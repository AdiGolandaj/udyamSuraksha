import {
  json,
  type LoaderFunction,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  PageHeader,
  SectionCard,
  StatTile,
  ErrorCard,
} from "~/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Grid, Box } from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import {
  Store,
  Package,
  Banknote,
  ShieldAlert,
  Clock,
  TrendingDown,
} from "lucide-react";
import { useTranslation } from "~/hooks/useTranslation";

export const meta: MetaFunction = () => [
  { title: "Regional Estimation | DisasterShield" },
];

interface EstimationLoaderData {
  regionCode: string;
  district: string;
  taluka: string;
  scenario: "FLOOD" | "POWER_OUTAGE" | "WINDSTORM" | "LANDSLIDE";
  metrics: {
    totalShops: number;
    totalStockValue: number;
    estimatedTotalLoss: number;
    highRiskShops: number;
    avgRecoveryDays: number;
    preventablePercentage: number;
  };
  sectorWiseLoss: Array<{
    category: string;
    shopCount: number;
    estimatedLoss: number;
    avgLossPerShop: number;
    mostCommonRisk: string;
  }>;
  areaWiseBreakdown: Array<{
    area: string;
    shopCount: number;
    highRiskCount: number;
    estimatedLoss: number;
    connectivity: string;
    roadAccess: string;
  }>;
  supplyChainRiskData: Array<{
    day: number;
    flood: number;
    powerOutage: number;
  }>;
  resourceRequirements: Array<{
    resource: string;
    estimatedNeed: number;
    basis: string;
  }>;
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const officer = await requireRole(request, "lrdb");

    if (officer.id !== params.officerId) {
      throw new Response("Unauthorized", { status: 403 });
    }

    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
      include: {
        user: true,
      },
    });

    if (!lrdbProfile) {
      throw new Response("LRDB profile not found", { status: 404 });
    }

    const url = new URL(request.url);
    const scenario =
      (url.searchParams.get("scenario") as any) || "FLOOD";

    // Fetch all shops in the region
    const shops = await db.shopProfile.findMany({
      where: {
        regionCode: lrdbProfile.regionCode,
      },
      include: {
        riskProfile: true,
        stockItems: {
          select: {
            estimatedValueInr: true,
          },
        },
        locationProfile: {
          select: {
            village: true,
            taluka: true,
            latitude: true,
            longitude: true,
            nearestWaterBodyDistanceMetres: true,
            nearestPavedRoadDistanceMetres: true,
            connectivityType: true,
            powerSupplyType: true,
          },
        },
      },
    });

    // Calculate metrics
    const totalShops = shops.length;
    const totalStockValue = shops.reduce((sum, shop) => {
      return (
        sum +
        shop.stockItems.reduce((s, item) => s + (item.estimatedValueInr || 0), 0)
      );
    }, 0);

    const highRiskShops = shops.filter(
      (s) => s.riskProfile?.riskLevel === "HIGH" || s.riskProfile?.riskLevel === "CRITICAL"
    ).length;

    // Estimate losses based on scenario
    let estimatedTotalLoss = 0;
    let avgRecoveryDays = 0;
    let preventablePercentage = 0;

    if (scenario === "FLOOD") {
      avgRecoveryDays = 8;
      preventablePercentage = 35;
      estimatedTotalLoss = Math.round(totalStockValue * 0.25);
    } else if (scenario === "POWER_OUTAGE") {
      avgRecoveryDays = 2;
      preventablePercentage = 45;
      estimatedTotalLoss = Math.round(totalStockValue * 0.08);
    } else if (scenario === "WINDSTORM") {
      avgRecoveryDays = 5;
      preventablePercentage = 25;
      estimatedTotalLoss = Math.round(totalStockValue * 0.15);
    } else if (scenario === "LANDSLIDE") {
      avgRecoveryDays = 12;
      preventablePercentage = 20;
      estimatedTotalLoss = Math.round(totalStockValue * 0.3);
    }

    // Group shops by category for sector-wise analysis
    const shopsByCategory = shops.reduce(
      (acc: any, shop) => {
        if (!acc[shop.category]) {
          acc[shop.category] = [];
        }
        acc[shop.category].push(shop);
        return acc;
      },
      {}
    );

    const sectorWiseLoss = Object.entries(shopsByCategory).map(
      ([category, categoryShops]: any) => {
        const categoryStockValue = categoryShops.reduce((sum: number, shop: any) => {
          return (
            sum +
            shop.stockItems.reduce(
              (s: number, item: any) => s + (item.estimatedValueInr || 0),
              0
            )
          );
        }, 0);

        const categoryLoss =
          scenario === "FLOOD"
            ? Math.round(categoryStockValue * 0.25)
            : scenario === "POWER_OUTAGE"
            ? Math.round(categoryStockValue * 0.08)
            : scenario === "WINDSTORM"
            ? Math.round(categoryStockValue * 0.15)
            : Math.round(categoryStockValue * 0.3);

        return {
          category,
          shopCount: categoryShops.length,
          estimatedLoss: categoryLoss,
          avgLossPerShop: Math.round(categoryLoss / categoryShops.length),
          mostCommonRisk: "Water-sensitive stock",
        };
      }
    );

    // Area-wise breakdown by taluka
    const shopsByArea = shops.reduce(
      (acc: any, shop) => {
        const area = shop.locationProfile?.taluka || "Unknown";
        if (!acc[area]) {
          acc[area] = [];
        }
        acc[area].push(shop);
        return acc;
      },
      {}
    );

    const areaWiseBreakdown = Object.entries(shopsByArea).map(
      ([area, areaShops]: any) => {
        const areaStockValue = areaShops.reduce((sum: number, shop: any) => {
          return (
            sum +
            shop.stockItems.reduce(
              (s: number, item: any) => s + (item.estimatedValueInr || 0),
              0
            )
          );
        }, 0);

        const areaLoss =
          scenario === "FLOOD"
            ? Math.round(areaStockValue * 0.25)
            : scenario === "POWER_OUTAGE"
            ? Math.round(areaStockValue * 0.08)
            : scenario === "WINDSTORM"
            ? Math.round(areaStockValue * 0.15)
            : Math.round(areaStockValue * 0.3);

        const highRiskCount = areaShops.filter(
          (s: any) => s.riskProfile?.riskLevel === "HIGH" || s.riskProfile?.riskLevel === "CRITICAL"
        ).length;

        return {
          area,
          shopCount: areaShops.length,
          highRiskCount,
          estimatedLoss: areaLoss,
          connectivity: "Good",
          roadAccess: "Accessible",
        };
      }
    );

    // Supply chain risk data (14 days post-disaster)
    const supplyChainRiskData = Array.from({ length: 14 }, (_, i) => ({
      day: i + 1,
      flood: Math.max(0, 100 - i * 7),
      powerOutage: Math.max(0, 100 - i * 15),
    }));

    // Resource requirements
    const criticalShops = shops.filter(
      (s) => s.riskProfile?.riskLevel === "CRITICAL"
    ).length;

    const resourceRequirements = [
      {
        resource: "Emergency relief kits",
        estimatedNeed: criticalShops,
        basis: "1 per shop with CRITICAL risk",
      },
      {
        resource: "Temporary storage capacity",
        estimatedNeed: Math.round(
          shops
            .filter((s) => s.riskProfile?.riskLevel === "HIGH" || s.riskProfile?.riskLevel === "CRITICAL")
            .length * 500
        ),
        basis: "~500 sq ft per high-risk shop",
      },
      {
        resource: "Generator units needed",
        estimatedNeed: shops.filter((s) => s.locationProfile?.powerSupplyType === "GRID").length,
        basis: "Shops dependent on grid power",
      },
      {
        resource: "Medical response teams",
        estimatedNeed: shops.filter((s) => (s.locationProfile?.latitude || 0) > 10).length > 5 ? 2 : 1,
        basis: "Based on remote shop count",
      },
      {
        resource: "Relief vehicle trips",
        estimatedNeed: Math.round(shops.length / 10),
        basis: "Based on shop distribution",
      },
    ];

    return json<EstimationLoaderData>({
      regionCode: lrdbProfile.regionCode,
      district: lrdbProfile.district,
      taluka: lrdbProfile.taluka ?? "",
      scenario,
      metrics: {
        totalShops,
        totalStockValue,
        estimatedTotalLoss,
        highRiskShops,
        avgRecoveryDays,
        preventablePercentage,
      },
      sectorWiseLoss: sectorWiseLoss.sort(
        (a, b) => b.estimatedLoss - a.estimatedLoss
      ),
      areaWiseBreakdown: areaWiseBreakdown.sort(
        (a, b) => b.estimatedLoss - a.estimatedLoss
      ),
      supplyChainRiskData,
      resourceRequirements,
    });
  } catch (error) {
    console.error("Estimation Loader Error:", error);
    throw error;
  }
};

export default function EstimationPage() {
  const data = useLoaderData<typeof loader>() as EstimationLoaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const scenario = searchParams.get("scenario") || "FLOOD";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t("regionalEstimation")}
        subtitle={t("financialImpactForecasting")}
        action={
          <Select
            value={scenario}
            onValueChange={(value) => {
              const params = new URLSearchParams(searchParams);
              params.set("scenario", value);
              setSearchParams(params);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FLOOD">{t("flood")}</SelectItem>
              <SelectItem value="POWER_OUTAGE">{t("powerOutage")}</SelectItem>
              <SelectItem value="WINDSTORM">{t("windstorm")}</SelectItem>
              <SelectItem value="LANDSLIDE">{t("landslide")}</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Region Overview Tiles */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatTile
            label={t("totalShops")}
            value={data.metrics.totalShops}
            icon={Store}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatTile
            label={t("totalStockValue")}
            value={`₹${(data.metrics.totalStockValue / 100000).toFixed(1)}L`}
            icon={Package}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatTile
            label={t("estimatedTotalLoss")}
            value={`₹${(data.metrics.estimatedTotalLoss / 100000).toFixed(1)}L`}
            icon={Banknote}
            variant="danger"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatTile
            label={t("shopsAtHighRisk")}
            value={data.metrics.highRiskShops}
            icon={ShieldAlert}
            variant="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatTile
            label={t("avgRecoveryDays")}
            value={data.metrics.avgRecoveryDays}
            icon={Clock}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatTile
            label={t("preventableLossPercentage")}
            value={`${data.metrics.preventablePercentage}%`}
            icon={TrendingDown}
            variant="success"
          />
        </Grid>
      </Grid>

      {/* Sector-Wise Loss Analysis */}
      <SectionCard title={t("lossByBusinessSector")}>
        <Box sx={{ height: 300, mb: 4 }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.sectorWiseLoss.map(s => ({ name: s.category, loss: s.estimatedLoss }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="loss" name="Estimated Loss" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("category")}</TableHead>
              <TableHead>{t("shopCount")}</TableHead>
              <TableHead>{t("totalEstimatedLoss")}</TableHead>
              <TableHead>{t("avgLossPerShop")}</TableHead>
              <TableHead>{t("mostCommonRisk")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sectorWiseLoss.map((sector) => (
              <TableRow key={sector.category}>
                <TableCell className="font-medium">{sector.category}</TableCell>
                <TableCell>{sector.shopCount}</TableCell>
                <TableCell>
                  ₹{(sector.estimatedLoss / 100000).toFixed(1)}L
                </TableCell>
                <TableCell>
                  ₹{(sector.avgLossPerShop / 1000).toFixed(0)}K
                </TableCell>
                <TableCell>{sector.mostCommonRisk}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Area-Wise Breakdown */}
      <SectionCard title={t("lossByArea")}>
        <Box sx={{ height: 300, mb: 4 }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.areaWiseBreakdown.map(a => ({ name: a.area, loss: a.estimatedLoss }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="loss" name="Estimated Loss" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("area")}</TableHead>
              <TableHead>{t("shops")}</TableHead>
              <TableHead>{t("highRiskShops")}</TableHead>
              <TableHead>{t("estimatedLoss")}</TableHead>
              <TableHead>{t("connectivity")}</TableHead>
              <TableHead>{t("roadAccess")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.areaWiseBreakdown.map((area) => (
              <TableRow key={area.area}>
                <TableCell className="font-medium">{area.area}</TableCell>
                <TableCell>{area.shopCount}</TableCell>
                <TableCell>{area.highRiskCount}</TableCell>
                <TableCell>
                  ₹{(area.estimatedLoss / 100000).toFixed(1)}L
                </TableCell>
                <TableCell>{area.connectivity}</TableCell>
                <TableCell>{area.roadAccess}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Supply Chain Risk */}
      <SectionCard title={t("supplyChainDisruptionAnalysis")}>
        <Box sx={{ height: 300, mb: 4 }}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.supplyChainRiskData.map(d => ({ day: d.day, flood: d.flood, powerOutage: d.powerOutage }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" label={{ value: 'Days post-disaster', position: 'insideBottom' }} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="flood" name="Flood Scenario" stroke="#ef4444" />
              <Line type="monotone" dataKey="powerOutage" name="Power Outage Scenario" stroke="#f59e0b" />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </SectionCard>

      {/* Resource Planning */}
      <SectionCard title={t("resourceRequirements")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("resource")}</TableHead>
              <TableHead>{t("estimatedNeed")}</TableHead>
              <TableHead>{t("basis")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.resourceRequirements.map((req) => (
              <TableRow key={req.resource}>
                <TableCell className="font-medium">{req.resource}</TableCell>
                <TableCell className="font-semibold">{req.estimatedNeed}</TableCell>
                <TableCell>{req.basis}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorCard
        title={`${error.status} Error`}
        message={error.statusText || "An error occurred"}
      />
    );
  }

  return <ErrorCard title="Error" message="An unexpected error occurred" />;
}

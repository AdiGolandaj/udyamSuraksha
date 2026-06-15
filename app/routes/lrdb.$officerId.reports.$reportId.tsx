import {
  json,
  type LoaderFunction,
  type ActionFunction,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import { useState } from "react";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  PageHeader,
  SectionCard,
  StatTile,
  ErrorCard,
} from "~/components/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Grid, Box } from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import {
  FileBarChart,
  CheckCircle,
  AlertOctagon,
  TrendingDown,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "~/hooks/useTranslation";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = ({ data }: any) => [
  {
    title: `${data?.report?.title || "Report"} | DisasterShield`,
  },
];

interface ReportDetailData {
  id: string;
  title: string;
  disasterType: string;
  affectedZone: string;
  reportDate: string;
  summary: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  publishedBy: {
    name: string | null;
  } | null;
  regionCode: string;
  reportMetrics: Array<{
    id: string;
    metricKey: string;
    metricValue: number;
    metricLabel: string;
  }>;
  affectedShops: Array<{
    id: string;
    shopName: string;
    category: string;
    location: string;
    estimatedLoss: number;
    primaryDamage: string;
    recoveryStatus: "RECOVERED" | "PARTIAL" | "DISRUPTED";
    queryRaised: boolean;
  }>;
}

interface ReportDetailLoaderData {
  report: ReportDetailData;
  isEditable: boolean;
}

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const officer = await requireRole(request, "lrdb");

    if (officer.id !== params.officerId) {
      throw new Response("Unauthorized", { status: 403 });
    }

    const lrdbProfile = await db.lRDBOfficer.findUnique({
      where: { userId: officer.id },
    });

    if (!lrdbProfile) {
      throw new Response("LRDB profile not found", { status: 404 });
    }

    const report = await db.disasterReport.findUnique({
      where: { id: params.reportId },
      include: {
        reportMetrics: true,
        publishedBy: { select: { name: true } },
        affectedShops: {
          select: {
            id: true,
            shopProfile: {
              select: {
                id: true,
                shopName: true,
                category: true,
                locationProfile: {
                  select: { village: true, taluka: true },
                },
              },
            },
            estimatedLoss: true,
            primaryDamageType: true,
            recoveryStatus: true,
          },
        },
      },
    });

    if (!report) {
      throw new Response("Report not found", { status: 404 });
    }

    if (report.affectedRegionCode !== lrdbProfile.regionCode) {
      throw new Response("Unauthorized", { status: 403 });
    }

    return json<ReportDetailLoaderData>({
      report: {
        id: report.id,
        title: report.title,
        disasterType: report.disasterType,
        affectedZone: report.affectedZone,
        reportDate: report.reportDate.toISOString(),
        summary: report.summary ?? '',
        status: report.status,
        publishedAt: report.publishedAt?.toISOString() || null,
        publishedBy: report.publishedBy,
        regionCode: report.affectedRegionCode,
        reportMetrics: report.reportMetrics.map((m) => ({
          id: m.id,
          metricKey: m.metricKey,
          metricValue: m.metricValue,
          metricLabel: m.metricLabel || m.metricKey,
        })),
        affectedShops: report.affectedShops.map((s: any) => ({
          id: s.id,
          shopName: s.shopProfile.shopName,
          category: s.shopProfile.category,
          location: `${s.shopProfile.locationProfile?.village}, ${s.shopProfile.locationProfile?.taluka}`,
          estimatedLoss: s.estimatedLoss,
          primaryDamage: s.primaryDamageType,
          recoveryStatus: s.recoveryStatus,
          queryRaised: false,
        })),
      },
      isEditable: report.status === "DRAFT",
    });
  } catch (error) {
    console.error("Report Detail Loader Error:", error);
    throw error;
  }
};

export const action: ActionFunction = async ({ request, params }) => {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const officer = await requireRole(request, "lrdb");

  if (officer.id !== params.officerId) {
    throw new Response("Unauthorized", { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "publish-report") {
    await db.disasterReport.update({
      where: { id: params.reportId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedByUserId: officer.id,
      },
    });

    return json({ success: true });
  }

  if (intent === "update-summary") {
    const summary = formData.get("summary");
    await db.disasterReport.update({
      where: { id: params.reportId },
      data: { summary: String(summary) },
    });

    return json({ success: true });
  }

  throw new Response("Unknown action", { status: 400 });
};

export default function ReportDetailPage() {
  const { report, isEditable } = useLoaderData<ReportDetailLoaderData>();
  const fetcher = useFetcher();
  const { t } = useTranslation();
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);

  const totalShopsAffected =
    report.reportMetrics.find((m) => m.metricKey === "total_shops_affected")
      ?.metricValue || 0;
  const totalEstimatedLoss =
    report.reportMetrics.find((m) => m.metricKey === "estimated_loss_inr")
      ?.metricValue || 0;
  const recoveredShops =
    report.reportMetrics.find((m) => m.metricKey === "recovered_shops")
      ?.metricValue || 0;
  const disruptedShops =
    report.reportMetrics.find((m) => m.metricKey === "disrupted_shops")
      ?.metricValue || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={report.title}
        subtitle={report.affectedZone}
        breadcrumb={[{ label: 'Reports' }, { label: report.title }]}
        action={
          isEditable && (
            <fetcher.Form method="post" className="flex gap-2">
              <Button
                type="submit"
                name="intent"
                value="publish-report"
                variant="destructive"
              >
                {t("publishReport")}
              </Button>
              <Button variant="outline">{t("editReport")}</Button>
            </fetcher.Form>
          )
        }
      />

      {/* Overview Section */}
      <SectionCard title={t("eventOverview")}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("disasterType")}</p>
              <p className="text-base font-medium">{report.disasterType}</p>

              <p className="text-sm text-muted-foreground mt-3">{t("affectedZone")}</p>
              <p className="text-base font-medium">{report.affectedZone}</p>

              <p className="text-sm text-muted-foreground mt-3">{t("reportDate")}</p>
              <p className="text-base font-medium">
                {format(new Date(report.reportDate), "PPP")}
              </p>
            </div>
          </Grid>

          <Grid item xs={12} md={6}>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("summary")}</p>
              <p className="text-base">{report.summary}</p>

              {report.publishedAt && report.publishedBy && (
                <>
                  <p className="text-sm text-muted-foreground mt-3">
                    {t("publishedBy")}
                  </p>
                  <p className="text-base font-medium">
                    {report.publishedBy.name} on{" "}
                    {format(new Date(report.publishedAt), "PPP")}
                  </p>
                </>
              )}
            </div>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Impact Metrics */}
      <SectionCard title={t("impactSummary")}>
        <Grid container spacing={2} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <StatTile
              title={t("totalShopsAffected")}
              value={totalShopsAffected}
              variant="default"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatTile
              title={t("totalEstimatedLoss")}
              value={`₹${(totalEstimatedLoss / 100000).toFixed(1)}L`}
              variant="danger"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatTile
              title={t("fullyOperational")}
              value={recoveredShops}
              variant="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatTile
              title={t("fullyDisrupted")}
              value={disruptedShops}
              variant="danger"
            />
          </Grid>
        </Grid>

        {/* Recovery Status Pie Chart */}
        <Box sx={{ height: 300, mb: 4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "Recovered", value: recoveredShops },
                  { name: "Partial", value: totalShopsAffected - recoveredShops - disruptedShops },
                  { name: "Disrupted", value: disruptedShops },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#f59e0b" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </SectionCard>

      {/* Affected Shops */}
      <SectionCard title={t("affectedBusinesses")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("shop")}</TableHead>
              <TableHead>{t("location")}</TableHead>
              <TableHead>{t("estimatedLoss")}</TableHead>
              <TableHead>{t("primaryDamage")}</TableHead>
              <TableHead>{t("recoveryStatus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.affectedShops.map((shop) => (
              <TableRow key={shop.id}>
                <TableCell className="font-medium">{shop.shopName}</TableCell>
                <TableCell>{shop.location}</TableCell>
                <TableCell>₹{(shop.estimatedLoss / 100000).toFixed(1)}L</TableCell>
                <TableCell>{shop.primaryDamage}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      shop.recoveryStatus === "RECOVERED"
                        ? "bg-green-100 text-green-800"
                        : shop.recoveryStatus === "PARTIAL"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {shop.recoveryStatus}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Export Button */}
      <div className="flex gap-2">
        <Button variant="outline" className="gap-2">
          <Download className="size-4" />
          {t("exportReport")}
        </Button>
      </div>
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

import {
  json,
  type LoaderFunction,
  type ActionFunction,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
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
  RiskBadge,
  EmptyState,
  LoadingSkeleton,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Grid, Box } from "@mui/material";
import {
  FileBarChart,
  CheckCircle,
  FilePen,
  Banknote,
  Plus,
} from "lucide-react";
import { Link } from "@remix-run/react";
import { format } from "date-fns";
import { useTranslation } from "~/hooks/useTranslation";

export const meta: MetaFunction = () => [
  { title: "Disaster Reports | DisasterShield" },
];

interface ReportData {
  id: string;
  title: string;
  disasterType: string;
  affectedZone: string;
  reportDate: string;
  summary: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  publishedBy: {
    name: string | null;
  } | null;
  reportMetrics: Array<{
    id: string;
    metricKey: string;
    metricValue: number;
  }>;
}

interface ReportsLoaderData {
  regionCode: string;
  district: string;
  reports: ReportData[];
  stats: {
    totalReports: number;
    published: number;
    drafts: number;
    totalEstimatedLoss: number;
  };
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

    const url = new URL(request.url);
    const searchQuery = url.searchParams.get("search")?.toLowerCase() || "";
    const statusFilter = url.searchParams.get("status");
    const disasterTypeFilter = url.searchParams.get("disasterType");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");

    const whereClause: any = {
      affectedRegionCode: lrdbProfile.regionCode,
    };

    if (searchQuery) {
      whereClause.OR = [
        { title: { contains: searchQuery, mode: "insensitive" } },
        { summary: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    if (statusFilter && statusFilter !== "all") {
      whereClause.status = statusFilter;
    }

    if (disasterTypeFilter && disasterTypeFilter !== "all") {
      whereClause.disasterType = disasterTypeFilter;
    }

    if (fromDate) {
      whereClause.reportDate = {
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      if (whereClause.reportDate) {
        whereClause.reportDate.lte = new Date(toDate);
      } else {
        whereClause.reportDate = {
          lte: new Date(toDate),
        };
      }
    }

    // Fetch all reports
    const allReports = await db.disasterReport.findMany({
      where: whereClause,
      include: {
        reportMetrics: true,
        publishedBy: { select: { name: true } },
      },
      orderBy: { reportDate: "desc" },
    });

    // Calculate stats
    const statsWhereClause: any = {
      affectedRegionCode: lrdbProfile.regionCode,
    };

    const allReportsForStats = await db.disasterReport.findMany({
      where: statsWhereClause,
      include: { reportMetrics: true },
    });

    const totalEstimatedLoss = allReportsForStats.reduce((sum, report) => {
      const lossMetric = report.reportMetrics.find(
        (m) => m.metricKey === "estimated_loss_inr"
      );
      return sum + (lossMetric?.metricValue || 0);
    }, 0);

    return json<ReportsLoaderData>({
      regionCode: lrdbProfile.regionCode,
      district: lrdbProfile.district,
      reports: allReports.map((r) => ({
        id: r.id,
        title: r.title,
        disasterType: r.disasterType,
        affectedZone: r.affectedZone,
        reportDate: r.reportDate.toISOString(),
        summary: r.summary,
        status: r.status,
        publishedAt: r.publishedAt?.toISOString() || null,
        publishedBy: r.publishedBy,
        reportMetrics: r.reportMetrics,
      })),
      stats: {
        totalReports: allReportsForStats.length,
        published: allReportsForStats.filter((r) => r.status === "PUBLISHED")
          .length,
        drafts: allReportsForStats.filter((r) => r.status === "DRAFT").length,
        totalEstimatedLoss,
      },
    });
  } catch (error) {
    console.error("Reports Loader Error:", error);
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
    const reportId = formData.get("reportId");

    await db.disasterReport.update({
      where: { id: String(reportId) },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedByUserId: officer.id,
      },
    });

    return json({ success: true });
  }

  throw new Response("Unknown action", { status: 400 });
};

export default function ReportsPage() {
  const { regionCode, district, reports, stats } =
    useLoaderData<ReportsLoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();
  const { t } = useTranslation();

  const currentStatus = searchParams.get("status") || "all";

  const filteredReports =
    currentStatus === "all"
      ? reports
      : reports.filter((r) => r.status === currentStatus);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t("disasterReports")}
        subtitle={t("postEventAnalysis")}
        action={
          <Button size="sm" className="gap-2">
            <Plus className="size-4" />
            {t("createReport")}
          </Button>
        }
      />

      {/* Stats Tiles */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            title={t("totalReports")}
            value={stats.totalReports}
            icon={FileBarChart}
            variant="default"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            title={t("published")}
            value={stats.published}
            icon={CheckCircle}
            variant="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            title={t("drafts")}
            value={stats.drafts}
            icon={FilePen}
            variant="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            title={t("totalEstimatedLoss")}
            value={`₹${(stats.totalEstimatedLoss / 100000).toFixed(1)}L`}
            icon={Banknote}
            variant="danger"
          />
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <SectionCard className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <Input
            placeholder={t("search")}
            defaultValue={searchParams.get("search") || ""}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set("search", e.target.value);
              } else {
                params.delete("search");
              }
              setSearchParams(params);
            }}
            className="max-w-xs"
          />

          <Select
            defaultValue={searchParams.get("disasterType") || "all"}
            onValueChange={(value) => {
              const params = new URLSearchParams(searchParams);
              if (value !== "all") {
                params.set("disasterType", value);
              } else {
                params.delete("disasterType");
              }
              setSearchParams(params);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="FLOOD">{t("flood")}</SelectItem>
              <SelectItem value="WIND">{t("wind")}</SelectItem>
              <SelectItem value="POWER_OUTAGE">{t("powerOutage")}</SelectItem>
              <SelectItem value="LANDSLIDE">{t("landslide")}</SelectItem>
              <SelectItem value="OTHER">{t("other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* Status Tabs */}
      <Tabs
        value={currentStatus}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams);
          if (value !== "all") {
            params.set("status", value);
          } else {
            params.delete("status");
          }
          setSearchParams(params);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
          <TabsTrigger value="DRAFT">{t("draft")}</TabsTrigger>
          <TabsTrigger value="PUBLISHED">{t("published")}</TabsTrigger>
          <TabsTrigger value="ARCHIVED">{t("archived")}</TabsTrigger>
        </TabsList>

        <TabsContent value={currentStatus} className="space-y-4">
          {filteredReports.length === 0 ? (
            <EmptyState
              icon={FileBarChart}
              title={t("noReports")}
              description={t("createYourFirstReport")}
            />
          ) : (
            <SectionCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("title")}</TableHead>
                    <TableHead>{t("disasterType")}</TableHead>
                    <TableHead>{t("affectedZone")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("estimatedLoss")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        {report.title}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-muted">
                          {report.disasterType}
                        </span>
                      </TableCell>
                      <TableCell>{report.affectedZone}</TableCell>
                      <TableCell>
                        {format(new Date(report.reportDate), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const loss = report.reportMetrics.find(
                            (m) => m.metricKey === "estimated_loss_inr"
                          );
                          return loss
                            ? `₹${(loss.metricValue / 100000).toFixed(1)}L`
                            : "—";
                        })()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            report.status === "PUBLISHED"
                              ? "bg-green-100 text-green-800"
                              : report.status === "DRAFT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {report.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link to={`./reports/${report.id}`}>
                          <Button variant="ghost" size="sm">
                            {t("view")}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          )}
        </TabsContent>
      </Tabs>
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

import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarClock,
  Clock3,
  FileText,
  MonitorSmartphone,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import FeedbackMessage from "../components/FeedbackMessage";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { dashboardService } from "../features/dashboard/services/dashboard.service";
import type { DashboardSummary } from "../types/dashboard";
import type { ContentType } from "../types/content";
import { getErrorMessage } from "../utils/getErrorMessage";

type AlertLevel = "critical" | "warning" | "info";

type OperationalAlert = {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
  actionState?: unknown;
};

type MetricTone = "default" | "positive" | "warning" | "critical" | "info";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  image: "Imágenes",
  video: "Videos",
  news: "Noticias",
  advertisement: "Publicidades",
  pdf: "PDFs",
};

function getMetricValueClass(tone: MetricTone) {
  if (tone === "positive") return "text-[#0f7a3a]";
  if (tone === "warning") return "text-[#8f5b0a]";
  if (tone === "critical") return "text-(--color-red-main)";
  if (tone === "info") return "text-[#1f5dbd]";
  return "text-(--color-text-main)";
}

function getAlertContainerClass(level: AlertLevel) {
  if (level === "critical") {
    return "border-[#f3c2cb] bg-[#fff6f8]";
  }

  if (level === "warning") {
    return "border-[#f1d7aa] bg-[#fff8ee]";
  }

  return "border-[#c8daf7] bg-[#f3f7ff]";
}

function getAlertIconClass(level: AlertLevel) {
  if (level === "critical") {
    return "border-[#f3c2cb] bg-[#fdebef] text-(--color-red-main)";
  }

  if (level === "warning") {
    return "border-[#f1d7aa] bg-[#fff0da] text-[#8f5b0a]";
  }

  return "border-[#c8daf7] bg-[#eaf2ff] text-[#1f5dbd]";
}

function buildOperationalAlerts(
  summary: DashboardSummary,
  isSuperAdmin: boolean,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const metrics = summary.metrics;

  if (metrics.totems.activeOffline > 0) {
    alerts.push({
      id: "totems-active-offline",
      level: "critical",
      title: "Tótems activos sin conexión",
      description: `Hay ${metrics.totems.activeOffline} tótems activos que están fuera de línea.`,
      actionLabel: "Revisar tótems",
      actionPath: "/admin/totems",
      actionState: {
        dashboardFilters: {
          state: "active",
          connectionStatus: "offline",
        },
      },
    });
  }

  if (metrics.assignments.expired > 0) {
    alerts.push({
      id: "assignments-expired",
      level: "warning",
      title: "Asignaciones expiradas",
      description: `Hay ${metrics.assignments.expired} asignaciones con vigencia finalizada.`,
      actionLabel: "Revisar asignaciones",
      actionPath: "/admin/assignments",
      actionState: {
        dashboardFilters: {
          status: "expired",
        },
      },
    });
  }

  if (metrics.assignments.expiringSoon > 0) {
    alerts.push({
      id: "assignments-expiring-soon",
      level: "info",
      title: "Asignaciones próximas a expirar",
      description: `${metrics.assignments.expiringSoon} asignaciones activas expiran dentro de ${summary.thresholds.assignmentExpiringSoonHours} horas.`,
      actionLabel: "Revisar asignaciones",
      actionPath: "/admin/assignments?status=expiringSoon",
      actionState: {
        dashboardFilters: {
          status: "expiringSoon",
        },
      },
    });
  }

  if (metrics.notifications.urgentActive > 0) {
    alerts.push({
      id: "urgent-notifications",
      level: "warning",
      title: "Notificaciones urgentes activas",
      description: `Hay ${metrics.notifications.urgentActive} notificaciones urgentes actualmente visibles.`,
      actionLabel: "Revisar notificaciones",
      actionPath: "/admin/notifications",
      actionState: {
        dashboardFilters: {
          type: "urgent",
          status: "active",
        },
      },
    });
  }

  if (metrics.contents.activeWithoutAssignment > 0) {
    alerts.push({
      id: "unassigned-contents",
      level: "info",
      title: "Contenidos activos sin asignar",
      description: `${metrics.contents.activeWithoutAssignment} contenidos activos todavía no tienen asignación.`,
      actionLabel: "Revisar contenidos",
      actionPath: "/admin/contents?status=active&operationalStatus=activeWithoutAssignment",
      actionState: {
        dashboardFilters: {
          status: "active",
          operationalStatus: "activeWithoutAssignment",
        },
      },
    });
  }

  if (metrics.contents.activeWithUnavailableFile > 0) {
    alerts.push({
      id: "contents-with-unavailable-file",
      level: "warning",
      title: "Contenidos con archivo no disponible",
      description: `Hay ${metrics.contents.activeWithUnavailableFile} contenidos activos cuyo archivo no se encuentra disponible.`,
      actionLabel: "Revisar contenidos",
      actionPath: "/admin/contents?status=active&operationalStatus=activeWithUnavailableFile",
      actionState: {
        dashboardFilters: {
          status: "active",
          operationalStatus: "activeWithUnavailableFile",
        },
      },
    });
  }

  if (isSuperAdmin && metrics.users && metrics.users.pendingInvited > 0) {
    alerts.push({
      id: "pending-invites",
      level: "info",
      title: "Invitaciones de usuario pendientes",
      description: `Hay ${metrics.users.pendingInvited} usuarios invitados pendientes de activación.`,
      actionLabel: "Revisar usuarios",
      actionPath: "/admin/users",
      actionState: {
        dashboardFilters: {
          status: "invited",
        },
      },
    });
  }

  return alerts;
}

function MetricRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: MetricTone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f0f0f1] bg-[#fcfcfd] px-3 py-2">
      <p className="text-xs text-(--color-text-secondary)">{label}</p>
      <p className={`text-sm font-bold ${getMetricValueClass(tone)}`}>{value}</p>
    </div>
  );
}

function MetricsGroupCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof MonitorSmartphone;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-(--color-border) bg-(--color-card) p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-bold text-(--color-text-main)">{title}</h3>
          <p className="text-xs text-(--color-text-secondary)">{subtitle}</p>
        </div>

        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f5f8] text-(--color-text-secondary)">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-2">{children}</div>
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const summaryRequestIdRef = useRef(0);
  const summaryAbortControllerRef = useRef<AbortController | null>(null);

  const isSuperAdmin = user?.role === "SuperAdmin";

  const operationalAlerts = useMemo(() => {
    if (!summary) {
      return [];
    }

    return buildOperationalAlerts(summary, isSuperAdmin);
  }, [summary, isSuperAdmin]);

  async function loadSummary() {
    const requestId = summaryRequestIdRef.current + 1;
    summaryRequestIdRef.current = requestId;
    summaryAbortControllerRef.current?.abort();
    const requestAbortController = new AbortController();
    summaryAbortControllerRef.current = requestAbortController;

    setLoading(true);
    setError("");

    try {
      const response = await dashboardService.getSummary({
        signal: requestAbortController.signal,
      });
      if (summaryRequestIdRef.current !== requestId) {
        return;
      }
      setSummary(response.data);
    } catch (err) {
      if (
        summaryRequestIdRef.current !== requestId
        || requestAbortController.signal.aborted
      ) {
        return;
      }
      setSummary(null);
      setError(getErrorMessage(err, "No se pudo cargar el dashboard"));
    } finally {
      if (summaryAbortControllerRef.current === requestAbortController) {
        summaryAbortControllerRef.current = null;
      }

      if (summaryRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadSummary();

    return () => {
      summaryAbortControllerRef.current?.abort();
      summaryAbortControllerRef.current = null;
      summaryRequestIdRef.current += 1;
    };
  }, []);

  return (
    <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {error && (
          <FeedbackMessage
            type="error"
            message={error}
            onClose={() => setError("")}
          />
        )}

        {loading ? (
          <LoadingState message="Cargando información del dashboard..." />
        ) : !summary ? (
          <EmptyState
            title="No se pudo cargar el dashboard"
            description="Intenta nuevamente más tarde o refresca la página."
          />
        ) : (
          <section className="space-y-4">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-(--color-text-main)">
                  Dashboard
                </h1>
                <p className="text-xs text-(--color-text-secondary) sm:text-xs">
                  Vista operativa del sistema para tomar decisiones rápidas.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 text-xs text-(--color-text-secondary) sm:items-end">
                <button
                  type="button"
                  onClick={() => void loadSummary()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-(--color-border) bg-white px-4 py-1.5 text-xs font-semibold text-(--color-text-main) transition hover:border-(--color-red-main)/40 hover:bg-[#fff6f8] hover:text-(--color-red-main)"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar datos
                </button>
              </div>
            </header>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <MetricsGroupCard
                title="Tótems"
                subtitle="Estado de registro y conexión"
                icon={MonitorSmartphone}
              >
                <MetricRow label="Tótems registrados" value={summary.metrics.totems.total} />
                <MetricRow label="Tótems activos" value={summary.metrics.totems.active} tone="positive" />
                <MetricRow label="Tótems inactivos" value={summary.metrics.totems.inactive} />
                <MetricRow label="Tótems en línea" value={summary.metrics.totems.online} tone="info" />
                <MetricRow
                  label="Tótems activos fuera de línea"
                  value={summary.metrics.totems.activeOffline}
                  tone={summary.metrics.totems.activeOffline > 0 ? "critical" : "positive"}
                />
                <MetricRow
                  label="Activos sin registro de conexión"
                  value={summary.metrics.totems.withoutConnectionRecord}
                  tone={summary.metrics.totems.withoutConnectionRecord > 0 ? "warning" : "default"}
                />
              </MetricsGroupCard>

              <MetricsGroupCard
                title="Contenidos"
                subtitle="Inventario activo por tipo"
                icon={FileText}
              >
                <MetricRow label="Contenidos activos" value={summary.metrics.contents.active} />
                <MetricRow label={CONTENT_TYPE_LABELS.image} value={summary.metrics.contents.activeByType.image} />
                <MetricRow label={CONTENT_TYPE_LABELS.video} value={summary.metrics.contents.activeByType.video} />
                <MetricRow label={CONTENT_TYPE_LABELS.news} value={summary.metrics.contents.activeByType.news} />
                <MetricRow
                  label={CONTENT_TYPE_LABELS.advertisement}
                  value={summary.metrics.contents.activeByType.advertisement}
                />
                <MetricRow label={CONTENT_TYPE_LABELS.pdf} value={summary.metrics.contents.activeByType.pdf} />
              </MetricsGroupCard>

              <MetricsGroupCard
                title="Asignaciones"
                subtitle="Vigencia de contenidos asignados"
                icon={CalendarClock}
              >
                <MetricRow label="Asignaciones activas" value={summary.metrics.assignments.active} tone="positive" />
                <MetricRow
                  label="Asignaciones programadas"
                  value={summary.metrics.assignments.scheduled}
                  tone="info"
                />
                <MetricRow
                  label="Asignaciones expiradas"
                  value={summary.metrics.assignments.expired}
                  tone={summary.metrics.assignments.expired > 0 ? "warning" : "positive"}
                />
                <MetricRow
                  label={`Asignaciones próximas a expirar (${summary.thresholds.assignmentExpiringSoonHours}h)`}
                  value={summary.metrics.assignments.expiringSoon}
                  tone={summary.metrics.assignments.expiringSoon > 0 ? "warning" : "default"}
                />
              </MetricsGroupCard>

              <MetricsGroupCard
                title="Notificaciones"
                subtitle="Seguimiento por estado operativo"
                icon={BellRing}
              >
                <MetricRow label="Notificaciones activas" value={summary.metrics.notifications.active} />
                <MetricRow
                  label="Notificaciones urgentes activas"
                  value={summary.metrics.notifications.urgentActive}
                  tone={summary.metrics.notifications.urgentActive > 0 ? "critical" : "positive"}
                />
                <MetricRow label="Notificaciones programadas" value={summary.metrics.notifications.scheduled} tone="info" />
                <MetricRow
                  label="Notificaciones finalizadas o expiradas"
                  value={summary.metrics.notifications.finishedOrExpired}
                />
              </MetricsGroupCard>

              {isSuperAdmin && summary.metrics.users && (
                <div className="xl:col-span-2">
                  <MetricsGroupCard
                    title="Usuarios"
                    subtitle="Gestión de acceso administrativo"
                    icon={Users}
                  >
                    <MetricRow label="Usuarios activos" value={summary.metrics.users.active} />
                    <MetricRow
                      label="Usuarios invitados pendientes"
                      value={summary.metrics.users.pendingInvited}
                      tone={summary.metrics.users.pendingInvited > 0 ? "warning" : "positive"}
                    />
                  </MetricsGroupCard>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <article className="rounded-2xl border border-(--color-border) bg-(--color-card) p-4">
                <header className="mb-3">
                  <h2 className="text-lg font-bold text-(--color-text-main)">
                    Alertas operativas
                  </h2>
                  <p className="text-xs text-(--color-text-secondary)">
                    Indicadores para atención rápida.
                  </p>
                </header>

                {operationalAlerts.length === 0 ? (
                  <section className="flex min-h-40 items-center justify-center rounded-2xl border border-[#d6ebdf] bg-[#f3fbf7] p-5 text-center">
                    <div className="space-y-2">
                      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#dff3e7] text-[#0f7a3a]">
                        <Activity className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-[#0f7a3a]">
                        Todo está funcionando correctamente.
                      </p>
                    </div>
                  </section>
                ) : (
                  <div className="space-y-3">
                    {operationalAlerts.map((alert) => (
                      <article
                        key={alert.id}
                        className={`rounded-2xl border p-3 ${getAlertContainerClass(alert.level)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border ${getAlertIconClass(
                              alert.level,
                            )}`}
                          >
                            {alert.level === "critical" ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : alert.level === "warning" ? (
                              <Clock3 className="h-4 w-4" />
                            ) : (
                              <Radio className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <h3 className="text-sm font-semibold text-(--color-text-main)">
                              {alert.title}
                            </h3>
                            <p className="text-xs text-(--color-text-secondary)">
                              {alert.description}
                            </p>
                            <Link
                              to={alert.actionPath}
                              state={alert.actionState}
                              className="inline-flex items-center gap-1 rounded-full border border-(--color-border) bg-white px-3 py-1.5 text-xs font-semibold text-(--color-text-main) transition hover:border-(--color-red-main)/35 hover:bg-[#fff5f7] hover:text-(--color-red-main)"
                            >
                              {alert.level === "critical" ? (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              ) : (
                                <CalendarClock className="h-3.5 w-3.5" />
                              )}
                              {alert.actionLabel}
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}

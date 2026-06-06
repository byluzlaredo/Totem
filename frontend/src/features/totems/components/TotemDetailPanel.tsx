import {
  Activity,
  Building2,
  CalendarDays,
  Cable,
  Check,
  Clock3,
  Copy,
  FileText,
  KeyRound,
  Pencil,
  RefreshCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import FeedbackMessage from "../../../components/FeedbackMessage";
import LoadingState from "../../../components/LoadingState";
import SafeText from "../../../components/SafeText";
import SideDrawer from "../../../components/SideDrawer";
import type { Totem, TotemLinkingCodeResponse } from "../../../types/totem";
import { copyTextToClipboard } from "../../../utils/clipboard";
import { getErrorMessage } from "../../../utils/getErrorMessage";
import { totemService } from "../services/totem.service";

interface TotemDetailPanelProps {
  isOpen: boolean;
  totemId: number | null;
  initialTotem?: Totem | null;
  onClose: () => void;
  onEdit?: (totem: Totem) => void;
}

const DETAIL_ITEM_CLASS =
  "flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 py-2 [&>div]:min-w-0";

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatRemainingTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "Expirado";
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${seconds}s`;
}

function getConnectionBadgeClass(connectionStatus: Totem["connectionStatus"]) {
  if (connectionStatus === "online") return "bg-[#c9eed8] text-[#0f7a3a]";

  return "bg-[#ececef] text-[#5e6470]";
}

function getConnectionBadgeLabel(connectionStatus: Totem["connectionStatus"]) {
  if (connectionStatus === "online") return "En línea";

  return "Fuera de línea";
}

function getLinkingCodeStatusLabel(status: TotemLinkingCodeResponse["status"]) {
  if (status === "active") return "Activo";
  if (status === "expired") return "Vencido";
  if (status === "used") return "Usado";
  return "Sin código";
}

function getLinkingCodeStatusClass(status: TotemLinkingCodeResponse["status"]) {
  if (status === "active") return "bg-[#c9eed8] text-[#0f7a3a]";
  if (status === "expired") return "bg-[#fff5e7] text-[#a86418]";
  if (status === "used") return "bg-[#f4e8ff] text-[#6f33a8]";
  return "bg-[#ececef] text-[#5e6470]";
}

export default function TotemDetailPanel({
  isOpen,
  totemId,
  initialTotem = null,
  onClose,
  onEdit,
}: TotemDetailPanelProps) {
  const [totem, setTotem] = useState<Totem | null>(null);
  const [linkingCode, setLinkingCode] = useState<TotemLinkingCodeResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [selectedTtlMinutes, setSelectedTtlMinutes] = useState(10);
  const [clockTick, setClockTick] = useState(0);
  const [detailCopyState, setDetailCopyState] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const detailCopyResetTimeoutRef = useRef<number | null>(null);
  const loadRequestIdRef = useRef(0);

  function clearDetailCopyResetTimeout() {
    if (detailCopyResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(detailCopyResetTimeoutRef.current);
    detailCopyResetTimeoutRef.current = null;
  }

  function scheduleDetailCopyReset() {
    clearDetailCopyResetTimeout();

    detailCopyResetTimeoutRef.current = window.setTimeout(() => {
      setDetailCopyState("idle");
      detailCopyResetTimeoutRef.current = null;
    }, 2500);
  }

  async function loadTotemDetail(nextTotemId: number) {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    setLoading(true);
    setError("");

    try {
      const [totemResponse, linkingCodeResponse] = await Promise.all([
        totemService.getTotemById(nextTotemId),
        totemService.getTotemLinkingCode(nextTotemId),
      ]);

      if (loadRequestIdRef.current !== requestId) return;

      setTotem(totemResponse.data);
      setLinkingCode(linkingCodeResponse.data);
      setSelectedTtlMinutes(
        linkingCodeResponse.data.ttlMinutes
        ?? linkingCodeResponse.data.defaultTtlMinutes
        ?? 10,
      );
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return;
      setError(getErrorMessage(err, "No se pudo cargar el detalle del tótem"));
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!isOpen || !totemId) {
      loadRequestIdRef.current += 1;
      setTotem(null);
      setLinkingCode(null);
      setLoading(false);
      setError("");
      setSuccess("");
      setIsGeneratingCode(false);
      setClockTick(0);
      clearDetailCopyResetTimeout();
      setDetailCopyState("idle");
      return;
    }

    if (initialTotem && initialTotem.id === totemId) {
      setTotem(initialTotem);
    }

    void loadTotemDetail(totemId);
  }, [initialTotem, isOpen, totemId]);

  useEffect(() => {
    if (!isOpen || linkingCode?.status !== "active" || !linkingCode.expiresAt) {
      return;
    }

    const expiresAtMs = Date.parse(linkingCode.expiresAt);

    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return;
    }

    const timer = window.setInterval(() => {
      if (Date.now() >= expiresAtMs) {
        setClockTick((value) => value + 1);
        window.clearInterval(timer);
        return;
      }

      setClockTick((value) => value + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isOpen, linkingCode?.expiresAt, linkingCode?.status]);

  const computedStatus = useMemo(() => {
    if (!linkingCode) {
      return null;
    }

    if (linkingCode.status !== "active" || !linkingCode.expiresAt) {
      return linkingCode.status;
    }

    const expiresAtMs = Date.parse(linkingCode.expiresAt);

    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return "expired" as const;
    }

    return linkingCode.status;
  }, [clockTick, linkingCode]);

  const remainingSeconds = useMemo(() => {
    if (!linkingCode?.expiresAt) {
      return 0;
    }

    const expiresAtMs = Date.parse(linkingCode.expiresAt);

    if (!Number.isFinite(expiresAtMs)) {
      return 0;
    }

    return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
  }, [clockTick, linkingCode?.expiresAt]);

  useEffect(() => {
    clearDetailCopyResetTimeout();
    setDetailCopyState("idle");
  }, [linkingCode?.code]);

  useEffect(() => {
    return () => {
      clearDetailCopyResetTimeout();
    };
  }, []);

  async function handleGenerateLinkingCode() {
    if (!totem || totem.state !== "active" || isGeneratingCode) {
      return;
    }

    setIsGeneratingCode(true);
    setError("");
    setSuccess("");

    try {
      const response = await totemService.generateTotemLinkingCode(
        totem.id,
        selectedTtlMinutes,
      );
      setLinkingCode(response.data);
      setSuccess("Código temporal generado correctamente.");
    } catch (err) {
      setError(
        getErrorMessage(err, "No se pudo generar el código temporal de vinculación."),
      );
    } finally {
      setIsGeneratingCode(false);
    }
  }

  async function handleCopyLinkingCode() {
    const code = linkingCode?.code?.trim();

    if (!code) {
      setDetailCopyState("error");
      return;
    }

    const copied = await copyTextToClipboard(code);

    if (copied) {
      setDetailCopyState("copied");
      scheduleDetailCopyReset();
      return;
    }

    clearDetailCopyResetTimeout();
    setDetailCopyState("error");
    setError("No se pudo copiar el código de vinculación.");
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      title="Detalle de Tótem"
      description="Datos generales y estado operativo del dispositivo."
      onClose={onClose}
      widthClassName="max-w-5xl"
    >
      <div className="space-y-4">
        {success && (
          <FeedbackMessage
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        {error && (
          <FeedbackMessage
            type="error"
            message={error}
            onClose={() => setError("")}
          />
        )}

        {loading ? (
          <LoadingState message="Cargando detalle del tótem..." />
        ) : totem ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full bg-[#f8dbe3] px-4 py-0.5 text-xs font-bold tracking-[0.08em] text-(--color-red-main)">
                Tótem
              </div>
              <h3
                className="max-w-full truncate text-lg font-bold text-(--color-text-main)"
                title={totem.name}
              >
                {totem.name}
              </h3>
              <span
                className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${totem.state === "active"
                  ? "bg-[#c9eed8] text-[#0f7a3a]"
                  : "bg-[#ececef] text-[#5e6470]"
                  }`}
              >
                {totem.state === "active" ? "Activo" : "Inactivo"}
              </span>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(totem)}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-(--color-red-button) px-4 py-2 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark)"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
              <article className="rounded-2xl border border-(--color-border) bg-white p-5">
                <h4 className="text-sm font-bold text-(--color-text-main)">
                  Información del Tótem
                </h4>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                    <Cable className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Código
                      </p>
                      <SafeText
                        value={totem.code}
                        className="text-xs font-medium text-(--color-text-main)"
                      />
                    </div>
                  </article>
                  <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                    <FileText className="shrink-0 mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Nombre de registro
                      </p>
                      <SafeText
                        value={totem.name}
                        className="text-xs font-medium text-(--color-text-main)"
                      />
                    </div>
                  </article>


                  <article className={DETAIL_ITEM_CLASS}>
                    <Building2 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Campus
                      </p>
                      <p className="text-xs font-medium text-(--color-text-main)">
                        {totem.campus?.name ?? "Sin campus"}
                      </p>
                    </div>
                  </article>

                  <article className={DETAIL_ITEM_CLASS}>
                    <Activity className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Conexión
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getConnectionBadgeClass(
                          totem.connectionStatus,
                        )}`}
                      >
                        {getConnectionBadgeLabel(totem.connectionStatus)}
                      </span>
                    </div>
                  </article>

                  <article className={DETAIL_ITEM_CLASS}>
                    <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Última conexión
                      </p>
                      <p className="text-xs font-medium text-(--color-text-main)">
                        {formatDateTime(totem.lastSeenAt)}
                      </p>
                    </div>
                  </article>

                  <article className={DETAIL_ITEM_CLASS}>
                    <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Creado en
                      </p>
                      <p className="text-xs font-medium text-(--color-text-main)">
                        {formatDateTime(totem.createdAt)}
                      </p>
                    </div>
                  </article>

                  <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                    <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Actualizado en
                      </p>
                      <p className="text-xs font-medium text-(--color-text-main)">
                        {formatDateTime(totem.updatedAt)}
                      </p>
                    </div>
                  </article>
                </div>
              </article>

              <article className="rounded-2xl border border-(--color-border) bg-white p-5">
                <div className="border-b border-(--color-border) pb-4">
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Vinculación segura
                  </p>
                  <h3 className="text-sm font-bold text-(--color-text-main)">
                    Código temporal de vinculación
                  </h3>
                  <p className="mt-2 text-xs text-(--color-text-secondary)">
                    Usa este código temporal para vincular el cliente tótem en el
                    dispositivo. El código expira automáticamente por seguridad.
                  </p>
                </div>

                <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={selectedTtlMinutes}
                    onChange={(event) => setSelectedTtlMinutes(Number(event.target.value))}
                    disabled={totem.state !== "active" || isGeneratingCode}
                    className="rounded-xl border border-(--color-border) bg-white px-3 py-2 text-xs font-medium text-(--color-text-main) disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {(linkingCode?.allowedTtlMinutes ?? [5, 10]).map((ttlMinutes) => (
                      <option key={ttlMinutes} value={ttlMinutes}>
                        {ttlMinutes} minutos
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleGenerateLinkingCode}
                    disabled={totem.state !== "active" || isGeneratingCode}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-red-button) px-4 py-2 text-xs font-semibold text-white transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isGeneratingCode ? (
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {linkingCode?.status === "active" ? "Regenerar código" : "Generar código"}
                  </button>
                </div>

                {totem.state !== "active" ? (
                  <div className="mt-4 rounded-xl border border-[#f3c2cb] bg-[#fff7f8] px-4 py-2 text-xs text-[#b42346]">
                    Este tótem está inactivo. Debes activarlo para generar un código temporal.
                  </div>
                ) : null}

                {linkingCode ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-[#d7e2f3] bg-[#f7faff] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getLinkingCodeStatusClass(
                            computedStatus ?? linkingCode.status,
                          )}`}
                        >
                          {getLinkingCodeStatusLabel(computedStatus ?? linkingCode.status)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#385682]">
                          <Clock3 className="h-3.5 w-3.5" />
                          {computedStatus === "active"
                            ? formatRemainingTime(remainingSeconds)
                            : "No vigente"}
                        </span>
                      </div>

                      {computedStatus === "active" && linkingCode.code ? (
                        <>
                          <p className="mt-4 font-mono text-3xl font-bold tracking-[0.2em] text-[#123462]">
                            {linkingCode.code}
                          </p>

                          <button
                            type="button"
                            onClick={handleCopyLinkingCode}
                            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-[#b7c9e4] bg-white px-3.5 py-2 text-xs font-semibold text-[#23416f] transition hover:bg-[#eef4ff]"
                          >
                            {detailCopyState === "copied" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            {detailCopyState === "copied" ? "Código copiado" : "Copiar código"}
                          </button>
                        </>
                      ) : (
                        <p className="mt-4 text-xs text-(--color-text-secondary)">
                          No hay un código temporal vigente en este momento.
                        </p>
                      )}
                    </div>

                    <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-(--color-border) bg-[#fcfcfd] p-4 text-sm">
                      <div>
                        <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                          Vigencia configurada
                        </dt>
                        <dd className="mt-1 font-semibold text-xs text-(--color-text-main)">
                          {linkingCode.ttlMinutes ?? linkingCode.defaultTtlMinutes} minutos
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                          Generado en
                        </dt>
                        <dd className="mt-1 font-medium text-xs text-(--color-text-main)">
                          {formatDateTime(linkingCode.generatedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                          Expira en
                        </dt>
                        <dd className="mt-1 font-medium text-xs text-(--color-text-main)">
                          {formatDateTime(linkingCode.expiresAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                          Último uso
                        </dt>
                        <dd className="mt-1 font-medium text-xs text-(--color-text-main)">
                          {formatDateTime(linkingCode.usedAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-(--color-border) bg-[#f9fafb] px-4 py-2 text-xs text-(--color-text-secondary)">
                    No hay información de código temporal disponible para este tótem.
                  </div>
                )}
              </article>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-(--color-border) bg-white px-4 py-2 text-xs text-(--color-text-secondary)">
            No se encontró la información del tótem seleccionado.
          </div>
        )}
      </div>
    </SideDrawer>
  );
}

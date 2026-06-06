import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import TotemClientSystemScreen from "../features/totemClient/components/TotemClientSystemScreen";
import InternalServerErrorPage from "../pages/errors/InternalServerErrorPage";

const TOTEM_AUTO_RELOAD_DELAY_MS = 2500;
const TOTEM_AUTO_RELOAD_WINDOW_MS = 60_000;
const TOTEM_AUTO_RELOAD_MAX_ATTEMPTS = 3;
const TOTEM_AUTO_RELOAD_GUARD_KEY = "totem-client.error-reload-guard";

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  isTotemClientRoute: boolean;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  totemReloadStatus: "idle" | "scheduled" | "blocked";
}

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    totemReloadStatus: "idle",
  };
  private reloadTimer: number | null = null;

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true, totemReloadStatus: "idle" };
  }

  componentWillUnmount() {
    this.clearReloadTimer();
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Error inesperado en la interfaz:", error, errorInfo);

    if (!this.props.isTotemClientRoute) {
      return;
    }

    const totemReloadStatus = this.scheduleTotemAutoReload();
    this.setState({ totemReloadStatus });
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.clearReloadTimer();
      this.setState({ hasError: false, totemReloadStatus: "idle" });
    }
  }

  private clearReloadTimer() {
    if (this.reloadTimer !== null) {
      window.clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  private scheduleTotemAutoReload(): "scheduled" | "blocked" {
    if (typeof window === "undefined") {
      return "blocked";
    }

    const now = Date.now();
    let attempts = 0;
    let windowStartedAt = now;

    try {
      const rawGuard = window.sessionStorage.getItem(TOTEM_AUTO_RELOAD_GUARD_KEY);

      if (rawGuard) {
        const parsedGuard = JSON.parse(rawGuard) as {
          attempts?: number;
          windowStartedAt?: number;
        };

        attempts = Number.isFinite(parsedGuard.attempts) ? Number(parsedGuard.attempts) : 0;
        windowStartedAt = Number.isFinite(parsedGuard.windowStartedAt)
          ? Number(parsedGuard.windowStartedAt)
          : now;
      }
    } catch {
      attempts = 0;
      windowStartedAt = now;
    }

    if (now - windowStartedAt > TOTEM_AUTO_RELOAD_WINDOW_MS) {
      attempts = 0;
      windowStartedAt = now;
    }

    if (attempts >= TOTEM_AUTO_RELOAD_MAX_ATTEMPTS) {
      return "blocked";
    }

    const nextGuard = {
      attempts: attempts + 1,
      windowStartedAt,
    };

    try {
      window.sessionStorage.setItem(
        TOTEM_AUTO_RELOAD_GUARD_KEY,
        JSON.stringify(nextGuard),
      );
    } catch {
      // Si no hay acceso a sessionStorage, continuamos con un unico reintento.
    }

    this.clearReloadTimer();
    this.reloadTimer = window.setTimeout(() => {
      window.location.reload();
    }, TOTEM_AUTO_RELOAD_DELAY_MS);

    return "scheduled";
  }

  render() {
    if (this.state.hasError) {
      if (this.props.isTotemClientRoute) {
        const details =
          this.state.totemReloadStatus === "blocked"
            ? "No se pudo recuperar automáticamente. Reinicia el navegador del dispositivo."
            : `Reiniciando automáticamente en ${Math.round(TOTEM_AUTO_RELOAD_DELAY_MS / 1000)} segundos.`;

        return (
          <TotemClientSystemScreen
            icon={AlertTriangle}
            title="Error en la interfaz del cliente tótem"
            message="El cliente encontró un problema inesperado durante la ejecución."
            details={details}
          />
        );
      }

      return <InternalServerErrorPage />;
    }

    return this.props.children;
  }
}

export default function RouteErrorBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}${location.hash}`;
  const isTotemClientRoute =
    location.pathname.startsWith("/client")
    || location.pathname.startsWith("/totem-client");

  return (
    <AppErrorBoundary resetKey={resetKey} isTotemClientRoute={isTotemClientRoute}>
      {children}
    </AppErrorBoundary>
  );
}

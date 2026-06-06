import {
  Bell,
  ChevronDown,
  ClipboardList,
  FileText,
  KeyRound,
  LogOut,
  Menu,
  Monitor,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logoIcon from "../../assets/images/Logo.webp";
import FeedbackMessage from "../components/FeedbackMessage";
import FormModal from "../components/FormModal";
import { useAuth } from "../context/AuthContext";
import ChangePasswordForm from "../features/auth/components/ChangePasswordForm";
import {
  authService,
  getChangePasswordFieldErrors,
} from "../features/auth/services/auth.service";
import type {
  ChangePasswordFormErrors,
  ChangePasswordPayload,
} from "../types/auth";
import type { UserRole } from "../types/user";
import { getErrorMessage } from "../utils/getErrorMessage";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Monitor;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: Monitor,
    roles: ["Admin", "SuperAdmin"],
  },
  {
    to: "/admin/notifications",
    label: "Notificaciones",
    icon: Bell,
    roles: ["Admin", "SuperAdmin"],
  },
  {
    to: "/admin/users",
    label: "Usuarios",
    icon: Users,
    roles: ["SuperAdmin"],
  },
  {
    to: "/admin/totems",
    label: "Tótems",
    icon: Monitor,
    roles: ["Admin", "SuperAdmin"],
  },
  {
    to: "/admin/contents",
    label: "Contenidos",
    icon: FileText,
    roles: ["Admin", "SuperAdmin"],
  },
  {
    to: "/admin/assignments",
    label: "Asignaciones",
    icon: ClipboardList,
    roles: ["Admin", "SuperAdmin"],
  },
];

const SIDEBAR_HIDDEN_STORAGE_KEY = "totem-admin.sidebar-hidden";

function buildNavLinkClass(isActive: boolean) {
  if (isActive) {
    return "group inline-flex w-full items-center gap-3 rounded-xl border border-(--color-red-main) bg-(--color-red-main) px-4 py-2.5 text-xs font-semibold text-white shadow-sm";
  }

  return "group inline-flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold text-[#d1d1d1] transition hover:border-[#2f2f2f] hover:bg-[#1c1c1c] hover:text-white";
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_HIDDEN_STORAGE_KEY) === "1";
  });
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [changePasswordModalKey, setChangePasswordModalKey] = useState(0);
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false);
  const [changePasswordErrors, setChangePasswordErrors] =
    useState<ChangePasswordFormErrors>({});
  const [changePasswordError, setChangePasswordError] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const visibleItems = useMemo(() => {
    if (!user) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  }, [user]);

  const currentSectionLabel = useMemo(() => {
    const exactMatch = visibleItems.find((item) => item.to === location.pathname);
    if (exactMatch) {
      return exactMatch.label;
    }

    const nestedMatch = visibleItems.find((item) =>
      location.pathname.startsWith(`${item.to}/`)
    );

    return nestedMatch?.label ?? "Panel Administrativo";
  }, [location.pathname, visibleItems]);

  const headerBreadcrumb = useMemo(() => {
    if (currentSectionLabel === "Panel Administrativo") {
      return "Administración";
    }

    return `Administración / ${currentSectionLabel}`;
  }, [currentSectionLabel]);

  useEffect(() => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_HIDDEN_STORAGE_KEY,
      sidebarHidden ? "1" : "0"
    );
  }, [sidebarHidden]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (
        accountMenuRef.current &&
        target instanceof Node &&
        !accountMenuRef.current.contains(target)
      ) {
        setAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen]);

  if (!user) {
    return null;
  }

  async function handleLogout() {
    setLogoutSubmitting(true);
    setFeedback(null);
    setAccountMenuOpen(false);

    try {
      await logout();
      navigate("/admin/login", { replace: true });
    } catch (err) {
      setFeedback({
        type: "error",
        message: getErrorMessage(err, "No se pudo cerrar sesión"),
      });
    } finally {
      setLogoutSubmitting(false);
    }
  }

  function handleSidebarToggle() {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      setSidebarHidden((prev) => !prev);
      setMenuOpen(false);
      return;
    }

    setMenuOpen((prev) => !prev);
  }

  function handleOpenChangePasswordModal() {
    setFeedback(null);
    setAccountMenuOpen(false);
    setChangePasswordErrors({});
    setChangePasswordError("");
    setChangePasswordModalKey((prev) => prev + 1);
    setChangePasswordModalOpen(true);
  }

  function handleCloseChangePasswordModal() {
    if (changePasswordSubmitting) {
      return;
    }

    setChangePasswordModalOpen(false);
    setChangePasswordErrors({});
    setChangePasswordError("");
  }

  async function handleChangePasswordSubmit(values: ChangePasswordPayload) {
    setChangePasswordSubmitting(true);
    setChangePasswordErrors({});
    setChangePasswordError("");

    try {
      const response = await authService.changePassword(values);

      setChangePasswordModalOpen(false);
      setFeedback({
        type: "success",
        message: response.message || "Contraseña actualizada correctamente",
      });
    } catch (err) {
      const nextFieldErrors = getChangePasswordFieldErrors(err);
      setChangePasswordErrors(nextFieldErrors);

      if (Object.keys(nextFieldErrors).length === 0) {
        setChangePasswordError(
          getErrorMessage(err, "No se pudo cambiar la contraseña")
        );
      }
    } finally {
      setChangePasswordSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--color-bg)">
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 lg:hidden ${menuOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
          }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-[#252525] bg-(--color-sidebar) px-4 py-5 transition-transform duration-500 ease-in-out ${menuOpen ? "translate-x-0" : "-translate-x-full"
          } ${sidebarHidden ? "lg:-translate-x-full" : "lg:translate-x-0"}`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffffff] shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
                <img
                  src={logoIcon}
                  alt="Logo TOTEM"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-wide text-white">
                  TOTEM
                </p>
                <p className="truncate text-xs tracking-widest text-[#a8a8a8]">
                  Panel administrativo
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#cfcfcf] hover:bg-[#1f1f1f] lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-label="Cerrar menú lateral"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {visibleItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => buildNavLinkClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-white" : "text-[#bdbdbd] group-hover:text-white"
                        }`}
                    />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 shrink-0 rounded-xl border border-[#2a2a2a] bg-[#171717] px-3 py-2">
            <p className="text-xs font-semibold text-[#d5d5d5]">TOTEM - Univalle</p>
            <p className="text-xs text-[#8f8f8f]">Sistema de Señalización Digital</p>
          </div>
        </div>
      </aside>

      <div
        className={`flex min-h-screen flex-col transition-[padding-left] duration-500 ease-in-out ${sidebarHidden ? "lg:pl-0" : "lg:pl-60"
          }`}
      >
        <header className="sticky top-0 z-20 border-b border-(--color-border) bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSidebarToggle}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-(--color-border) text-(--color-text-main) transition hover:border-(--color-red-main)/35 hover:bg-[#fdebef] hover:text-(--color-red-main) active:translate-y-0 active:scale-95"
                aria-label={
                  sidebarHidden ? "Mostrar menú lateral" : "Ocultar menú lateral"
                }
                title={
                  sidebarHidden ? "Mostrar menú lateral" : "Ocultar menú lateral"
                }
              >
                <Menu
                  className={`h-4 w-4 transition-transform duration-300 ${sidebarHidden ? "rotate-180" : ""
                    }`}
                />
              </button>

              <div className="min-w-0">
                <p className="truncate text-base font-bold leading-tight text-(--color-text-main)">
                  {currentSectionLabel}
                </p>
                <p className="hidden text-xs text-(--color-text-secondary) sm:block">
                  {headerBreadcrumb}
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-2 sm:gap-3" ref={accountMenuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Abrir menú de cuenta"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-white px-2.5 py-1.5 text-left transition hover:border-(--color-red-main)/35 hover:bg-[#fff9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main)/25"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fdebef] text-(--color-red-main)">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-xs font-semibold text-(--color-text-main)">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-(--color-text-secondary)">
                    {user.email}
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-(--color-text-secondary) transition ${accountMenuOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              <div
                role="menu"
                aria-label="Menú de cuenta"
                className={`absolute right-0 top-[calc(100%+0.55rem)] z-40 w-72 origin-top-right rounded-2xl border border-(--color-border) bg-white p-2 shadow-xl transition ${accountMenuOpen
                  ? "pointer-events-auto scale-100 opacity-100"
                  : "pointer-events-none scale-95 opacity-0"
                  }`}
              >
                <div className="rounded-xl border border-[#f0f0f0] bg-[#fafafa] px-3 py-2.5">
                  <p className="truncate text-xs font-semibold text-(--color-text-main)">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-(--color-text-secondary)">
                    {user.email}
                  </p>
                  <p className="mt-1 inline-flex rounded-full border border-[#f3d7dd] bg-[#fff2f5] px-2 py-0.5 text-xs font-semibold tracking-[0.04em] text-(--color-red-main)">
                    {user.role}
                  </p>
                </div>

                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleOpenChangePasswordModal}
                    className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#f6f6f6]"
                  >
                    <KeyRound className="h-4 w-4 text-(--color-text-secondary)" />
                    Cambiar contraseña
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={logoutSubmitting}
                    onClick={handleLogout}
                    className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-(--color-red-main) transition hover:bg-[#fff0f3] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <LogOut className="h-4 w-4" />
                    {logoutSubmitting ? "Cerrando..." : "Cerrar sesión"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>

      {feedback && (
        <FeedbackMessage
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      <FormModal
        isOpen={changePasswordModalOpen}
        title="Cambiar contraseña"
        description="Actualiza tu contraseña de acceso para proteger tu cuenta."
        onClose={handleCloseChangePasswordModal}
        maxWidthClassName="max-w-2xl"
        disableClose={changePasswordSubmitting}
      >
        <ChangePasswordForm
          key={`change-password-${changePasswordModalKey}`}
          submitting={changePasswordSubmitting}
          serverError={changePasswordError}
          serverErrors={changePasswordErrors}
          onSubmit={handleChangePasswordSubmit}
        />
      </FormModal>
    </div>
  );
}

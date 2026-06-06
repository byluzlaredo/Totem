import { useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

const BASE_TITLE = "TOTEM - Sistema de Señalización Digital";

const ROUTE_TITLE_PATTERNS: Array<{ path: string; title: string }> = [
  { path: "/admin/dashboard", title: "Dashboard" },
  { path: "/admin/totems", title: "Tótems" },
  { path: "/admin/totems/:id", title: "Tótems" },
  { path: "/admin/contents", title: "Contenidos" },
  { path: "/admin/contents/:id/question-images", title: "Imágenes de Preguntas PDF" },
  { path: "/admin/assignments", title: "Asignaciones" },
  { path: "/admin/assignments/new", title: "Nueva Asignación" },
  { path: "/admin/assignments/:id/edit", title: "Editar Asignación" },
  { path: "/admin/users", title: "Usuarios" },
  { path: "/admin/notifications", title: "Notificaciones" },
  { path: "/admin/login", title: "Inicio de Sesión" },
  { path: "/admin/forgot-password", title: "Recuperar Contraseña" },
  { path: "/admin/reset-password", title: "Restablecer Contraseña" },
  { path: "/admin/set-password", title: "Activar Cuenta" },
  { path: "/set-password", title: "Activar Cuenta" },
  { path: "/admin/unauthorized", title: "No Autorizado" },
  { path: "/admin/forbidden", title: "Acceso Denegado" },
  { path: "/admin/internal-error", title: "Error Interno" },
  { path: "/admin/not-found", title: "Página No Encontrada" },
  { path: "/client/totem", title: "Cliente Tótem" },
];

function resolveRouteTitle(pathname: string) {
  for (const entry of ROUTE_TITLE_PATTERNS) {
    if (matchPath({ path: entry.path, end: true }, pathname)) {
      return entry.title;
    }
  }

  if (pathname.startsWith("/client") || pathname.startsWith("/totem-client")) {
    return "Cliente Tótem";
  }

  return "";
}

function buildDocumentTitle(pathname: string) {
  const routeTitle = resolveRouteTitle(pathname);

  if (!routeTitle) {
    return BASE_TITLE;
  }

  return `${routeTitle} | ${BASE_TITLE}`;
}

export default function DocumentTitleManager() {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = buildDocumentTitle(location.pathname);
  }, [location.pathname]);

  return null;
}

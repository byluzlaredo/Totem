import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import InternalServerErrorPage from "../pages/errors/InternalServerErrorPage";
import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";
import RouteErrorBoundary from "./RouteErrorBoundary";
import ScrollToTop from "../components/ScrollToTop";
import DocumentTitleManager from "./DocumentTitleManager";

const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const AdminLoginPage = lazy(() => import("../pages/AdminLogin/Login"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const NotificationListPage = lazy(() => import("../pages/notifications/NotificationListPage"));
const TotemClientPage = lazy(() => import("../pages/client/TotemClientPage"));
const ContentListPage = lazy(() => import("../pages/contents/ContentListPage"));
const ContentQuestionImagesPage = lazy(() => import("../pages/contents/ContentQuestionImagesPage"));
const ForbiddenPage = lazy(() => import("../pages/errors/ForbiddenPage"));
const NotFoundPage = lazy(() => import("../pages/errors/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("../pages/errors/UnauthorizedPage"));
const ForgotPasswordPage = lazy(() => import("../pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../pages/auth/ResetPasswordPage"));
const SetPasswordPage = lazy(() => import("../pages/auth/SetPasswordPage"));
const TotemContentListPage = lazy(() => import("../pages/totemContents/TotemContentListPage"));
const TotemContentUpsertPage = lazy(() => import("../pages/totemContents/TotemContentUpsertPage"));
const TotemListPage = lazy(() => import("../pages/totems/TotemListPage"));
const UsersAdminPage = lazy(() => import("../pages/users/UsersAdminPage"));

function RootRedirect() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingState message="Cargando..." />;
  }

  return isAuthenticated ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <Navigate to="/admin/login" replace />
  );
}

function UnknownRouteFallback() {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingState message="Cargando..." />;
  }

  if (
    location.pathname.startsWith("/client")
    || location.pathname.startsWith("/totem-client")
  ) {
    return <Navigate to="/client/totem" replace />;
  }

  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  if (isAuthenticated) {
    return <Navigate to="/admin/not-found" replace state={{ from: currentPath }} />;
  }

  return <Navigate to="/admin/login" replace state={{ from: currentPath }} />;
}

function TotemDetailRedirect() {
  const { id } = useParams();
  const totemId = Number(id);

  if (Number.isInteger(totemId) && totemId > 0) {
    return (
      <Navigate
        to="/admin/totems"
        replace
        state={{ openTotemDetailId: totemId }}
      />
    );
  }

  return <Navigate to="/admin/totems" replace />;
}

function AssignmentEditRedirect() {
  const { id } = useParams();
  const assignmentId = Number(id);

  if (Number.isInteger(assignmentId) && assignmentId > 0) {
    return <Navigate to={`/admin/assignments/${assignmentId}/edit`} replace />;
  }

  return <Navigate to="/admin/assignments" replace />;
}

function ContentQuestionImagesRedirect() {
  const { id } = useParams();
  const contentId = Number(id);

  if (Number.isInteger(contentId) && contentId > 0) {
    return <Navigate to={`/admin/contents/${contentId}/question-images`} replace />;
  }

  return <Navigate to="/admin/contents" replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <DocumentTitleManager />
      <ScrollToTop />
      <RouteErrorBoundary>
        <Suspense fallback={<LoadingState message="Cargando..." />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            <Route path="/client">
              <Route index element={<Navigate to="/client/totem" replace />} />
              <Route path="totem" element={<TotemClientPage />} />
              <Route path="link" element={<Navigate to="/client/totem" replace />} />
              <Route path="pairing" element={<Navigate to="/client/totem" replace />} />
              <Route path="*" element={<Navigate to="/client/totem" replace />} />
            </Route>

            <Route path="/totem-client" element={<Navigate to="/client/totem" replace />} />
            <Route path="/totem-client/*" element={<Navigate to="/client/totem" replace />} />

            <Route
              path="/admin/login"
              element={
                <PublicOnlyRoute>
                  <AdminLoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="/login" element={<Navigate to="/admin/login" replace />} />
            <Route path="/AdminLogin" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/forgot-password" element={<Navigate to="/admin/forgot-password" replace />} />
            <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
            <Route path="/reset-password" element={<Navigate to="/admin/reset-password" replace />} />
            <Route path="/admin/set-password" element={<SetPasswordPage />} />
            <Route path="/set-password" element={<SetPasswordPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="notifications" element={<NotificationListPage />} />
              <Route path="totems" element={<TotemListPage />} />
              <Route path="totems/new" element={<Navigate to="/admin/totems" replace />} />
              <Route path="totems/:id" element={<TotemDetailRedirect />} />
              <Route path="totems/:id/edit" element={<Navigate to="/admin/totems" replace />} />

              <Route path="contents" element={<ContentListPage />} />
              <Route
                path="contents/:id/question-images"
                element={<ContentQuestionImagesPage />}
              />
              <Route path="contents/new" element={<Navigate to="/admin/contents" replace />} />
              <Route path="contents/:id" element={<Navigate to="/admin/contents" replace />} />
              <Route path="contents/:id/edit" element={<Navigate to="/admin/contents" replace />} />

              <Route path="assignments" element={<TotemContentListPage />} />
              <Route path="assignments/new" element={<TotemContentUpsertPage mode="create" />} />
              <Route path="assignments/:id/edit" element={<TotemContentUpsertPage mode="edit" />} />
              <Route path="unauthorized" element={<UnauthorizedPage />} />
              <Route path="internal-error" element={<InternalServerErrorPage />} />
              <Route path="forbidden" element={<ForbiddenPage />} />
              <Route path="not-found" element={<NotFoundPage />} />

              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={["SuperAdmin"]}>
                    <UsersAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users/new"
                element={
                  <ProtectedRoute allowedRoles={["SuperAdmin"]}>
                    <Navigate to="/admin/users" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users/:id"
                element={
                  <ProtectedRoute allowedRoles={["SuperAdmin"]}>
                    <Navigate to="/admin/users" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users/:id/edit"
                element={
                  <ProtectedRoute allowedRoles={["SuperAdmin"]}>
                    <Navigate to="/admin/users" replace />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/notifications" element={<Navigate to="/admin/notifications" replace />} />
            <Route path="/totems" element={<Navigate to="/admin/totems" replace />} />
            <Route path="/totems/new" element={<Navigate to="/admin/totems" replace />} />
            <Route path="/totems/:id" element={<TotemDetailRedirect />} />
            <Route path="/totems/:id/edit" element={<Navigate to="/admin/totems" replace />} />
            <Route path="/contents" element={<Navigate to="/admin/contents" replace />} />
            <Route
              path="/contents/:id/question-images"
              element={<ContentQuestionImagesRedirect />}
            />
            <Route path="/contents/new" element={<Navigate to="/admin/contents" replace />} />
            <Route path="/contents/:id" element={<Navigate to="/admin/contents" replace />} />
            <Route path="/contents/:id/edit" element={<Navigate to="/admin/contents" replace />} />
            <Route path="/assignments" element={<Navigate to="/admin/assignments" replace />} />
            <Route path="/assignments/new" element={<Navigate to="/admin/assignments/new" replace />} />
            <Route path="/assignments/:id/edit" element={<AssignmentEditRedirect />} />
            <Route path="/users" element={<Navigate to="/admin/users" replace />} />
            <Route path="/users/new" element={<Navigate to="/admin/users" replace />} />
            <Route path="/users/:id" element={<Navigate to="/admin/users" replace />} />
            <Route path="/users/:id/edit" element={<Navigate to="/admin/users" replace />} />
            <Route path="/unauthorized" element={<Navigate to="/admin/unauthorized" replace />} />
            <Route path="/forbidden" element={<Navigate to="/admin/forbidden" replace />} />
            <Route path="/internal-error" element={<Navigate to="/admin/internal-error" replace />} />
            <Route path="/not-found" element={<Navigate to="/admin/not-found" replace />} />

            <Route path="*" element={<UnknownRouteFallback />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}

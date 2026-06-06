import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types/user";

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const location = useLocation();
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <LoadingState message="Validando sesión..." />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return <>{children}</>;
}

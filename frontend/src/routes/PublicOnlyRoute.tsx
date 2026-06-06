import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import LoadingState from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";

export default function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingState message="Cargando..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}

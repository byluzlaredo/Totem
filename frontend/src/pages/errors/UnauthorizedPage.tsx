import { ArrowLeft, House, LogIn, ShieldAlert } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ErrorPageLayout, {
  ERROR_PRIMARY_ACTION_CLASS,
  ERROR_SECONDARY_ACTION_CLASS,
} from "./ErrorPageLayout";

interface UnauthorizedLocationState {
  from?: string;
}

export default function UnauthorizedPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const fromPath = (location.state as UnauthorizedLocationState | null)?.from;

  return (
    <ErrorPageLayout
      code="401"
      title="Sesión requerida"
      description="Necesitas iniciar sesión para acceder a esta sección del sistema."
      icon={ShieldAlert}
    >
      <Link
        to="/admin/login"
        state={fromPath ? { from: fromPath } : undefined}
        className={ERROR_PRIMARY_ACTION_CLASS}
      >
        <LogIn className="h-4 w-4" />
        Ir a iniciar sesión
      </Link>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className={ERROR_SECONDARY_ACTION_CLASS}
      >
        <ArrowLeft className="h-4 w-4" />
        Regresar
      </button>

      <Link
        to={isAuthenticated ? "/admin/dashboard" : "/admin/login"}
        className={ERROR_SECONDARY_ACTION_CLASS}
      >
        <House className="h-4 w-4" />
        Ir al inicio
      </Link>
    </ErrorPageLayout>
  );
}

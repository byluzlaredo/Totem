import { ArrowLeft, House, RefreshCcw, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ErrorPageLayout, {
  ERROR_PRIMARY_ACTION_CLASS,
  ERROR_SECONDARY_ACTION_CLASS,
} from "./ErrorPageLayout";

export default function InternalServerErrorPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const homePath = isAuthenticated ? "/admin/dashboard" : "/admin/login";

  return (
    <ErrorPageLayout
      code="500"
      title="Ocurrió un error inesperado"
      description="No pudimos completar la operación en este momento. Intenta nuevamente en unos instantes."
      icon={ShieldAlert}
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={ERROR_PRIMARY_ACTION_CLASS}
      >
        <RefreshCcw className="h-4 w-4" />
        Reintentar
      </button>

      <Link to={homePath} className={ERROR_SECONDARY_ACTION_CLASS}>
        <House className="h-4 w-4" />
        Volver al inicio
      </Link>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className={ERROR_SECONDARY_ACTION_CLASS}
      >
        <ArrowLeft className="h-4 w-4" />
        Regresar
      </button>
    </ErrorPageLayout>
  );
}

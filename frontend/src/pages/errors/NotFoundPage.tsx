import { ArrowLeft, FileX2, House } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ErrorPageLayout, {
  ERROR_PRIMARY_ACTION_CLASS,
  ERROR_SECONDARY_ACTION_CLASS,
} from "./ErrorPageLayout";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const homePath = isAuthenticated ? "/admin/dashboard" : "/admin/login";

  return (
    <ErrorPageLayout
      code="404"
      title="Página no encontrada"
      description="La ruta que intentaste abrir no existe o ya no está disponible."
      icon={FileX2}
    >
      <Link to={homePath} className={ERROR_PRIMARY_ACTION_CLASS}>
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

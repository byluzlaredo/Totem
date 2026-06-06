import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import ErrorPageLayout, {
  ERROR_PRIMARY_ACTION_CLASS,
} from "./ErrorPageLayout";

export default function ForbiddenPage() {
  return (
    <ErrorPageLayout
      code="403"
      title="Acceso denegado"
      description="No tienes permisos para acceder a esta sección."
      icon={ShieldAlert}
    >
      <Link to="/admin/dashboard" className={ERROR_PRIMARY_ACTION_CLASS}>
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio
      </Link>
    </ErrorPageLayout>
  );
}

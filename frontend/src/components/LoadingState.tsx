import { LoaderCircle } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({
  message = "Cargando...",
}: LoadingStateProps) {
  return (
    <section
      aria-live="polite"
      className="flex min-h-40 items-center justify-center rounded-3xl border border-(--color-border) bg-(--color-card) px-6 py-12 shadow-sm"
    >
      <div className="flex items-center gap-3 text-(--color-text-secondary)">
        <LoaderCircle className="h-4 w-4 animate-spin text-(--color-red-main)" />
        <p className="text-xs font-medium sm:text-xs">{message}</p>
      </div>
    </section>
  );
}

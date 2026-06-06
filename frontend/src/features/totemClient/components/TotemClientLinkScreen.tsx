import { Link2, Loader2 } from "lucide-react";
import loginBg from "../../../../assets/images/Login-bg.webp";
import logoIcon from "../../../../assets/images/Logo.webp";

interface TotemClientLinkScreenProps {
  linkCode: string;
  error: string;
  isSubmitting: boolean;
  onLinkCodeChange: (value: string) => void;
  onSubmit: () => void;
}

export default function TotemClientLinkScreen({
  linkCode,
  error,
  isSubmitting,
  onLinkCodeChange,
  onSubmit,
}: TotemClientLinkScreenProps) {
  return (
    <main
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-cover bg-center p-4 text-(--totem-text-primary) lg:p-8"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/68" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(5,5,6,0.76)_0%,rgba(20,20,28,0.5)_48%,rgba(216,27,78,0.28)_100%)]" />

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-(--totem-border-strong) bg-(--totem-surface-2)/95 shadow-2xl shadow-black/50 backdrop-blur-sm">
        <header className="border-b border-(--totem-border) px-6 py-6 text-center sm:px-8">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-(--totem-border-strong) bg-black/40">
            <img src={logoIcon} alt="Logo Totem" className="h-11 w-11" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--totem-accent)">
            Cliente Tótem
          </p>
          <h1 className="mt-1 text-2xl font-bold text-(--totem-text-primary)">
            Vincular dispositivo
          </h1>
          <p className="mt-2 text-sm text-(--totem-text-secondary)">
            Ingresa el código temporal generado desde el panel administrativo.
          </p>
        </header>

        <form
          className="space-y-5 px-6 py-6 sm:px-8 sm:py-8"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="block space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-(--totem-text-muted)">
              Código temporal
            </span>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--totem-accent)" />
              <input
                type="text"
                value={linkCode}
                onChange={(event) => onLinkCodeChange(event.target.value)}
                placeholder="Ejemplo: AB12CD"
                autoComplete="off"
                autoCapitalize="characters"
                className="w-full rounded-xl border border-(--totem-border-strong) bg-(--totem-surface-3) py-2.5 pl-10 pr-3 text-sm uppercase tracking-[0.08em] text-(--totem-text-primary) outline-none transition placeholder:text-(--totem-text-muted) focus:border-(--totem-accent) focus:ring-2 focus:ring-(--totem-accent)/25"
                disabled={isSubmitting}
              />
            </div>
          </label>

          {error ? (
            <div className="rounded-xl border border-(--totem-danger-soft) bg-(--totem-danger-surface) px-3 py-2 text-xs font-medium text-(--totem-danger-text)">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(--totem-accent-strong) px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-(--totem-accent-strong)/30 transition hover:bg-(--totem-accent) disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Vinculando..." : "Vincular dispositivo"}
          </button>
        </form>
      </section>
    </main>
  );
}

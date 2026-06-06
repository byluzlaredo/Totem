import type { LucideIcon } from "lucide-react";
import loginBg from "../../../../assets/images/Login-bg.webp";

interface TotemClientSystemScreenProps {
  icon: LucideIcon;
  title: string;
  message: string;
  details?: string;
}

export default function TotemClientSystemScreen({
  icon: Icon,
  title,
  message,
  details,
}: TotemClientSystemScreenProps) {
  return (
    <main
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-cover bg-center p-6 text-(--totem-text-primary)"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/68" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(5,5,6,0.76)_0%,rgba(20,20,28,0.5)_48%,rgba(216,27,78,0.28)_100%)]" />
      <section className="relative max-w-xl rounded-2xl border border-(--totem-danger-soft) bg-(--totem-danger-surface) p-8 text-center shadow-xl shadow-black/45">
        <Icon className="mx-auto h-10 w-10 text-(--totem-danger-text)" />
        <h1 className="mt-4 text-2xl font-semibold text-(--totem-text-primary)">{title}</h1>
        <p className="mt-3 text-sm text-(--totem-danger-text)">{message}</p>
        {details ? <p className="mt-2 text-xs text-(--totem-text-secondary)">{details}</p> : null}
      </section>
    </main>
  );
}

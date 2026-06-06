import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ErrorPageLayoutProps {
  code: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children?: ReactNode;
}

export const ERROR_PRIMARY_ACTION_CLASS =
  "inline-flex items-center gap-2 rounded-xl bg-(--color-red-button) px-5 py-2 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark)";

export const ERROR_SECONDARY_ACTION_CLASS =
  "inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-white px-5 py-2 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#f7f7f7]";

export default function ErrorPageLayout({
  code,
  title,
  description,
  icon: Icon,
  children,
}: ErrorPageLayoutProps) {
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-3xl border border-(--color-border) bg-(--color-card) p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fdebef] text-(--color-red-main)">
            <Icon className="h-7 w-7" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--color-red-main)">
            Error {code}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-(--color-text-main)">
            {title}
          </h1>
          <p className="mt-3 text-xs text-(--color-text-secondary)">
            {description}
          </p>

          {children ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {children}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
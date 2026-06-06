import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-(--color-border) bg-(--color-card) px-6 py-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f8dbe3] text-(--color-red-main)">
        <Inbox className="h-6 w-6" />
      </div>
      <h2 className="text-sm font-semibold text-(--color-text-main)">
        {title}
      </h2>
      <p className="mt-2 text-xs text-(--color-text-secondary)">
        {description}
      </p>
    </section>
  );
}

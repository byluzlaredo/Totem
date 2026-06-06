type TruncatedTextTag = "span" | "p" | "div" | "h2" | "h3";

interface TruncatedTextProps {
  value: string | number | null | undefined;
  fallback?: string;
  className?: string;
  title?: string;
  as?: TruncatedTextTag;
}

function mergeClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function TruncatedText({
  value,
  fallback = "Sin registro",
  className = "",
  title,
  as = "span",
}: TruncatedTextProps) {
  const Tag = as;
  const hasValue = value !== null && value !== undefined && String(value).length > 0;
  const resolvedValue = hasValue ? String(value) : fallback;
  const resolvedTitle = title ?? (hasValue ? String(value) : undefined);

  return (
    <Tag
      className={mergeClassNames("block min-w-0 truncate", className)}
      title={resolvedTitle}
    >
      {resolvedValue}
    </Tag>
  );
}

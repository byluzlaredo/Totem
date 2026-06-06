type SafeTextTag = "span" | "p" | "div";

interface SafeTextProps {
  value: string | number | null | undefined;
  fallback?: string;
  className?: string;
  as?: SafeTextTag;
}

function mergeClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function SafeText({
  value,
  fallback = "Sin registro",
  className = "",
  as = "p",
}: SafeTextProps) {
  const Tag = as;
  const hasValue = value !== null && value !== undefined && String(value).length > 0;
  const resolvedValue = hasValue ? String(value) : fallback;

  return (
    <Tag
      className={mergeClassNames(
        "whitespace-pre-wrap wrap-anywhere",
        className,
      )}
    >
      {resolvedValue}
    </Tag>
  );
}

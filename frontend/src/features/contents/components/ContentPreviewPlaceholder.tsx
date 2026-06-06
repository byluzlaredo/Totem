import { FileX2 } from "lucide-react";

type PlaceholderTone = "light" | "dark";

interface ContentPreviewPlaceholderProps {
  title?: string;
  message?: string;
  tone?: PlaceholderTone;
  className?: string;
}

export default function ContentPreviewPlaceholder({
  title = "Contenido no disponible",
  message = "No se encontró el archivo asociado a este contenido.",
  tone = "light",
  className = "",
}: ContentPreviewPlaceholderProps) {
  const containerToneClass =
    tone === "dark"
      ? "bg-[#1b1e39] text-white"
      : "bg-[#f8f9fb] text-(--color-text-main)";
  const iconToneClass = tone === "dark" ? "text-white/70" : "text-[#7e8693]";
  const messageToneClass = tone === "dark" ? "text-white/70" : "text-[#6d7582]";

  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-2 px-4 text-center ${containerToneClass} ${className}`}
    >
      <FileX2 className={`h-8 w-8 ${iconToneClass}`} />
      <p className="text-xs font-semibold">{title}</p>
      <p className={`max-w-104 text-xs ${messageToneClass}`}>{message}</p>
    </div>
  );
}

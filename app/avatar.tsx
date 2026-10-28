// Foto de perfil o, si no hay, las iniciales. Sirve en pantallas del servidor y del navegador.

export function initialsOf(name: string | null | undefined) {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export default function Avatar({
  name,
  url,
  size = 36,
  className = "",
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ? `Foto de ${name}` : "Foto de perfil"}
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#20A4DD]/15 font-semibold text-[#45B8E8] ${className}`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

/* eslint-disable @next/next/no-img-element */

// Logo real de AeroPro: blanco y cyan en modo oscuro, negro y cyan en modo claro (lo decide globals.css).
export default function Logo({ height = 22, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * 446) / 96);
  return (
    <span className={`inline-flex ${className}`}>
      <img src="/aeropro-logo-white.png" alt="AeroPro" width={width} height={height} className="logo-on-dark" />
      <img src="/aeropro-logo-black.png" alt="AeroPro" width={width} height={height} className="logo-on-light" />
    </span>
  );
}

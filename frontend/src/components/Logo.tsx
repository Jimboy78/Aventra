// Pixel-art open book with a flame rising from the spine: the story is being written live.

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" className={className} aria-hidden="true">
      <path fill="#6d3a0a" d="M3 22h12v2h2v-2h12v4H3z" />
      <path fill="#f4b942" d="M4 12h10v9H4zM18 12h10v9H18z" />
      <path fill="#ffd98a" d="M5 13h8v1H5zM19 13h8v1h-8z" />
      <path fill="#a0621a" d="M6 16h6v1H6zM6 18h4v1H6zM20 16h6v1h-6zM20 18h4v1h-4z" />
      <path fill="#3b2410" d="M14 12h4v10h-4z" />
      <g className="flicker" style={{ transformOrigin: "16px 10px" }}>
        <path fill="#ff7a3d" d="M15 3h2v2h1v2h1v4h-6V7h1V5h1z" />
        <path fill="#ffd98a" d="M15 7h2v3h-2z" />
      </g>
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "xl" }) {
  const mark = { sm: 28, md: 36, xl: 96 }[size];
  const text = { sm: "text-[0.7rem]", md: "text-sm", xl: "text-3xl sm:text-5xl" }[size];
  return (
    <span className={`inline-flex items-center ${size === "xl" ? "flex-col gap-5" : "gap-2.5"}`}>
      <LogoMark size={mark} className={size === "xl" ? "float" : ""} />
      <span
        className={`font-pixel ${text} tracking-[0.12em] text-[var(--gold)]`}
        style={{ textShadow: size === "xl" ? "4px 4px 0 #6d3a0a, 0 0 40px rgba(244,185,66,.35)" : "2px 2px 0 #6d3a0a" }}
      >
        AVENTRA
      </span>
    </span>
  );
}

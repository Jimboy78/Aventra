"use client";

import { useEffect, useState } from "react";
import { OUTCOME_LABEL } from "@/lib/engine/dice";
import type { CheckResult } from "@/lib/engine/types";

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

/** Animated d20 showing the engine's roll, the DC for the assessed risk and the outcome. */
export function Dice({ check, animate }: { check: CheckResult; animate: boolean }) {
  const [face, setFace] = useState(animate ? 20 : check.roll);
  const [rolling, setRolling] = useState(animate);

  useEffect(() => {
    if (!animate) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      if (ticks >= 12) {
        clearInterval(timer);
        setFace(check.roll);
        setRolling(false);
      } else setFace(1 + Math.floor(Math.random() * 20));
    }, 60);
    return () => clearInterval(timer);
  }, [animate, check.roll]);

  return (
    <div
      className={`outcome-${check.outcome} inline-flex items-center gap-3 border-2 border-[var(--line)] bg-[#0d0a14] py-1.5 pl-1.5 pr-4`}
      data-testid="dice"
      data-roll={check.roll}
      data-outcome={check.outcome}
    >
      <svg width="44" height="44" viewBox="0 0 44 44" className={rolling ? "rolling" : ""} aria-hidden="true">
        <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" fill="#1c1528" stroke="var(--out)" strokeWidth="2.5" />
        <polygon points="22,9 34,30 10,30" fill="none" stroke="var(--out)" strokeOpacity="0.45" strokeWidth="1.5" />
        <path d="M22 2v7M40 12l-6 18M4 12l6 18M10 30L4 32M34 30l6 2M22 42l-12-12M22 42l12-12" stroke="var(--out)" strokeOpacity="0.3" strokeWidth="1.2" />
        <text x="22" y="25.5" textAnchor="middle" fontFamily="var(--font-pixel)" fontSize={face > 9 ? 9 : 11} fill="var(--out)">
          {face}
        </text>
      </svg>
      <div className="leading-tight">
        <p className="font-pixel text-[0.62rem] uppercase text-[var(--out)]" style={{ opacity: rolling ? 0.3 : 1 }}>
          {rolling ? "rodando…" : OUTCOME_LABEL[check.outcome]}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          d20 {check.roll} {signed(check.modifier)} vs CD {check.dc} · riesgo {check.risk}
        </p>
      </div>
    </div>
  );
}

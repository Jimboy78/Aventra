"use client";

import { useState } from "react";
import type { Risk, SuggestedAction } from "@/lib/engine/types";
import type { Stage } from "@/lib/game/engine";
import { STAGE_LABEL } from "./StoryFeed";

interface ComposerProps {
  actions: SuggestedAction[];
  disabled: boolean;
  stage: Stage | null;
  onSend: (text: string, risk: Risk | null) => void;
}

export function Composer({ actions, disabled, stage, onSend }: ComposerProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value, null);
    setText("");
  };

  return (
    <div className="frame p-3 sm:p-4" data-testid="composer">
      {actions.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2" data-testid="actions">
          {actions.map((action) => (
            <button
              key={action.text}
              type="button"
              disabled={disabled}
              onClick={() => onSend(action.text, action.risk)}
              data-testid="action-button"
              data-risk={action.risk}
              className={`risk-${action.risk} group flex items-start gap-3 border-2 border-[var(--line)] bg-[#110d19] px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-[var(--risk)] disabled:pointer-events-none disabled:opacity-40`}
            >
              <span className="risk-dot mt-1.5 shrink-0" />
              <span className="min-w-0">
                <span className="block leading-snug text-[var(--ink)]">
                  {action.text}
                  {action.may_end_game && <span title="Puede terminar la historia"> ☠</span>}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--faint)] group-hover:text-[var(--muted)]">
                  {action.risk} · {action.effect_hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          className="field min-h-[3rem] resize-none"
          rows={2}
          value={text}
          disabled={disabled}
          maxLength={500}
          data-testid="composer-input"
          aria-label="Tu acción"
          placeholder={disabled ? (stage ? STAGE_LABEL[stage] : "Espera…") : "O escribe lo que haces, dices o intentas…"}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="submit" className="btn btn-gold h-[3.2rem]" disabled={disabled || !text.trim()} data-testid="composer-send">
          Actuar ➤
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { describeError, keyStore, validateKey } from "@/lib/ai/openai";

interface KeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (key: string) => void;
}

export function KeyDialog({ open, onClose, onSaved }: KeyDialogProps) {
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = value.trim();
    if (!key.startsWith("sk-")) {
      setMessage("Las keys de OpenAI empiezan con “sk-”.");
      return;
    }
    setChecking(true);
    setMessage(null);
    try {
      const hasModel = await validateKey(key);
      if (!hasModel) throw new Error("Esta key no tiene acceso a gpt-4.1-mini.");
      keyStore.set(key, remember);
      setValue("");
      onSaved(key);
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-title"
        data-testid="key-dialog"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="frame frame-gold corners rise w-full max-w-lg p-6 sm:p-7"
      >
        <p className="label">Trae tu propia llave</p>
        <h2 id="key-title" className="mb-3 text-2xl font-semibold">
          Conecta tu key de OpenAI
        </h2>
        <p className="mb-5 text-[var(--muted)]">
          Aventra no tiene servidor: tu navegador habla directo con OpenAI y la key nunca sale de este dispositivo. Un turno con GPT-4.1 mini
          cuesta alrededor de <strong className="text-[var(--ink)]">US$0.002</strong> y una ilustración <strong className="text-[var(--ink)]">US$0.006</strong>.
        </p>
        <label className="label" htmlFor="api-key">
          API key
        </label>
        <input
          ref={input}
          id="api-key"
          className="field font-mono"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-..."
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="accent-[var(--gold)]" />
          Recordarla en este navegador (si no, se borra al cerrar la pestaña)
        </label>
        {message && (
          <p role="alert" className="mt-4 border-l-4 border-[var(--blood)] bg-[#ff5d6c14] px-3 py-2 text-sm text-[#ffc2c8]">
            {message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <a className="text-sm text-[var(--sky)] underline-offset-4 hover:underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
            Crear una key ↗
          </a>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-gold" disabled={checking || !value.trim()} data-testid="key-save">
              {checking ? "Verificando…" : "Guardar key"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

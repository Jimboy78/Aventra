// Componente de input de usuario con AI SDK

"use client";

import { useState, useRef, KeyboardEvent } from "react";

interface UserInputProps {
  input: string;
  setInput: (input: string) => void;
  onSend: () => void;
  isLoading: boolean;
  placeholder?: string;
  className?: string;
}

export function UserInput({
  input,
  setInput,
  onSend,
  isLoading,
  placeholder = "Describe tu acción o pregunta...",
  className = "",
}: UserInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(2);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSend();
      }
    }
  };

  const handleInput = (value: string) => {
    setInput(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      const newRows = Math.min(
        Math.max(Math.ceil(textarea.scrollHeight / 24), 2),
        6
      );
      setRows(newRows);
    }
  };

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend();
    }
  };

  return (
    <div className={`user-input-container ${className}`}>
      <div className="relative">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={rows}
          className={`
            w-full px-4 py-3 pr-12 border rounded-lg 
            resize-none transition-all duration-200
            border-[var(--ui-border)] bg-[var(--ui-bg-primary)] text-[var(--ui-text)]
            focus:ring-2 focus:ring-[var(--mystical)] focus:border-[var(--mystical)] 
            ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
            placeholder:text-[var(--ui-text-muted)]
          `}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className={`
            absolute right-2 bottom-2 p-2 rounded-md transition-all duration-200
            ${
              input.trim() && !isLoading
                ? "text-[var(--gold)] hover:bg-[var(--ui-bg-tertiary)] cursor-pointer"
                : "text-[var(--ui-text-muted)] cursor-not-allowed"
            }
          `}
        >
          {isLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-[var(--mystical)] rounded-full border-t-transparent" />
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Helper text */}
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--ui-text-muted)]">
        <span>
          {isLoading
            ? "Generando respuesta..."
            : "Presiona Enter para enviar, Shift+Enter para nueva línea"}
        </span>

        <span className="text-right">{input.length}/500</span>
      </div>

      {/* Quick actions bar (opcional) */}
      {!isLoading && (
        <div className="mt-2 flex space-x-2">
          <QuickActionButton
            text="Examinar alrededor"
            onClick={() => setInput("Examinar alrededor cuidadosamente")}
          />
          <QuickActionButton
            text="Inventario"
            onClick={() => setInput("Revisar mi inventario")}
          />
          <QuickActionButton
            text="Estado"
            onClick={() => setInput("¿Cómo me encuentro ahora?")}
          />
        </div>
      )}
    </div>
  );
}

// Botón de acción rápida
function QuickActionButton({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-xs text-[var(--ui-text)] bg-[var(--ui-bg-tertiary)] hover:bg-[var(--ui-bg-secondary)] rounded transition-colors duration-200 border border-[var(--ui-border)]"
    >
      {text}
    </button>
  );
}

export default UserInput;

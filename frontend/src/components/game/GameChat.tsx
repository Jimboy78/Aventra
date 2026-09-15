// Componente de chat optimizado con AI SDK
// Renderizado progresivo de narrativa con streaming

"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { type CoreMessage } from "ai";
import GameImage from "./GameImage";

interface GameChatProps {
  messages: CoreMessage[];
  isLoading: boolean;
  currentImage: string | null;
  className?: string;
}

export function GameChat({
  messages,
  isLoading,
  currentImage,
  className = "",
}: GameChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      {/* Imagen actual (si existe) */}
      {currentImage && (
        <div className="w-full flex justify-center mb-4">
          <GameImage
            imageBase64={currentImage}
            alt="Escena actual"
            className="max-w-md rounded-lg shadow-lg"
          />
        </div>
      )}

      {/* Messages container */}
      <div className="space-y-6 max-h-[60vh] overflow-y-auto px-4 py-2">
        {messages.map((message, index) => (
          <div key={index} className="message-container">
            {message.role === "assistant" ? (
              <NarrativeMessage message={message} />
            ) : (
              <UserMessage message={message} />
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            <span className="text-sm">El narrador está pensando...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

// Componente para mensajes de narrativa (IA)
function NarrativeMessage({ message }: { message: CoreMessage }) {
  const toolInvocations = (message as unknown as { toolInvocations?: unknown })
    .toolInvocations;
  const showDebug =
    process.env.NODE_ENV === "development" && Boolean(toolInvocations);
  return (
    <div className="narration">
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
            strong: ({ children }) => (
              <strong className="text-[var(--gold)] font-semibold">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="text-[var(--ui-text-muted)] italic">{children}</em>
            ),
          }}
        >
          {typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content)}
        </ReactMarkdown>
      </div>

      {showDebug && (
        <div className="mt-2 text-xs text-[var(--ui-text-muted)]">
          <details>
            <summary className="cursor-pointer">Debug Info</summary>
            <pre className="mt-1 p-2 bg-[var(--ui-bg-primary)] rounded text-xs overflow-auto border border-[var(--ui-border)]">
              {JSON.stringify(
                (message as unknown as { toolInvocations?: unknown })
                  .toolInvocations,
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// Componente para mensajes del usuario
function UserMessage({ message }: { message: CoreMessage }) {
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
  const isAction = content.startsWith("[ACCIÓN:");

  return (
    <div
      className={`user-message flex justify-end ${
        isAction ? "action-message" : ""
      }`}
    >
      <div
        className={`max-w-xs p-3 rounded-l-lg rounded-tr-lg ${
          isAction
            ? "bg-green-100 border border-green-300 text-green-800"
            : "bg-[var(--mystical)] text-white"
        }`}
      >
        <p className="text-sm">
          {isAction ? (
            <span>
              <span className="font-semibold">Acción:</span>{" "}
              {content.replace(/^\[ACCIÓN: [^\]]+\] /, "")}
            </span>
          ) : (
            content
          )}
        </p>
      </div>
    </div>
  );
}

export default GameChat;

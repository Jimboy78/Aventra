// Implementación simplificada del AI SDK para build exitoso

import { useState, useCallback } from "react";
import { GameState } from "@/types/game";
import { ChatMessage, DebugConfig } from "@/types/api";
import { api } from "./api";
import type { Action } from "@/types/game";

interface SimpleGameChatOptions {
  gameState?: GameState;
  sessionId?: string;
  debugConfig?: DebugConfig;
}

// Hook simplificado que mantiene compatibilidad con la API existente
export function useGameChat(options: SimpleGameChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gameState] = useState<GameState | undefined>(options.gameState);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [input, setInput] = useState("");

  // Simular envío de mensaje (por ahora usa la API existente)
  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim() || isLoading || !gameState) return;

      setIsLoading(true);
      setError(null);

      try {
        // Agregar mensaje del usuario
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "user" as const,
          content: userInput,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // Llamar a la API existente
        const response = await api.generateStory({
          user_input: userInput,
          state: gameState,
          debug: options.debugConfig || { enabled: false },
        });

        // Agregar respuesta del asistente
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant" as const,
          content: response.text,
          createdAt: new Date(),
          toolInvocations: response.image_base64
            ? [
                {
                  toolName: "generateImage",
                  result: { image_base64: response.image_base64 } as unknown,
                },
              ]
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Actualizar imagen si existe
        if (response.image_base64) {
          setCurrentImage(response.image_base64);
        }

        setInput("");
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Error desconocido"));
      } finally {
        setIsLoading(false);
      }
    },
    [gameState, isLoading, options.debugConfig]
  );

  const sendAction = useCallback(
    async (actionId: string, actionText: string) => {
      await sendMessage(`[ACCIÓN: ${actionId}] ${actionText}`);
    },
    [sendMessage]
  );

  const reload = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setCurrentImage(null);
    setDebugInfo(null);
    setError(null);
    setInput("");
  }, []);

  const initializeWithMessage = useCallback((narration: string, image?: string) => {
    const initialMessage: ChatMessage = {
      id: "initial",
      role: "assistant" as const,
      content: narration,
      createdAt: new Date(),
    };
    setMessages([initialMessage]);
    if (image) {
      setCurrentImage(image);
    }
  }, []);

  return {
    messages,
    gameState,
    currentImage,
    debugInfo,
    isLoading,
    error,
    input,
    setInput,
    sendMessage,
    sendAction,
    reload,
    stop: () => {}, // Placeholder
    resetChat,
    initializeWithMessage,
    canSend: !isLoading && input.trim().length > 0,
  };
}

// Mantener exportaciones existentes para compatibilidad
export { api } from "./api";

type ToolInvocation = { toolName: string; result?: unknown };
type MessageWithTools = { toolInvocations?: ToolInvocation[] };

export function extractActionsFromMessage(message: MessageWithTools): Action[] {
  const tool = message.toolInvocations?.find(
    (t) => t.toolName === "updateGameState"
  );
  const result = tool?.result as { actions?: Action[] } | undefined;
  return result?.actions || [];
}

export function extractImageFromMessage(
  message: MessageWithTools
): string | null {
  const imageResult = message.toolInvocations?.find(
    (t) => t.toolName === "generateImage"
  );
  const result = imageResult?.result as { image_base64?: string } | undefined;
  return result?.image_base64 || null;
}

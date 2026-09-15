// Componente GamePlay completamente renovado con AI SDK

"use client";

import { useState, useEffect, useRef } from "react";
import type { CoreMessage } from "ai";
import { GameState, Action, LLMOutput } from "@/types/game";
import { useGameChat, extractActionsFromMessage } from "@/lib/ai-api-simple";
import GameChat from "./GameChat";
import UserInput from "./UserInput";
// import ActionButtons from "./ActionButtons"; // Removido - solo input de texto libre
import ErrorState from "./ErrorState";

interface GamePlayProps {
  initialState: GameState;
  initialOutput: LLMOutput & {
    image_base64?: string;
    mime_type?: string;
    width?: number;
    height?: number;
  };
  sessionId: string;
  onError: (error: string) => void;
  onGameOver?: (state: GameState) => void;
  onGameStateUpdate?: (state: GameState) => void;
  onOpenMenu?: () => void;
  settings?: {
    auto_save_enabled: boolean;
    auto_save_interval: number;
    debug_mode: boolean;
    animations_enabled: boolean;
  };
  autoSaveStatus?: {
    isAutoSaving: boolean;
    lastAutoSave: Date | null;
  };
}

export default function GamePlay({
  initialState,
  initialOutput,
  sessionId,
  onError,
  onGameOver,
  onGameStateUpdate,
  onOpenMenu,
  settings,
  autoSaveStatus,
}: GamePlayProps) {
  // Hook principal del AI SDK
  const {
    messages,
    gameState: currentGameState,
    currentImage,
    debugInfo,
    isLoading,
    error,
    input,
    setInput,
    sendMessage,
    sendAction,
    reload,
    canSend,
    initializeWithMessage,
  } = useGameChat({
    gameState: initialState,
    sessionId: sessionId,
    debugConfig: {
      enabled: settings?.debug_mode || process.env.NODE_ENV === "development",
      level: "basic",
    },
  });

  // Estados locales
  const [showPlayerStats, setShowPlayerStats] = useState(true);
  const [showInventory, setShowInventory] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);

  // Inicializar con mensaje de introducción
  useEffect(() => {
    if (messages.length === 0 && initialOutput.narration) {
      // Inicializar el chat con la narrativa inicial
      initializeWithMessage(
        initialOutput.narration,
        initialOutput.image_base64
      );
    }
  }, [messages.length, initialOutput.narration, initialOutput.image_base64, initializeWithMessage]);

  // Actualizar acciones cuando lleguen nuevos mensajes - REMOVIDO: Solo input libre

  // Verificar game over y notificar cambios de estado
  useEffect(() => {
    if (currentGameState) {
      onGameStateUpdate?.(currentGameState);
      
      if (currentGameState.game.is_game_over && onGameOver) {
        onGameOver(currentGameState);
      }
    }
  }, [currentGameState, onGameOver, onGameStateUpdate]);

  // Manejo de errores
  useEffect(() => {
    if (error) {
      onError(error.message);
    }
  }, [error, onError]);

  // Handlers
  const handleSendMessage = async () => {
    if (!canSend) return;
    await sendMessage(input);
  };

  // Handler de acciones removido - solo input de texto libre

  const handleRetry = () => {
    reload();
  };

  const handleClearError = () => {
    // Error se limpia automáticamente con retry
  };

  const player = currentGameState?.characters.find((c) => c.role === "player");
  const gameState = currentGameState || initialState;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar izquierda sticky con toda la info y acciones */}
      <div className="w-80 sidebar-surface flex flex-col sticky top-0 h-[100dvh]">
        {/* Header del juego */}
        <div className="p-6 border-b border-[var(--ui-border)]">
          {/* Header with Menu Button */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-[var(--ui-text)]">
              {gameState.scene.title || "Aventra"}
            </h2>
            <button
              onClick={onOpenMenu}
              className="pixel-button pixel-button-secondary text-xs px-3 py-1"
              title="Menú del juego (ESC)"
            >
              <span className="text-pixel">☰</span>
            </button>
          </div>
          
          {gameState.scene.location && (
            <p className="text-[var(--ui-text-muted)] text-sm">
              📍 {gameState.scene.location}
            </p>
          )}
          <p className="text-[var(--ui-text-muted)] text-xs mt-1">
            Capítulo {gameState.story_position.chapter} • Turno{" "}
            {gameState.story_position.turn}
          </p>

          {/* Status indicators */}
          <div className="mt-3 space-y-1">
            {/* Connection status */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  error ? "bg-red-500" : "bg-green-500"
                }`}
              />
              <span className="text-xs text-[var(--ui-text-muted)]">
                {error ? "Desconectado" : "Conectado"}
              </span>
            </div>
            
            {/* Auto-save status */}
            {autoSaveStatus && settings?.auto_save_enabled && (
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    autoSaveStatus.isAutoSaving ? "bg-yellow-500 animate-pulse" : "bg-blue-500"
                  }`}
                />
                <span className="text-xs text-[var(--ui-text-muted)]">
                  {autoSaveStatus.isAutoSaving 
                    ? "Guardando..." 
                    : autoSaveStatus.lastAutoSave 
                      ? `Último guardado: ${autoSaveStatus.lastAutoSave.toLocaleTimeString()}`
                      : "Auto-guardado activado"
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Acciones sugeridas - REMOVIDO: Solo input de texto libre */}

        {/* Tabs para información */}
        <div className="border-b border-[var(--ui-border)]">
          <div className="flex">
            <button
              onClick={() => {
                setShowPlayerStats(true);
                setShowInventory(false);
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 ${
                showPlayerStats
                  ? "border-[var(--gold)] text-[var(--gold)] bg-[color:color-mix(in_oklab,var(--ui-bg-secondary)_85%,transparent)]"
                  : "border-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:border-[var(--ui-border)]"
              }`}
            >
              Personaje
            </button>
            <button
              onClick={() => {
                setShowPlayerStats(false);
                setShowInventory(true);
              }}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 ${
                showInventory
                  ? "border-[var(--gold)] text-[var(--gold)] bg-[color:color-mix(in_oklab,var(--ui-bg-secondary)_85%,transparent)]"
                  : "border-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:border-[var(--ui-border)]"
              }`}
            >
              Inventario ({gameState.inventory.length})
            </button>
          </div>
        </div>

        {/* Contenido de tabs */}
        <div className="flex-1 overflow-y-auto">
          {showPlayerStats && player && <PlayerStats player={player} />}

          {showInventory && <InventoryView items={gameState.inventory} />}
        </div>

        {/* Debug info (desarrollo) */}
        {settings?.debug_mode && !!debugInfo && (
          <div className="border-t border-[var(--ui-border)] p-4">
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--ui-text-muted)]">
                Debug Info
              </summary>
              <pre className="mt-2 p-2 bg-[var(--ui-bg-primary)] rounded text-xs overflow-auto border border-[var(--ui-border)] text-[var(--ui-text)]">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
        
        {/* Quick Actions Footer */}
        <div className="border-t border-[var(--ui-border)] p-4">
          <div className="text-xs text-[var(--ui-text-muted)] space-y-1">
            <p>💡 <strong>Atajos:</strong></p>
            <p>ESC - Menú • Ctrl+S - Guardar</p>
            <p>Ctrl+O - Cargar partida</p>
          </div>
        </div>

        {/* Game over state */}
        {gameState.game.is_game_over && (
          <div className="p-6 bg-red-900/20 border-t border-red-800">
            <h3 className="font-semibold text-red-300 mb-2">Juego Terminado</h3>
            <p className="text-red-300 text-sm">
              {gameState.game.ending?.type === "death" && "💀 Muerte"}
              {gameState.game.ending?.type === "defeat" && "⚔️ Derrota"}
              {gameState.game.ending?.type === "retire" && "🚪 Retiro"}
              {gameState.game.ending?.type === "bittersweet" &&
                "🌓 Final Agridulce"}
            </p>
            {gameState.game.ending?.summary && (
              <p className="text-red-300 text-xs mt-1">
                {gameState.game.ending.summary}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col p-4 md:p-6" ref={mainRef}>
        {/* Error state */}
        {error && (
          <ErrorState
            error={error}
            onRetry={handleRetry}
            onClear={handleClearError}
            className="mb-4"
          />
        )}

        {/* Chat area */}
        <div className="flex-1">
          <GameChat
            messages={messages as unknown as CoreMessage[]}
            isLoading={isLoading}
            currentImage={currentImage}
            className="h-full"
          />
        </div>

        {/* Input area */}
        {!gameState.game.is_game_over && (
          <div className="border-t border-[var(--ui-border)] bg-[var(--ui-bg-primary)] p-4 md:p-6 rounded-xl">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* User input */}
              <UserInput
                input={input}
                setInput={setInput}
                onSend={handleSendMessage}
                isLoading={isLoading}
                placeholder="Describe tu acción o haz una pregunta..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente para stats del jugador
import type { Character, Item } from "@/types/game";

function PlayerStats({ player }: { player: Character }) {
  return (
    <div className="p-6 text-[var(--ui-text)]">
      <h3 className="font-semibold mb-4">{player.name}</h3>

      {player.health !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[var(--ui-text-muted)]">Salud</span>
            <span className="font-medium">{player.health}/100</span>
          </div>
          <div className="w-full bg-[var(--ui-bg-tertiary)] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                player.health >= 70
                  ? "bg-green-500"
                  : player.health >= 40
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.max(0, player.health)}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2 text-sm">
        {player.race && (
          <div className="flex justify-between">
            <span className="text-[var(--ui-text-muted)]">Raza:</span>
            <span className="font-medium">{player.race}</span>
          </div>
        )}
        {player.class && (
          <div className="flex justify-between">
            <span className="text-[var(--ui-text-muted)]">Clase:</span>
            <span className="font-medium">{player.class}</span>
          </div>
        )}
      </div>

      {player.conditions && player.conditions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-[var(--ui-text-muted)] mb-2">
            Estados
          </h4>
          <div className="space-y-1">
            {player.conditions.map((condition) => (
              <div
                key={condition.id}
                className={`text-xs px-2 py-1 rounded-full ${
                  condition.type === "wound"
                    ? "bg-red-900/30 text-red-200"
                    : condition.type === "buff"
                    ? "bg-green-900/30 text-green-200"
                    : condition.type === "debuff"
                    ? "bg-orange-900/30 text-orange-200"
                    : "bg-[var(--ui-bg-tertiary)] text-[var(--ui-text)]"
                }`}
              >
                {condition.name}
                {condition.severity &&
                  condition.severity !== "minor" &&
                  ` (${condition.severity})`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para inventario
function InventoryView({ items }: { items: Item[] }) {
  return (
    <div className="p-6 text-[var(--ui-text)]">
      <h3 className="font-semibold mb-4">Inventario ({items.length})</h3>

      {items.length === 0 ? (
        <p className="text-[var(--ui-text-muted)] text-sm italic">
          Sin objetos
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex justificar-between items-start p-2 bg-[var(--ui-bg-primary)] rounded border border-[var(--ui-border)]"
            >
              <div>
                <span className="text-sm font-medium">{item.name}</span>
                {item.description && (
                  <p className="text-xs text-[var(--ui-text-muted)] mt-1">
                    {item.description}
                  </p>
                )}
              </div>
              {item.qty && item.qty > 1 && (
                <span className="text-xs text-[var(--ui-text-muted)] bg-[var(--ui-bg-tertiary)] px-2 py-1 rounded">
                  ×{item.qty}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

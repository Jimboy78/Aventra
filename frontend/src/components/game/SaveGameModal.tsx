"use client";

import { useState, useRef, useEffect } from "react";
import { GameState } from "@/types/game";
import { SaveGameRequest } from "@/types/api";
import { api } from "@/lib/api";

interface SaveGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  sessionId: string;
  onSaveComplete?: (saveId: string, title: string) => void;
  onError?: (error: string) => void;
}

export default function SaveGameModal({
  isOpen,
  onClose,
  gameState,
  sessionId,
  onSaveComplete,
  onError,
}: SaveGameModalProps) {
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate auto title based on game state
  const generateAutoTitle = () => {
    const player = gameState.characters.find((c) => c.role === "player");
    const playerName = player?.name || "Aventurero";
    const location =
      gameState.scene.location || gameState.scene.title || "Aventra";
    const chapter = gameState.story_position.chapter;
    const turn = gameState.story_position.turn;

    const autoTitle = `${playerName} en ${location} (Cap.${chapter})`;
    setTitle(autoTitle);
    setDescription(`Turno ${turn} • ${location}`);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      onError?.("El título no puede estar vacío");
      return;
    }

    setIsLoading(true);
    try {
      const saveRequest: SaveGameRequest = {
        state: gameState,
        session_id: sessionId,
        title: title.trim(),
        auto_save: false,
      };

      const response = await api.saveGame(saveRequest);

      if (response.success && response.save_id) {
        onSaveComplete?.(response.save_id, response.title || title);
        onClose();
        // Reset form
        setTitle("");
        setDescription("");
      } else {
        onError?.(response.error || "Error al guardar la partida");
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative pixel-card bg-adventure p-6 w-full max-w-lg mx-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-mystical text-glow text-pixel">
            💾 GUARDAR PARTIDA
          </h2>
          <p className="text-treasure text-pixel text-sm mt-2">
            Guarda tu progreso actual
          </p>
        </div>

        {/* Game Info */}
        <div className="pixel-card bg-mystical p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl">
              {gameState.characters.find((c) => c.role === "player")?.race ===
                "elfo" && "🧝"}
              {gameState.characters.find((c) => c.role === "player")?.race ===
                "humano" && "👤"}
              {gameState.characters.find((c) => c.role === "player")?.race ===
                "enano" && "🧔"}
              {!["elfo", "humano", "enano"].includes(
                gameState.characters.find((c) => c.role === "player")?.race ||
                  ""
              ) && "🎭"}
            </div>
            <div className="flex-1">
              <h3 className="text-pixel font-bold text-adventure">
                {gameState.characters.find((c) => c.role === "player")?.name ||
                  "Aventurero"}
              </h3>
              <p className="text-xs text-adventure opacity-70">
                {gameState.scene.location || gameState.scene.title}
              </p>
              <p className="text-xs text-treasure">
                Capítulo {gameState.story_position.chapter} • Turno{" "}
                {gameState.story_position.turn}
              </p>
            </div>
          </div>
        </div>

        {/* Save Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-pixel font-medium text-adventure mb-2">
              Título de la partida
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ej: Mi gran aventura"
                maxLength={100}
                className="
                  flex-1 pixel-input bg-mystical border-dragon text-adventure
                  text-pixel p-3 rounded focus:outline-none focus:ring-2 focus:ring-treasure
                "
                disabled={isLoading}
              />
              <button
                onClick={generateAutoTitle}
                disabled={isLoading}
                className="pixel-button pixel-button-secondary px-4"
                title="Generar título automático"
              >
                <span className="text-pixel">🎲</span>
              </button>
            </div>
            <p className="text-xs text-adventure opacity-50 mt-1">
              {title.length}/100 caracteres
            </p>
          </div>

          {description && (
            <div className="pixel-card bg-dragon p-3">
              <p className="text-xs text-adventure opacity-70">{description}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 pixel-button pixel-button-secondary"
          >
            <span className="text-pixel">CANCELAR</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isLoading || !title.trim()}
            className={`
              flex-1 pixel-button pixel-button-success
              ${isLoading ? "animate-pulse" : ""}
            `}
          >
            {isLoading ? (
              <span className="text-pixel flex items-center gap-2">
                ⏳ GUARDANDO...
              </span>
            ) : (
              <span className="text-pixel">💾 GUARDAR</span>
            )}
          </button>
        </div>

        {/* Save Tips */}
        <div className="mt-6 pixel-card bg-treasure p-3">
          <p className="text-pixel text-xs text-adventure">
            💡 <strong>Consejo:</strong> Puedes guardar múltiples partidas y
            alternar entre ellas.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { GameState, LLMOutput } from "@/types/game";
import { GameMenuAction } from "@/types/api";
import { GameSetup, GamePlay, GameStateViewer } from "@/components/game";
import GameMenu from "@/components/game/GameMenu";
import SaveGameModal from "@/components/game/SaveGameModal";
import LoadGameModal from "@/components/game/LoadGameModal";
import NotificationSystem, { useNotifications } from "@/components/game/NotificationSystem";
import { useSaveSystem } from "@/hooks/useSaveSystem";

type GamePhase = "menu" | "setup" | "playing" | "game-over";

export default function Home() {
  const [gamePhase, setGamePhase] = useState<GamePhase>("menu");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentOutput, setCurrentOutput] = useState<
    | (LLMOutput & {
        image_base64?: string;
        mime_type?: string;
        width?: number;
        height?: number;
      })
    | null
  >(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showStateViewer, setShowStateViewer] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  
  // Hooks
  const notifications = useNotifications();
  const saveSystem = useSaveSystem();

  const handleSetupComplete = (
    state: GameState,
    intro: LLMOutput & {
      image_base64?: string;
      mime_type?: string;
      width?: number;
      height?: number;
    },
    newSessionId?: string
  ) => {
    setGameState(state);
    setCurrentOutput(intro);
    setSessionId(newSessionId || `session-${Date.now()}`);
    setGamePhase("playing");
    setShowGameMenu(false);
  };

  const handleError = (errorMessage: string) => {
    notifications.error("Error", errorMessage);
  };

  const handleGameOver = (finalState: GameState) => {
    setGameState(finalState);
    setGamePhase("game-over");
  };

  const handleNewGame = () => {
    setGameState(null);
    setCurrentOutput(null);
    setSessionId(null);
    setGamePhase("setup");
    setShowStateViewer(false);
    setShowGameMenu(false);
  };
  
  // Handle menu actions
  const handleMenuAction = useCallback(async (action: GameMenuAction['action']) => {
    switch (action) {
      case 'continue':
        setShowGameMenu(false);
        break;
        
      case 'save':
        setShowSaveModal(true);
        break;
        
      case 'load':
        setShowLoadModal(true);
        break;
        
      case 'new-game':
        handleNewGame();
        break;
        
      case 'exit':
        setGamePhase("menu");
        setGameState(null);
        setCurrentOutput(null);
        setSessionId(null);
        setShowGameMenu(false);
        break;
        
      case 'settings':
        // Settings are handled within GameMenu
        break;
    }
  }, []);
  
  // Handle save completion
  const handleSaveComplete = useCallback((saveId: string, title: string) => {
    notifications.success("Partida Guardada", `"${title}" se ha guardado correctamente`);
    setShowSaveModal(false);
    setShowGameMenu(false);
  }, [notifications]);
  
  // Handle load completion
  const handleLoadComplete = useCallback((state: GameState, newSessionId: string, intro: LLMOutput) => {
    setGameState(state);
    setSessionId(newSessionId);
    setCurrentOutput(intro);
    setGamePhase("playing");
    setShowLoadModal(false);
    setShowGameMenu(false);
    
    const player = state.characters.find(c => c.role === 'player');
    notifications.success(
      "Partida Cargada", 
      `Continuando como ${player?.name || 'Aventurero'} en ${state.scene.location || state.scene.title}`
    );
  }, [notifications]);
  
  // Handle auto-save
  const handleAutoSave = useCallback(async (state: GameState, session: string) => {
    if (saveSystem.shouldAutoSave(state)) {
      try {
        await saveSystem.triggerAutoSave(state, session);
        notifications.autoSave("Auto-guardado", "Progreso guardado automáticamente");
      } catch (error) {
        notifications.warning("Error de Auto-guardado", "No se pudo guardar automáticamente");
      }
    }
  }, [saveSystem, notifications]);
  
  // Handle game state updates for auto-save
  const handleGameStateUpdate = useCallback((newState: GameState) => {
    setGameState(newState);
    if (sessionId) {
      handleAutoSave(newState, sessionId);
    }
  }, [sessionId, handleAutoSave]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gamePhase === "playing") {
        if (e.key === "Escape") {
          setShowGameMenu(!showGameMenu);
        }
        if (e.ctrlKey && e.key === "s") {
          e.preventDefault();
          setShowSaveModal(true);
        }
        if (e.ctrlKey && e.key === "o") {
          e.preventDefault();
          setShowLoadModal(true);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gamePhase, showGameMenu]);

  return (
    <div className="min-h-screen bg-adventure">
      {/* Notification System */}
      <NotificationSystem 
        notifications={notifications.notifications}
        onDismiss={notifications.dismissNotification}
      />

      {/* Contenido principal */}
      <div>
        {gamePhase === "menu" && (
          <MainMenuScreen 
            onNewGame={() => setGamePhase("setup")}
            onLoadGame={() => setShowLoadModal(true)}
            saveSystem={saveSystem}
            notifications={notifications}
          />
        )}
        
        {gamePhase === "setup" && (
          <GameSetup
            onSetupComplete={handleSetupComplete}
            onError={handleError}
          />
        )}

        {gamePhase === "playing" && gameState && currentOutput && (
          <>
            <GamePlay
              initialState={gameState}
              initialOutput={currentOutput}
              sessionId={sessionId || ""}
              onError={handleError}
              onGameOver={handleGameOver}
              onGameStateUpdate={handleGameStateUpdate}
              onOpenMenu={() => setShowGameMenu(true)}
              settings={saveSystem.settings}
              autoSaveStatus={{
                isAutoSaving: saveSystem.isAutoSaving,
                lastAutoSave: saveSystem.lastAutoSave
              }}
            />
            
            {/* Game Menu */}
            <GameMenu
              isOpen={showGameMenu}
              onClose={() => setShowGameMenu(false)}
              onAction={handleMenuAction}
              gameInProgress={true}
              settings={saveSystem.settings}
              onSettingsChange={saveSystem.updateSettings}
            />
          </>
        )}

        {gamePhase === "game-over" && gameState && (
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="pixel-card bg-adventure p-8 w-full max-w-2xl text-center">
              <div className="text-8xl mb-6 animate-treasure-bounce">
                {gameState.game.ending?.type === "death" && "💀"}
                {gameState.game.ending?.type === "defeat" && "⚔️"}
                {gameState.game.ending?.type === "retire" && "🚪"}
                {gameState.game.ending?.type === "bittersweet" && "🌓"}
              </div>

              <h1 className="text-4xl font-bold text-mystical text-glow mb-6 text-pixel">
                {gameState.game.ending?.type === "death" &&
                  "TU HISTORIA HA LLEGADO A SU FIN"}
                {gameState.game.ending?.type === "defeat" &&
                  "HAS SIDO DERROTADO"}
                {gameState.game.ending?.type === "retire" &&
                  "DECIDISTE RETIRARTE"}
                {gameState.game.ending?.type === "bittersweet" &&
                  "UN FINAL AGRIDULCE"}
              </h1>

              {gameState.game.ending?.summary && (
                <div className="pixel-card bg-mystical p-6 mb-6">
                  <p className="text-adventure text-lg prose">
                    {gameState.game.ending.summary}
                  </p>
                </div>
              )}

              {gameState.game.ending?.cause && (
                <p className="text-treasure mb-8 text-pixel italic">
                  {gameState.game.ending.cause}
                </p>
              )}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowStateViewer(true)}
                  className="pixel-button pixel-button-primary"
                >
                  <span className="text-pixel">VER ESTADO FINAL</span>
                </button>
                <button
                  onClick={handleNewGame}
                  className="pixel-button pixel-button-success"
                >
                  <span className="text-pixel">NUEVA AVENTURA</span>
                </button>
                <button
                  onClick={() => setGamePhase("menu")}
                  className="pixel-button pixel-button-secondary"
                >
                  <span className="text-pixel">MENÚ PRINCIPAL</span>
                </button>
              </div>

              <div className="mt-8 pixel-card bg-treasure p-4">
                <p className="text-pixel text-sm">
                  <span className="text-mystical-glow">ESTADÍSTICAS:</span>{" "}
                  {gameState.story_position.turn} TURNOS •{" "}
                  {gameState.story_position.chapter} CAPÍTULOS
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal del estado del juego */}
      {showStateViewer && gameState && (
        <GameStateViewer
          gameState={gameState}
          isOpen={showStateViewer}
          onClose={() => setShowStateViewer(false)}
        />
      )}
      
      {/* Save Game Modal */}
      {showSaveModal && gameState && sessionId && (
        <SaveGameModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          gameState={gameState}
          sessionId={sessionId}
          onSaveComplete={handleSaveComplete}
          onError={handleError}
        />
      )}
      
      {/* Load Game Modal */}
      <LoadGameModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoadComplete={handleLoadComplete}
        onError={handleError}
      />
    </div>
  );
}

// Main Menu Screen Component
interface MainMenuScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  saveSystem: ReturnType<typeof useSaveSystem>;
  notifications: ReturnType<typeof useNotifications>;
}

function MainMenuScreen({ onNewGame, onLoadGame, saveSystem, notifications }: MainMenuScreenProps) {
  const recentSaves = saveSystem.saves.filter(save => !save.auto_save).slice(0, 3);
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="pixel-card bg-adventure p-8 w-full max-w-2xl text-center">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold text-mystical text-glow mb-4 text-pixel">
            AVENTRA
          </h1>
          <p className="text-treasure text-pixel text-lg">
            Generador de Historias Interactivas con IA
          </p>
          <p className="text-adventure text-pixel text-sm opacity-70 mt-2">
            Crea tu propia aventura épica
          </p>
        </div>

        {/* Main Actions */}
        <div className="space-y-4 mb-8">
          <button
            onClick={onNewGame}
            className="w-full pixel-button pixel-button-primary p-4"
          >
            <span className="text-pixel text-xl">🎮 NUEVA AVENTURA</span>
          </button>
          
          <button
            onClick={onLoadGame}
            disabled={saveSystem.saves.length === 0}
            className="w-full pixel-button pixel-button-secondary p-4"
          >
            <span className="text-pixel text-xl">
              📂 CARGAR PARTIDA {saveSystem.saves.length > 0 && `(${saveSystem.saves.length})`}
            </span>
          </button>
        </div>

        {/* Recent Saves */}
        {recentSaves.length > 0 && (
          <div className="pixel-card bg-mystical p-6">
            <h3 className="text-pixel font-bold text-treasure mb-4">PARTIDAS RECIENTES</h3>
            <div className="space-y-2">
              {recentSaves.map((save) => (
                <div key={save.save_id} className="flex items-center justify-between p-2 bg-adventure rounded">
                  <div className="text-left">
                    <p className="text-pixel font-medium text-sm">{save.title}</p>
                    <p className="text-pixel text-xs opacity-70">Cap. {save.chapter} • {save.location}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const result = await saveSystem.loadGame(save.save_id);
                        if (result) {
                          // This would trigger the load in the parent component
                          onLoadGame();
                        }
                      } catch (error) {
                        notifications.error("Error", "No se pudo cargar la partida");
                      }
                    }}
                    className="pixel-button pixel-button-primary text-xs px-3 py-1"
                  >
                    <span className="text-pixel">Cargar</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-pixel text-xs text-adventure opacity-50">
            v1.0.0 • Powered by OpenAI GPT
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { SaveMetadata, LoadGameResponse } from "@/types/api";
import { GameState, LLMOutput } from "@/types/game";
import { api } from "@/lib/api";

interface LoadGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadComplete?: (state: GameState, sessionId: string, intro: LLMOutput) => void;
  onError?: (error: string) => void;
}

export default function LoadGameModal({ 
  isOpen, 
  onClose, 
  onLoadComplete,
  onError 
}: LoadGameModalProps) {
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [selectedSave, setSelectedSave] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [showAutoSaves, setShowAutoSaves] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load saves when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSaves();
    }
  }, [isOpen, showAutoSaves]);

  const loadSaves = async () => {
    setIsLoading(true);
    try {
      const savesList = await api.listSaves(showAutoSaves);
      // Sort by updated date (newest first)
      const sortedSaves = savesList.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setSaves(sortedSaves);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Error al cargar partidas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadGame = async (saveId: string) => {
    setIsLoadingGame(true);
    try {
      const response: LoadGameResponse = await api.loadGame(saveId);
      
      if (response.success && response.state && response.session_id) {
        // Create a basic intro for loaded game
        const intro: LLMOutput = {
          narration: "Continuando tu aventura donde la dejaste...",
          actions: []
        };
        
        onLoadComplete?.(response.state, response.session_id, intro);
        onClose();
      } else {
        onError?.(response.error || "Error al cargar la partida");
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Error al cargar la partida");
    } finally {
      setIsLoadingGame(false);
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    try {
      const response = await api.deleteSave(saveId);
      if (response.success) {
        setSaves(saves.filter(save => save.save_id !== saveId));
        setConfirmDelete(null);
        if (selectedSave === saveId) {
          setSelectedSave(null);
        }
      } else {
        onError?.(response.error || "Error al eliminar la partida");
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Error al eliminar la partida");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return "Hace menos de 1 hora";
    } else if (diffInHours < 24) {
      return `Hace ${Math.floor(diffInHours)} horas`;
    } else if (diffInHours < 48) {
      return "Ayer";
    } else {
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative pixel-card bg-adventure p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-mystical text-glow text-pixel">
            📂 CARGAR PARTIDA
          </h2>
          <p className="text-treasure text-pixel text-sm mt-2">
            Selecciona una partida guardada para continuar
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAutoSaves(!showAutoSaves)}
              className={`
                pixel-button text-sm px-4 py-2
                ${showAutoSaves ? 'pixel-button-primary' : 'pixel-button-secondary'}
              `}
            >
              <span className="text-pixel">
                {showAutoSaves ? '✅' : '☐'} Auto-guardados
              </span>
            </button>
            
            <button
              onClick={loadSaves}
              disabled={isLoading}
              className="pixel-button pixel-button-secondary text-sm px-4 py-2"
            >
              <span className="text-pixel">
                {isLoading ? '⏳' : '🔄'} Actualizar
              </span>
            </button>
          </div>

          <div className="text-pixel text-xs text-adventure opacity-70">
            {saves.length} partida{saves.length !== 1 ? 's' : ''} encontrada{saves.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Saves List */}
        <div className="flex-1 overflow-y-auto mb-6" style={{ maxHeight: '400px' }}>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-4xl animate-pulse mb-4">⏳</div>
              <p className="text-pixel text-adventure">Cargando partidas...</p>
            </div>
          ) : saves.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-pixel text-adventure">No hay partidas guardadas</p>
              <p className="text-pixel text-xs text-adventure opacity-70 mt-2">
                {showAutoSaves ? 'Incluyendo auto-guardados' : 'Solo partidas manuales'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {saves.map((save) => (
                <SaveCard
                  key={save.save_id}
                  save={save}
                  isSelected={selectedSave === save.save_id}
                  isConfirmingDelete={confirmDelete === save.save_id}
                  onSelect={setSelectedSave}
                  onLoad={handleLoadGame}
                  onDelete={() => setConfirmDelete(save.save_id)}
                  onCancelDelete={() => setConfirmDelete(null)}
                  onConfirmDelete={handleDeleteSave}
                  formatDate={formatDate}
                  formatFileSize={formatFileSize}
                  isLoadingGame={isLoadingGame}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoadingGame}
            className="flex-1 pixel-button pixel-button-secondary"
          >
            <span className="text-pixel">CANCELAR</span>
          </button>
          
          <button
            onClick={() => selectedSave && handleLoadGame(selectedSave)}
            disabled={!selectedSave || isLoadingGame}
            className={`
              flex-1 pixel-button pixel-button-success
              ${isLoadingGame ? 'animate-pulse' : ''}
            `}
          >
            {isLoadingGame ? (
              <span className="text-pixel flex items-center gap-2">
                ⏳ CARGANDO...
              </span>
            ) : (
              <span className="text-pixel">📂 CARGAR PARTIDA</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Save Card Component
interface SaveCardProps {
  save: SaveMetadata;
  isSelected: boolean;
  isConfirmingDelete: boolean;
  onSelect: (saveId: string) => void;
  onLoad: (saveId: string) => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: (saveId: string) => void;
  formatDate: (date: string) => string;
  formatFileSize: (bytes?: number) => string;
  isLoadingGame: boolean;
}

function SaveCard({ 
  save, 
  isSelected, 
  isConfirmingDelete,
  onSelect, 
  onLoad, 
  onDelete, 
  onCancelDelete,
  onConfirmDelete,
  formatDate, 
  formatFileSize,
  isLoadingGame 
}: SaveCardProps) {
  return (
    <div
      className={`
        pixel-card p-4 cursor-pointer transition-all
        ${isSelected ? 'bg-treasure border-treasure' : 'bg-mystical border-dragon'}
        ${isConfirmingDelete ? 'border-red-500' : ''}
        hover:border-treasure
      `}
      onClick={() => onSelect(save.save_id)}
    >
      <div className="flex items-center gap-4">
        {/* Save Icon */}
        <div className="text-2xl">
          {save.game_over && '☠️'}
          {!save.game_over && save.auto_save && '🔄'}
          {!save.game_over && !save.auto_save && '💾'}
        </div>

        {/* Save Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-pixel font-bold text-adventure">
              {save.title}
            </h3>
            {save.auto_save && (
              <span className="text-xs bg-dragon text-adventure px-2 py-1 rounded">
                AUTO
              </span>
            )}
            {save.game_over && (
              <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded">
                TERMINADO
              </span>
            )}
          </div>
          
          <p className="text-sm text-adventure opacity-70">
            {save.player_name} en {save.location}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-adventure opacity-60">
            <span>Cap. {save.chapter} • Turno {save.turn}</span>
            <span>{formatDate(save.updated_at)}</span>
            <span>{formatFileSize(save.file_size)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isConfirmingDelete ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelDelete();
                }}
                className="pixel-button pixel-button-secondary text-xs px-2 py-1"
              >
                <span className="text-pixel">Cancelar</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmDelete(save.save_id);
                }}
                className="pixel-button pixel-button-danger text-xs px-2 py-1"
              >
                <span className="text-pixel">🗑️ Confirmar</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLoad(save.save_id);
                }}
                disabled={isLoadingGame}
                className="pixel-button pixel-button-primary text-xs px-3 py-1"
              >
                <span className="text-pixel">Cargar</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={isLoadingGame}
                className="pixel-button pixel-button-danger text-xs px-2 py-1"
              >
                <span className="text-pixel">🗑️</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
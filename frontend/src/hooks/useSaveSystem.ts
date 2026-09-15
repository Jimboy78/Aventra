"use client";

import { useState, useCallback, useEffect } from "react";
import { GameState } from "@/types/game";
import { SaveMetadata, GameSettings } from "@/types/api";
import { api } from "@/lib/api";

interface UseSaveSystemReturn {
  // State
  saves: SaveMetadata[];
  isLoading: boolean;
  isAutoSaving: boolean;
  lastAutoSave: Date | null;
  settings: GameSettings;
  
  // Actions
  saveGame: (gameState: GameState, sessionId: string, title?: string) => Promise<string | null>;
  loadGame: (saveId: string) => Promise<{ state: GameState; sessionId: string } | null>;
  deleteSave: (saveId: string) => Promise<boolean>;
  renameSave: (saveId: string, newTitle: string) => Promise<boolean>;
  refreshSaves: () => Promise<void>;
  
  // Auto-save
  triggerAutoSave: (gameState: GameState, sessionId: string) => Promise<void>;
  shouldAutoSave: (gameState: GameState) => boolean;
  
  // Settings
  updateSettings: (newSettings: Partial<GameSettings>) => void;
  
  // Import/Export
  exportSave: (saveId: string) => Promise<void>;
  importSave: (file: File) => Promise<string | null>;
}

const DEFAULT_SETTINGS: GameSettings = {
  auto_save_enabled: true,
  auto_save_interval: 5,
  image_generation: true,
  debug_mode: false,
  sound_enabled: true,
  animations_enabled: true,
};

export function useSaveSystem(): UseSaveSystemReturn {
  const [saves, setSaves] = useState<SaveMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() => {
    // Load settings from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aventra-settings');
      if (saved) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_SETTINGS;
        }
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aventra-settings', JSON.stringify(settings));
    }
  }, [settings]);

  // Save game
  const saveGame = useCallback(async (
    gameState: GameState, 
    sessionId: string, 
    title?: string
  ): Promise<string | null> => {
    try {
      const response = await api.saveGame({
        state: gameState,
        session_id: sessionId,
        title: title || generateAutoTitle(gameState),
        auto_save: false
      });

      if (response.success && response.save_id) {
        await refreshSaves();
        return response.save_id;
      }
      
      throw new Error(response.error || "Error al guardar");
    } catch (error) {
      console.error("Save game error:", error);
      throw error;
    }
  }, []);

  // Load game
  const loadGame = useCallback(async (saveId: string) => {
    try {
      const response = await api.loadGame(saveId);
      
      if (response.success && response.state && response.session_id) {
        return {
          state: response.state,
          sessionId: response.session_id
        };
      }
      
      throw new Error(response.error || "Error al cargar");
    } catch (error) {
      console.error("Load game error:", error);
      throw error;
    }
  }, []);

  // Delete save
  const deleteSave = useCallback(async (saveId: string): Promise<boolean> => {
    try {
      const response = await api.deleteSave(saveId);
      
      if (response.success) {
        setSaves(prev => prev.filter(save => save.save_id !== saveId));
        return true;
      }
      
      throw new Error(response.error || "Error al eliminar");
    } catch (error) {
      console.error("Delete save error:", error);
      return false;
    }
  }, []);

  // Rename save
  const renameSave = useCallback(async (saveId: string, newTitle: string): Promise<boolean> => {
    try {
      const response = await api.renameSave(saveId, newTitle);
      
      if (response.success) {
        setSaves(prev => prev.map(save => 
          save.save_id === saveId 
            ? { ...save, title: response.title || newTitle }
            : save
        ));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Rename save error:", error);
      return false;
    }
  }, []);

  // Refresh saves list
  const refreshSaves = useCallback(async () => {
    setIsLoading(true);
    try {
      const savesList = await api.listSaves(true);
      setSaves(savesList.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ));
    } catch (error) {
      console.error("Refresh saves error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-save functionality
  const triggerAutoSave = useCallback(async (gameState: GameState, sessionId: string) => {
    if (!settings.auto_save_enabled) return;
    
    setIsAutoSaving(true);
    try {
      const response = await api.autoSave({
        state: gameState,
        session_id: sessionId,
        title: generateAutoTitle(gameState),
        auto_save: true
      });

      if (response.success) {
        setLastAutoSave(new Date());
        await refreshSaves();
      }
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [settings.auto_save_enabled, refreshSaves]);

  // Check if auto-save should trigger
  const shouldAutoSave = useCallback((gameState: GameState): boolean => {
    if (!settings.auto_save_enabled) return false;
    
    const turnsSinceLastSave = gameState.story_position.turn % settings.auto_save_interval;
    return turnsSinceLastSave === 0 && gameState.story_position.turn > 0;
  }, [settings.auto_save_enabled, settings.auto_save_interval]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Export save
  const exportSave = useCallback(async (saveId: string) => {
    try {
      const blob = await api.exportSave(saveId);
      const save = saves.find(s => s.save_id === saveId);
      const filename = `aventra-save-${save?.title || saveId}.json`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export save error:", error);
      throw error;
    }
  }, [saves]);

  // Import save
  const importSave = useCallback(async (file: File): Promise<string | null> => {
    try {
      const response = await api.importSave(file);
      
      if (response.success && response.save_id) {
        await refreshSaves();
        return response.save_id;
      }
      
      throw new Error(response.error || "Error al importar");
    } catch (error) {
      console.error("Import save error:", error);
      throw error;
    }
  }, [refreshSaves]);

  // Load saves on mount
  useEffect(() => {
    refreshSaves();
  }, [refreshSaves]);

  return {
    // State
    saves,
    isLoading,
    isAutoSaving,
    lastAutoSave,
    settings,
    
    // Actions
    saveGame,
    loadGame,
    deleteSave,
    renameSave,
    refreshSaves,
    
    // Auto-save
    triggerAutoSave,
    shouldAutoSave,
    
    // Settings
    updateSettings,
    
    // Import/Export
    exportSave,
    importSave,
  };
}

// Helper function to generate auto titles
function generateAutoTitle(gameState: GameState): string {
  const player = gameState.characters.find(c => c.role === 'player');
  const playerName = player?.name || 'Aventurero';
  const location = gameState.scene.location || gameState.scene.title || 'Aventra';
  const chapter = gameState.story_position.chapter;
  
  return `${playerName} en ${location} (Cap.${chapter})`;
}
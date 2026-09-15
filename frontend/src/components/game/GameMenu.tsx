"use client";

import { useState } from "react";
import { GameMenuAction, GameSettings } from "@/types/api";

interface GameMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: GameMenuAction['action']) => void;
  gameInProgress?: boolean;
  settings?: GameSettings;
  onSettingsChange?: (settings: GameSettings) => void;
}

export default function GameMenu({ 
  isOpen, 
  onClose, 
  onAction, 
  gameInProgress = false,
  settings,
  onSettingsChange 
}: GameMenuProps) {
  const [showSettings, setShowSettings] = useState(false);

  if (!isOpen) return null;

  const menuActions: GameMenuAction[] = [
    ...(gameInProgress ? [
      { id: 'continue', label: 'Continuar', icon: '▶️', action: 'continue' as const },
      { id: 'save', label: 'Guardar Partida', icon: '💾', action: 'save' as const },
    ] : []),
    { id: 'load', label: 'Cargar Partida', icon: '📂', action: 'load' as const },
    { id: 'new-game', label: 'Nueva Partida', icon: '🎮', action: 'new-game' as const },
    { id: 'settings', label: 'Configuración', icon: '⚙️', action: 'settings' as const },
    ...(gameInProgress ? [
      { id: 'exit', label: 'Salir al Menú', icon: '🚪', action: 'exit' as const }
    ] : [])
  ];

  const handleAction = (action: GameMenuAction['action']) => {
    if (action === 'settings') {
      setShowSettings(true);
      return;
    }
    onAction(action);
    if (action !== 'save') {
      onClose();
    }
  };

  const handleSettingsBack = () => {
    setShowSettings(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Menu Content */}
      <div className="relative pixel-card bg-adventure p-8 w-full max-w-md mx-4">
        {!showSettings ? (
          <>
            {/* Main Menu */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-mystical text-glow mb-2 text-pixel">
                AVENTRA
              </h1>
              <p className="text-treasure text-pixel text-sm">
                Generador de Historias con IA
              </p>
            </div>

            <div className="space-y-3">
              {menuActions.map((menuAction) => (
                <button
                  key={menuAction.id}
                  onClick={() => handleAction(menuAction.action)}
                  disabled={menuAction.disabled}
                  className={`
                    w-full pixel-button pixel-button-primary
                    flex items-center gap-3 p-4 text-left
                    ${menuAction.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <span className="text-xl">{menuAction.icon}</span>
                  <span className="text-pixel font-medium">{menuAction.label}</span>
                </button>
              ))}
            </div>

            {gameInProgress && (
              <div className="mt-6 text-center">
                <p className="text-pixel text-xs text-adventure opacity-70">
                  ESC para cerrar menú
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Settings Panel */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-mystical text-pixel">
                CONFIGURACIÓN
              </h2>
            </div>

            <SettingsPanel 
              settings={settings}
              onSettingsChange={onSettingsChange}
              onBack={handleSettingsBack}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Settings Panel Component
interface SettingsPanelProps {
  settings?: GameSettings;
  onSettingsChange?: (settings: GameSettings) => void;
  onBack: () => void;
}

function SettingsPanel({ settings, onSettingsChange, onBack }: SettingsPanelProps) {
  const currentSettings: GameSettings = {
    auto_save_enabled: true,
    auto_save_interval: 5,
    image_generation: true,
    debug_mode: false,
    sound_enabled: true,
    animations_enabled: true,
    ...settings
  };

  const handleSettingChange = (key: keyof GameSettings, value: any) => {
    const newSettings = { ...currentSettings, [key]: value };
    onSettingsChange?.(newSettings);
  };

  return (
    <div className="space-y-6">
      {/* Gameplay Settings */}
      <div>
        <h3 className="text-pixel font-bold text-treasure mb-3">JUEGO</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Auto-guardado"
            description="Guarda automáticamente cada ciertos turnos"
            value={currentSettings.auto_save_enabled}
            onChange={(value) => handleSettingChange('auto_save_enabled', value)}
          />
          
          {currentSettings.auto_save_enabled && (
            <SettingSlider
              label="Intervalo de auto-guardado"
              description={`Cada ${currentSettings.auto_save_interval} turnos`}
              min={1}
              max={10}
              value={currentSettings.auto_save_interval}
              onChange={(value) => handleSettingChange('auto_save_interval', value)}
            />
          )}

          <SettingToggle
            label="Generación de imágenes"
            description="Crear imágenes automáticamente para escenas"
            value={currentSettings.image_generation}
            onChange={(value) => handleSettingChange('image_generation', value)}
          />
        </div>
      </div>

      {/* Interface Settings */}
      <div>
        <h3 className="text-pixel font-bold text-treasure mb-3">INTERFAZ</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Sonidos"
            description="Efectos de sonido del juego"
            value={currentSettings.sound_enabled}
            onChange={(value) => handleSettingChange('sound_enabled', value)}
          />
          
          <SettingToggle
            label="Animaciones"
            description="Animaciones y transiciones"
            value={currentSettings.animations_enabled}
            onChange={(value) => handleSettingChange('animations_enabled', value)}
          />
        </div>
      </div>

      {/* Advanced Settings */}
      <div>
        <h3 className="text-pixel font-bold text-treasure mb-3">AVANZADO</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Modo Debug"
            description="Mostrar información de desarrollo"
            value={currentSettings.debug_mode}
            onChange={(value) => handleSettingChange('debug_mode', value)}
          />
        </div>
      </div>

      {/* Back Button */}
      <div className="pt-4 border-t border-dragon">
        <button
          onClick={onBack}
          className="w-full pixel-button pixel-button-secondary"
        >
          <span className="text-pixel">← VOLVER</span>
        </button>
      </div>
    </div>
  );
}

// Setting Components
interface SettingToggleProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function SettingToggle({ label, description, value, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 pixel-card bg-mystical">
      <div>
        <p className="text-pixel font-medium text-adventure">{label}</p>
        <p className="text-xs text-adventure opacity-70">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`
          w-12 h-6 rounded-full border-2 relative transition-colors
          ${value 
            ? 'bg-treasure border-treasure' 
            : 'bg-dragon border-dragon'
          }
        `}
      >
        <div
          className={`
            w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform
            ${value ? 'translate-x-6' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  );
}

interface SettingSliderProps {
  label: string;
  description: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

function SettingSlider({ label, description, min, max, value, onChange }: SettingSliderProps) {
  return (
    <div className="p-3 pixel-card bg-mystical">
      <div className="flex justify-between items-center mb-2">
        <p className="text-pixel font-medium text-adventure">{label}</p>
        <span className="text-pixel text-treasure font-bold">{value}</span>
      </div>
      <p className="text-xs text-adventure opacity-70 mb-3">{description}</p>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-dragon rounded-lg appearance-none cursor-pointer slider"
      />
    </div>
  );
}
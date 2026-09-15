'use client';

import { useState } from 'react';
import { PlayerSetup, WorldSetup, SetupSessionRequest } from '@/types/api';
import { api } from '@/lib/api';

import { GameState, LLMOutput } from '@/types/game';

interface GameSetupProps {
  onSetupComplete: (state: GameState, intro: LLMOutput & {
    image_base64?: string;
    mime_type?: string;
    width?: number;
    height?: number;
  }) => void;
  onError: (error: string) => void;
}

export default function GameSetup({ onSetupComplete, onError }: GameSetupProps) {
  const [step, setStep] = useState<'player' | 'world'>('player');
  const [isLoading, setIsLoading] = useState(false);
  
  const [player, setPlayer] = useState<PlayerSetup>({
    name: '',
    race: '',
    class: '',
    traits: [],
    backstory: ''
  });

  const [world, setWorld] = useState<WorldSetup>({
    name: '',
    genre: '',
    description: '',
    rules: [],
    tone: '',
    lethality: 'balanced'
  });

  const [difficulty, setDifficulty] = useState<'story' | 'balanced' | 'hard'>('balanced');

  const handlePlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!player.name.trim()) {
      onError('El nombre del personaje es requerido');
      return;
    }
    setStep('world');
  };

  const handleWorldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const setupData: SetupSessionRequest = {
        player,
        world,
        difficulty,
        debug: { enabled: false }
      };

      const response = await api.setupSession(setupData);
      onSetupComplete(response.state, response.intro);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Error al configurar el juego');
    } finally {
      setIsLoading(false);
    }
  };

  const addTrait = (trait: string) => {
    if (trait.trim() && !player.traits?.includes(trait)) {
      setPlayer(prev => ({
        ...prev,
        traits: [...(prev.traits || []), trait.trim()]
      }));
    }
  };

  const removeTrait = (index: number) => {
    setPlayer(prev => ({
      ...prev,
      traits: prev.traits?.filter((_, i) => i !== index) || []
    }));
  };

  const addRule = (rule: string) => {
    if (rule.trim() && !world.rules?.includes(rule)) {
      setWorld(prev => ({
        ...prev,
        rules: [...(prev.rules || []), rule.trim()]
      }));
    }
  };

  const removeRule = (index: number) => {
    setWorld(prev => ({
      ...prev,
      rules: prev.rules?.filter((_, i) => i !== index) || []
    }));
  };

  if (step === 'player') {
    return (
      <div className="min-h-screen bg-adventure flex items-center justify-center p-4">
        <div className="pixel-card bg-adventure p-8 w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="emoji-large animate-sparkle mb-4">⚔️</div>
            <h1 className="text-4xl font-bold text-mystical text-glow text-pixel">
              CREAR HÉROE
            </h1>
            <p className="text-treasure text-pixel mt-2">Forja tu leyenda...</p>
          </div>
          
          <form onSubmit={handlePlayerSubmit} className="space-y-6">
            <div>
              <label className="block text-treasure text-pixel font-bold mb-3">
                <span className="emoji-medium">✨</span> NOMBRE DEL HÉROE *
              </label>
              <input
                type="text"
                value={player.name}
                onChange={(e) => setPlayer(prev => ({ ...prev, name: e.target.value }))}
                className="w-full pixel-input"
                placeholder="Tu nombre de aventurero..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-treasure text-pixel font-bold mb-3">
                  <span className="emoji-medium">🧬</span> RAZA
                </label>
                <input
                  type="text"
                  value={player.race || ''}
                  onChange={(e) => setPlayer(prev => ({ ...prev, race: e.target.value }))}
                  className="w-full pixel-input"
                  placeholder="Humano, Elfo, Enano..."
                />
              </div>

              <div>
                <label className="block text-treasure text-pixel font-bold mb-3">
                  <span className="emoji-medium">⚔️</span> CLASE
                </label>
                <input
                  type="text"
                  value={player.class || ''}
                  onChange={(e) => setPlayer(prev => ({ ...prev, class: e.target.value }))}
                  className="w-full pixel-input"
                  placeholder="Guerrero, Mago, Ladrón..."
                />
              </div>
            </div>

            <div>
              <label className="block text-treasure text-pixel font-bold mb-3">
                <span className="emoji-medium">🎭</span> RASGOS ESPECIALES
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {player.traits?.map((trait, index) => (
                  <span
                    key={index}
                    className="status-effect status-effect-magical flex items-center gap-2"
                  >
                    {trait}
                    <button
                      type="button"
                      onClick={() => removeTrait(index)}
                      className="pixel-button pixel-button-danger text-xs p-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                className="w-full pixel-input"
                placeholder="Valiente, Astuto, Maldito... (Enter para añadir)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTrait(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-treasure text-pixel font-bold mb-3">
                <span className="emoji-medium">📜</span> HISTORIA DEL HÉROE
              </label>
              <textarea
                value={player.backstory || ''}
                onChange={(e) => setPlayer(prev => ({ ...prev, backstory: e.target.value }))}
                className="w-full pixel-input h-24 resize-none"
                placeholder="Cuenta la historia de tu héroe antes de la aventura..."
              />
            </div>

            <button
              type="submit"
              className="w-full pixel-button pixel-button-primary py-4 animate-pixel-glow"
            >
              <span className="text-pixel text-lg flex items-center justify-center gap-2">
                <span className="emoji-medium">🌍</span>
                CONTINUAR AL MUNDO
              </span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-adventure flex items-center justify-center p-4">
      <div className="pixel-card bg-adventure p-8 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <div className="emoji-large animate-sparkle mb-4">🌍</div>
            <h1 className="text-4xl font-bold text-mystical text-glow text-pixel">
              FORJAR MUNDO
            </h1>
            <p className="text-treasure text-pixel mt-2">Crea tu reino...</p>
          </div>
          <button
            onClick={() => setStep('player')}
            className="pixel-button flex items-center gap-2"
          >
            <span className="emoji-medium">←</span>
            <span className="text-pixel">ATRÁS</span>
          </button>
        </div>
        
        <form onSubmit={handleWorldSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-treasure text-pixel font-bold mb-3">
                <span className="emoji-medium">🏰</span> NOMBRE DEL REINO
              </label>
              <input
                type="text"
                value={world.name || ''}
                onChange={(e) => setWorld(prev => ({ ...prev, name: e.target.value }))}
                className="w-full pixel-input"
                placeholder="Aventra, Tierra Mística..."
              />
            </div>

            <div>
              <label className="block text-treasure text-pixel font-bold mb-3">
                <span className="emoji-medium">🎭</span> GÉNERO
              </label>
              <input
                type="text"
                value={world.genre || ''}
                onChange={(e) => setWorld(prev => ({ ...prev, genre: e.target.value }))}
                className="w-full pixel-input"
                placeholder="Fantasía Épica, Sci-Fi..."
              />
            </div>
          </div>

          <div>
            <label className="block text-treasure text-pixel font-bold mb-3">
              <span className="emoji-medium">🗺️</span> DESCRIPCIÓN DEL MUNDO
            </label>
            <textarea
              value={world.description || ''}
              onChange={(e) => setWorld(prev => ({ ...prev, description: e.target.value }))}
              className="w-full pixel-input h-24 resize-none"
              placeholder="Tierras místicas llenas de magia y peligro..."
            />
          </div>

          <div>
            <label className="block text-treasure text-pixel font-bold mb-3">
              <span className="emoji-medium">📋</span> LEYES DEL REINO
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {world.rules?.map((rule, index) => (
                <span
                  key={index}
                  className="status-effect status-effect-positive flex items-center gap-2"
                >
                  {rule}
                  <button
                    type="button"
                    onClick={() => removeRule(index)}
                    className="pixel-button pixel-button-danger text-xs p-1"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              className="w-full pixel-input"
              placeholder="La magia es real, Los dragones existen... (Enter)"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRule(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>

          <div>
            <label className="block text-treasure text-pixel font-bold mb-3">
              <span className="emoji-medium">🎭</span> AMBIENTE DE LA AVENTURA
            </label>
            <input
              type="text"
              value={world.tone || ''}
              onChange={(e) => setWorld(prev => ({ ...prev, tone: e.target.value }))}
              className="w-full pixel-input"
              placeholder="Épico y Heróico, Oscuro y Misterioso..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-treasure text-pixel font-bold mb-3">
                <span className="emoji-medium">☠️</span> PELIGRO DEL MUNDO
              </label>
              <select
                value={world.lethality || 'balanced'}
                onChange={(e) => setWorld(prev => ({ 
                  ...prev, 
                  lethality: e.target.value as 'story' | 'balanced' | 'hard' 
                }))}
                className="w-full pixel-input"
              >
                <option value="story">🌸 Pacífico - Baja letalidad</option>
                <option value="balanced">⚔️ Aventurero - Letalidad moderada</option>
                <option value="hard">🔥 Letal - Peligro extremo</option>
              </select>
            </div>

            <div>
              <label className="block text-treasure text-pixel font-bold mb-3">
                <span className="emoji-medium">🎯</span> DESAFÍO
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'story' | 'balanced' | 'hard')}
                className="w-full pixel-input"
              >
                <option value="story">📚 Narrativo - Historia primero</option>
                <option value="balanced">⚖️ Equilibrado - Historia y combate</option>
                <option value="hard">🐉 Extremo - Solo los valientes</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full pixel-button pixel-button-success py-4 animate-pixel-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-pixel text-lg flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <span className="emoji-medium animate-treasure-bounce">⚙️</span>
                  FORJANDO AVENTURA...
                </>
              ) : (
                <>
                  <span className="emoji-medium">🎆</span>
                  ¡COMENZAR AVENTURA!
                </>
              )}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { GameState } from '@/types/game';
import { getHealthColor } from '@/utils';

interface GameStateViewerProps {
  gameState: GameState;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'character' | 'inventory' | 'bestiary' | 'quests' | 'journal';

export default function GameStateViewer({ gameState, isOpen, onClose }: GameStateViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('character');

  if (!isOpen) return null;

  const player = gameState.characters.find(c => c.role === 'player');
  const npcs = gameState.characters.filter(c => c.role === 'npc' || c.role === 'ally');

  const tabs = [
    { id: 'character' as const, label: 'Personaje', icon: '👤' },
    { id: 'inventory' as const, label: 'Inventario', icon: '🎒', count: gameState.inventory.length },
    { id: 'bestiary' as const, label: 'Bestiario', icon: '👹', count: gameState.monsters.length },
    { id: 'quests' as const, label: 'Misiones', icon: '📜', count: gameState.quests?.length || 0 },
    { id: 'journal' as const, label: 'Diario', icon: '📖', count: gameState.journal?.length || 0 },
  ];

  const renderCharacterSheet = () => (
    <div className="space-y-6">
      {player && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {player.name}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                Información Básica
              </h4>
              <div className="space-y-2 text-sm">
                {player.race && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Raza:</span>
                    <span className="font-medium">{player.race}</span>
                  </div>
                )}
                {player.class && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Clase:</span>
                    <span className="font-medium">{player.class}</span>
                  </div>
                )}
                {player.health !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Salud:</span>
                    <span className={`font-medium ${getHealthColor(player.health)}`}>
                      {player.health}/100
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                Rasgos
              </h4>
              {player.traits && player.traits.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {player.traits.map((trait, index) => (
                    <span
                      key={index}
                      className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Sin rasgos definidos
                </p>
              )}
            </div>
          </div>

          {player.conditions && player.conditions.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Estados y Condiciones
              </h4>
              <div className="space-y-2">
                {player.conditions.map((condition) => (
                  <div
                    key={condition.id}
                    className={`p-3 rounded-lg border ${
                      condition.type === 'wound' 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : condition.type === 'buff'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : condition.type === 'debuff'
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                        : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h5 className="font-medium">{condition.name}</h5>
                      {condition.severity && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          condition.severity === 'critical' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' :
                          condition.severity === 'severe' ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200' :
                          condition.severity === 'moderate' ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' :
                          'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {condition.severity}
                        </span>
                      )}
                    </div>
                    {condition.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {condition.notes}
                      </p>
                    )}
                    {condition.mechanical_effects && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1 font-medium">
                        {condition.mechanical_effects}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {player.notes && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Notas
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                {player.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* NPCs y aliados */}
      {npcs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Personajes Conocidos
          </h3>
          <div className="space-y-3">
            {npcs.map((npc) => (
              <div key={npc.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium">{npc.name}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    npc.role === 'ally' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                  }`}>
                    {npc.role === 'ally' ? 'Aliado' : 'NPC'}
                  </span>
                </div>
                {npc.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {npc.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-4">
      {gameState.inventory.length > 0 ? (
        <div className="grid gap-3">
          {gameState.inventory.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {item.name}
                </h4>
                {item.qty && item.qty > 1 && (
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-sm">
                    ×{item.qty}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎒</div>
          <p className="text-gray-500 dark:text-gray-400">
            Tu inventario está vacío
          </p>
        </div>
      )}
    </div>
  );

  const renderBestiary = () => (
    <div className="space-y-4">
      {gameState.monsters.length > 0 ? (
        <div className="grid gap-3">
          {gameState.monsters.map((monster) => (
            <div
              key={monster.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {monster.name}
                </h4>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    monster.threat_level >= 4 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      : monster.threat_level >= 3
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                      : monster.threat_level >= 2
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  }`}>
                    Amenaza {monster.threat_level}
                  </span>
                </div>
              </div>
              
              {monster.health !== undefined && (
                <div className="mb-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Salud</span>
                    <span className={getHealthColor(monster.health)}>
                      {monster.health > 0 ? monster.health : 'Derrotado'}
                    </span>
                  </div>
                </div>
              )}
              
              {monster.notes && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {monster.notes}
                </p>
              )}

              {monster.conditions && monster.conditions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {monster.conditions.map((condition) => (
                    <span
                      key={condition.id}
                      className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs"
                    >
                      {condition.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👹</div>
          <p className="text-gray-500 dark:text-gray-400">
            No has encontrado criaturas aún
          </p>
        </div>
      )}
    </div>
  );

  const renderQuests = () => (
    <div className="space-y-4">
      {gameState.quests && gameState.quests.length > 0 ? (
        <div className="grid gap-3">
          {gameState.quests.map((quest) => (
            <div
              key={quest.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {quest.title}
                </h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  quest.status === 'completed' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : quest.status === 'failed'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    : quest.status === 'accepted'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {quest.status === 'completed' && '✅ Completada'}
                  {quest.status === 'failed' && '❌ Fallida'}
                  {quest.status === 'accepted' && '⏳ En progreso'}
                  {quest.status === 'offered' && '❓ Ofrecida'}
                </span>
              </div>

              {quest.objectives && quest.objectives.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Objetivos:
                  </h5>
                  <div className="space-y-1">
                    {quest.objectives.map((objective) => (
                      <div key={objective.id} className="flex items-center gap-2 text-sm">
                        <span className={objective.done ? '✅' : '⬜'}>
                          {objective.done ? '✅' : '⬜'}
                        </span>
                        <span className={objective.done ? 'line-through text-gray-500' : ''}>
                          {objective.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {quest.notes && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {quest.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📜</div>
          <p className="text-gray-500 dark:text-gray-400">
            No tienes misiones activas
          </p>
        </div>
      )}
    </div>
  );

  const renderJournal = () => (
    <div className="space-y-4">
      {gameState.journal && gameState.journal.length > 0 ? (
        <div className="space-y-3">
          {gameState.journal
            .sort((a, b) => b.turn - a.turn) // Ordenar por turno descendente (más reciente primero)
            .map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Turno {entry.turn}
                  </h4>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-1 rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {entry.text}
                </p>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📖</div>
          <p className="text-gray-500 dark:text-gray-400">
            Tu diario está vacío
          </p>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'character':
        return renderCharacterSheet();
      case 'inventory':
        return renderInventory();
      case 'bestiary':
        return renderBestiary();
      case 'quests':
        return renderQuests();
      case 'journal':
        return renderJournal();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Estado del Juego
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
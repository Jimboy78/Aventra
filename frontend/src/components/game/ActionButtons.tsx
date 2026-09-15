// Componente de botones de acción con estados automáticos

'use client';

import { useState } from 'react';
import { Action } from '@/types/game';

interface ActionButtonsProps {
  actions: Action[];
  onActionClick: (actionId: string, actionText: string) => void;
  isLoading: boolean;
  className?: string;
}

export function ActionButtons({ 
  actions, 
  onActionClick, 
  isLoading,
  className = '' 
}: ActionButtonsProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleActionClick = (action: Action) => {
    if (isLoading) return;
    
    const actionId = action.id || `action-${Date.now()}`;
    setSelectedAction(actionId);
    onActionClick(actionId, action.text);
  };

  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <div className={`action-buttons space-y-3 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        ¿Qué deseas hacer?
      </h3>
      
      <div className="grid gap-2">
        {actions.map((action, index) => {
          const actionId = action.id || `action-${index}`;
          return (
            <ActionButton
              key={actionId}
              action={action}
              onClick={() => handleActionClick(action)}
              isLoading={isLoading}
              isSelected={selectedAction === actionId}
            />
          );
        })}
      </div>

      {/* Input libre como alternativa */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 mb-2">
          O describe tu propia acción:
        </p>
        {/* Este input será manejado por el componente padre */}
      </div>
    </div>
  );
}

// Componente individual de botón de acción
function ActionButton({
  action,
  onClick,
  isLoading,
  isSelected
}: {
  action: Action;
  onClick: () => void;
  isLoading: boolean;
  isSelected: boolean;
}) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'bajo':
        return 'border-green-300 hover:border-green-400 text-green-700';
      case 'medio':
        return 'border-yellow-300 hover:border-yellow-400 text-yellow-700';
      case 'alto':
        return 'border-red-300 hover:border-red-400 text-red-700';
      default:
        return 'border-gray-300 hover:border-gray-400 text-gray-700';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'bajo':
        return '✓'; // checkmark
      case 'medio':
        return '⚠'; // warning
      case 'alto':
        return '⚡'; // danger
      default:
        return '→';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        relative p-4 border-2 rounded-lg text-left transition-all duration-200
        ${getRiskColor(action.risk || 'bajo')}
        ${isLoading 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:shadow-md active:transform active:scale-[0.98]'
        }
        ${isSelected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
        ${action.may_end_game ? 'border-dashed' : ''}
      `}
    >
      {/* Contenido principal */}
      <div className="flex items-start space-x-3">
        <span className="text-lg flex-shrink-0 mt-0.5">
          {getRiskIcon(action.risk || 'bajo')}
        </span>
        
        <div className="flex-1">
          <p className="font-medium text-gray-900 mb-1">
            {action.text}
          </p>
          
          {action.effect_hint && (
            <p className="text-sm text-gray-600 italic">
              {action.effect_hint}
            </p>
          )}
        </div>
      </div>

      {/* Indicadores de riesgo */}
      <div className="absolute top-2 right-2 flex space-x-1">
        {action.risk && (
          <span className={`
            px-2 py-1 text-xs rounded-full font-medium
            ${action.risk === 'bajo' ? 'bg-green-100 text-green-600' :
              action.risk === 'medio' ? 'bg-yellow-100 text-yellow-600' :
              'bg-red-100 text-red-600'
            }
          `}>
            {action.risk}
          </span>
        )}
        
        {action.may_end_game && (
          <span className="px-2 py-1 text-xs rounded-full font-medium bg-purple-100 text-purple-600">
            ⚠ Final
          </span>
        )}
      </div>

      {/* Loading indicator en botón seleccionado */}
      {isSelected && isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      )}
    </button>
  );
}

export default ActionButtons;
// Componente para manejo de estados de error

'use client';

import { useState } from 'react';

interface ErrorStateProps {
  error: Error | null;
  onRetry?: () => void;
  onClear?: () => void;
  className?: string;
}

export function ErrorState({ 
  error, 
  onRetry, 
  onClear,
  className = '' 
}: ErrorStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorType = (error: Error) => {
    if (error.message.includes('fetch')) return 'network';
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('rate limit')) return 'rate_limit';
    return 'unknown';
  };

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'network':
        return '📡';
      case 'timeout':
        return '⏱️';
      case 'rate_limit':
        return '⚠️';
      default:
        return '❌';
    }
  };

  const getErrorTitle = (type: string) => {
    switch (type) {
      case 'network':
        return 'Problema de conexión';
      case 'timeout':
        return 'Tiempo de espera agotado';
      case 'rate_limit':
        return 'Demasiadas solicitudes';
      default:
        return 'Error inesperado';
    }
  };

  const getErrorMessage = (type: string) => {
    switch (type) {
      case 'network':
        return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
      case 'timeout':
        return 'La solicitud tardó demasiado tiempo. Inténtalo de nuevo.';
      case 'rate_limit':
        return 'Demasiadas solicitudes en poco tiempo. Espera un momento antes de continuar.';
      default:
        return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    }
  };

  const errorType = getErrorType(error);

  return (
    <div className={`error-state bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0 text-2xl">
          {getErrorIcon(errorType)}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-red-800 font-semibold mb-1">
            {getErrorTitle(errorType)}
          </h3>
          
          <p className="text-red-700 text-sm mb-3">
            {getErrorMessage(errorType)}
          </p>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {onRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isRetrying ? (
                  <>
                    <div className="inline-block animate-spin h-3 w-3 border border-white rounded-full border-t-transparent mr-2"></div>
                    Reintentando...
                  </>
                ) : (
                  'Reintentar'
                )}
              </button>
            )}

            {onClear && (
              <button
                onClick={onClear}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors duration-200"
              >
                Cerrar
              </button>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-red-600 text-sm hover:text-red-700 underline"
            >
              {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
          </div>

          {/* Error details */}
          {showDetails && (
            <div className="mt-3 p-3 bg-red-100 rounded text-xs">
              <pre className="whitespace-pre-wrap text-red-800 font-mono">
                {error.message}
                {error.stack && (
                  <>
                    {'\n\nStack trace:\n'}
                    {error.stack}
                  </>
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente para errores de conexión específicos
export function ConnectionError({ 
  onRetry 
}: { 
  onRetry: () => void 
}) {
  return (
    <div className="connection-error text-center py-8">
      <div className="text-4xl mb-4">🔌</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Conexión perdida
      </h3>
      <p className="text-gray-600 mb-4">
        Se perdió la conexión con el servidor. Intentando reconectar...
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
      >
        Reconectar manualmente
      </button>
    </div>
  );
}

export default ErrorState;
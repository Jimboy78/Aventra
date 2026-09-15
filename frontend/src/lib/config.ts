export const APP_CONFIG = {
  // Backend API Configuration
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  
  // AI SDK Configuration
  AI_SDK: {
    // Stream configuration
    streamMode: 'text' as const,
    maxRetries: 3,
    retryDelay: 1000,
    // Chat configuration
    maxTokens: 2000,
    temperature: 0.7,
  },
  
  // Timeouts para requests
  API_TIMEOUT: 60000, // 60 segundos (más tiempo para streaming)
  STREAM_TIMEOUT: 120000, // 2 minutos para streaming
  
  // Debug Configuration
  DEBUG: {
    enabled: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
    aiDebug: process.env.NEXT_PUBLIC_AI_DEBUG === 'true',
    level: 'basic' as const,
  },
  
  // Configuración de debug por defecto
  DEFAULT_DEBUG: {
    enabled: process.env.NODE_ENV === 'development',
    level: 'basic' as const,
    include: {
      prompts: false,
      state_patches: true,
      memory_ops: false,
      risk_resolution: true,
      timing: true,
    }
  },
  
  // UX Configuration
  ERROR_DISPLAY_DURATION: 5000, // 5 segundos
  TYPING_DELAY: 50, // ms between characters for typing effect
  AUTO_SCROLL_DELAY: 100, // ms delay for auto scroll
  
  // Metadatos de la aplicación
  APP_NAME: 'Aventra',
  APP_DESCRIPTION: 'Generador de Historias Interactivas con IA',
  VERSION: '2.0.0-ai-sdk',
} as const;
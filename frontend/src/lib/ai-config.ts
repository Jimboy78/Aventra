// Configuración del AI SDK de Vercel
// import { openai } from '@ai-sdk/openai';
// import { APP_CONFIG } from './config';

// Configuración del provider OpenAI (para uso futuro)
// export const aiProvider = openai({
//   apiKey: process.env.OPENAI_API_KEY || '',
//   baseURL: APP_CONFIG.API_BASE_URL,
// });

// Configuración por defecto para useChat
export const defaultChatConfig = {
  api: "/api/generate-story",
  maxRetries: 3,
  retryDelay: 1000,
  headers: {
    "Content-Type": "application/json",
  },
};

// Configuración de streaming
export const streamingConfig = {
  streamMode: "text" as const,
  experimental_streamData: true,
};

// Tool definitions para type safety
export const gameTools = {
  updateGameState: {
    description: "Update the current game state with new information",
    parameters: {
      type: "object",
      properties: {
        state: { type: "object" },
        patches: { type: "array" },
      },
      required: ["state"],
    },
  },
  generateImage: {
    description: "Generate an image for the current scene",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string" },
        style: { type: "string" },
        aspect_ratio: { type: "string" },
      },
      required: ["description"],
    },
  },
  debugTrace: {
    description: "Provide debug information about the current generation",
    parameters: {
      type: "object",
      properties: {
        trace: { type: "object" },
        warnings: { type: "array" },
      },
    },
  },
};

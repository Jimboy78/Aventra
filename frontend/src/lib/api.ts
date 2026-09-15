// Cliente API para conectar con el backend de Aventra

import {
  SetupSessionRequest,
  SetupSessionResponse,
  GenerateStoryRequest,
  GenerateStoryResponse,
  SaveGameRequest,
  SaveGameResponse,
  LoadGameResponse,
  SaveMetadata,
  DeleteSaveResponse,
  SaveStatsResponse,
  ImageGenerationRequest,
  ImageResponse,
  MemorySearchRequest,
  MemorySearchResponse,
  MemoryStatsResponse,
  UpdateStateRequest,
  UpdateStateResponse,
  APIError
} from '@/types/api';
import { APP_CONFIG } from './config';

class AventraAPI {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${APP_CONFIG.API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error: APIError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
          status_code: response.status,
        }));
        throw new Error(error.detail || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health');
  }

  // Setup session
  async setupSession(data: SetupSessionRequest): Promise<SetupSessionResponse> {
    return this.request('/api/setup-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Generate story
  async generateStory(data: GenerateStoryRequest): Promise<GenerateStoryResponse> {
    return this.request('/api/generate-story', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== SAVE SYSTEM ====================
  
  // Save game
  async saveGame(data: SaveGameRequest): Promise<SaveGameResponse> {
    return this.request('/api/saves/save-game', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Load game
  async loadGame(saveId: string): Promise<LoadGameResponse> {
    return this.request(`/api/saves/load-game/${saveId}`);
  }

  // List saves
  async listSaves(includeAutoSaves: boolean = true): Promise<SaveMetadata[]> {
    const params = includeAutoSaves ? '' : '?include_auto_saves=false';
    return this.request(`/api/saves/saves${params}`);
  }

  // Delete save
  async deleteSave(saveId: string): Promise<DeleteSaveResponse> {
    return this.request(`/api/saves/delete-save/${saveId}`, {
      method: 'DELETE',
    });
  }

  // Auto save
  async autoSave(data: SaveGameRequest): Promise<SaveGameResponse> {
    return this.request('/api/saves/auto-save', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Save stats
  async getSaveStats(): Promise<SaveStatsResponse> {
    return this.request('/api/saves/save-stats');
  }

  // Cleanup saves
  async cleanupSaves(): Promise<{success: boolean; count: number}> {
    return this.request('/api/saves/cleanup-saves', {
      method: 'POST',
    });
  }

  // Export save
  async exportSave(saveId: string): Promise<Blob> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/saves/export-save/${saveId}`);
    if (!response.ok) {
      throw new Error('Failed to export save');
    }
    return response.blob();
  }

  // Import save
  async importSave(file: File): Promise<SaveGameResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/api/saves/import-save', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    });
  }

  // Rename save
  async renameSave(saveId: string, newTitle: string): Promise<{success: boolean; title: string}> {
    return this.request(`/api/saves/rename-save/${saveId}`, {
      method: 'POST',
      body: JSON.stringify({ title: newTitle }),
    });
  }

  // Get save details
  async getSaveDetails(saveId: string): Promise<SaveMetadata> {
    return this.request(`/api/saves/save-details/${saveId}`);
  }

  // ==================== IMAGE GENERATION ====================
  
  // Generate image
  async generateImage(data: ImageGenerationRequest): Promise<ImageResponse> {
    return this.request('/api/images/generate-image', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== MEMORY SYSTEM ====================
  
  // Search memories
  async searchMemories(data: MemorySearchRequest): Promise<MemorySearchResponse> {
    return this.request('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get recent memories
  async getRecentMemories(sessionId: string, limit: number = 10): Promise<MemorySearchResponse> {
    return this.request(`/api/memory/recent/${sessionId}?limit=${limit}`);
  }

  // Get memory stats
  async getMemoryStats(sessionId: string): Promise<MemoryStatsResponse> {
    return this.request(`/api/memory/stats/${sessionId}`);
  }

  // Get chapter summary
  async getChapterSummary(sessionId: string, chapter: number): Promise<{summary: string}> {
    return this.request(`/api/memory/chapter-summary/${sessionId}/${chapter}`);
  }

  // Cleanup memory
  async cleanupMemory(sessionId: string): Promise<{success: boolean; count: number}> {
    return this.request(`/api/memory/cleanup/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // ==================== STATE MANAGEMENT ====================
  
  // Update state
  async updateState(data: UpdateStateRequest): Promise<UpdateStateResponse> {
    return this.request('/api/state/update-state', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get player view
  async getPlayerView(sessionId: string): Promise<any> {
    return this.request(`/api/state/player-view?session_id=${sessionId}`);
  }

  // Get character view
  async getCharacterView(sessionId: string): Promise<any> {
    return this.request(`/api/state/player-view/character?session_id=${sessionId}`);
  }

  // Get inventory view
  async getInventoryView(sessionId: string): Promise<any> {
    return this.request(`/api/state/player-view/inventory?session_id=${sessionId}`);
  }

  // Get monster details
  async getMonsterDetails(monsterId: string, sessionId: string): Promise<any> {
    return this.request(`/api/state/player-view/monster/${monsterId}?session_id=${sessionId}`);
  }

  // ==================== DEBUG & PERFORMANCE ====================
  
  // Get performance metrics
  async getPerformanceMetrics(): Promise<any> {
    return this.request('/api/debug/performance');
  }

  // Debug health check
  async debugHealthCheck(): Promise<any> {
    return this.request('/api/debug/health');
  }

  // Clear debug metrics
  async clearDebugMetrics(): Promise<{success: boolean}> {
    return this.request('/api/debug/clear-metrics', {
      method: 'POST',
    });
  }

}

// Instancia singleton del cliente API
export const api = new AventraAPI();



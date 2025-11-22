// AI Runtime - Shared AI inference logic
// Communicates with Ollama for embeddings and LLM inference

import axios from 'axios';

export interface EmbeddingResponse {
  embedding: number[];
}

export interface GenerationResponse {
  response: string;
  done: boolean;
}

export class AIRuntime {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generateEmbedding(text: string, model: string = 'all-minilm'): Promise<number[]> {
    try {
      const response = await axios.post<EmbeddingResponse>(`${this.baseUrl}/api/embeddings`, {
        model,
        prompt: text,
      });
      return response.data.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generate(prompt: string, model: string = 'llama3.2:3b'): Promise<string> {
    try {
      const response = await axios.post<GenerationResponse>(`${this.baseUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
      });
      return response.data.response;
    } catch (error) {
      console.error('Error generating text:', error);
      throw error;
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`);
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models.map((m: any) => m.name);
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  }
}

export default AIRuntime;

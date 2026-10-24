import crypto from 'crypto';
import { IEmbeddingProvider } from '../../domain/interfaces/embedding-provider.interface.js';

export class DeterministicHashEmbeddingProvider implements IEmbeddingProvider {
  readonly dimension = 768;

  async embed(text: string): Promise<Float32Array> {
    return this.computeVector(text);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return texts.map(t => this.computeVector(t));
  }

  private computeVector(text: string): Float32Array {
    const vector = new Float32Array(this.dimension);
    if (!text || text.trim().length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    const clean = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = clean.split(/[\s,.;:!?()[\]{}"'\\/-]+/).filter(t => t.length > 0);

    // 1. Proyección de n-gramas de caracteres y tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      this.accumulateToken(vector, token, 1.0);

      // Sub-ngramas de 3 a 5 caracteres para capturar morfología y lematización
      if (token.length >= 3) {
        for (let j = 0; j <= token.length - 3; j++) {
          const tri = token.slice(j, j + 3);
          this.accumulateToken(vector, tri, 0.4);
        }
      }

      // Modulación posicional senoidal
      const posHash = (i * 31) % this.dimension;
      vector[posHash] += Math.sin((i + 1) * 0.15) * 0.2;
    }

    // 2. Normalización euclidiana L2 estricta (invariante: ||v|| = 1.0)
    let sumSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSq);
    if (norm > 1e-12) {
      const invNorm = 1.0 / norm;
      for (let i = 0; i < this.dimension; i++) {
        vector[i] *= invNorm;
      }
    } else {
      vector[0] = 1.0;
    }

    return vector;
  }

  private accumulateToken(vec: Float32Array, str: string, weight: number): void {
    const hash = crypto.createHash('sha256').update(str).digest();
    
    // Extraer 4 buckets pseudo-aleatorios e independientes a partir del digest de 32 bytes
    for (let b = 0; b < 4; b++) {
      const raw32 = hash.readUInt32LE(b * 4);
      const bucket = raw32 % this.dimension;
      const sign = (raw32 & 0x80000000) !== 0 ? 1.0 : -1.0;
      vec[bucket] += sign * weight;
    }
  }
}

export class HybridEmbeddingProvider implements IEmbeddingProvider {
  readonly dimension = 768;
  private fallbackProvider = new DeterministicHashEmbeddingProvider();
  private ollamaHost: string | null;

  constructor(ollamaHost?: string) {
    this.ollamaHost = ollamaHost || process.env.OLLAMA_HOST || null;
  }

  async embed(text: string): Promise<Float32Array> {
    if (this.ollamaHost) {
      try {
        const vec = await this.callOllama(text);
        if (vec) return vec;
      } catch {
        // Fallback inmediato ante caída de servidor Ollama
      }
    }
    return this.fallbackProvider.embed(text);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  private async callOllama(text: string): Promise<Float32Array | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    try {
      const res = await fetch(`${this.ollamaHost}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
        signal: controller.signal
      });

      if (!res.ok) return null;
      const data = await res.json() as { embedding?: number[] };
      if (Array.isArray(data.embedding) && data.embedding.length === this.dimension) {
        return new Float32Array(data.embedding);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly embeddingDimension = 1536;

  constructor(private readonly prisma: PrismaService) {}

  async ensureVectorExtension(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        'CREATE EXTENSION IF NOT EXISTS vector',
      );
      this.logger.log('pgvector extension enabled');
    } catch (error) {
      this.logger.warn(
        `Could not enable pgvector extension: ${(error as Error).message}`,
      );
    }
  }

  async generateEmbedding(text: string, apiKey?: string): Promise<number[]> {
    if (apiKey) {
      return this.generateOpenAiEmbedding(text, apiKey);
    }
    return this.generateMockEmbedding(text);
  }

  async generateEmbeddings(
    texts: string[],
    apiKey?: string,
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text, apiKey);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  async storeChunkEmbedding(
    chunkId: string,
    embedding: number[],
  ): Promise<void> {
    const vectorStr = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      chunkId,
    );
  }

  async searchSimilarChunks(
    queryEmbedding: number[],
    tenantId: string,
    topK: number = 5,
    documentId?: string,
  ): Promise<
    Array<{
      id: string;
      content: string;
      chunkIndex: number;
      documentId: string;
      similarity: number;
      documentTitle: string;
    }>
  > {
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    let query = `
      SELECT
        dc.id,
        dc.content,
        dc.chunk_index as "chunkIndex",
        dc.document_id as "documentId",
        d.title as "documentTitle",
        1 - (dc.embedding <=> $1::vector) as similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.tenant_id = $2
        AND d.status = 'COMPLETED'
        AND dc.embedding IS NOT NULL
    `;

    const params: (string | number)[] = [vectorStr, tenantId];

    if (documentId) {
      query += ` AND dc.document_id = $3`;
      params.push(documentId);
    }

    query += ` ORDER BY dc.embedding <=> $1::vector LIMIT $${params.length + 1}`;
    params.push(topK);

    const results = await this.prisma.$queryRawUnsafe(query, ...params);
    return results as Array<{
      id: string;
      content: string;
      chunkIndex: number;
      documentId: string;
      similarity: number;
      documentTitle: string;
    }>;
  }

  private async generateOpenAiEmbedding(
    text: string,
    apiKey: string,
  ): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`OpenAI embedding error: ${error}`);
      return this.generateMockEmbedding(text);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0].embedding;
  }

  private generateMockEmbedding(text: string): number[] {
    const embedding = new Array(this.embeddingDimension);
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = ((seed << 5) - seed + text.charCodeAt(i)) | 0;
    }

    for (let i = 0; i < this.embeddingDimension; i++) {
      seed = ((seed << 5) - seed + i) | 0;
      embedding[i] = (seed % 1000) / 1000;
    }

    const magnitude = Math.sqrt(
      embedding.reduce((sum: number, v: number) => sum + v * v, 0),
    );
    return embedding.map((v: number) => v / magnitude);
  }
}

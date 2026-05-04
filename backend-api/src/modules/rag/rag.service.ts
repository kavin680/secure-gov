import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DocumentProcessingService } from './document-processing.service';
import { EmbeddingService } from './embedding.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { StorageService } from '../../common/services';
import { RagChatDto } from './dto';

export interface DocumentUploadParams {
  title: string;
  description?: string;
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentProcessing: DocumentProcessingService,
    private readonly embeddingService: EmbeddingService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit() {
    await this.embeddingService.ensureVectorExtension();
  }

  async uploadDocument(
    params: DocumentUploadParams,
    userId: string,
    tenantId: string,
  ) {
    const supportedTypes = this.documentProcessing.getSupportedTypes();
    if (!supportedTypes.includes(params.file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${params.file.mimetype}. Supported: PDF, DOCX, TXT`,
      );
    }

    const result = this.storageService.store({
      buffer: params.file.buffer,
      originalName: params.file.originalname,
      mimeType: params.file.mimetype,
      size: params.file.size,
    });

    const document = await this.prisma.document.create({
      data: {
        tenantId,
        title: params.title,
        description: params.description,
        fileName: params.file.originalname,
        fileType: params.file.mimetype,
        fileSize: params.file.size,
        storageKey: result.storageKey,
        status: 'PENDING',
        uploadedBy: userId,
      },
    });

    this.processDocument(document.id, tenantId).catch((error) => {
      this.logger.error(
        `Background processing failed for document ${document.id}: ${(error as Error).message}`,
      );
    });

    return document;
  }

  async processDocument(documentId: string, tenantId: string): Promise<void> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      const filePath = this.storageService.getFullPath(document.storageKey);
      const text = await this.documentProcessing.extractText(
        filePath,
        document.fileType,
      );

      if (!text || text.trim().length === 0) {
        throw new Error('No text content could be extracted from the document');
      }

      const chunks = this.documentProcessing.chunkText(text);

      const apiKey = await this.getEmbeddingApiKey(tenantId);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = await this.prisma.documentChunk.create({
          data: {
            documentId,
            chunkIndex: i,
            content: chunks[i],
            tokenCount: this.documentProcessing.estimateTokenCount(chunks[i]),
          },
        });

        try {
          const embedding = await this.embeddingService.generateEmbedding(
            chunks[i],
            apiKey,
          );
          await this.embeddingService.storeChunkEmbedding(chunk.id, embedding);
        } catch (embeddingError) {
          this.logger.warn(
            `Embedding generation failed for chunk ${i} of document ${documentId}: ${(embeddingError as Error).message}`,
          );
        }
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          totalChunks: chunks.length,
        },
      });

      this.logger.log(
        `Document ${documentId} processed: ${chunks.length} chunks created`,
      );
    } catch (error) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error).message,
        },
      });

      this.logger.error(
        `Document processing failed: ${(error as Error).message}`,
      );
    }
  }

  async searchDocuments(
    query: string,
    tenantId: string,
    topK: number = 5,
    documentId?: string,
  ) {
    const apiKey = await this.getEmbeddingApiKey(tenantId);
    const queryEmbedding = await this.embeddingService.generateEmbedding(
      query,
      apiKey,
    );

    const results = await this.embeddingService.searchSimilarChunks(
      queryEmbedding,
      tenantId,
      topK,
      documentId,
    );

    return results;
  }

  async ragChat(dto: RagChatDto, userId: string, tenantId: string) {
    const contextChunks = await this.searchDocuments(
      dto.message,
      tenantId,
      dto.topK,
      dto.documentId,
    );

    const contextText = contextChunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: ${chunk.documentTitle}]\n${chunk.content}`,
      )
      .join('\n\n---\n\n');

    const systemPrompt = contextText
      ? `You are a helpful assistant. Answer the user's question based on the following context documents. If the answer cannot be found in the context, say so clearly.\n\n--- Context ---\n${contextText}\n--- End Context ---`
      : 'You are a helpful assistant. No relevant documents were found for this query. Inform the user that no context is available.';

    const response = await this.aiGatewayService.chat(
      {
        model: dto.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dto.message },
        ],
        provider: dto.provider || 'mock',
      },
      userId,
      tenantId,
    );

    return {
      answer: response.content,
      model: response.model,
      provider: response.provider,
      usage: response.usage,
      latencyMs: response.latencyMs,
      logId: response.logId,
      sources: contextChunks.map((chunk) => ({
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        chunkIndex: chunk.chunkIndex,
        similarity: chunk.similarity,
        excerpt: chunk.content.slice(0, 200) + '...',
      })),
    };
  }

  async getDocuments(tenantId: string) {
    return this.prisma.document.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        status: true,
        totalChunks: true,
        errorMessage: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getDocument(id: string, tenantId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, tenantId },
      include: {
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true,
            tokenCount: true,
            createdAt: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async deleteDocument(id: string, tenantId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.storageService.delete(document.storageKey);

    await this.prisma.document.delete({
      where: { id },
    });

    return { message: 'Document deleted successfully' };
  }

  async reprocessDocument(id: string, tenantId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.documentChunk.deleteMany({
      where: { documentId: id },
    });

    await this.prisma.document.update({
      where: { id },
      data: { status: 'PENDING', totalChunks: 0, errorMessage: null },
    });

    this.processDocument(id, tenantId).catch((error) => {
      this.logger.error(
        `Reprocessing failed for document ${id}: ${(error as Error).message}`,
      );
    });

    return { message: 'Document reprocessing started' };
  }

  async getDocumentStats(tenantId: string) {
    const [totalDocuments, byStatus, totalChunks] = await Promise.all([
      this.prisma.document.count({ where: { tenantId } }),
      this.prisma.document.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.documentChunk.count({
        where: { document: { tenantId } },
      }),
    ]);

    return {
      totalDocuments,
      totalChunks,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    };
  }

  private async getEmbeddingApiKey(
    tenantId: string,
  ): Promise<string | undefined> {
    try {
      const apiKey = await this.prisma.apiKey.findFirst({
        where: {
          tenantId,
          provider: 'openai',
          isActive: true,
        },
      });

      if (apiKey) {
        return this.aiGatewayService.decryptApiKey(apiKey.keyHash);
      }
    } catch {
      this.logger.debug(
        'No OpenAI API key found for tenant, using mock embeddings',
      );
    }
    return undefined;
  }
}

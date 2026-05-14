import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { PrismaService } from '../../database/prisma.service';
import { DocumentProcessingService } from './document-processing.service';
import { EmbeddingService } from './embedding.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { StorageService } from '../../common/services';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DOCUMENT_PROCESSING_QUEUE } from './document-processing.constants';

describe('RagService', () => {
  let service: RagService;

  const mockDocument = {
    id: 'doc-1',
    tenantId: 'tenant-1',
    title: 'Test Document',
    description: 'A test document',
    fileName: 'test.txt',
    fileType: 'text/plain',
    fileSize: 1024,
    storageKey: '2026-05-14/abc123.txt',
    status: 'COMPLETED',
    totalChunks: 3,
    errorMessage: null,
    uploadedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    documentChunk: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    apiKey: {
      findFirst: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
  };

  const mockDocumentProcessing = {
    getSupportedTypes: jest
      .fn()
      .mockReturnValue([
        'text/plain',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]),
    extractText: jest.fn(),
    chunkText: jest.fn(),
    estimateTokenCount: jest.fn().mockReturnValue(100),
  };

  const mockEmbeddingService = {
    ensureVectorExtension: jest.fn(),
    generateEmbedding: jest.fn(),
    storeChunkEmbedding: jest.fn(),
    searchSimilarChunks: jest.fn(),
  };

  const mockAiGatewayService = {
    chat: jest.fn(),
    decryptApiKey: jest.fn(),
  };

  const mockStorageService = {
    store: jest.fn(),
    delete: jest.fn(),
    getFullPath: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: DocumentProcessingService,
          useValue: mockDocumentProcessing,
        },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: AiGatewayService, useValue: mockAiGatewayService },
        { provide: StorageService, useValue: mockStorageService },
        {
          provide: getQueueToken(DOCUMENT_PROCESSING_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
  });

  describe('uploadDocument', () => {
    const uploadParams = {
      title: 'Test Document',
      description: 'A test document',
      file: {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('test content'),
      },
    };

    it('should upload a document and queue for processing', async () => {
      mockStorageService.store.mockReturnValue({
        filename: 'abc123.txt',
        storageKey: '2026-05-14/abc123.txt',
        storageType: 'local',
      });
      mockPrisma.document.create.mockResolvedValue(mockDocument);
      mockQueue.add.mockResolvedValue({});

      const result = await service.uploadDocument(
        uploadParams,
        'user-1',
        'tenant-1',
      );

      expect(result.id).toBe('doc-1');
      expect(mockStorageService.store).toHaveBeenCalled();
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            title: 'Test Document',
            status: 'PENDING',
          }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process',
        { documentId: 'doc-1', tenantId: 'tenant-1' },
        expect.any(Object),
      );
    });

    it('should throw BadRequestException for unsupported file type', async () => {
      const badParams = {
        ...uploadParams,
        file: { ...uploadParams.file, mimetype: 'application/zip' },
      };

      await expect(
        service.uploadDocument(badParams, 'user-1', 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fall back to sync processing when queue is unavailable', async () => {
      mockStorageService.store.mockReturnValue({
        filename: 'abc123.txt',
        storageKey: '2026-05-14/abc123.txt',
        storageType: 'local',
      });
      mockPrisma.document.create.mockResolvedValue(mockDocument);
      mockQueue.add.mockRejectedValue(new Error('Queue not available'));

      // processDocument is called async in background, mock its dependencies
      mockPrisma.document.update.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      mockStorageService.getFullPath.mockReturnValue('/uploads/test.txt');
      mockDocumentProcessing.extractText.mockResolvedValue('test content');
      mockDocumentProcessing.chunkText.mockReturnValue(['chunk 1']);
      mockPrisma.documentChunk.create.mockResolvedValue({ id: 'chunk-1' });
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);

      const result = await service.uploadDocument(
        uploadParams,
        'user-1',
        'tenant-1',
      );

      expect(result.id).toBe('doc-1');
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('getDocuments', () => {
    it('should return documents for a tenant', async () => {
      mockPrisma.document.findMany.mockResolvedValue([mockDocument]);

      const result = await service.getDocuments('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Document');
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
        }),
      );
    });

    it('should return empty array when no documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await service.getDocuments('tenant-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getDocument', () => {
    it('should return document with chunks', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        ...mockDocument,
        chunks: [
          {
            id: 'chunk-1',
            chunkIndex: 0,
            content: 'chunk content',
            tokenCount: 50,
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.getDocument('doc-1', 'tenant-1');

      expect(result.title).toBe('Test Document');
      expect(result.chunks).toHaveLength(1);
    });

    it('should throw NotFoundException for nonexistent document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.getDocument('nonexistent', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document and its storage file', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockPrisma.document.delete.mockResolvedValue(mockDocument);

      const result = await service.deleteDocument('doc-1', 'tenant-1');

      expect(result.message).toBe('Document deleted successfully');
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        mockDocument.storageKey,
      );
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
    });

    it('should throw NotFoundException for nonexistent document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDocument('nonexistent', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reprocessDocument', () => {
    it('should reprocess document by clearing chunks and re-queuing', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockPrisma.documentChunk.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.document.update.mockResolvedValue({
        ...mockDocument,
        status: 'PENDING',
        totalChunks: 0,
      });
      mockQueue.add.mockResolvedValue({});

      const result = await service.reprocessDocument('doc-1', 'tenant-1');

      expect(result.message).toBe('Document reprocessing started');
      expect(mockPrisma.documentChunk.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
      });
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'PENDING', totalChunks: 0, errorMessage: null },
        }),
      );
    });

    it('should throw NotFoundException for nonexistent document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.reprocessDocument('nonexistent', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDocumentStats', () => {
    it('should return document statistics for tenant', async () => {
      mockPrisma.document.count.mockResolvedValue(5);
      mockPrisma.document.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: 4 },
        { status: 'FAILED', _count: 1 },
      ]);
      mockPrisma.documentChunk.count.mockResolvedValue(25);

      const result = await service.getDocumentStats('tenant-1');

      expect(result.totalDocuments).toBe(5);
      expect(result.totalChunks).toBe(25);
      expect(result.byStatus).toHaveLength(2);
      expect(result.byStatus[0].status).toBe('COMPLETED');
      expect(result.byStatus[0].count).toBe(4);
    });
  });

  describe('searchDocuments', () => {
    it('should search documents using embeddings', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockEmbeddingService.searchSimilarChunks.mockResolvedValue([
        {
          id: 'chunk-1',
          content: 'relevant content',
          chunkIndex: 0,
          documentId: 'doc-1',
          documentTitle: 'Test Document',
          similarity: 0.89,
        },
      ]);

      const result = await service.searchDocuments('test query', 'tenant-1', 5);

      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBe(0.89);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        'test query',
        undefined,
      );
    });
  });

  describe('ragChat', () => {
    it('should perform RAG chat with document context', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockEmbeddingService.searchSimilarChunks.mockResolvedValue([
        {
          id: 'chunk-1',
          content: 'Refund policy content here',
          chunkIndex: 0,
          documentId: 'doc-1',
          documentTitle: 'Policy Manual',
          similarity: 0.92,
        },
      ]);
      mockAiGatewayService.chat.mockResolvedValue({
        content: 'Based on the documents, the refund policy states...',
        model: 'gpt-4o-mini',
        provider: 'mock',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 200,
        logId: 'log-1',
      });

      const result = await service.ragChat(
        {
          message: 'What is the refund policy?',
          model: 'gpt-4o-mini',
          provider: 'mock',
          topK: 5,
        },
        'user-1',
        'tenant-1',
      );

      expect(result.answer).toContain('refund policy');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].documentTitle).toBe('Policy Manual');
      expect(result.sources[0].similarity).toBe(0.92);
      expect(mockAiGatewayService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({
              role: 'user',
              content: 'What is the refund policy?',
            }),
          ]),
        }),
        'user-1',
        'tenant-1',
      );
    });

    it('should handle RAG chat with no matching documents', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockEmbeddingService.searchSimilarChunks.mockResolvedValue([]);
      mockAiGatewayService.chat.mockResolvedValue({
        content: 'No relevant documents found.',
        model: 'gpt-4o-mini',
        provider: 'mock',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        latencyMs: 100,
        logId: 'log-2',
      });

      const result = await service.ragChat(
        {
          message: 'Random question',
          model: 'gpt-4o-mini',
          provider: 'mock',
          topK: 5,
        },
        'user-1',
        'tenant-1',
      );

      expect(result.sources).toHaveLength(0);
      expect(result.answer).toBeDefined();
    });
  });

  describe('processDocument', () => {
    it('should process document: extract, chunk, embed', async () => {
      mockPrisma.document.update.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      mockStorageService.getFullPath.mockReturnValue('/uploads/test.txt');
      mockDocumentProcessing.extractText.mockResolvedValue(
        'This is a long document with lots of content.',
      );
      mockDocumentProcessing.chunkText.mockReturnValue(['chunk 1', 'chunk 2']);
      mockPrisma.documentChunk.create
        .mockResolvedValueOnce({ id: 'chunk-1' })
        .mockResolvedValueOnce({ id: 'chunk-2' });
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await service.processDocument('doc-1', 'tenant-1');

      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PROCESSING' }),
        }),
      );
      expect(mockDocumentProcessing.extractText).toHaveBeenCalled();
      expect(mockDocumentProcessing.chunkText).toHaveBeenCalled();
      expect(mockPrisma.documentChunk.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            totalChunks: 2,
          }),
        }),
      );
    });

    it('should mark document as FAILED on error', async () => {
      mockPrisma.document.update.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await service.processDocument('doc-1', 'tenant-1');

      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: expect.any(String),
          }),
        }),
      );
    });
  });
});

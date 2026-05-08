import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { RagService } from './rag.service';
import {
  DOCUMENT_PROCESSING_QUEUE,
  DocumentProcessingJobData,
} from './document-processing.constants';

@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    @Inject(forwardRef(() => RagService))
    private readonly ragService: RagService,
  ) {
    super();
  }

  async process(job: Job<DocumentProcessingJobData>): Promise<void> {
    const { documentId, tenantId } = job.data;
    this.logger.log(
      `Processing document ${documentId} for tenant ${tenantId} (job ${job.id})`,
    );

    try {
      await this.ragService.processDocument(documentId, tenantId);
      this.logger.log(
        `Document ${documentId} processed successfully (job ${job.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Document processing failed for ${documentId} (job ${job.id}): ${(error as Error).message}`,
      );
      throw error;
    }
  }
}

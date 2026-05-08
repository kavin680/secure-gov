import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { DocumentProcessingService } from './document-processing.service';
import { EmbeddingService } from './embedding.service';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { DocumentProcessingProcessor } from './document-processing.processor';
import { DOCUMENT_PROCESSING_QUEUE } from './document-processing.constants';

@Module({
  imports: [
    AiGatewayModule,
    BullModule.registerQueue({ name: DOCUMENT_PROCESSING_QUEUE }),
  ],
  controllers: [RagController],
  providers: [
    RagService,
    DocumentProcessingService,
    EmbeddingService,
    DocumentProcessingProcessor,
  ],
  exports: [RagService],
})
export class RagModule {}

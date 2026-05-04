import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { DocumentProcessingService } from './document-processing.service';
import { EmbeddingService } from './embedding.service';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [AiGatewayModule],
  controllers: [RagController],
  providers: [RagService, DocumentProcessingService, EmbeddingService],
  exports: [RagService],
})
export class RagModule {}

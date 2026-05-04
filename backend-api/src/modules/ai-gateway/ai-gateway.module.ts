import { Module } from '@nestjs/common';
import { PoliciesModule } from '../policies/policies.module';
import { AiGatewayService } from './ai-gateway.service';
import { ApiKeysService } from './api-keys.service';
import { AiGatewayController } from './ai-gateway.controller';
import {
  OpenAiProvider,
  AnthropicProvider,
  GeminiProvider,
  MockAiProvider,
} from './providers';

@Module({
  imports: [PoliciesModule],
  controllers: [AiGatewayController],
  providers: [
    AiGatewayService,
    ApiKeysService,
    OpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
    MockAiProvider,
  ],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}

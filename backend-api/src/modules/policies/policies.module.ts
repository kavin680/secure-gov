import { Module } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PolicyEvaluationService } from './policy-evaluation.service';
import { PoliciesController } from './policies.controller';

@Module({
  controllers: [PoliciesController],
  providers: [PoliciesService, PolicyEvaluationService],
  exports: [PoliciesService, PolicyEvaluationService],
})
export class PoliciesModule {}

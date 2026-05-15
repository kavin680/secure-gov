import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { S3StorageService } from './s3-storage.service';

@Global()
@Module({
  providers: [StorageService, S3StorageService],
  exports: [StorageService, S3StorageService],
})
export class CommonModule {}

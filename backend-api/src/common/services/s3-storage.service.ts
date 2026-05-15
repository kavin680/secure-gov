import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as crypto from 'crypto';
import * as path from 'path';
import { StoreFileParams, StorageResult } from '../interfaces';

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    const enabled = this.configService.get<string>('app.storageType') === 's3';
    this.bucket = this.configService.get<string>('app.s3Bucket') || '';
    this.region = this.configService.get<string>('app.s3Region') || 'us-east-1';
    this.cdnUrl = this.configService.get<string>('app.s3CdnUrl') || '';

    if (enabled && this.bucket) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId:
            this.configService.get<string>('app.s3AccessKeyId') || '',
          secretAccessKey:
            this.configService.get<string>('app.s3SecretAccessKey') || '',
        },
      });
      this.logger.log(`S3 storage initialized: bucket=${this.bucket}`);
    } else {
      this.logger.warn('S3 storage is disabled — using local storage');
    }
  }

  isEnabled(): boolean {
    return this.s3Client !== null;
  }

  async store(params: StoreFileParams): Promise<StorageResult> {
    if (!this.s3Client) {
      throw new Error('S3 storage is not configured');
    }

    const ext = path.extname(params.originalName);
    const hash = crypto.randomBytes(16).toString('hex');
    const datePrefix = new Date().toISOString().split('T')[0];
    const filename = `${hash}${ext}`;
    const storageKey = `${datePrefix}/${filename}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: params.buffer,
        ContentType: params.mimeType,
        ContentLength: params.size,
      }),
    );

    this.logger.log(
      `File uploaded to S3: ${params.originalName} -> ${storageKey}`,
    );

    return {
      filename,
      storageKey,
      storageType: 's3',
      url: this.cdnUrl
        ? `${this.cdnUrl}/${storageKey}`
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${storageKey}`,
    };
  }

  async delete(storageKey: string): Promise<void> {
    if (!this.s3Client) return;

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );

    this.logger.log(`File deleted from S3: ${storageKey}`);
  }

  async getStream(storageKey: string) {
    if (!this.s3Client) {
      throw new Error('S3 storage is not configured');
    }

    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );

    return response.Body;
  }
}

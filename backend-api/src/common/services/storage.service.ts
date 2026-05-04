import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { APP_CONSTANTS } from '../constants';
import { StoreFileParams, StorageResult } from '../interfaces';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get<string>('app.uploadDir') || './uploads';
    this.ensureDirectory(this.uploadDir);
  }

  store(params: StoreFileParams): StorageResult {
    this.validate(params);

    const ext = path.extname(params.originalName);
    const hash = crypto.randomBytes(16).toString('hex');
    const filename = `${hash}${ext}`;
    const datePrefix = new Date().toISOString().split('T')[0];
    const storageKey = path.join(datePrefix, filename);
    const fullPath = path.join(this.uploadDir, storageKey);

    this.ensureDirectory(path.dirname(fullPath));
    fs.writeFileSync(fullPath, params.buffer);

    this.logger.log(
      `File stored: ${params.originalName} -> ${storageKey} (${params.size} bytes)`,
    );

    return { filename, storageKey, storageType: 'local' };
  }

  delete(storageKey: string): void {
    const fullPath = path.join(this.uploadDir, storageKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      this.logger.log(`File deleted: ${storageKey}`);
    }
  }

  getFullPath(storageKey: string): string {
    return path.join(this.uploadDir, storageKey);
  }

  private validate(params: StoreFileParams): void {
    const allowedTypes: readonly string[] =
      APP_CONSTANTS.FILE_UPLOAD.ALLOWED_MIME_TYPES;
    if (!allowedTypes.includes(params.mimeType)) {
      throw new BadRequestException(
        `File type '${params.mimeType}' is not allowed. Allowed: ${APP_CONSTANTS.FILE_UPLOAD.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (params.size > APP_CONSTANTS.FILE_UPLOAD.MAX_FILE_SIZE) {
      const maxMB = APP_CONSTANTS.FILE_UPLOAD.MAX_FILE_SIZE / 1024 / 1024;
      throw new BadRequestException(`File size exceeds maximum of ${maxMB}MB`);
    }
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

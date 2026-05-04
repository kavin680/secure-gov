import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils/pagination.util';

export interface UploadFileParams {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async upload(file: UploadFileParams, userId: string) {
    const result = this.storageService.store({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    const record = await this.prisma.fileUpload.create({
      data: {
        filename: result.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: result.storageKey,
        storageType: result.storageType,
        uploadedBy: userId,
      },
    });

    this.logger.log(
      `File uploaded: ${file.originalname} -> ${result.storageKey}`,
    );
    return record;
  }

  async findByUser(userId: string, query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const [files, total] = await Promise.all([
      this.prisma.fileUpload.findMany({
        where: { uploadedBy: userId },
        skip,
        take,
        orderBy,
      }),
      this.prisma.fileUpload.count({ where: { uploadedBy: userId } }),
    ]);

    return buildPaginatedResult(files, query, total);
  }

  async findOne(id: string) {
    const file = await this.prisma.fileUpload.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async remove(id: string) {
    const file = await this.findOne(id);
    this.storageService.delete(file.storageKey);
    await this.prisma.fileUpload.delete({ where: { id } });
    this.logger.log(`File deleted: ${file.storageKey}`);
    return file;
  }
}

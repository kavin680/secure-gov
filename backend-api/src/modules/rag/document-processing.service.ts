import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  async extractText(filePath: string, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'text/plain':
        return this.extractFromTxt(filePath);
      case 'application/pdf':
        return this.extractFromPdf(filePath);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractFromDocx(filePath);
      default:
        throw new BadRequestException(
          `Unsupported file type for RAG: ${mimeType}. Supported: PDF, DOCX, TXT`,
        );
    }
  }

  chunkText(
    text: string,
    chunkSize: number = 1500,
    overlap: number = 200,
  ): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const cleanText = text.replace(/\n{3,}/g, '\n\n').trim();
    const paragraphs = cleanText.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      if (
        currentChunk.length + trimmed.length + 1 > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + ' ' + trimmed;
      } else {
        currentChunk =
          currentChunk.length > 0 ? currentChunk + '\n\n' + trimmed : trimmed;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    this.logger.log(
      `Chunked text into ${chunks.length} chunks (avg ${Math.round(cleanText.length / Math.max(chunks.length, 1))} chars each)`,
    );
    return chunks;
  }

  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async extractFromTxt(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8');
  }

  private async extractFromPdf(filePath: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }

  private async extractFromDocx(filePath: string): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({
      path: filePath,
    });
    return result.value;
  }

  getSupportedTypes(): string[] {
    return [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
  }
}

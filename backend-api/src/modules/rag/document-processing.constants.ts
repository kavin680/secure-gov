export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';

export interface DocumentProcessingJobData {
  documentId: string;
  tenantId: string;
}

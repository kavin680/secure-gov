export interface StoreFileParams {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StorageResult {
  filename: string;
  storageKey: string;
  storageType: string;
}

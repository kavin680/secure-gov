export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
}

export interface AiProvider {
  readonly name: string;
  readonly supportedModels: string[];

  chat(
    request: AiCompletionRequest,
    apiKey: string,
  ): Promise<AiCompletionResponse>;

  isModelSupported(model: string): boolean;
}

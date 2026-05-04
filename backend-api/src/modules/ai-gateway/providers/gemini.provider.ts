import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  readonly name = 'gemini';
  readonly supportedModels = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ];

  isModelSupported(model: string): boolean {
    return this.supportedModels.some(
      (m) => m.toLowerCase() === model.toLowerCase(),
    );
  }

  async chat(
    request: AiCompletionRequest,
    apiKey: string,
  ): Promise<AiCompletionResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`;

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 1024,
      },
    };

    if (systemMessage) {
      body.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Gemini API error: ${response.status} ${errorBody}`);
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason: string;
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    };

    const text =
      data.candidates[0]?.content?.parts?.map((p) => p.text).join('') ?? '';

    return {
      content: text,
      model: request.model,
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      finishReason: data.candidates[0]?.finishReason ?? 'STOP',
    };
  }
}

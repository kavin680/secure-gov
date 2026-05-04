import { Injectable, Logger } from '@nestjs/common';
import {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from './ai-provider.interface';

@Injectable()
export class AnthropicProvider implements AiProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  readonly name = 'anthropic';
  readonly supportedModels = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
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
    const url = 'https://api.anthropic.com/v1/messages';

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const nonSystemMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model: request.model,
      messages: nonSystemMessages,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.7,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Anthropic API error: ${response.status} ${errorBody}`);
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      model: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
      stop_reason: string;
    };

    const textContent =
      data.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('') ?? '';

    return {
      content: textContent,
      model: data.model,
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      finishReason: data.stop_reason ?? 'end_turn',
    };
  }
}

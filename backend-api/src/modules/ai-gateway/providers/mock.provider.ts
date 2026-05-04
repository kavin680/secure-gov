import { Injectable } from '@nestjs/common';
import {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from './ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  readonly supportedModels = ['mock-model', 'demo-model'];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isModelSupported(_model: string): boolean {
    return true;
  }

  async chat(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const userMessage =
      request.messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    const promptTokens = Math.ceil(userMessage.length / 4);
    const responseText = this.generateMockResponse(userMessage);
    const completionTokens = Math.ceil(responseText.length / 4);

    await new Promise((resolve) =>
      setTimeout(resolve, 200 + Math.random() * 300),
    );

    return {
      content: responseText,
      model: request.model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      finishReason: 'stop',
    };
  }

  private generateMockResponse(prompt: string): string {
    const lower = prompt.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi')) {
      return "Hello! I'm a mock AI assistant running through the Secure Gov AI Gateway. How can I help you today?";
    }

    if (lower.includes('weather')) {
      return "I don't have access to real-time weather data, but this is a mock response from the AI Gateway. In a production setup, I would connect to a weather API or an AI provider like OpenAI to answer your question.";
    }

    if (lower.includes('code') || lower.includes('program')) {
      return '```typescript\n// Mock code response from AI Gateway\nconst greeting = "Hello from Secure Gov!";\nconsole.log(greeting);\n```\nThis is a mock response. Configure a real AI provider API key to get actual code assistance.';
    }

    return `This is a mock response from the Secure Gov AI Gateway. Your prompt was: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}". To get real AI responses, configure an API key for OpenAI, Anthropic, or Google Gemini in your tenant settings.`;
  }
}

import OpenAI from 'openai';
import { log } from '../utils/logger.js';
import { AIResponse, UnifiedMessage } from '../types/index.js';

const DEFAULT_SYSTEM_PROMPT = `Вы - вежливый и профессиональный AI-ассистент службы поддержки.
Ваша задача - помогать клиентам с их вопросами.

Правила:
1. Отвечайте кратко и по существу
2. Будьте дружелюбны и профессиональны
3. Если не знаете ответ - честно скажите об этом
4. При сложных вопросах предложите связаться с оператором
5. Не давайте медицинских, юридических или финансовых советов

Контекст: Вы работаете в компании, которая использует систему DIAR AI для управления клиентами.`;

interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export class AIResponderService {
  private openai: OpenAI | null = null;
  private isAvailable = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.isAvailable = true;
      log.info('AI Responder service initialized');
    } else {
      log.warn('OpenAI API key not configured - AI responses disabled');
    }
  }

  /**
   * Классификация намерения сообщения
   */
  async classifyIntent(text: string): Promise<string> {
    if (!this.openai) return 'unknown';

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Классифицируй намерение сообщения пользователя в одну из категорий:
- greeting: приветствие, начало разговора
- faq: общий вопрос о продукте/услуге
- order_status: вопрос о статусе заказа
- complaint: жалоба или проблема
- payment: вопрос об оплате
- support: запрос на связь с оператором
- other: другое

Верни ТОЛЬКО название категории, без объяснений.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 20,
        temperature: 0,
      });

      const intent = response.choices[0]?.message?.content?.trim().toLowerCase() || 'other';
      log.debug('Intent classified', { text: text.substring(0, 50), intent });
      return intent;
    } catch (error) {
      log.error('Failed to classify intent', error);
      return 'unknown';
    }
  }

  /**
   * Генерация AI ответа
   */
  async generateResponse(
    message: UnifiedMessage,
    systemPrompt?: string,
    context?: ConversationContext
  ): Promise<AIResponse> {
    if (!this.openai) {
      return {
        text: '',
        confidence: 0,
        shouldEscalate: true,
        escalationReason: 'AI not available',
      };
    }

    try {
      // Классифицируем намерение
      const intent = await this.classifyIntent(message.text);

      // Проверяем, нужна ли эскалация по намерению
      const escalationIntents = ['complaint', 'support'];
      if (escalationIntents.includes(intent)) {
        return {
          text: '',
          confidence: 0,
          shouldEscalate: true,
          escalationReason: `Intent requires escalation: ${intent}`,
          intent,
        };
      }

      // Формируем контекст разговора
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        },
      ];

      // Добавляем историю разговора
      if (context?.messages) {
        for (const msg of context.messages.slice(-5)) {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Добавляем текущее сообщение
      messages.push({
        role: 'user',
        content: message.text,
      });

      // Генерируем ответ
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.7,
      });

      const responseText = response.choices[0]?.message?.content?.trim() || '';

      // Рассчитываем confidence (упрощенно)
      const confidence = this.calculateConfidence(responseText, intent);

      log.info('AI response generated', {
        messageId: message.id,
        intent,
        confidence,
        responseLength: responseText.length,
      });

      // Проверяем, нужна ли эскалация по confidence
      if (confidence < 0.7) {
        return {
          text: responseText,
          confidence,
          shouldEscalate: true,
          escalationReason: 'Low confidence',
          intent,
        };
      }

      return {
        text: responseText,
        confidence,
        shouldEscalate: false,
        intent,
      };
    } catch (error) {
      log.error('Failed to generate AI response', error);
      return {
        text: '',
        confidence: 0,
        shouldEscalate: true,
        escalationReason: 'AI generation failed',
      };
    }
  }

  /**
   * Расчет уверенности ответа
   */
  private calculateConfidence(response: string, intent: string): number {
    let confidence = 0.8; // Базовая уверенность

    // Уменьшаем если ответ слишком короткий
    if (response.length < 20) {
      confidence -= 0.2;
    }

    // Уменьшаем если ответ слишком длинный
    if (response.length > 500) {
      confidence -= 0.1;
    }

    // Уменьшаем для неизвестных намерений
    if (intent === 'unknown' || intent === 'other') {
      confidence -= 0.15;
    }

    // Увеличиваем для приветствий
    if (intent === 'greeting') {
      confidence += 0.1;
    }

    // Проверяем на признаки неуверенности в ответе
    const uncertaintyPhrases = [
      'не уверен',
      'возможно',
      'к сожалению',
      'не могу',
      'не знаю',
      'обратитесь',
    ];

    for (const phrase of uncertaintyPhrases) {
      if (response.toLowerCase().includes(phrase)) {
        confidence -= 0.1;
        break;
      }
    }

    // Ограничиваем диапазон
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Проверить ключевые слова эскалации
   */
  checkEscalationKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
  }

  /**
   * Обработать сообщение (полный pipeline)
   */
  async processMessage(
    message: UnifiedMessage,
    config: {
      systemPrompt?: string;
      escalationKeywords?: string[];
      context?: ConversationContext;
    }
  ): Promise<AIResponse> {
    // Проверяем ключевые слова эскалации
    if (config.escalationKeywords?.length) {
      if (this.checkEscalationKeywords(message.text, config.escalationKeywords)) {
        return {
          text: '',
          confidence: 0,
          shouldEscalate: true,
          escalationReason: 'Escalation keyword detected',
        };
      }
    }

    // Генерируем ответ
    return this.generateResponse(message, config.systemPrompt, config.context);
  }

  /**
   * Проверить доступность AI
   */
  isAIAvailable(): boolean {
    return this.isAvailable;
  }
}

// Singleton
let aiResponderService: AIResponderService | null = null;

export function getAIResponderService(): AIResponderService {
  if (!aiResponderService) {
    aiResponderService = new AIResponderService();
  }
  return aiResponderService;
}

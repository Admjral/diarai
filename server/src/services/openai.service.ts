import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { log } from '../utils/logger';

dotenv.config();

// Получаем API ключ Gemini из переменных окружения
const getApiKey = (): string => {
  return process.env.GEMINI_API_KEY ||
         process.env.GOOGLE_AI_KEY ||
         '';
};

// Инициализация Gemini клиента
let genAI: GoogleGenerativeAI | null = null;

try {
  const apiKey = getApiKey();
  if (apiKey && apiKey.length > 0) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini API настроен и готов к использованию');
  } else {
    console.log('⚠️ Gemini API ключ не найден');
  }
} catch (error) {
  console.error('⚠️ Ошибка при инициализации Gemini:', error);
  genAI = null;
}

/**
 * Проверка доступности Gemini API
 */
export function isGeminiAvailable(): boolean {
  const apiKey = getApiKey();
  return !!apiKey && apiKey.length > 0 && genAI !== null;
}

/**
 * Получить информацию о статусе Gemini API
 */
export function getGeminiStatus(): { available: boolean; configured: boolean } {
  const apiKey = getApiKey();
  return {
    available: isGeminiAvailable(),
    configured: !!apiKey && apiKey.length > 0,
  };
}

// Алиасы для обратной совместимости
export const isOpenAIAvailable = isGeminiAvailable;
export const getOpenAIStatus = getGeminiStatus;

/**
 * Генерация текста объявления с помощью Gemini
 * Без fallback шаблонов - Gemini генерирует всё сам
 */
export async function generateAdText(
  campaignName: string,
  category: string,
  location?: string,
  platforms?: string[],
  description?: string
): Promise<string> {
  if (!isGeminiAvailable() || !genAI) {
    log.warn('Gemini недоступен для генерации текста', { campaignName });
    throw new Error('AI сервис временно недоступен. Попробуйте позже.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const platformInfo = platforms && platforms.length > 0
      ? `\nПлатформы: ${platforms.join(', ')}`
      : '';

    const locationInfo = location ? `\nЛокация: ${location}` : '';
    const descriptionText = description ? `\nОписание: ${description}` : '';

    const prompt = `Создай рекламное объявление для "${campaignName}".

Контекст:
- Категория: ${category}${platformInfo}${locationInfo}${descriptionText}

Требования:
1. Длина: 100-200 символов
2. Язык: русский
3. Структура: Привлечение внимания → Выгода → Призыв к действию
4. Стиль: Живой, конкретный, продающий
5. Можно использовать 1-2 эмодзи

Верни ТОЛЬКО текст объявления.`;

    log.debug('Генерирую текст через Gemini', { campaignName, category });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let adText = response.text().trim();

    // Очищаем от лишнего
    adText = adText.replace(/^["'«»]|["'«»]$/g, '').trim();
    adText = adText.replace(/^(Объявление|Текст|Реклама|Вот текст):\s*/i, '').trim();
    adText = adText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    if (adText.length >= 10) {
      // Обрезаем если слишком длинный
      if (adText.length > 250) {
        const lastBreak = Math.max(adText.lastIndexOf('.'), adText.lastIndexOf('!'));
        if (lastBreak > 150) {
          adText = adText.substring(0, lastBreak + 1);
        } else {
          adText = adText.substring(0, 250);
        }
      }

      log.info('✅ Текст объявления сгенерирован', {
        campaignName,
        length: adText.length
      });
      return adText;
    }

    throw new Error('Не удалось сгенерировать текст');
  } catch (error: any) {
    log.error('Ошибка генерации текста', error, { campaignName, category });
    throw new Error(error.message || 'Ошибка генерации текста');
  }
}

/**
 * Генерация рекомендаций по оптимизации кампании
 */
export async function generateRecommendations(
  campaignName: string,
  budget: number,
  platforms: string[],
  category: string,
  description?: string
): Promise<string[]> {
  if (!isGeminiAvailable() || !genAI) {
    log.warn('Gemini недоступен для рекомендаций', { campaignName });
    return ['Настройте таргетинг на вашу целевую аудиторию', 'Тестируйте разные креативы', 'Отслеживайте конверсии'];
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const descriptionText = description ? `\nОписание: ${description}` : '';

    const prompt = `Дай 4 конкретные рекомендации для рекламной кампании "${campaignName}".

Параметры:
- Бюджет: ${budget.toLocaleString()} тенге
- Платформы: ${platforms.join(', ')}
- Категория: ${category}${descriptionText}

Требования:
- Конкретные, практичные советы
- На русском языке
- 1-2 предложения каждая
- Начинай с глагола

Верни список рекомендаций, по одной на строку.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    if (text) {
      const recommendations = text
        .split('\n')
        .map(r => r.replace(/^[\d\.\)\-\*\•]\s*/, '').trim())
        .filter(r => r.length > 15)
        .slice(0, 5);

      if (recommendations.length > 0) {
        log.info('✅ Рекомендации сгенерированы', { campaignName, count: recommendations.length });
        return recommendations;
      }
    }

    return ['Настройте таргетинг на вашу целевую аудиторию', 'Тестируйте разные креативы', 'Отслеживайте метрики'];
  } catch (error) {
    log.error('Ошибка генерации рекомендаций', error as Error, { campaignName });
    return ['Настройте таргетинг', 'Тестируйте креативы', 'Анализируйте результаты'];
  }
}

/**
 * Анализ названия кампании и определение категории
 */
export async function analyzeCampaignCategory(campaignName: string, description?: string): Promise<string> {
  if (!isGeminiAvailable() || !genAI) {
    return analyzeCategoryByKeywords(campaignName);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const descriptionText = description ? `\nОписание: ${description}` : '';

    const prompt = `Определи категорию бизнеса: "${campaignName}"${descriptionText}

Категории: fashion, beauty, tech, food, fitness, education, realEstate, automotive, general

Верни ТОЛЬКО одно слово - название категории.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const category = response.text().trim().toLowerCase().replace(/[^a-z]/g, '');

    const validCategories = ['fashion', 'beauty', 'tech', 'food', 'fitness', 'education', 'realestate', 'automotive', 'general'];
    if (validCategories.includes(category)) {
      return category === 'realestate' ? 'realEstate' : category;
    }

    return analyzeCategoryByKeywords(campaignName);
  } catch (error) {
    log.error('Ошибка анализа категории', error as Error, { campaignName });
    return analyzeCategoryByKeywords(campaignName);
  }
}

/**
 * Генерация интересов для целевой аудитории
 */
export async function generateAudienceInterests(
  campaignName: string,
  category: string,
  description?: string
): Promise<string[]> {
  if (!isGeminiAvailable() || !genAI) {
    return [];
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const descriptionText = description ? `\nОписание: ${description}` : '';

    const prompt = `Определи 6 интересов целевой аудитории для "${campaignName}".

Категория: ${category}${descriptionText}

Требования:
- На русском языке
- Конкретные интересы для таргетинга

Верни список интересов, по одному на строку.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    if (text) {
      const interests = text
        .split('\n')
        .map(i => i.replace(/^[\d\.\)\-\*\•]\s*/, '').trim())
        .filter(i => i.length > 2)
        .slice(0, 8);

      return interests;
    }

    return [];
  } catch (error) {
    log.error('Ошибка генерации интересов', error as Error, { campaignName });
    return [];
  }
}

/**
 * Проверка доступности генерации изображений
 */
export function isImagenAvailable(): boolean {
  return isGeminiAvailable();
}

/**
 * Генерация изображения через Google Gemini API
 */
export async function generateAdImage(
  campaignName: string,
  category: string,
  description?: string
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    log.warn('Gemini недоступен для генерации изображений');
    return null;
  }

  // Стили по категориям
  const styles: Record<string, string> = {
    fashion: 'elegant fashion photography, studio lighting, minimalist',
    beauty: 'beauty product photography, soft lighting, luxury',
    tech: 'modern technology, sleek design, futuristic',
    food: 'appetizing food photography, professional lighting',
    fitness: 'dynamic fitness scene, energetic, motivational',
    education: 'professional educational setting, modern',
    realEstate: 'real estate photography, bright interior',
    automotive: 'automotive photography, dramatic lighting',
    general: 'professional advertising photography, clean design',
  };

  const style = styles[category] || styles.general;
  const desc = description ? `. ${description}` : '';
  const prompt = `Professional advertising image for "${campaignName}"${desc}. Style: ${style}. High resolution, social media ready. No text, no logos.`;

  // Модели для генерации изображений
  const models = [
    'gemini-2.0-flash-exp-image-generation',
    'imagen-3.0-generate-002',
  ];

  for (const model of models) {
    log.info(`Пробую генерацию изображения: ${model}`, { campaignName });

    const result = await tryGenerateImage(apiKey, model, prompt);
    if (result) {
      log.info(`✅ Изображение сгенерировано через ${model}`, { campaignName });
      return result;
    }
  }

  log.warn('Не удалось сгенерировать изображение', { campaignName, category });
  return null;
}

/**
 * Попытка генерации изображения через конкретную модель
 */
async function tryGenerateImage(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate image: ${prompt}` }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Ошибка API ${model}`, new Error(`HTTP ${response.status}`), {
        status: response.status,
        error: errorText.substring(0, 300)
      });
      return null;
    }

    const data: any = await response.json();

    // Ищем изображение в ответе
    for (const candidate of data.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          log.info('Изображение получено', {
            model,
            mimeType: part.inlineData.mimeType,
            sizeKB: Math.round((part.inlineData.data?.length || 0) / 1024)
          });
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    // Проверяем блокировку
    if (data.promptFeedback?.blockReason) {
      log.warn('Контент заблокирован', { model, reason: data.promptFeedback.blockReason });
    }

    return null;
  } catch (error) {
    log.error(`Исключение при генерации ${model}`, error as Error);
    return null;
  }
}

/**
 * Простой анализ категории по ключевым словам
 */
function analyzeCategoryByKeywords(campaignName: string): string {
  const name = campaignName.toLowerCase();
  const keywords: Record<string, string[]> = {
    fashion: ['мода', 'одежда', 'стиль', 'бренд', 'коллекция'],
    beauty: ['красота', 'косметика', 'макияж', 'уход', 'крем'],
    tech: ['технолог', 'гаджет', 'смартфон', 'ноутбук', 'it'],
    food: ['еда', 'ресторан', 'кафе', 'доставка', 'пицца'],
    fitness: ['фитнес', 'спорт', 'тренировк', 'здоровь', 'йога'],
    education: ['обучен', 'курс', 'школ', 'образован'],
    realEstate: ['недвижимост', 'квартир', 'дом', 'аренд'],
    automotive: ['авто', 'машин', 'автомобил', 'запчаст'],
  };

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(word => name.includes(word))) {
      return category;
    }
  }

  return 'general';
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

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
    console.log('✅ Imagen (генерация изображений) доступен через тот же API ключ');
  } else {
    console.log('ℹ️  Gemini API ключ не найден. Используется fallback режим.');
  }
} catch (error) {
  console.error('⚠️  Ошибка при инициализации Gemini:', error);
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
 */
export async function generateAdText(
  campaignName: string,
  category: string,
  location?: string,
  platforms?: string[],
  description?: string
): Promise<string> {
  if (!isGeminiAvailable() || !genAI) {
    return generateFallbackAdText(campaignName, category, location);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const platformInfo = platforms && platforms.length > 0
      ? `\nПлатформы для размещения: ${platforms.join(', ')}`
      : '';

    const locationInfo = location ? `\nЛокация: ${location}` : '';
    const descriptionText = description ? `\n\nОписание бизнеса/продукта: ${description}` : '';

    const platformGuidance = platforms && platforms.length > 0 ? `
Учти специфику платформ:
${platforms.map(p => {
  const guides: Record<string, string> = {
    'Instagram': 'Короткий, визуальный текст, эмоциональный, с эмодзи',
    'Facebook': 'Более информативный, с призывом к действию',
    'TikTok': 'Очень короткий, трендовый, цепляющий',
    'YouTube': 'Информативный, с акцентом на ценность',
    'Google Ads': 'Четкий, с ключевыми словами, призыв к действию',
    'VK': 'Информативный, дружелюбный тон',
    'Telegram Ads': 'Короткий, прямой, с акцентом на выгоду',
  };
  return `- ${p}: ${guides[p] || 'Стандартный формат'}`;
}).join('\n')}` : '';

    const prompt = `Ты профессиональный копирайтер. Создай эффективное рекламное объявление для кампании "${campaignName}".

Категория бизнеса: ${category}${platformInfo}${locationInfo}${descriptionText}${platformGuidance}

ТРЕБОВАНИЯ К ТЕКСТУ:
1. Язык: русский
2. Длина: 80-120 символов (строго соблюдай)
3. Стиль: эмоциональный и убедительный, с четким призывом к действию
4. Формат: без эмодзи в начале текста, можно 1-2 эмодзи в конце
5. Контент: упомяни ключевое преимущество, включи призыв к действию

Верни ТОЛЬКО текст объявления, без кавычек и префиксов.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let adText = response.text().trim();

    // Очищаем от кавычек и префиксов
    adText = adText.replace(/^["'«»]|["'«»]$/g, '').trim();
    adText = adText.replace(/^(Объявление|Текст|Реклама|Ad):\s*/i, '').trim();

    if (adText.length >= 10 && adText.length <= 150) {
      console.log(`✅ Сгенерирован текст объявления (${adText.length} символов)`);
      return adText;
    } else if (adText.length > 150) {
      return adText.substring(0, 150).trim();
    }

    return generateFallbackAdText(campaignName, category, location);
  } catch (error) {
    console.error('Ошибка при генерации текста через Gemini:', error);
    return generateFallbackAdText(campaignName, category, location);
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
    return generateFallbackRecommendations(budget, platforms, category);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const descriptionText = description ? `\n\nОписание бизнеса/продукта: ${description}` : '';

    const budgetGuidance = budget < 20000
      ? 'Ограниченный бюджет - фокус на 1-2 платформах'
      : budget > 100000
      ? 'Большой бюджет - тестирование нескольких аудиторий'
      : 'Средний бюджет - баланс между охватом и конверсией';

    const prompt = `Ты эксперт по цифровому маркетингу. Создай 4-5 конкретных рекомендаций по оптимизации рекламной кампании "${campaignName}".

ПАРАМЕТРЫ КАМПАНИИ:
- Бюджет: ${budget.toLocaleString()} тенге (${budgetGuidance})
- Платформы: ${platforms.join(', ')}
- Категория: ${category}${descriptionText}

ТРЕБОВАНИЯ:
- Каждая рекомендация должна быть конкретной и практичной
- На русском языке
- Длина: 1-2 предложения
- Начинай с глагола (Настройте, Создайте, Запустите)

Верни ТОЛЬКО список рекомендаций, по одной на строку, без нумерации и маркеров.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const recommendationsText = response.text().trim();

    if (recommendationsText) {
      const recommendations = recommendationsText
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 20 && !r.match(/^\d+[\.\)\-\s]/) && !r.match(/^[-\*\•]\s/))
        .slice(0, 5);

      return recommendations.length > 0
        ? recommendations
        : generateFallbackRecommendations(budget, platforms, category);
    }

    return generateFallbackRecommendations(budget, platforms, category);
  } catch (error) {
    console.error('Ошибка при генерации рекомендаций через Gemini:', error);
    return generateFallbackRecommendations(budget, platforms, category);
  }
}

/**
 * Анализ названия кампании и определение категории
 */
export async function analyzeCampaignCategory(campaignName: string, description?: string): Promise<string> {
  if (!isGeminiAvailable() || !genAI) {
    return analyzeCategoryFallback(campaignName);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const descriptionText = description ? `\nОписание: ${description}` : '';

    const prompt = `Определи категорию бизнеса по названию кампании: "${campaignName}"${descriptionText}

Доступные категории:
- fashion (мода, одежда)
- beauty (косметика, уход)
- tech (технологии, гаджеты)
- food (еда, рестораны)
- fitness (спорт, здоровье)
- education (обучение)
- realEstate (недвижимость)
- automotive (авто)
- general (остальное)

Верни ТОЛЬКО название категории на английском (например: fashion).`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const category = response.text().trim().toLowerCase().replace(/[^a-z]/g, '');

    const validCategories = ['fashion', 'beauty', 'tech', 'food', 'fitness', 'education', 'realestate', 'automotive', 'general'];
    if (validCategories.includes(category)) {
      return category === 'realestate' ? 'realEstate' : category;
    }

    return analyzeCategoryFallback(campaignName);
  } catch (error) {
    console.error('Ошибка при анализе категории через Gemini:', error);
    return analyzeCategoryFallback(campaignName);
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

    const prompt = `Определи 6-8 релевантных интересов для целевой аудитории кампании "${campaignName}".

Категория: ${category}${descriptionText}

ТРЕБОВАНИЯ:
- Интересы на русском языке
- Конкретные, для таргетинга (Мода, Фитнес, Технологии и т.д.)

Верни список интересов, по одному на строку, без нумерации.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const interestsText = response.text().trim();

    if (interestsText) {
      const interests = interestsText
        .split('\n')
        .map(i => i.trim())
        .filter(i => i.length > 2 && !i.match(/^\d+[\.\)\-\s]/) && !i.match(/^[-\*\•]\s/))
        .slice(0, 8);

      return interests.length > 0 ? interests : [];
    }

    return [];
  } catch (error) {
    console.error('Ошибка при генерации интересов через Gemini:', error);
    return [];
  }
}

/**
 * Проверка доступности Imagen (использует тот же API ключ что и Gemini)
 */
export function isImagenAvailable(): boolean {
  return isGeminiAvailable();
}

/**
 * Генерация изображения через Google Imagen (Generative AI API)
 * Использует тот же API ключ что и Gemini
 */
export async function generateAdImage(
  campaignName: string,
  category: string,
  description?: string
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('Imagen недоступен - API ключ не настроен');
    return null;
  }

  try {
    // Формируем промпт для генерации рекламного изображения
    const categoryStyles: Record<string, string> = {
      fashion: 'elegant fashion photography, studio lighting, minimalist background, high-end product shot',
      beauty: 'beauty product photography, soft diffused lighting, clean aesthetic, luxury feel',
      tech: 'modern technology visualization, sleek design, futuristic blue tones, premium gadget',
      food: 'appetizing food photography, professional lighting, restaurant quality, gourmet presentation',
      fitness: 'dynamic fitness scene, energetic atmosphere, motivational, active lifestyle',
      education: 'professional educational setting, modern classroom, inspiring learning environment',
      realEstate: 'real estate photography, bright natural interior, welcoming home atmosphere',
      automotive: 'automotive photography, dramatic lighting, premium car, showroom quality',
      general: 'professional advertising photography, clean modern design, commercial quality',
    };

    const style = categoryStyles[category] || categoryStyles.general;
    const descriptionText = description ? `. Product/service: ${description}` : '';

    const prompt = `Professional advertising image for "${campaignName}"${descriptionText}. Style: ${style}. High resolution, suitable for social media marketing and digital ads. No text, no logos, no watermarks.`;

    // Используем Gemini 2.0 Flash Image Generation (рабочая модель)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate image: ${prompt}`
          }]
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini Image Generation API error:', response.status, errorData);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string }
          }>
        }
      }>
    };

    // Ищем изображение в ответе
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          console.log('✅ Изображение сгенерировано через Gemini 2.0 Flash');
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    console.log('Gemini не вернул изображение');
    return null;
  } catch (error) {
    console.error('Ошибка при генерации изображения через Imagen:', error);
    return null;
  }
}

/**
 * Альтернативная генерация через gemini-2.0-flash (если Imagen недоступен)
 * Gemini 2.0 может генерировать изображения
 */
async function generateImageFallback(prompt: string, apiKey: string): Promise<string | null> {
  try {
    // Gemini 2.0 Flash с генерацией изображений
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate an image: ${prompt}`
          }]
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    });

    if (!response.ok) {
      console.error('Gemini 2.0 image generation failed:', response.status);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string }
          }>
        }
      }>
    };

    // Ищем изображение в ответе
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          console.log('✅ Изображение сгенерировано через Gemini 2.0');
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    console.log('Gemini 2.0 не вернул изображение');
    return null;
  } catch (error) {
    console.error('Ошибка генерации через Gemini 2.0:', error);
    return null;
  }
}

// Fallback функции

function generateFallbackAdText(campaignName: string, category: string, location?: string): string {
  const templates: Record<string, string[]> = {
    fashion: [
      `${campaignName}! Откройте для себя новую коллекцию и стильные решения. Эксклюзивные предложения только сейчас!`,
      `${campaignName} - ваш стиль, ваша индивидуальность. Качественные материалы и современный дизайн.`,
    ],
    beauty: [
      `${campaignName} - преобразитесь с нашими продуктами! Профессиональный уход и потрясающие результаты.`,
      `${campaignName}: откройте секрет красоты. Натуральные ингредиенты и проверенная эффективность.`,
    ],
    tech: [
      `${campaignName} - инновационные технологии будущего уже здесь! Современные решения для вашего комфорта.`,
      `${campaignName}: передовые технологии и надежность. Выберите лучшее для себя и своего бизнеса.`,
    ],
    food: [
      `${campaignName} - вкус, который вы запомните! Свежие ингредиенты и быстрая доставка прямо к вам.`,
      `${campaignName}: гастрономическое удовольствие в каждом блюде. Закажите прямо сейчас!`,
    ],
    fitness: [
      `${campaignName} - начните свой путь к идеальной форме! Профессиональные тренировки и поддержка.`,
      `${campaignName}: здоровье и сила в ваших руках. Присоединяйтесь к сообществу активных людей!`,
    ],
    education: [
      `${campaignName} - инвестируйте в свое будущее! Практические знания и реальные результаты.`,
      `${campaignName}: откройте новые возможности. Обучение от практикующих экспертов.`,
    ],
    realEstate: [
      `${campaignName} - найдите дом своей мечты! Лучшие предложения на рынке недвижимости.`,
      `${campaignName}: выгодные условия и надежные сделки. Ваша недвижимость ждет вас!`,
    ],
    automotive: [
      `${campaignName} - качество и надежность на дорогах! Профессиональный сервис и оригинальные запчасти.`,
      `${campaignName}: ваш автомобиль в надежных руках. Опыт и профессионализм в каждом решении.`,
    ],
    general: [
      `${campaignName} - качество, которое вы заслуживаете! Лучшие предложения и индивидуальный подход.`,
      `${campaignName}: ваш успех - наша цель. Присоединяйтесь к тысячам довольных клиентов!`,
    ],
  };

  const categoryTemplates = templates[category] || templates.general;
  let text = categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];

  if (location) {
    text += ` ${location}.`;
  }

  return text;
}

function generateFallbackRecommendations(budget: number, platforms: string[], category: string): string[] {
  const recommendations: string[] = [];

  if (platforms.includes('Facebook') || platforms.includes('Instagram')) {
    recommendations.push(`Используйте таргетированную рекламу на ${platforms.filter(p => ['Facebook', 'Instagram'].includes(p)).join(' и ')} для привлечения аудитории`);
  }

  if (platforms.includes('TikTok')) {
    recommendations.push('Оптимизируйте креативы для TikTok, добавив вирусные элементы и популярные тренды');
  }

  if (platforms.includes('Google Ads')) {
    recommendations.push('Запустите ремаркетинг в Google Ads для пользователей, которые уже посетили ваш сайт');
  }

  if (platforms.includes('YouTube')) {
    recommendations.push('Создайте контент с полезной информацией на YouTube для улучшения SEO');
  }

  if (budget < 20000) {
    recommendations.push('Рекомендуем сфокусироваться на 1-2 платформах для максимальной эффективности');
  } else if (budget > 100000) {
    recommendations.push('Большой бюджет позволяет тестировать несколько аудиторий и проводить A/B тестирование');
  }

  return recommendations.slice(0, 4);
}

function analyzeCategoryFallback(campaignName: string): string {
  const nameLower = campaignName.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    fashion: ['мода', 'одежда', 'стиль', 'бренд', 'коллекция', 'sale', 'распродажа'],
    beauty: ['красота', 'косметика', 'макияж', 'уход', 'крем', 'парфюм'],
    tech: ['технологии', 'гаджеты', 'смартфон', 'ноутбук', 'электроника', 'it'],
    food: ['еда', 'ресторан', 'кафе', 'доставка', 'пицца', 'бургер', 'кухня'],
    fitness: ['фитнес', 'спорт', 'тренировка', 'здоровье', 'йога', 'тренажер'],
    education: ['обучение', 'курсы', 'школа', 'университет', 'образование'],
    realEstate: ['недвижимость', 'квартира', 'дом', 'аренда', 'продажа'],
    automotive: ['авто', 'машина', 'автомобиль', 'запчасти', 'сервис'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => nameLower.includes(keyword))) {
      return category;
    }
  }

  return 'general';
}

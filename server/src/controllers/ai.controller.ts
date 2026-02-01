import { Request, Response } from 'express';
import {
  generateAdText,
  generateRecommendations,
  analyzeCampaignCategory,
  generateAdImage,
  generateAudienceInterests,
  isOpenAIAvailable,
  getOpenAIStatus
} from '../services/openai.service';
import { getStorageService } from '../services/storage.service';
import { log } from '../utils/logger';

interface AIAudienceRequest {
  campaignName: string;
  platforms: string[];
  budget: number;
  phone?: string;
  location?: string;
  description?: string;
}

interface AIAudienceResponse {
  interests: string[];
  ageRange: string;
  platforms: string[];
  optimizedBid?: number;
  adText?: string;
  recommendations?: string[];
  aiPowered?: boolean;
}

/**
 * AI функция для подбора целевой аудитории
 * Анализирует название кампании, платформы и бюджет для оптимального подбора
 * Использует GPT API если доступен, иначе fallback логику
 */
async function selectTargetAudience(data: AIAudienceRequest): Promise<AIAudienceResponse> {
  const { campaignName, platforms, budget, location, description } = data;
  
  // Анализ категории с помощью GPT или fallback
  let businessCategory: string;
  if (isOpenAIAvailable()) {
    businessCategory = await analyzeCampaignCategory(campaignName, description);
  } else {
    // Fallback анализ
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
    
    businessCategory = 'general';
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => nameLower.includes(keyword))) {
        businessCategory = category;
        break;
      }
    }
  }
  
  // Базовые интересы по категориям
  const categoryInterests: Record<string, string[]> = {
    fashion: ['Мода', 'Стиль', 'Дизайн', 'Тренды', 'Шоппинг', 'Бренды'],
    beauty: ['Красота', 'Косметика', 'Уход за собой', 'Мода', 'Здоровье', 'Wellness'],
    tech: ['Технологии', 'Гаджеты', 'Инновации', 'IT', 'Программирование', 'Электроника'],
    food: ['Еда', 'Рестораны', 'Кулинария', 'Доставка еды', 'Гастрономия', 'Рецепты'],
    fitness: ['Фитнес', 'Спорт', 'Здоровье', 'Тренировки', 'Йога', 'Активный образ жизни'],
    education: ['Образование', 'Обучение', 'Развитие', 'Карьера', 'Навыки', 'Курсы'],
    realEstate: ['Недвижимость', 'Инвестиции', 'Бизнес', 'Финансы', 'Строительство'],
    automotive: ['Автомобили', 'Техника', 'Механика', 'Сервис', 'Запчасти'],
    general: ['Бизнес', 'Технологии', 'Образование', 'Развлечения', 'Новости', 'Lifestyle'],
  };
  
  // Возрастные диапазоны по платформам и категориям
  const platformAgeRanges: Record<string, { min: number; max: number }> = {
    'Instagram': { min: 18, max: 34 },
    'Facebook': { min: 25, max: 45 },
    'Google Ads': { min: 25, max: 55 },
    'TikTok': { min: 16, max: 30 },
    'YouTube': { min: 18, max: 45 },
    'VK': { min: 20, max: 40 },
    'Telegram Ads': { min: 22, max: 40 },
  };
  
  // Собираем интересы из категории
  const baseInterests = categoryInterests[businessCategory] || categoryInterests.general;
  
  // Объединяем интересы всех платформ
  const allInterests = new Set<string>(baseInterests);
  
  // Пытаемся получить более точные интересы через GPT, если доступен
  if (isOpenAIAvailable()) {
    try {
      const aiInterests = await generateAudienceInterests(campaignName, businessCategory, description);
      if (aiInterests.length > 0) {
        // Добавляем AI-сгенерированные интересы
        aiInterests.forEach(interest => allInterests.add(interest));
      }
    } catch (error) {
      console.error('Ошибка при генерации интересов через GPT, используем базовые:', error);
    }
  }
  
  // Добавляем специфичные интересы по платформам
  platforms.forEach(platform => {
    const platformInterests: Record<string, string[]> = {
      'Instagram': ['Фотография', 'Визуальный контент', 'Мода', 'Lifestyle'],
      'Facebook': ['Бизнес', 'Новости', 'Социальные сети', 'Образование'],
      'Google Ads': ['Поиск', 'Информация', 'Покупки', 'Бизнес'],
      'TikTok': ['Развлечения', 'Музыка', 'Тренды', 'Креативность'],
      'YouTube': ['Видео', 'Образование', 'Развлечения', 'Обзоры'],
      'VK': ['Социальные сети', 'Новости', 'Бизнес', 'Образование'],
      'Telegram Ads': ['Технологии', 'IT', 'Бизнес', 'Криптовалюты'],
    };
    
    (platformInterests[platform] || []).forEach(interest => allInterests.add(interest));
  });
  
  // Вычисляем возрастной диапазон
  const ageRanges = platforms
    .map(p => platformAgeRanges[p])
    .filter(Boolean);
  
  let minAge = Math.min(...ageRanges.map(r => r.min));
  let maxAge = Math.max(...ageRanges.map(r => r.max));
  
  // Корректировка на основе бюджета
  if (budget > 100000) {
    // Большой бюджет - расширяем аудиторию
    maxAge = Math.min(maxAge + 10, 65);
    minAge = Math.max(minAge - 5, 18);
  } else if (budget < 20000) {
    // Малый бюджет - сужаем для лучшей конверсии
    maxAge = Math.max(maxAge - 5, minAge + 5);
  }
  
  // Корректировка на основе локации (если указана)
  if (location) {
    const locationLower = location.toLowerCase();
    if (locationLower.includes('казахстан') || locationLower.includes('алматы') || locationLower.includes('астана')) {
      // Для Казахстана немного расширяем возраст
      maxAge = Math.min(maxAge + 3, 60);
    }
  }
  
  // Оптимизация ставки на основе бюджета и платформ
  const optimizedBid = calculateOptimalBid(budget, platforms.length, businessCategory);
  
  // Генерация текста объявления (использует GPT если доступен)
  const adText = await generateAdText(campaignName, businessCategory, location, platforms, description);
  
  // Рекомендации (использует GPT если доступен)
  const recommendations = await generateRecommendations(campaignName, budget, platforms, businessCategory, description);
  
  return {
    interests: Array.from(allInterests).slice(0, 8),
    ageRange: `${minAge}-${maxAge}`,
    platforms: [...platforms],
    optimizedBid,
    adText,
    recommendations,
  };
}

/**
 * Расчет оптимальной ставки
 */
function calculateOptimalBid(budget: number, platformCount: number, category: string): number {
  // Базовые ставки по категориям (в тенге)
  const baseBids: Record<string, number> = {
    fashion: 25,
    beauty: 30,
    tech: 35,
    food: 20,
    fitness: 28,
    education: 22,
    realEstate: 40,
    automotive: 45,
    general: 25,
  };
  
  let bid = baseBids[category] || baseBids.general;
  
  // Корректировка на количество платформ (больше платформ = ниже ставка на каждую)
  if (platformCount > 3) {
    bid *= 0.9;
  } else if (platformCount === 1) {
    bid *= 1.1; // Фокус на одной платформе - можно выше ставку
  }
  
  // Корректировка на бюджет
  if (budget > 100000) {
    bid *= 1.15; // Большой бюджет - можем позволить выше ставки
  } else if (budget < 20000) {
    bid *= 0.85; // Малый бюджет - оптимизируем ставки
  }
  
  return Math.round(bid);
}


/**
 * POST /api/ai/audience - Подбор целевой аудитории
 */
export async function getAIAudience(req: Request, res: Response) {
  try {
    const { campaignName, platforms, budget, phone, location, description } = req.body;
    
    if (!campaignName || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ 
        error: 'Необходимы поля: campaignName, platforms (массив), budget' 
      });
    }
    
    if (!budget || typeof budget !== 'number' || budget < 1000) {
      return res.status(400).json({ 
        error: 'Бюджет должен быть числом не менее 1000' 
      });
    }
    
    const result = await selectTargetAudience({
      campaignName,
      platforms,
      budget,
      phone,
      location,
      description,
    });
    
    // Добавляем информацию об использовании GPT
    res.json({
      ...result,
      aiPowered: isOpenAIAvailable(),
    });
  } catch (error) {
    console.error('Ошибка при подборе аудитории:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * GET /api/ai/status - Проверка статуса Gemini API
 */
export async function getAIStatus(req: Request, res: Response) {
  try {
    const status = getOpenAIStatus();
    res.json({
      ...status,
      provider: 'gemini',
      message: status.available
        ? 'Gemini API настроен и готов к использованию'
        : status.configured
        ? 'Gemini API ключ настроен, но недоступен'
        : 'Gemini API ключ не настроен. Используется fallback режим.',
    });
  } catch (error) {
    console.error('Ошибка при проверке статуса Gemini:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Сохраняет изображение из URL в локальное хранилище
 */
async function saveImageToStorage(imageUrl: string, fileName: string = 'dalle-image'): Promise<string | null> {
  try {
    const storageService = getStorageService();

    // Скачиваем и сохраняем изображение в локальное хранилище
    const result = await storageService.uploadFromUrl(imageUrl, 'ai-generated');

    // Получаем публичный URL
    const publicUrl = storageService.getPublicUrl(result.url);

    log.info('AI generated image saved to local storage', {
      originalUrl: imageUrl.substring(0, 50) + '...',
      localUrl: publicUrl,
      size: result.size,
    });

    return publicUrl;
  } catch (error: any) {
    log.error('Error saving AI image to local storage', error);
    return imageUrl; // Возвращаем оригинальный URL при ошибке
  }
}

/**
 * POST /api/ai/generate-image - Генерация изображения для рекламного объявления
 */
export async function generateAdImageHandler(req: Request, res: Response) {
  try {
    const { campaignName, category, description } = req.body;
    
    if (!campaignName) {
      return res.status(400).json({ 
        error: 'Необходимо поле: campaignName' 
      });
    }
    
    // Генерируем изображение через DALL-E
    const imageUrl = await generateAdImage(campaignName, category || 'general', description);
    
    if (!imageUrl) {
      return res.status(503).json({ 
        error: 'Не удалось сгенерировать изображение. Убедитесь, что OpenAI API настроен корректно.' 
      });
    }
    
    // Сохраняем изображение в Supabase Storage, чтобы избежать истечения URL
    const permanentUrl = await saveImageToStorage(imageUrl, `campaign-${campaignName.replace(/\s+/g, '-').toLowerCase()}`);
    
    res.json({ imageUrl: permanentUrl || imageUrl });
  } catch (error) {
    console.error('Ошибка при генерации изображения:', error);
    res.status(500).json({ error: 'Ошибка сервера при генерации изображения' });
  }
}


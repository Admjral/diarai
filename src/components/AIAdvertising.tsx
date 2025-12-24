import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Target, TrendingUp, DollarSign, Eye, MousePointer, Sparkles, X, Plus, Phone, MapPin, BarChart3, Play, Pause, MoreVertical, Loader2, Search, Filter, ArrowUpDown, MessageSquare, Menu } from 'lucide-react';
import { Screen } from '../App';
import { campaignsAPI, aiAPI, APIError, AIAudienceResponse } from '../lib/api';
import { getCache, setCache, clearCache, cacheKeys } from '../lib/cache';
import { CampaignListSkeleton } from './SkeletonLoaders';
import { ConfirmDialog } from './ConfirmDialog';

// Временный тип для формы кампании (пока zod не установлен)
interface CampaignFormData {
  name: string;
  platforms: string[];
  budget: string;
  phone: string;
  location?: string;
  adText?: string;
  imageUrl?: string | null;
}

// Временная функция валидации (заменяет zod)
const validateCampaignForm = (data: CampaignFormData) => {
  const errors: Record<string, { message: string }> = {};

  if (!data.name || data.name.trim().length < 3) {
    errors.name = { message: 'Название кампании должно содержать минимум 3 символа' };
  } else if (data.name.trim().length > 100) {
    errors.name = { message: 'Название кампании не должно превышать 100 символов' };
  }

  if (!data.platforms || data.platforms.length === 0) {
    errors.platforms = { message: 'Выберите хотя бы одну платформу' };
  }

  if (!data.budget || data.budget.trim().length === 0) {
    errors.budget = { message: 'Бюджет обязателен' };
  } else {
    const budgetNum = parseFloat(data.budget.replace(/[^\d.]/g, ''));
    if (isNaN(budgetNum) || budgetNum <= 0) {
      errors.budget = { message: 'Бюджет должен быть положительным числом' };
    } else if (budgetNum < 1000) {
      errors.budget = { message: 'Минимальный бюджет: ₸1,000' };
    }
  }

  if (!data.phone || data.phone.trim().length === 0) {
    errors.phone = { message: 'Номер телефона обязателен' };
  } else {
    const phoneRegex = /^[\d\s()+-]+$/;
    if (!phoneRegex.test(data.phone)) {
      errors.phone = { message: 'Неверный формат номера телефона' };
    } else if (data.phone.replace(/\D/g, '').length < 10) {
      errors.phone = { message: 'Номер телефона должен содержать минимум 10 цифр' };
    }
  }

  if (data.location && data.location.length > 200) {
    errors.location = { message: 'Локация не должна превышать 200 символов' };
  }

  return Object.keys(errors).length === 0 ? undefined : errors;
};

interface AIAdvertisingProps {
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface Campaign {
  id?: number;
  name: string;
  platforms: string[];
  status: string;
  budget: string;
  spent: string;
  conversions: number;
  phone?: string;
  location?: string;
  imageUrl?: string | null;
  audience?: {
    interests: string[];
    ageRange: string;
    platforms: string[];
    adText?: string;
    optimizedBid?: number;
    recommendations?: string[];
  };
}

// Функция для проверки, истек ли URL Azure Blob Storage
function isUrlExpired(url: string): boolean {
  try {
    // Проверяем, является ли это URL Azure Blob Storage
    if (!url.includes('blob.core.windows.net')) {
      return false; // Не Azure Blob Storage, не проверяем
    }

    // Извлекаем параметр se= (expiry time) из URL
    const urlObj = new URL(url);
    const expiryParam = urlObj.searchParams.get('se');
    
    if (!expiryParam) {
      return false; // Нет параметра expiry, считаем что не истек
    }

    // Парсим время истечения (формат: 2025-12-20T20:22:46Z)
    const expiryTime = new Date(expiryParam);
    const now = new Date();
    
    // Добавляем небольшой буфер (5 минут) для учета разницы во времени
    const buffer = 5 * 60 * 1000; // 5 минут в миллисекундах
    
    return expiryTime.getTime() < (now.getTime() + buffer);
  } catch (error) {
    // Если не удалось распарсить URL, возвращаем false
    console.warn('Не удалось проверить срок действия URL:', error);
    return false;
  }
}

// Компонент для отображения изображения с обработкой ошибок
function SafeImage({ 
  src, 
  alt, 
  className = '', 
  containerClassName = '',
  showErrorPlaceholder = true,
  onRegenerate
}: { 
  src: string; 
  alt: string; 
  className?: string;
  containerClassName?: string;
  showErrorPlaceholder?: boolean;
  onRegenerate?: () => void;
}) {
  // Проверяем, истек ли URL при монтировании
  const urlExpired = useMemo(() => isUrlExpired(src), [src]);
  const [imageError, setImageError] = useState(urlExpired);

  // Всегда возвращаем один элемент (span обертка) для стабильности структуры DOM
  // Используем пустой data URL при ошибке, чтобы предотвратить повторные попытки загрузки
  const emptyImageDataUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const imageSrc = (imageError || urlExpired) ? emptyImageDataUrl : src;
  const prevSrcRef = useRef(src);

  // Сбрасываем ошибку при изменении src
  useEffect(() => {
    if (src && src !== prevSrcRef.current && src !== emptyImageDataUrl) {
      const expired = isUrlExpired(src);
      setImageError(expired);
      prevSrcRef.current = src;
    }
  }, [src]);

  // Если URL истек, сразу показываем placeholder (не рендерим img, чтобы избежать ошибок)
  if (urlExpired || imageError) {
    if (showErrorPlaceholder) {
      return (
        <span className="inline-block">
          <div className={`bg-slate-800/50 flex items-center justify-center ${containerClassName || 'w-full h-64'}`}>
            <div className="text-center p-4">
              <Eye className="w-12 h-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm mb-1">Изображение недоступно</p>
              <p className="text-gray-600 text-xs mb-3">Срок действия ссылки истёк</p>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors"
                >
                  Сгенерировать заново
                </button>
              )}
            </div>
          </div>
        </span>
      );
    }
    // Если не показываем placeholder, возвращаем пустой span
    return <span className="inline-block" style={{ display: 'none' }} />;
  }

  return (
    <span className="inline-block">
      <img 
        src={imageSrc} 
        alt={alt}
        className={className}
        onError={(e) => {
          // Подавляем ошибку в консоли для истекших URL
          const target = e.currentTarget;
          const isExpired = isUrlExpired(src);
          
          if (isExpired || !imageError) {
            setImageError(true);
            // Останавливаем дальнейшие попытки загрузки
            target.src = emptyImageDataUrl;
            // Предотвращаем всплытие ошибки в консоль
            e.preventDefault();
            e.stopPropagation();
            // Очищаем src, чтобы браузер не пытался загрузить снова
            setTimeout(() => {
              target.src = emptyImageDataUrl;
            }, 0);
          }
        }}
        onLoadStart={() => {
          // Дополнительная проверка перед началом загрузки
          if (isUrlExpired(src)) {
            setImageError(true);
          }
        }}
      />
    </span>
  );
}

// Компонент для отображения изображения кампании с обработкой ошибок
function CampaignImage({ 
  imageUrl, 
  campaignName,
  onRegenerate,
  isRegenerating
}: { 
  imageUrl: string; 
  campaignName: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}) {
  return (
    <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-5 h-5 text-yellow-400" />
        <h4 className="text-white font-semibold text-sm">Изображение объявления</h4>
      </div>
      <div className="rounded-lg overflow-hidden border border-slate-700/30">
        {isRegenerating ? (
          <div className="w-full min-h-64 bg-slate-800/50 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-2 animate-spin" />
              <p className="text-gray-400 text-sm">Генерация изображения...</p>
            </div>
          </div>
        ) : (
          <SafeImage 
            src={imageUrl}
            alt={`Объявление ${campaignName}`}
            className="w-full h-auto max-h-96 object-cover"
            containerClassName="w-full min-h-64"
            onRegenerate={onRegenerate}
          />
        )}
      </div>
    </div>
  );
}

export function AIAdvertising({ onNavigate, showToast }: AIAdvertisingProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState<number | null>(null);
  
  // Вспомогательная функция для поиска индекса по ID
  const findCampaignIndexById = (id: number | undefined): number => {
    if (!id) return -1;
    return campaigns.findIndex(c => c.id === id);
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaignIndex, setEditingCampaignIndex] = useState<number | null>(null);
  const [isSelectingAudience, setIsSelectingAudience] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState<AIAudienceResponse | null>(null);
  const [generatedAdText, setGeneratedAdText] = useState<string>('');
  const [adDescription, setAdDescription] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [regeneratingImageCampaignId, setRegeneratingImageCampaignId] = useState<number | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [isRegeneratingImageInEdit, setIsRegeneratingImageInEdit] = useState(false);
  const [editingDescription, setEditingDescription] = useState<string>('');
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [statsCampaignIndex, setStatsCampaignIndex] = useState<number | null>(null);
  const [detailCampaignIndex, setDetailCampaignIndex] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const availablePlatforms = ['Instagram', 'Facebook', 'Google Ads', 'TikTok', 'YouTube', 'VK', 'Telegram Ads'];
  
  // Состояния для поиска, фильтрации, сортировки и пагинации
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [showFilters, setShowFilters] = useState(false);

  // Загрузка кампаний при монтировании компонента
  useEffect(() => {
    loadCampaigns();
  }, []);

  // Синхронизация generatedAdText с selectedAudience?.adText
  useEffect(() => {
    if (selectedAudience?.adText && selectedAudience.adText.trim().length > 0) {
      const audienceAdText = selectedAudience.adText.trim();
      const currentAdText = generatedAdText?.trim() || '';
      
      // Если generatedAdText пустой, но есть adText в selectedAudience, устанавливаем его
      if (!currentAdText || currentAdText.length === 0) {
        setGeneratedAdText(audienceAdText);
      } else if (audienceAdText !== currentAdText) {
        // Если generatedAdText уже есть, но selectedAudience.adText отличается, обновляем его
        // Но только если новый текст не пустой и длиннее текущего
        if (audienceAdText.length > currentAdText.length || currentAdText.length < 10) {
          setGeneratedAdText(audienceAdText);
        }
      }
    }
  }, [selectedAudience]);

  // Глобальный обработчик ошибок для изображений с истекшими URL
  useEffect(() => {
    const handleImageError = (event: ErrorEvent) => {
      // Проверяем, является ли это ошибкой загрузки изображения с Azure Blob Storage
      const target = event.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        const src = img.src;
        
        // Если это Azure Blob Storage URL и он истек, подавляем ошибку
        if (src && src.includes('blob.core.windows.net')) {
          if (isUrlExpired(src)) {
            // Подавляем ошибку в консоли
            event.preventDefault();
            event.stopPropagation();
            return false;
          }
        }
      }
      return true;
    };

    // Добавляем обработчик ошибок
    window.addEventListener('error', handleImageError, true);
    
    // Очистка при размонтировании
    return () => {
      window.removeEventListener('error', handleImageError, true);
    };
  }, []);

  const loadCampaigns = async (useCache = true) => {
    try {
      setIsLoading(true);
      
      // Проверяем кэш
      if (useCache) {
        const cached = getCache<Campaign[]>(cacheKeys.campaigns);
        if (cached) {
          setCampaigns(cached);
          setIsLoading(false);
          // Загружаем свежие данные в фоне для обновления
          loadCampaignsFromAPI();
          return;
        }
      }
      
      // Загружаем из API
      await loadCampaignsFromAPI();
    } catch (error: any) {
      console.error('Ошибка загрузки кампаний:', error);
      // Пытаемся использовать кэш при ошибке
      const cached = getCache<Campaign[]>(cacheKeys.campaigns);
      if (cached) {
        setCampaigns(cached);
        // Показываем предупреждение, если это сетевая ошибка
        if (error instanceof APIError && error.isNetworkError) {
          showToast('Используются данные из кэша. Сервер недоступен.', 'info');
        }
      } else {
        const errorMessage = error instanceof APIError 
          ? error.message 
          : (error.message || 'Не удалось загрузить кампании');
        showToast(errorMessage, 'error');
        setCampaigns([]);
      }
      setIsLoading(false);
    }
  };

  const loadCampaignsFromAPI = async () => {
    const data = await campaignsAPI.getAll();
    setCampaigns(data);
    // Сохраняем в кэш
    setCache(cacheKeys.campaigns, data);
    setIsLoading(false);
  };
  
  // React Hook Form для создания кампании
  const createForm = useForm<CampaignFormData>({
    defaultValues: {
      name: '',
      platforms: ['Instagram'],
      budget: '',
      phone: '',
      location: '',
    },
    mode: 'onChange', // Валидация при изменении
  });

  // React Hook Form для редактирования кампании
  const editForm = useForm<CampaignFormData>({
    mode: 'onChange',
  });

  const adCards = [
    {
      title: 'Создать рекламное объявление',
      description: 'AI поможет создать эффективный текст, подобрать изображение и запустит рекламу сразу на всех платформах',
      icon: <Target className="w-8 h-8" />,
      gradient: 'from-blue-500 to-cyan-500',
      onClick: () => setShowCreateModal(true),
    },
    {
      title: 'Оптимизация кампаний',
      description: 'AI анализирует метрики и дает рекомендации по улучшению результатов',
      icon: <TrendingUp className="w-8 h-8" />,
      gradient: 'from-yellow-400 to-amber-500',
      onClick: () => showToast('Функция в разработке', 'info'),
    },
  ];

  const metrics = [
    { label: 'CTR', value: '3.2%', change: '+0.5%', icon: <MousePointer className="w-5 h-5" />, color: 'blue' },
    { label: 'CPM', value: '₸450', change: '-12%', icon: <Eye className="w-5 h-5" />, color: 'purple' },
    { label: 'CPC', value: '₸14', change: '-8%', icon: <MousePointer className="w-5 h-5" />, color: 'green' },
    { label: 'ROAS', value: '4.2x', change: '+18%', icon: <DollarSign className="w-5 h-5" />, color: 'yellow' },
  ];

  // Автоматический подбор целевой аудитории с помощью AI
  const selectTargetAudience = async (campaignName: string, platforms: string[], budget: string, description?: string, phone?: string, location?: string) => {
    setIsSelectingAudience(true);
    
    try {
      const budgetNum = parseFloat(budget.replace(/[^\d.]/g, ''));
      
      if (isNaN(budgetNum) || budgetNum < 1000) {
        throw new Error('Бюджет должен быть не менее 1000');
      }
      
      // Вызываем AI API для подбора аудитории
      const aiResponse = await aiAPI.getAudience({
        campaignName,
        platforms,
        budget: budgetNum,
        phone,
        location,
        description,
      });
      
      // Убеждаемся, что adText существует и не пустой
      const adText = aiResponse.adText?.trim() || '';
      
      // Сначала устанавливаем текст объявления, затем selectedAudience
      // Это гарантирует, что generatedAdText будет установлен до того, как useEffect сработает
      let finalAdText = '';
      
      if (adText && adText.length > 0) {
        finalAdText = adText;
      } else if (aiResponse.adText && aiResponse.adText.trim().length > 0) {
        // Если adText не был извлечен, но есть в aiResponse
        finalAdText = aiResponse.adText.trim();
      } else if (description?.trim()) {
        // Если текст не сгенерирован, используем описание как fallback
        finalAdText = description.trim();
      } else {
        finalAdText = '';
      }
      
      // Устанавливаем generatedAdText СНАЧАЛА
      setGeneratedAdText(finalAdText);
      
      // Затем устанавливаем selectedAudience (это вызовет useEffect, но generatedAdText уже будет установлен)
      setSelectedAudience(aiResponse);
      
      // Дополнительная проверка: если в aiResponse есть adText, но мы его не использовали, обновляем
      if (finalAdText === '' && aiResponse.adText && aiResponse.adText.trim().length > 0) {
        setGeneratedAdText(aiResponse.adText.trim());
      }
      
      return aiResponse;
    } catch (error: any) {
      console.error('Ошибка при подборе аудитории:', error);
      const errorMessage = error instanceof APIError 
        ? error.message 
        : (error.message || 'Не удалось подобрать аудиторию');
      showToast(errorMessage, 'error');
      
      // Fallback на базовую логику при ошибке
      const fallbackAudience: AIAudienceResponse = {
        interests: ['Бизнес', 'Технологии', 'Образование'],
        ageRange: '25-45',
        platforms: [...platforms],
      };
      setSelectedAudience(fallbackAudience);
      return fallbackAudience;
    } finally {
      setIsSelectingAudience(false);
    }
  };

  // Генерация изображения для объявления с помощью AI
  const generateAdImage = async (campaignName: string, category?: string, description?: string) => {
    setIsGeneratingImage(true);
    
    try {
      const response = await aiAPI.generateImage({
        campaignName,
        category,
        description,
      });
      
      setGeneratedImageUrl(response.imageUrl);
      showToast('Изображение успешно сгенерировано!', 'success');
      return response.imageUrl;
    } catch (error: any) {
      console.error('Ошибка при генерации изображения:', error);
      const errorMessage = error instanceof APIError 
        ? error.message 
        : (error.message || 'Не удалось сгенерировать изображение');
      showToast(errorMessage, 'error');
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Регенерация изображения для существующей кампании
  const regenerateCampaignImage = async (campaignIndex: number) => {
    const campaign = campaigns[campaignIndex];
    if (!campaign.id) {
      showToast('Кампания не может быть обновлена', 'error');
      return;
    }

    setRegeneratingImageCampaignId(campaign.id);
    
    try {
      // Определяем категорию на основе названия кампании
      const category = 'general'; // Можно улучшить, добавив поле category в Campaign
      
      // Генерируем изображение напрямую через API, без использования generateAdImage
      // чтобы не устанавливать generatedImageUrl
      const response = await aiAPI.generateImage({
        campaignName: campaign.name,
        category,
      });
      
      if (response.imageUrl) {
        // Обновляем кампанию с новым изображением
        await campaignsAPI.update(campaign.id, { imageUrl: response.imageUrl });
        
        // Обновляем локальное состояние
        setCampaigns(prev => {
          const updated = prev.map(c => 
            c.id === campaign.id ? { ...c, imageUrl: response.imageUrl } : c
          );
          // Обновляем кэш
          setCache(cacheKeys.campaigns, updated);
          return updated;
        });
        
        showToast('Изображение успешно обновлено!', 'success');
      }
    } catch (error: any) {
      console.error('Ошибка при регенерации изображения:', error);
      const errorMessage = error instanceof APIError 
        ? error.message 
        : (error.message || 'Не удалось регенерировать изображение');
      showToast(errorMessage, 'error');
    } finally {
      setRegeneratingImageCampaignId(null);
    }
  };

  const handlePlatformToggle = (platform: string) => {
    const currentPlatforms = createForm.getValues('platforms');
    const newPlatforms = currentPlatforms.includes(platform)
      ? currentPlatforms.filter(p => p !== platform)
      : [...currentPlatforms, platform];
    createForm.setValue('platforms', newPlatforms, { shouldValidate: true });
  };

  const handleEditPlatformToggle = (platform: string) => {
    const currentPlatforms = editForm.getValues('platforms');
    const newPlatforms = currentPlatforms.includes(platform)
      ? currentPlatforms.filter(p => p !== platform)
      : [...currentPlatforms, platform];
    editForm.setValue('platforms', newPlatforms, { shouldValidate: true });
  };

  const handleSelectAllPlatforms = () => {
    const currentPlatforms = createForm.getValues('platforms');
    const allSelected = currentPlatforms.length === availablePlatforms.length;
    createForm.setValue('platforms', allSelected ? [] : [...availablePlatforms], { shouldValidate: true });
  };

  const handleSelectAllEditPlatforms = () => {
    const currentPlatforms = editForm.getValues('platforms');
    const allSelected = currentPlatforms.length === availablePlatforms.length;
    editForm.setValue('platforms', allSelected ? [] : [...availablePlatforms], { shouldValidate: true });
  };

  const toggleCampaignStatus = async (index: number) => {
    const campaign = campaigns[index];
    if (!campaign.id) {
      showToast('Кампания не может быть обновлена', 'error');
      return;
    }

    const newStatus = campaign.status === 'Активна' ? 'На паузе' : 'Активна';
    setIsTogglingStatus(campaign.id);
    
    try {
      await campaignsAPI.update(campaign.id, { status: newStatus });
      
      setCampaigns(prev => {
        const updated = prev.map(c => 
          c.id === campaign.id ? { ...c, status: newStatus } : c
        );
        // Обновляем кэш
        setCache(cacheKeys.campaigns, updated);
        return updated;
      });
      
      showToast(
        campaign.status === 'Активна' 
          ? `Кампания "${campaign.name}" приостановлена` 
          : `Кампания "${campaign.name}" возобновлена`,
        'success'
      );
    } catch (error: any) {
      console.error('Ошибка обновления статуса:', error);
      const errorMessage = error instanceof APIError 
        ? error.message 
        : (error.message || 'Не удалось обновить статус кампании');
      showToast(errorMessage, 'error');
    } finally {
      setIsTogglingStatus(null);
    }
    
    setOpenMenuIndex(null);
  };

  const openCampaignDetail = (index: number) => {
    setDetailCampaignIndex(index);
    setOpenMenuIndex(null);
  };

  const openCampaignStats = (index: number) => {
    setStatsCampaignIndex(index);
    setOpenMenuIndex(null);
  };

  const handleDeleteClick = (index: number) => {
    const campaign = campaigns[index];
    if (!campaign.id) {
      showToast('Кампания не может быть удалена', 'error');
      setOpenMenuIndex(null);
      return;
    }
    setCampaignToDelete(index);
    setDeleteConfirmOpen(true);
    setOpenMenuIndex(null);
  };

  const deleteCampaign = async () => {
    if (campaignToDelete === null) return;
    
    const campaign = campaigns[campaignToDelete];
    if (!campaign.id) {
      showToast('Кампания не может быть удалена', 'error');
      setDeleteConfirmOpen(false);
      setCampaignToDelete(null);
      return;
    }

    setIsDeleting(campaignToDelete);

    try {
      await campaignsAPI.delete(campaign.id);
      setCampaigns(prev => {
        const updated = prev.filter((_, i) => i !== campaignToDelete);
        // Обновляем кэш
        setCache(cacheKeys.campaigns, updated);
        return updated;
      });
      showToast(`Кампания "${campaign.name}" удалена`, 'success');
      setDeleteConfirmOpen(false);
      setCampaignToDelete(null);
    } catch (error: any) {
      console.error('Ошибка удаления кампании:', error);
      const errorMessage = error instanceof APIError 
        ? error.message 
        : (error.message || 'Не удалось удалить кампанию');
      showToast(errorMessage, 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const openEditModal = (index: number) => {
    const campaign = campaigns[index];
    if (!campaign.id) {
      showToast('Кампания не может быть отредактирована', 'error');
      setOpenMenuIndex(null);
      return;
    }

    // Извлекаем числовое значение бюджета из строки
    const budgetValue = campaign.budget.replace(/[^\d.]/g, '');
    
    editForm.reset({
      name: campaign.name,
      platforms: [...campaign.platforms],
      budget: budgetValue,
      phone: campaign.phone || '',
      location: campaign.location || '',
      adText: campaign.audience?.adText || '',
      imageUrl: campaign.imageUrl || null,
    });
    setEditingImageUrl(campaign.imageUrl || null);
    // Восстанавливаем description из audience, если он был сохранен
    setEditingDescription((campaign.audience as any)?.description || '');
    setEditingCampaignIndex(index);
    setShowEditModal(true);
    setOpenMenuIndex(null);
  };

  const handleEditCampaign = async (data: CampaignFormData) => {
    if (editingCampaignIndex === null) return;

    // Валидация перед отправкой
    const validationErrors = validateCampaignForm(data);
    if (validationErrors) {
      // Устанавливаем ошибки в форму
      Object.keys(validationErrors).forEach((key) => {
        editForm.setError(key as keyof CampaignFormData, validationErrors[key]);
      });
      return;
    }

    const campaign = campaigns[editingCampaignIndex];
    if (!campaign.id) {
      showToast('Кампания не может быть обновлена', 'error');
      return;
    }

    try {
      const updateData: any = {
        name: data.name.trim(),
        platforms: data.platforms,
        budget: data.budget,
        phone: data.phone.trim(),
        location: data.location?.trim() || '',
      };

      // Добавляем изображение, если оно было изменено
      if (data.imageUrl !== undefined) {
        updateData.imageUrl = data.imageUrl;
      }

      // Добавляем audience с обновленным текстом объявления, если он был изменен
      if (data.adText !== undefined) {
        updateData.audience = campaign.audience ? {
          ...campaign.audience,
          adText: data.adText.trim() || campaign.audience.adText,
          description: editingDescription || (campaign.audience as any)?.description || null,
        } : {
          interests: [],
          ageRange: '',
          platforms: data.platforms,
          adText: data.adText.trim(),
          description: editingDescription || null,
        };
      } else if (editingDescription) {
        // Сохраняем description даже если adText не изменен
        updateData.audience = campaign.audience ? {
          ...campaign.audience,
          description: editingDescription,
        } : {
          interests: [],
          ageRange: '',
          platforms: data.platforms,
          description: editingDescription,
        };
      }

      const updatedCampaign = await campaignsAPI.update(campaign.id, updateData);
      
      // Обновляем локальное состояние с новыми данными
      setCampaigns(prev => {
        const updated = [...prev];
        const updatedAudience = updateData.audience || campaign.audience;
        updated[editingCampaignIndex] = {
          ...updatedCampaign,
          audience: updatedAudience,
          imageUrl: data.imageUrl !== undefined ? data.imageUrl : campaign.imageUrl,
        };
        // Обновляем кэш
        setCache(cacheKeys.campaigns, updated);
        return updated;
      });

      setShowEditModal(false);
      setEditingCampaignIndex(null);
      setEditingImageUrl(null);
      editForm.reset();
      setEditingDescription('');
      showToast(`Кампания "${data.name}" успешно обновлена`, 'success');
    } catch (error: any) {
      console.error('Ошибка обновления кампании:', error);
      const errorMessage = error instanceof APIError 
        ? error.message 
        : (error.message || 'Не удалось обновить кампанию');
      showToast(errorMessage, 'error');
    }
  };

  const duplicateCampaign = async (index: number) => {
    const campaign = campaigns[index];
    if (!campaign.id) {
      showToast('Кампания не может быть скопирована', 'error');
      return;
    }
    setIsDuplicating(campaign.id);
    setOpenMenuIndex(null);
    
    try {
      const duplicatedData = {
        name: `${campaign.name} (копия)`,
        platforms: campaign.platforms,
        status: 'На паузе',
        budget: campaign.budget,
        spent: '₸0',
        conversions: 0,
        phone: campaign.phone,
        location: campaign.location,
        audience: campaign.audience,
      };

      const newCampaign = await campaignsAPI.create(duplicatedData);
      setCampaigns(prev => {
        const updated = [...prev, newCampaign];
        // Обновляем кэш
        setCache(cacheKeys.campaigns, updated);
        return updated;
      });
      showToast(`Кампания "${campaign.name}" скопирована`, 'success');
    } catch (error: any) {
      console.error('Ошибка копирования кампании:', error);
      const errorMessage = error instanceof APIError 
        ? error.message 
        : (error.message || 'Не удалось скопировать кампанию');
      showToast(errorMessage, 'error');
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleCreateCampaign = async (data: CampaignFormData) => {
    // Валидация перед отправкой
    const validationErrors = validateCampaignForm(data);
    if (validationErrors) {
      // Устанавливаем ошибки в форму
      Object.keys(validationErrors).forEach((key) => {
        createForm.setError(key as keyof CampaignFormData, validationErrors[key]);
      });
      return;
    }
    try {
      // Автоматический подбор целевой аудитории с помощью AI
      const audience = await selectTargetAudience(
        data.name,
        data.platforms,
        data.budget,
        adDescription || undefined,
        data.phone,
        data.location
      );
      
      // Убеждаемся, что selectedAudience и generatedAdText установлены
      if (audience) {
        setSelectedAudience(audience);
        if (audience.adText && audience.adText.trim().length > 0) {
          setGeneratedAdText(audience.adText.trim());
        }
      }
      
      // Преобразуем budget в число или строку (в зависимости от типа)
      const budgetValue = typeof data.budget === 'string' 
        ? data.budget 
        : String(data.budget);
      
      // Очищаем phone и location от пустых строк
      const phoneValue = data.phone?.trim() || null;
      const locationValue = data.location?.trim() || null;
      
      // Определяем финальный текст объявления
      // Используем generatedAdText если он есть, иначе берем из audience
      const finalAdText = generatedAdText?.trim() || audience?.adText?.trim() || adDescription?.trim() || null;
      
      const campaignData = {
        name: data.name.trim(),
        platforms: data.platforms,
        status: 'На проверке',
        budget: budgetValue,
        spent: 0, // Отправляем как число, а не строку
        conversions: 0,
        ...(phoneValue && { phone: phoneValue }),
        ...(locationValue && { location: locationValue }),
        ...(generatedImageUrl && { imageUrl: generatedImageUrl }),
        ...(audience && {
          audience: {
            ...audience,
            adText: finalAdText,
            optimizedBid: audience.optimizedBid || null,
            description: adDescription?.trim() || null,
          },
        }),
      };

      const createdCampaign = await campaignsAPI.create(campaignData);
      
      setCampaigns(prev => {
        const updated = [...prev, createdCampaign];
        // Обновляем кэш
        setCache(cacheKeys.campaigns, updated);
        return updated;
      });
      setShowCreateModal(false);
      createForm.reset();
      setSelectedAudience(null);
      setGeneratedAdText('');
      setGeneratedImageUrl(null);
      setAdDescription('');
      
      const successMessage = `Кампания "${data.name.trim()}" отправлена на проверку. Мы проверим её и активируем в ближайшее время.`;
      showToast(successMessage, 'info');
    } catch (error: any) {
      console.error('Ошибка создания кампании:', error);
      
      // Обработка ошибок валидации с деталями
      if (error instanceof APIError) {
        let errorMessage = error.message;
        
        // Если есть детали ошибки валидации, показываем их
        try {
          const errorData = error as any;
          if (errorData.details && Array.isArray(errorData.details)) {
            const detailsMessages = errorData.details.map((d: any) => `${d.path}: ${d.message}`).join(', ');
            errorMessage = `Ошибка валидации: ${detailsMessages}`;
          }
        } catch {
          // Игнорируем ошибки парсинга
        }
        
        showToast(errorMessage, 'error');
      } else {
        const errorMessage = error.message || 'Не удалось создать кампанию';
        showToast(errorMessage, 'error');
      }
    }
  };

  // Функция сортировки
  const sortData = (data: Campaign[], sortBy: string, order: 'asc' | 'desc') => {
    const sorted = [...data].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'budget':
          aVal = parseFloat(a.budget.replace(/[^\d.]/g, '')) || 0;
          bVal = parseFloat(b.budget.replace(/[^\d.]/g, '')) || 0;
          break;
        case 'spent':
          aVal = parseFloat(a.spent.replace(/[^\d.]/g, '')) || 0;
          bVal = parseFloat(b.spent.replace(/[^\d.]/g, '')) || 0;
          break;
        case 'conversions':
          aVal = a.conversions || 0;
          bVal = b.conversions || 0;
          break;
        case 'date':
        default:
          // Используем id как дату создания (если есть)
          aVal = a.id || 0;
          bVal = b.id || 0;
          break;
      }

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  // Фильтрация и сортировка кампаний
  const filteredAndSortedCampaigns = useMemo(() => {
    let filtered = campaigns.filter(campaign => {
      // Поиск по названию, платформам, телефону, локации
      const matchesSearch = 
        campaign.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.platforms?.some(p => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
        campaign.phone?.includes(searchQuery) ||
        campaign.location?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Фильтр по статусу
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      
      // Фильтр по платформе
      const matchesPlatform = platformFilter === 'all' || 
        campaign.platforms?.some(p => p === platformFilter);
      
      return matchesSearch && matchesStatus && matchesPlatform;
    });

    // Сортировка
    return sortData(filtered, sortBy, sortOrder);
  }, [campaigns, searchQuery, statusFilter, platformFilter, sortBy, sortOrder]);

  // Пагинация
  const totalPages = Math.ceil(filteredAndSortedCampaigns.length / itemsPerPage);
  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCampaigns.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedCampaigns, currentPage, itemsPerPage]);

  // Сброс страницы при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, platformFilter, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white text-lg sm:text-xl truncate">AI Реклама</h1>
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-4 ml-auto">
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Техподдержка</span>
              </button>
            </div>
            {/* Mobile burger menu */}
            <div className="sm:hidden relative ml-auto">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </button>

              {mobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Техподдержка</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Cards */}
        <div className="mb-8">
          <h2 className="text-white mb-6">Инструменты</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adCards.map((card, index) => (
              <button
                key={index}
                onClick={card.onClick}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all duration-300 hover:scale-105 text-left group"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${card.gradient} flex items-center justify-center mb-4 group-hover:shadow-lg transition-shadow`}>
                  {card.icon}
                </div>
                <h3 className="text-white mb-3">{card.title}</h3>
                <p className="text-gray-400">{card.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="mb-8">
          <h2 className="text-white mb-6">Ключевые метрики</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400">{metric.label}</span>
                  <div className={`text-${metric.color}-400`}>{metric.icon}</div>
                </div>
                <div className="text-white mb-1">{metric.value}</div>
                <div className={`${metric.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {metric.change} за неделю
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Optimization Insight */}
        <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white mb-2">Рекомендация AI по оптимизации</h3>
              <p className="text-gray-300 mb-4">
                Ваша кампания "Летняя распродажа" показывает отличный CTR. Рекомендуем увеличить бюджет на 20% и 
                расширить аудиторию на возрастную группу 25-34 года для повышения конверсий на 15-20%.
              </p>
              <div className="flex gap-2 sm:gap-3 flex-wrap">
                <button
                  onClick={() => showToast('Рекомендация применена', 'success')}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors text-sm sm:text-base"
                >
                  Применить рекомендацию
                </button>
                <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors text-sm sm:text-base">
                  Узнать больше
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Campaigns */}
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="text-white">Активные кампании</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center gap-2 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Создать кампанию</span>
              <span className="sm:hidden">Создать</span>
            </button>
          </div>

          {/* Поиск и фильтры */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <div className="relative max-w-md flex-1 min-w-0 sm:min-w-[200px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию, платформе, телефону..."
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-colors"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl flex items-center gap-2 transition-colors text-sm sm:text-base ${
                  showFilters || statusFilter !== 'all' || platformFilter !== 'all'
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black'
                    : 'bg-slate-800/50 border border-slate-700 text-gray-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Фильтры</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm hidden sm:inline">Сортировка:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="date">По дате</option>
                  <option value="name">По названию</option>
                  <option value="status">По статусу</option>
                  <option value="budget">По бюджету</option>
                  <option value="spent">По потраченному</option>
                  <option value="conversions">По конверсиям</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 sm:px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                  title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Панель фильтров */}
            {showFilters && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Статус:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                  >
                    <option value="all">Все</option>
                    <option value="Активна">Активна</option>
                    <option value="На паузе">На паузе</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Платформа:</span>
                  <select
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                  >
                    <option value="all">Все</option>
                    {availablePlatforms.map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </div>
                {(statusFilter !== 'all' || platformFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setPlatformFilter('all');
                    }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Сбросить
                  </button>
                )}
              </div>
            )}

            {/* Информация о результатах */}
            {searchQuery || statusFilter !== 'all' || platformFilter !== 'all' ? (
              <div className="text-gray-400 text-sm">
                Найдено кампаний: {filteredAndSortedCampaigns.length} из {campaigns.length}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <CampaignListSkeleton count={3} />
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">У вас пока нет кампаний</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow text-sm sm:text-base"
              >
                Создать первую кампанию
              </button>
            </div>
          ) : filteredAndSortedCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">Кампании не найдены по заданным фильтрам</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPlatformFilter('all');
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors text-sm sm:text-base"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedCampaigns.map((campaign, index) => {
                  // Находим оригинальный индекс для правильной работы с модальными окнами
                  const originalIndex = campaigns.findIndex(c => c.id === campaign.id);
              const budgetNum = parseInt(campaign.budget.replace(/[^\d]/g, ''));
              const spentNum = parseInt(campaign.spent.replace(/[^\d]/g, ''));
              const progress = budgetNum > 0 ? (spentNum / budgetNum) * 100 : 0;
              const remaining = budgetNum - spentNum;
              const cpc = campaign.conversions > 0 ? Math.round(spentNum / campaign.conversions) : 0;
              const roas = campaign.conversions > 0 ? ((campaign.conversions * 5000) / spentNum).toFixed(2) : '0';
              
                  return (
                    <div
                      key={campaign.id || index}
                      className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/30 transition-all hover:shadow-lg cursor-pointer"
                      onClick={(e) => {
                        // Открываем детальное окно только если клик не на кнопке или другом интерактивном элементе
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
                          return;
                        }
                        openCampaignDetail(originalIndex >= 0 ? originalIndex : findCampaignIndexById(campaign.id));
                      }}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <h3 className="text-white text-xl font-bold break-words">{campaign.name}</h3>
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                              campaign.status === 'Активна'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}>
                              {campaign.status === 'Активна' ? (
                                <>
                                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                  {campaign.status}
                                </>
                              ) : (
                                campaign.status
                              )}
                            </span>
                          </div>
                      
                          {/* Platforms */}
                          <div className="mb-3">
                            <p className="text-gray-400 text-xs mb-2 font-medium">Платформы рекламы</p>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 min-w-0">
                              {campaign.platforms.map((platform, idx) => (
                                <span 
                                  key={idx} 
                                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg text-xs font-medium text-blue-300 whitespace-nowrap w-full sm:w-auto"
                                >
                                  {platform}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Contact Info */}
                          {(campaign.phone || campaign.location) && (
                            <div className="flex items-center gap-4 text-gray-400 flex-wrap">
                              {campaign.phone && (
                                <div className="flex items-center gap-1.5 text-blue-400">
                                  <Phone className="w-4 h-4" />
                                  <span className="text-sm">{campaign.phone}</span>
                                </div>
                              )}
                              {campaign.location && (
                                <div className="flex items-center gap-1.5 text-purple-400">
                                  <MapPin className="w-4 h-4" />
                                  <span className="text-sm">{campaign.location}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                  </div>

                  {/* Budget Section */}
                  <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-5 h-5 text-yellow-400" />
                      <h4 className="text-white font-semibold text-sm">Бюджет кампании</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Выделено</p>
                        <p className="text-white font-bold text-lg sm:text-xl">{campaign.budget}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Потрачено</p>
                        <p className="text-white font-bold text-lg sm:text-xl">{campaign.spent}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{progress.toFixed(1)}% бюджета</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Осталось</p>
                        <p className="text-white font-bold text-lg sm:text-xl">₸{remaining.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-xs">Использование бюджета</p>
                        <p className="text-gray-300 text-xs font-medium">{progress.toFixed(1)}%</p>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            progress < 50 
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                              : progress < 80
                              ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                              : 'bg-gradient-to-r from-red-500 to-rose-600'
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-blue-400" />
                        <p className="text-gray-400 text-xs font-medium">Конверсии</p>
                      </div>
                      <p className="text-white font-bold text-2xl mb-1">{campaign.conversions}</p>
                      <div className="space-y-0.5">
                        <p className="text-gray-500 text-xs">CPC: <span className="text-gray-300 font-medium">₸{cpc === 0 ? '—' : cpc.toLocaleString()}</span></p>
                        <p className="text-gray-500 text-xs">Стоимость конверсии</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <p className="text-gray-400 text-xs font-medium">ROAS</p>
                      </div>
                      <p className="text-white font-bold text-2xl mb-1">{roas}x</p>
                      <div className="space-y-0.5">
                        <p className="text-green-400 text-xs font-medium">+18% за неделю</p>
                        <p className="text-gray-500 text-xs">Возврат инвестиций</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50 col-span-2 md:col-span-1">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <p className="text-gray-400 text-xs font-medium">Эффективность</p>
                      </div>
                      <p className="text-white font-bold text-2xl mb-1">
                        {spentNum > 0 && campaign.conversions > 0
                          ? `${((campaign.conversions / spentNum) * 1000).toFixed(2)}`
                          : '0.00'
                        }
                      </p>
                      <p className="text-gray-500 text-xs">Конверсий на ₸1000</p>
                    </div>
                  </div>

                  {/* Ad Text */}
                  <div className="pt-4 border-t border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      <p className="text-gray-400 text-sm font-medium">Текст объявления</p>
                    </div>
                    {campaign.audience?.adText && campaign.audience.adText.trim() ? (
                      <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                        {campaign.audience.adText}
                      </p>
                    ) : (
                      <p className="text-gray-500 text-sm italic">
                        Текст объявления не задан. Отредактируйте кампанию, чтобы добавить текст.
                      </p>
                    )}
                  </div>

                  {/* Audience Tags */}
                  {campaign.audience && (
                    <div className="pt-4 border-t border-slate-700">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <p className="text-gray-400 text-sm font-medium">Подобранная AI аудитория</p>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 min-w-0">
                        <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto">
                          <Target className="w-3 h-3 flex-shrink-0" />
                          <span className="whitespace-nowrap">{campaign.audience.ageRange} лет</span>
                        </span>
                        {campaign.audience.interests.slice(0, 4).map((interest, idx) => (
                          <span key={idx} className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium whitespace-nowrap w-full sm:w-auto">
                            {interest}
                          </span>
                        ))}
                        {campaign.audience.interests.length > 4 && (
                          <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-700/50 text-gray-400 rounded-lg text-xs whitespace-nowrap w-full sm:w-auto">
                            +{campaign.audience.interests.length - 4} еще
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                    );
                })}
              </div>

              {/* Пагинация */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    Назад
                  </button>
                  <span className="text-gray-400">
                    Страница {currentPage} из {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                  >
                    Вперед
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </main>

      {/* Campaign Stats Modal */}
      {statsCampaignIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setStatsCampaignIndex(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-[95%] sm:w-[90%] max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white text-xl font-semibold mb-1">
                  Статистика: {campaigns[statsCampaignIndex]?.name}
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm break-words">
                  <span className="whitespace-normal">{campaigns[statsCampaignIndex]?.platforms.join(', ')}</span> • {campaigns[statsCampaignIndex]?.status}
                </p>
              </div>
              <button
                onClick={() => setStatsCampaignIndex(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const campaign = campaigns[statsCampaignIndex];
              if (!campaign) return null;
              
              const budgetNum = parseInt(campaign.budget.replace(/[^\d]/g, ''));
              const spentNum = parseInt(campaign.spent.replace(/[^\d]/g, ''));
              const progress = budgetNum > 0 ? (spentNum / budgetNum) * 100 : 0;
              const cpc = campaign.conversions > 0 ? Math.round(spentNum / campaign.conversions) : 0;
              const roas = campaign.conversions > 0 ? ((campaign.conversions * 5000) / spentNum).toFixed(2) : '0';
              const ctr = 3.2;
              const cpm = 450;
              
              return (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-400" />
                        <p className="text-gray-400 text-xs">Показы</p>
                      </div>
                      <p className="text-white font-semibold text-2xl">72K</p>
                      <p className="text-green-400 text-xs mt-1">+12% за неделю</p>
                    </div>
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <MousePointer className="w-4 h-4 text-purple-400" />
                        <p className="text-gray-400 text-xs">Клики</p>
                      </div>
                      <p className="text-white font-semibold text-2xl">2,304</p>
                      <p className="text-green-400 text-xs mt-1">CTR: {ctr}%</p>
                    </div>
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <p className="text-gray-400 text-xs">Конверсии</p>
                      </div>
                      <p className="text-white font-semibold text-2xl">{campaign.conversions}</p>
                      <p className="text-gray-500 text-xs mt-1">CPC: ₸{cpc}</p>
                    </div>
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-yellow-400" />
                        <p className="text-gray-400 text-xs">ROAS</p>
                      </div>
                      <p className="text-white font-semibold text-2xl">{roas}x</p>
                      <p className="text-green-400 text-xs mt-1">+18% за неделю</p>
                    </div>
                  </div>

                  {/* Budget Progress */}
                  <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-semibold">Использование бюджета</h4>
                      <span className="text-gray-400 text-sm">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                      <div
                        className="bg-gradient-to-r from-yellow-400 to-amber-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Выделено</p>
                        <p className="text-white font-semibold">{campaign.budget}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Потрачено</p>
                        <p className="text-white font-semibold">{campaign.spent}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Осталось</p>
                        <p className="text-white font-semibold">₸{(budgetNum - spentNum).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <h4 className="text-white font-semibold mb-4">Эффективность</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">CPM</span>
                          <span className="text-white font-semibold">₸{cpm}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">CPC</span>
                          <span className="text-white font-semibold">₸{cpc}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">CTR</span>
                          <span className="text-white font-semibold">{ctr}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                      <h4 className="text-white font-semibold mb-4">Аудитория</h4>
                      {campaign.audience ? (
                        <div className="space-y-2">
                          <div>
                            <span className="text-gray-400 text-sm">Возраст: </span>
                            <span className="text-white font-semibold">{campaign.audience.ageRange} лет</span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-gray-400 text-sm">Интересы: </span>
                            <span className="text-white text-sm break-words">{campaign.audience.interests.slice(0, 3).join(', ')}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">Информация об аудитории отсутствует</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Campaign Detail Modal */}
      {detailCampaignIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDetailCampaignIndex(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-[95%] sm:max-w-[90%] md:max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const campaign = campaigns[detailCampaignIndex];
              if (!campaign) return null;
              
              const budgetNum = parseInt(campaign.budget.replace(/[^\d]/g, ''));
              const spentNum = parseInt(campaign.spent.replace(/[^\d]/g, ''));
              const progress = budgetNum > 0 ? (spentNum / budgetNum) * 100 : 0;
              const remaining = budgetNum - spentNum;
              const cpc = campaign.conversions > 0 ? Math.round(spentNum / campaign.conversions) : 0;
              const roas = campaign.conversions > 0 ? ((campaign.conversions * 5000) / spentNum).toFixed(2) : '0';
              
              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap min-w-0">
                        <h3 className="text-white text-lg sm:text-2xl font-bold break-words flex-1 min-w-0">{campaign.name}</h3>
                        <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                          campaign.status === 'Активна'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {campaign.status === 'Активна' ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                              {campaign.status}
                            </>
                          ) : (
                            campaign.status
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetailCampaignIndex(null)}
                      className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg flex-shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 sm:space-y-6">
                    {/* Platforms */}
                    <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <h4 className="text-white font-semibold text-sm">Платформы рекламы</h4>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                        {campaign.platforms.map((platform, idx) => (
                          <span 
                            key={idx} 
                            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg text-xs sm:text-sm font-medium text-blue-300 whitespace-nowrap flex-shrink-0"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Ad Text */}
                    <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
                        <h4 className="text-white font-semibold text-sm">Текст объявления</h4>
                      </div>
                      {campaign.audience?.adText && campaign.audience.adText.trim() ? (
                        <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/30 min-w-0">
                          <p className="text-gray-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                            {campaign.audience.adText}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/30 min-w-0">
                          <p className="text-gray-500 text-xs sm:text-sm italic break-words">
                            Текст объявления не задан. Отредактируйте кампанию, чтобы добавить текст.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Ad Image */}
                    {campaign.imageUrl && (
                      <CampaignImage 
                        imageUrl={campaign.imageUrl}
                        campaignName={campaign.name}
                        onRegenerate={() => regenerateCampaignImage(detailCampaignIndex)}
                        isRegenerating={campaign.id === regeneratingImageCampaignId}
                      />
                    )}

                    {/* Budget & Performance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Budget */}
                      <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <DollarSign className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                          <h4 className="text-white font-semibold text-sm">Бюджет кампании</h4>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Выделено</span>
                            <span className="text-white font-bold text-sm sm:text-base break-words text-right">{campaign.budget}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Потрачено</span>
                            <span className="text-white font-bold text-sm sm:text-base break-words text-right">{campaign.spent}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Осталось</span>
                            <span className="text-white font-bold text-sm sm:text-base break-words text-right">₸{remaining.toLocaleString()}</span>
                          </div>
                          <div className="pt-2">
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <span className="text-gray-400 text-xs flex-shrink-0">Использование бюджета</span>
                              <span className="text-gray-300 text-xs font-medium whitespace-nowrap">{progress.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  progress < 50 
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                    : progress < 80
                                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                                    : 'bg-gradient-to-r from-red-500 to-rose-600'
                                }`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                          <h4 className="text-white font-semibold text-sm">Показатели эффективности</h4>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Конверсии</span>
                            <span className="text-white font-bold text-base sm:text-lg break-words text-right">{campaign.conversions}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">CPC</span>
                            <span className="text-white font-bold text-base sm:text-lg break-words text-right">₸{cpc === 0 ? '—' : cpc.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Стоимость конверсии</span>
                            <span className="text-white font-bold text-base sm:text-lg break-words text-right">₸{cpc === 0 ? '—' : cpc.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">ROAS</span>
                            <span className="text-green-400 font-bold text-base sm:text-lg break-words text-right">{roas}x</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Возврат инвестиций</span>
                            <span className="text-white font-bold text-base sm:text-lg break-words text-right">+18%</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Эффективность</span>
                            <span className="text-white font-bold text-base sm:text-lg break-words text-right">0.00</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Конверсий на ₸1000</span>
                            <span className="text-white font-bold text-base sm:text-lg break-words text-right">0</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    {(campaign.phone || campaign.location) && (
                      <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <Phone className="w-5 h-5 text-blue-400 flex-shrink-0" />
                          <h4 className="text-white font-semibold text-sm">Контактная информация</h4>
                        </div>
                        <div className="space-y-3 min-w-0">
                          {campaign.phone && (
                            <div className="flex items-center gap-3 min-w-0">
                              <Phone className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              <span className="text-gray-300 text-xs sm:text-sm break-words">{campaign.phone}</span>
                            </div>
                          )}
                          {campaign.location && (
                            <div className="flex items-center gap-3 min-w-0">
                              <MapPin className="w-4 h-4 text-purple-400 flex-shrink-0" />
                              <span className="text-gray-300 text-xs sm:text-sm break-words">{campaign.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Audience */}
                    {campaign.audience && (
                      <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
                          <h4 className="text-white font-semibold text-sm">Подобранная AI аудитория</h4>
                        </div>
                        <div className="space-y-4 min-w-0">
                          <div className="min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm">Возраст: </span>
                            <span className="text-white font-semibold text-xs sm:text-sm break-words">{campaign.audience.ageRange} лет</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-400 text-xs sm:text-sm mb-2">Интересы:</p>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 min-w-0">
                              {campaign.audience.interests.map((interest, idx) => (
                                <span 
                                  key={idx} 
                                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium whitespace-nowrap w-full sm:w-auto"
                                >
                                  {interest}
                                </span>
                              ))}
                            </div>
                          </div>
                          {campaign.audience.platforms && campaign.audience.platforms.length > 0 && (
                            <div className="min-w-0">
                              <p className="text-gray-400 text-xs sm:text-sm mb-2">Платформы:</p>
                              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 min-w-0">
                                {campaign.audience.platforms.map((platform, idx) => (
                                  <span 
                                    key={idx} 
                                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium whitespace-nowrap w-full sm:w-auto"
                                  >
                                    {platform}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-4 border-t border-slate-700">
                      <button
                        onClick={() => {
                          setDetailCampaignIndex(null);
                          openCampaignStats(detailCampaignIndex);
                        }}
                        className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <BarChart3 className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium whitespace-nowrap">Статистика</span>
                      </button>
                      <button
                        onClick={() => {
                          setDetailCampaignIndex(null);
                          openEditModal(detailCampaignIndex);
                        }}
                        className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <Sparkles className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium whitespace-nowrap">Редактировать</span>
                      </button>
                      <button
                        onClick={() => {
                          setDetailCampaignIndex(null);
                          toggleCampaignStatus(detailCampaignIndex);
                        }}
                        className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700/50 hover:bg-slate-700 text-gray-300 rounded-lg transition-colors text-xs sm:text-sm w-full sm:w-auto"
                      >
                        {campaign.status === 'Активна' ? (
                          <>
                            <Pause className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium whitespace-nowrap">Приостановить</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium whitespace-nowrap">Возобновить</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setDetailCampaignIndex(null);
                          duplicateCampaign(detailCampaignIndex);
                        }}
                        disabled={isDuplicating === campaign.id || isDeleting === detailCampaignIndex}
                        className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm w-full sm:w-auto"
                      >
                        {isDuplicating === campaign.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                            <span className="font-medium whitespace-nowrap">Копирование...</span>
                          </>
                        ) : (
                          <>
                            <Target className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium whitespace-nowrap">Дублировать</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setDetailCampaignIndex(null);
                          handleDeleteClick(detailCampaignIndex);
                        }}
                        disabled={isDeleting === detailCampaignIndex}
                        className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm w-full sm:w-auto"
                      >
                        {isDeleting === detailCampaignIndex ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                            <span className="font-medium whitespace-nowrap">Удаление...</span>
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium whitespace-nowrap">Удалить</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white">Создать рекламную кампанию</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setIsSelectingAudience(false);
                  setSelectedAudience(null);
                  createForm.reset();
                }}
                disabled={isSelectingAudience}
                className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createForm.handleSubmit(handleCreateCampaign)} className="space-y-4">
              <div>
                <label className="text-gray-400 mb-2 block">Название кампании <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  {...createForm.register('name', {
                    required: 'Название кампании обязательно',
                    minLength: { value: 3, message: 'Название кампании должно содержать минимум 3 символа' },
                    maxLength: { value: 100, message: 'Название кампании не должно превышать 100 символов' },
                    validate: (value) => value.trim().length >= 3 || 'Название кампании должно содержать минимум 3 символа',
                  })}
                  placeholder="Например: Весенняя акция"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    createForm.formState.errors.name
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {createForm.formState.errors.name && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 block">Платформы <span className="text-red-400">*</span></label>
                  <button
                    type="button"
                    onClick={handleSelectAllPlatforms}
                    className="text-xs text-yellow-400 hover:text-yellow-300 px-3 py-1 rounded-lg hover:bg-yellow-400/10 transition-colors"
                  >
                    {(createForm.watch('platforms') || []).length === availablePlatforms.length ? 'Снять все' : 'Выбрать все'}
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-900/30 border border-slate-700 rounded-xl p-2 sm:p-3">
                  {availablePlatforms.map((platform) => (
                    <label
                      key={platform}
                      className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors min-w-0"
                    >
                      <input
                        type="checkbox"
                        checked={(createForm.watch('platforms') || []).includes(platform)}
                        onChange={() => handlePlatformToggle(platform)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500 focus:ring-2 flex-shrink-0"
                      />
                      <span className="text-white text-xs sm:text-sm break-words min-w-0">{platform}</span>
                    </label>
                  ))}
                </div>
                {createForm.formState.errors.platforms && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.platforms.message}</p>
                )}
              </div>

              <div>
                <label className="text-gray-400 mb-2 block">Номер телефона для связи <span className="text-red-400">*</span></label>
                <input
                  type="tel"
                  {...createForm.register('phone', {
                    required: 'Номер телефона обязателен',
                    pattern: {
                      value: /^[\d\s()+-]+$/,
                      message: 'Неверный формат номера телефона',
                    },
                    validate: (value) => {
                      const digits = value.replace(/\D/g, '');
                      return digits.length >= 10 || 'Номер телефона должен содержать минимум 10 цифр';
                    },
                  })}
                  placeholder="+7 (XXX) XXX-XX-XX"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    createForm.formState.errors.phone
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {createForm.formState.errors.phone && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.phone.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Клиенты смогут связаться с вами по этому номеру</p>
              </div>

              <div>
                <label className="text-gray-400 mb-2 block">Локация показа рекламы</label>
                <input
                  type="text"
                  {...createForm.register('location', {
                    maxLength: { value: 200, message: 'Локация не должна превышать 200 символов' },
                  })}
                  placeholder="Например: Алматы, Астана, Казахстан или весь мир"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    createForm.formState.errors.location
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {createForm.formState.errors.location && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.location.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Укажите города или регионы, где должна показываться реклама</p>
              </div>

              <div>
                <label className="text-gray-400 mb-2 block">Бюджет (₸) <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  {...createForm.register('budget', {
                    required: 'Бюджет обязателен',
                    validate: (value) => {
                      const num = parseFloat(value.replace(/[^\d.]/g, ''));
                      if (isNaN(num) || num <= 0) {
                        return 'Бюджет должен быть положительным числом';
                      }
                      if (num < 1000) {
                        return 'Минимальный бюджет: ₸1,000';
                      }
                      return true;
                    },
                  })}
                  placeholder="50000"
                  min="1000"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    createForm.formState.errors.budget
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {createForm.formState.errors.budget && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.budget.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Минимальный бюджет: ₸1,000</p>
              </div>

              <div>
                <label className="text-gray-400 mb-2 block">Краткое описание</label>
                <textarea
                  value={adDescription}
                  onChange={(e) => setAdDescription(e.target.value)}
                  placeholder="Опишите, что вы хотите рекламировать, какие преимущества выделить, какой стиль объявления предпочитаете..."
                  rows={4}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                />
                <p className="text-gray-500 text-xs mt-1">AI создаст точный текст объявления на основе вашего описания</p>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="text-gray-300 mb-3">
                      AI автоматически подберет целевую аудиторию (интересы, возраст, платформы), оптимизирует ставки и создаст эффективное объявление
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const formData = createForm.getValues();
                        if (formData.name && formData.platforms.length > 0 && formData.budget) {
                          await selectTargetAudience(
                            formData.name,
                            formData.platforms,
                            formData.budget,
                            adDescription || undefined,
                            formData.phone,
                            formData.location
                          );
                        } else {
                          showToast('Заполните название, выберите платформы и укажите бюджет для подбора аудитории', 'info');
                        }
                      }}
                      disabled={isSelectingAudience}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isSelectingAudience ? 'Анализ...' : 'Запустить AI анализ'}
                    </button>
                    {isSelectingAudience && (
                      <div className="flex items-center gap-2 mt-3 text-blue-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                        <span className="text-sm">AI анализирует данные и подбирает оптимальную аудиторию...</span>
                      </div>
                    )}
                    {selectedAudience && !isSelectingAudience && (
                      <div className="mt-3 pt-3 border-t border-blue-500/20 space-y-3">
                        <div>
                          <p className="text-xs text-blue-300 mb-2 font-semibold">Подобранная аудитория:</p>
                          <div className="space-y-1 text-xs text-gray-300">
                            <p className="break-words"><span className="text-gray-400">Возраст:</span> {selectedAudience.ageRange} лет</p>
                            <p className="break-words"><span className="text-gray-400">Интересы:</span> <span className="whitespace-normal">{selectedAudience.interests.join(', ')}</span></p>
                            <p className="break-words"><span className="text-gray-400">Платформы:</span> <span className="whitespace-normal">{selectedAudience.platforms.join(', ')}</span></p>
                            {selectedAudience.optimizedBid && (
                              <p><span className="text-gray-400">Оптимальная ставка:</span> <span className="text-yellow-400 font-semibold">₸{selectedAudience.optimizedBid}</span></p>
                            )}
                          </div>
                        </div>
                          </div>
                        )}
                      </div>
                </div>
              </div>

              {/* Генерация изображения */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h4 className="text-purple-300 font-semibold mb-2">Изображение для объявления</h4>
                    <p className="text-gray-300 mb-3 text-sm">
                      AI может создать профессиональное изображение для вашего объявления на основе названия и описания кампании
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const formData = createForm.getValues();
                        if (formData.name) {
                          await generateAdImage(
                            formData.name,
                            undefined,
                            adDescription || undefined
                          );
                        } else {
                          showToast('Заполните название кампании для генерации изображения', 'info');
                        }
                      }}
                      disabled={isGeneratingImage}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 rounded-lg text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
                    >
                      {isGeneratingImage ? (
                        <span key="generating" className="flex items-center gap-1 sm:gap-2">
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                          <span className="whitespace-nowrap">Генерация изображения...</span>
                        </span>
                      ) : (
                        <span key="generate" className="flex items-center gap-1 sm:gap-2">
                          <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="whitespace-nowrap">Сгенерировать изображение AI</span>
                        </span>
                      )}
                    </button>
                    {generatedImageUrl && (
                      <div className="mt-4">
                        <p className="text-xs text-purple-300 mb-2 font-semibold">Сгенерированное изображение:</p>
                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                          <SafeImage 
                            src={generatedImageUrl} 
                            alt="Сгенерированное изображение для объявления" 
                            className="w-full h-auto rounded-lg max-h-64 object-contain"
                            containerClassName="w-full h-64"
                          />
                  </div>
                        <button
                          type="button"
                          onClick={() => setGeneratedImageUrl(null)}
                          className="mt-2 text-xs text-red-400 hover:text-red-300"
                        >
                          Удалить изображение
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Предварительный просмотр объявления */}
              {(generatedAdText?.trim() || selectedAudience?.adText?.trim() || generatedImageUrl || adDescription?.trim() || (createForm.watch('platforms') || []).length > 0) && (
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-green-300 font-semibold mb-4">Предварительный просмотр объявления</h4>
                      <p className="text-gray-300 mb-4 text-sm">Как будет выглядеть ваше объявление на выбранных платформах:</p>
                      
                      <div className="space-y-6">
                        {(createForm.watch('platforms') || []).map((platform) => (
                          <div key={platform} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium">
                                {platform}
                              </span>
                      </div>
                            
                            {/* Instagram превью */}
                            {(platform === 'Instagram' || platform === 'Facebook') && (
                              <div className="bg-slate-800 text-white rounded-lg overflow-hidden w-full max-w-sm mx-auto">
                                {generatedImageUrl ? (
                                  <SafeImage 
                                    src={generatedImageUrl} 
                                    alt="Превью объявления" 
                                    className="w-full aspect-square object-cover"
                                    showErrorPlaceholder={false}
                                  />
                                ) : (
                                  <div className="w-full aspect-square bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                                    <span className="text-white/50 text-sm">Изображение объявления</span>
                                  </div>
                                )}
                                <div className="p-3 bg-slate-800">
                                  {(() => {
                                    // Приоритет: generatedAdText > selectedAudience?.adText > adDescription
                                    const displayText = (generatedAdText?.trim() || selectedAudience?.adText?.trim() || '').trim();
                                    
                                    // Отладочное логирование (только при проблемах)
                                    // Раскомментируйте для отладки:
                                    // if (process.env.NODE_ENV === 'development' && !displayText) {
                                    //   console.log('[Preview Render]', { platform, generatedAdText, selectedAudienceAdText, displayText });
                                    // }
                                    
                                    if (displayText && displayText.length > 0) {
                                      return (
                                        <p className="text-white text-sm leading-relaxed break-words whitespace-pre-wrap">
                                          {displayText}
                                        </p>
                                      );
                                    } else if (adDescription?.trim()) {
                                      return (
                                        <p className="text-white text-sm leading-relaxed break-words whitespace-pre-wrap">
                                          {adDescription.trim()}
                                        </p>
                                      );
                                    } else {
                                      return (
                                        <p className="text-gray-400 text-sm italic">Текст объявления будет здесь</p>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            )}
                            
                            {/* TikTok превью */}
                            {platform === 'TikTok' && (
                              <div className="relative bg-black rounded-lg overflow-hidden mx-auto w-full max-w-[300px] aspect-[9/16]">
                                {generatedImageUrl ? (
                                  <SafeImage 
                                    src={generatedImageUrl} 
                                    alt="Превью объявления" 
                                    className="w-full h-full object-cover"
                                    showErrorPlaceholder={false}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center">
                                    <span className="text-white/50 text-sm">Видео/Изображение</span>
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                  {(() => {
                                    const displayText = (generatedAdText?.trim() || selectedAudience?.adText?.trim() || '').trim();
                                    if (displayText && displayText.length > 0) {
                                      return (
                                        <p className="text-white text-sm font-medium line-clamp-2 break-words">
                                          {displayText}
                                        </p>
                                      );
                                    } else if (adDescription?.trim()) {
                                      return (
                                        <p className="text-white text-sm font-medium line-clamp-2 break-words">
                                          {adDescription.trim()}
                                        </p>
                                      );
                                    } else {
                                      return (
                                        <p className="text-white/50 text-sm italic">Текст объявления</p>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            )}
                            
                            {/* YouTube превью */}
                            {platform === 'YouTube' && (
                              <div className="bg-slate-800 text-white rounded-lg overflow-hidden w-full max-w-2xl mx-auto">
                                {generatedImageUrl ? (
                                  <SafeImage 
                                    src={generatedImageUrl} 
                                    alt="Превью объявления" 
                                    className="w-full aspect-video object-cover"
                                    showErrorPlaceholder={false}
                                  />
                                ) : (
                                  <div className="w-full aspect-video bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                                    <span className="text-white/50 text-sm">Изображение видео</span>
                                  </div>
                                )}
                                <div className="p-4 bg-slate-800">
                                  {(() => {
                                    const displayText = (generatedAdText?.trim() || selectedAudience?.adText?.trim() || '').trim();
                                    if (displayText && displayText.length > 0) {
                                      return (
                                        <p className="text-white font-semibold text-base mb-1 line-clamp-2 break-words">
                                          {displayText}
                                        </p>
                                      );
                                    } else if (adDescription?.trim()) {
                                      return (
                                        <p className="text-white font-semibold text-base mb-1 line-clamp-2 break-words">
                                          {adDescription.trim()}
                                        </p>
                                      );
                                    } else {
                                      return (
                                        <p className="text-gray-400 font-semibold text-base mb-1 italic">Заголовок объявления</p>
                                      );
                                    }
                                  })()}
                                  {createForm.watch('name') && (
                                    <p className="text-gray-300 text-sm break-words">{createForm.watch('name')}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Google Ads превью */}
                            {platform === 'Google Ads' && (
                              <div className="bg-slate-800 text-white border border-slate-700 rounded-lg p-4 w-full max-w-xl mx-auto">
                                <div className="flex gap-3">
                                  {generatedImageUrl && (
                                    <SafeImage 
                                      src={generatedImageUrl} 
                                      alt="Превью объявления" 
                                      className="w-24 h-24 object-cover rounded"
                                      showErrorPlaceholder={false}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-blue-400 font-semibold text-base mb-1 line-clamp-2 break-words">
                                      {createForm.watch('name') || 'Название кампании'}
                                    </h3>
                                    {(() => {
                                      const displayText = (generatedAdText?.trim() || selectedAudience?.adText?.trim() || '').trim();
                                      if (displayText && displayText.length > 0) {
                                        return (
                                          <p className="text-white text-sm leading-relaxed mb-2 break-words whitespace-pre-wrap">
                                            {displayText}
                                          </p>
                                        );
                                      } else if (adDescription?.trim()) {
                                        return (
                                          <p className="text-white text-sm leading-relaxed mb-2 break-words whitespace-pre-wrap">
                                            {adDescription.trim()}
                                          </p>
                                        );
                                      } else {
                                        return (
                                          <p className="text-gray-400 text-sm italic mb-2">Описание объявления</p>
                                        );
                                      }
                                    })()}
                                    {createForm.watch('phone') && (
                                      <p className="text-gray-400 text-xs break-words">{createForm.watch('phone')}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* VK превью */}
                            {platform === 'VK' && (
                              <div className="bg-slate-800 text-white rounded-lg overflow-hidden border border-slate-700 w-full max-w-lg mx-auto">
                                {generatedImageUrl ? (
                                  <SafeImage 
                                    src={generatedImageUrl} 
                                    alt="Превью объявления" 
                                    className="w-full aspect-[4/3] object-cover"
                                    showErrorPlaceholder={false}
                                  />
                                ) : (
                                  <div className="w-full aspect-[4/3] bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                                    <span className="text-white/50 text-sm">Изображение объявления</span>
                                  </div>
                                )}
                                <div className="p-3 bg-slate-800">
                                  {(() => {
                                    const displayText = (generatedAdText?.trim() || selectedAudience?.adText?.trim() || '').trim();
                                    if (displayText && displayText.length > 0) {
                                      return (
                                        <p className="text-white text-sm leading-relaxed break-words whitespace-pre-wrap">
                                          {displayText}
                                        </p>
                                      );
                                    } else if (adDescription?.trim()) {
                                      return (
                                        <p className="text-white text-sm leading-relaxed break-words whitespace-pre-wrap">
                                          {adDescription.trim()}
                                        </p>
                                      );
                                    } else {
                                      return (
                                        <p className="text-gray-400 text-sm italic">Текст объявления будет здесь</p>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            )}
                            
                            {/* Telegram Ads превью */}
                            {platform === 'Telegram Ads' && (
                              <div className="bg-slate-800 text-white rounded-lg overflow-hidden border border-slate-700 w-full max-w-sm mx-auto">
                                {generatedImageUrl ? (
                                  <img 
                                    src={generatedImageUrl} 
                                    alt="Превью объявления" 
                                    className="w-full aspect-square object-cover"
                                  />
                                ) : (
                                  <div className="w-full aspect-square bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                                    <span className="text-white/50 text-sm">Изображение объявления</span>
                                  </div>
                                )}
                                <div className="p-3 bg-slate-800">
                                  {(() => {
                                    const displayText = (generatedAdText?.trim() || selectedAudience?.adText?.trim() || '').trim();
                                    if (displayText && displayText.length > 0) {
                                      return (
                                        <p className="text-white text-sm leading-relaxed mb-2 break-words whitespace-pre-wrap">
                                          {displayText}
                                        </p>
                                      );
                                    } else if (adDescription?.trim()) {
                                      return (
                                        <p className="text-white text-sm leading-relaxed mb-2 break-words whitespace-pre-wrap">
                                          {adDescription.trim()}
                                        </p>
                                      );
                                    } else {
                                      return (
                                        <p className="text-gray-400 text-sm italic mb-2">Текст объявления будет здесь</p>
                                      );
                                    }
                                  })()}
                                  {createForm.watch('phone') && (
                                    <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors break-words">
                                      Связаться: {createForm.watch('phone')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {(createForm.watch('platforms') || []).length === 0 && (
                        <p className="text-gray-400 text-sm">Выберите платформы для просмотра превью</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 sm:gap-3 mt-6 flex-wrap">
                <button
                  type="submit"
                  disabled={isSelectingAudience || createForm.formState.isSubmitting}
                  className="flex-1 min-w-0 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {isSelectingAudience ? 'Подбор аудитории...' : createForm.formState.isSubmitting ? 'Создание...' : 'Создать кампанию'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setIsSelectingAudience(false);
                    setSelectedAudience(null);
                    setGeneratedAdText('');
                    setGeneratedImageUrl(null);
                    setAdDescription('');
                    createForm.reset();
                  }}
                  disabled={isSelectingAudience}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex-1 sm:flex-initial min-w-0"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {showEditModal && editingCampaignIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white">Редактировать кампанию</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCampaignIndex(null);
                  setEditingImageUrl(null);
                  editForm.reset();
                  setEditingDescription('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editForm.handleSubmit(handleEditCampaign)} className="space-y-4">
              <div>
                <label className="text-gray-400 mb-2 block">Название кампании <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  {...editForm.register('name', {
                    required: 'Название кампании обязательно',
                    minLength: { value: 3, message: 'Название кампании должно содержать минимум 3 символа' },
                    maxLength: { value: 100, message: 'Название кампании не должно превышать 100 символов' },
                    validate: (value) => value.trim().length >= 3 || 'Название кампании должно содержать минимум 3 символа',
                  })}
                  placeholder="Например: Весенняя акция"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    editForm.formState.errors.name
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {editForm.formState.errors.name && (
                  <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 block">Платформы <span className="text-red-400">*</span></label>
                  <button
                    type="button"
                    onClick={handleSelectAllEditPlatforms}
                    className="text-xs text-yellow-400 hover:text-yellow-300 px-3 py-1 rounded-lg hover:bg-yellow-400/10 transition-colors"
                  >
                    {editForm.watch('platforms').length === availablePlatforms.length ? 'Снять все' : 'Выбрать все'}
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-900/30 border border-slate-700 rounded-xl p-2 sm:p-3">
                  {availablePlatforms.map((platform) => (
                    <label
                      key={platform}
                      className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors min-w-0"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.watch('platforms').includes(platform)}
                        onChange={() => handleEditPlatformToggle(platform)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500 focus:ring-2 flex-shrink-0"
                      />
                      <span className="text-white text-xs sm:text-sm break-words min-w-0">{platform}</span>
                    </label>
                  ))}
                </div>
                {editForm.formState.errors.platforms && (
                  <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.platforms.message}</p>
                )}
              </div>

              <div>
                <label className="text-gray-400 mb-2 block">Номер телефона для связи <span className="text-red-400">*</span></label>
                <input
                  type="tel"
                  {...editForm.register('phone', {
                    required: 'Номер телефона обязателен',
                    pattern: {
                      value: /^[\d\s()+-]+$/,
                      message: 'Неверный формат номера телефона',
                    },
                    validate: (value) => {
                      const digits = value.replace(/\D/g, '');
                      return digits.length >= 10 || 'Номер телефона должен содержать минимум 10 цифр';
                    },
                  })}
                  placeholder="+7 (XXX) XXX-XX-XX"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    editForm.formState.errors.phone
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {editForm.formState.errors.phone && (
                  <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.phone.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Клиенты смогут связаться с вами по этому номеру</p>
              </div>

              <div>
                <label className="text-gray-400 mb-2 block">Локация показа рекламы</label>
                <input
                  type="text"
                  {...editForm.register('location', {
                    maxLength: { value: 200, message: 'Локация не должна превышать 200 символов' },
                  })}
                  placeholder="Например: Алматы, Астана, Казахстан или весь мир"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    editForm.formState.errors.location
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {editForm.formState.errors.location && (
                  <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.location.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Укажите города или регионы, где должна показываться реклама</p>
              </div>

              <div>
                <label className="text-gray-400 mb-2 block">Бюджет (₸) <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  {...editForm.register('budget', {
                    required: 'Бюджет обязателен',
                    validate: (value) => {
                      const num = parseFloat(value.replace(/[^\d.]/g, ''));
                      if (isNaN(num) || num <= 0) {
                        return 'Бюджет должен быть положительным числом';
                      }
                      if (num < 1000) {
                        return 'Минимальный бюджет: ₸1,000';
                      }
                      return true;
                    },
                  })}
                  placeholder="50000"
                  min="1000"
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none ${
                    editForm.formState.errors.budget
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {editForm.formState.errors.budget && (
                  <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.budget.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Минимальный бюджет: ₸1,000</p>
              </div>

              {/* Текст объявления */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 block">Текст объявления</label>
                  <button
                    type="button"
                    onClick={async () => {
                      const campaign = campaigns[editingCampaignIndex!];
                      if (!campaign) return;
                      
                      setIsSelectingAudience(true);
                      try {
                        const budgetNum = parseFloat(editForm.getValues('budget').replace(/[^\d.]/g, ''));
                        const aiResponse = await aiAPI.getAudience({
                          campaignName: editForm.getValues('name'),
                          platforms: editForm.getValues('platforms'),
                          budget: budgetNum,
                          phone: editForm.getValues('phone'),
                          location: editForm.getValues('location'),
                          description: editingDescription || undefined,
                        });
                        
                        if (aiResponse.adText) {
                          editForm.setValue('adText', aiResponse.adText);
                          showToast('Текст объявления обновлен с помощью AI', 'success');
                        }
                      } catch (error: any) {
                        showToast('Не удалось обновить текст объявления', 'error');
                      } finally {
                        setIsSelectingAudience(false);
                      }
                    }}
                    disabled={isSelectingAudience}
                    className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1 rounded-lg hover:bg-blue-400/10 transition-colors disabled:opacity-50"
                  >
                    {isSelectingAudience ? 'Генерация...' : '✨ Обновить с AI'}
                  </button>
                </div>
                <textarea
                  {...editForm.register('adText', {
                    maxLength: { value: 500, message: 'Текст объявления не должен превышать 500 символов' },
                  })}
                  placeholder="Введите текст рекламного объявления..."
                  rows={4}
                  className={`w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none resize-none ${
                    editForm.formState.errors.adText
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-slate-700 focus:border-yellow-500/50'
                  }`}
                />
                {editForm.formState.errors.adText && (
                  <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.adText.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">Текст, который будет использоваться в рекламных объявлениях</p>
              </div>

              {/* Краткое описание */}
              <div>
                <label className="text-gray-400 mb-2 block">Краткое описание</label>
                <textarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="Опишите, что вы хотите рекламировать, какие преимущества выделить, какой стиль объявления предпочитаете..."
                  rows={4}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                />
                <p className="text-gray-500 text-xs mt-1">AI использует это описание для улучшения текста и изображения объявления</p>
              </div>

              {/* Изображение объявления */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 block">Изображение объявления</label>
                  <button
                    type="button"
                    onClick={async () => {
                      const campaign = campaigns[editingCampaignIndex!];
                      if (!campaign || !campaign.id) return;
                      
                      setIsRegeneratingImageInEdit(true);
                      try {
                        const category = 'general';
                        const response = await aiAPI.generateImage({
                          campaignName: editForm.getValues('name'),
                          category,
                          description: editingDescription || undefined,
                        });
                        
                        if (response.imageUrl) {
                          setEditingImageUrl(response.imageUrl);
                          editForm.setValue('imageUrl', response.imageUrl);
                          showToast('Изображение успешно сгенерировано!', 'success');
                        }
                      } catch (error: any) {
                        showToast('Не удалось сгенерировать изображение', 'error');
                      } finally {
                        setIsRegeneratingImageInEdit(false);
                      }
                    }}
                    disabled={isRegeneratingImageInEdit}
                    className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1 rounded-lg hover:bg-blue-400/10 transition-colors disabled:opacity-50"
                  >
                    {isRegeneratingImageInEdit ? (
                      <span key="regenerating" className="inline-flex items-center">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        <span>Генерация...</span>
                      </span>
                    ) : (
                      <span key="regenerate">✨ Сгенерировать новое</span>
                    )}
                  </button>
                </div>
                {editingImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700/30 bg-slate-900/30">
                    <SafeImage 
                      src={editingImageUrl}
                      alt="Изображение объявления"
                      className="w-full h-auto max-h-64 object-cover"
                      containerClassName="w-full min-h-48"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditingImageUrl(null);
                        editForm.setValue('imageUrl', null);
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-900/30">
                    <Eye className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm mb-2">Изображение не добавлено</p>
                    <p className="text-gray-600 text-xs">Нажмите "Сгенерировать новое" для создания изображения</p>
                  </div>
                )}
                <p className="text-gray-500 text-xs mt-2">Изображение для рекламных объявлений</p>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-6 flex-wrap">
                <button
                  type="submit"
                  disabled={editForm.formState.isSubmitting}
                  className="flex-1 min-w-0 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {editForm.formState.isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCampaignIndex(null);
                    setEditingImageUrl(null);
                    editForm.reset();
                    setEditingDescription('');
                  }}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors text-sm sm:text-base flex-1 sm:flex-initial min-w-0"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={deleteCampaign}
        title="Удалить кампанию?"
        description={
          campaignToDelete !== null
            ? `Вы уверены, что хотите удалить кампанию "${campaigns[campaignToDelete]?.name}"? Это действие нельзя отменить.`
            : 'Вы уверены, что хотите удалить эту кампанию? Это действие нельзя отменить.'
        }
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={isDeleting !== null}
      />
    </div>
  );
}

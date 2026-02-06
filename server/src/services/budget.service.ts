/**
 * Сервис для работы с бюджетом рекламных кампаний
 * Предоставляет рекомендации по минимальному бюджету на основе выбранных платформ
 */

interface PlatformBudgetConfig {
  platform: string;
  minWeeklyBudget: number;  // Минимальный недельный бюджет в тенге
  minDailyBudget: number;   // Минимальный дневной бюджет
}

// Рекомендуемые минимальные бюджеты по платформам
const PLATFORM_BUDGETS: PlatformBudgetConfig[] = [
  { platform: 'Instagram', minWeeklyBudget: 5000, minDailyBudget: 714 },
  { platform: 'Facebook', minWeeklyBudget: 5000, minDailyBudget: 714 },
  { platform: 'Google Ads', minWeeklyBudget: 10000, minDailyBudget: 1429 },
  { platform: 'TikTok', minWeeklyBudget: 7000, minDailyBudget: 1000 },
  { platform: 'YouTube', minWeeklyBudget: 15000, minDailyBudget: 2143 },
];

export interface BudgetRecommendation {
  isRecommended: boolean;       // true если бюджет соответствует рекомендациям
  warnings: string[];           // Предупреждения для каждой платформы
  minRecommendedBudget: number; // Минимальный рекомендуемый бюджет для всех платформ
  dailyBudget: number;          // Рассчитанный дневной бюджет
}

/**
 * Получить рекомендации по бюджету для выбранных платформ
 *
 * @param platforms Массив выбранных платформ
 * @param budget Общий бюджет кампании
 * @param periodDays Период в днях
 * @returns Объект с рекомендациями
 */
export function getBudgetRecommendations(
  platforms: string[],
  budget: number,
  periodDays: number
): BudgetRecommendation {
  const dailyBudget = periodDays > 0 ? budget / periodDays : 0;
  const warnings: string[] = [];
  let minRecommendedBudget = 0;

  for (const platformName of platforms) {
    const config = PLATFORM_BUDGETS.find(
      p => p.platform.toLowerCase() === platformName.toLowerCase()
    );

    if (config) {
      // Рассчитываем требуемый бюджет для данного периода
      const requiredBudget = config.minDailyBudget * periodDays;

      if (budget < requiredBudget) {
        warnings.push(
          `${config.platform}: рекомендуем минимум ${requiredBudget.toLocaleString('ru-RU')}₸ на ${periodDays} дней (${config.minDailyBudget.toLocaleString('ru-RU')}₸/день)`
        );
      }

      minRecommendedBudget = Math.max(minRecommendedBudget, requiredBudget);
    }
  }

  return {
    isRecommended: warnings.length === 0,
    warnings,
    minRecommendedBudget,
    dailyBudget: Math.round(dailyBudget),
  };
}

/**
 * Получить минимальный рекомендуемый дневной бюджет для платформы
 */
export function getMinDailyBudget(platform: string): number {
  const config = PLATFORM_BUDGETS.find(
    p => p.platform.toLowerCase() === platform.toLowerCase()
  );
  return config?.minDailyBudget || 500; // Минимум 500₸/день по умолчанию
}

/**
 * Рассчитать дневной бюджет
 */
export function calculateDailyBudget(totalBudget: number, periodDays: number): number {
  if (periodDays <= 0) return 0;
  return Math.round(totalBudget / periodDays);
}

/**
 * Проверить достаточность бюджета для выбранных платформ
 */
export function isBudgetSufficient(
  platforms: string[],
  budget: number,
  periodDays: number
): boolean {
  const recommendations = getBudgetRecommendations(platforms, budget, periodDays);
  return recommendations.isRecommended;
}

import { useState, memo, useCallback, useMemo } from 'react';
import { Phone, Lock, Globe, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Language } from '../lib/translations';
import { ButtonSpinner } from './LoadingSpinner';

// Текст пользовательского соглашения
const USER_AGREEMENT = `ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ

Товарищество с ограниченной ответственностью «bibigul.agz» предоставляет сайт для управления маркетингом и продажами, размещённый в сети Интернет по адресу diar.pro, на условиях, являющихся предметом настоящего Пользовательского соглашения (далее — Соглашение). В случае несогласия с условиями Соглашения Пользователь обязан прекратить использование сайта. Использование сайта Пользователями означает их безоговорочное принятие и обязательство соблюдать все условия настоящего Соглашения.

Настоящее Пользовательское соглашение определяет порядок и условия использования материалов и сервисов, размещённых в сети Интернет по адресу diar.pro (далее — Сайт), Пользователями (как этот термин определён ниже).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ОБЩИЕ ПОЛОЖЕНИЯ

В настоящем Соглашении, если из текста прямо не вытекает иное, следующие термины, используемые с заглавной буквы, имеют указанные ниже значения:

Администратор — Товарищество с ограниченной ответственностью «bibigul.agz», которому принадлежат все соответствующие права на Сайт.

Акцепт — полное и безоговорочное принятие условий настоящего Соглашения, размещённого на Сайте по адресу diar.pro, осуществляемое путём совершения Пользователем любых действий по использованию Сайта.

Аутентификационные данные Пользователя — логин (номер мобильного телефона или адрес электронной почты Пользователя) и пароль (код доступа, направляемый Пользователю), которые в совокупности признаются простой электронной подписью Пользователя. Пользователь самостоятельно обеспечивает сохранность своих аутентификационных данных и возможность получения кодов доступа. Стороны признают юридическую силу действий, совершённых с использованием аутентификационных данных.

Пользователь — лицо, осуществляющее доступ к Сайту и использующее размещённые на нём материалы и сервисы.

Контент — любое информационное наполнение Сайта, включая, но не ограничиваясь, текстами, фото-, аудио- и видеоматериалами.

Личный кабинет — персонализированная часть Сайта, посредством которой обеспечивается электронное взаимодействие между Пользователем и Администратором. Доступ осуществляется путём ввода аутентификационных данных.

Персональные данные — любая информация, относящаяся к определённому или определяемому физическому лицу.

Обработка персональных данных — любые действия с персональными данными, совершаемые с использованием средств автоматизации или без таковых.

Сайт — совокупность информации, программ для ЭВМ, баз данных, дизайна и иных объектов интеллектуальной собственности, доступных по адресу diar.pro.

Все иные термины толкуются в соответствии с законодательством Республики Казахстан.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ПРЕДМЕТ СОГЛАШЕНИЯ

Администратор предоставляет Пользователю право безвозмездного использования Сайта в пределах его функциональных возможностей.

Сайт предоставляется по принципу «как есть» (as is). Администратор не предоставляет гарантий соответствия Сайта ожиданиям Пользователя, его бесперебойной и безошибочной работы, а также точности и надёжности результатов его использования.

Пользователь считается присоединившимся к Соглашению в порядке статьи 396 ГК РК, получая доступ к Сайту и используя его, включая:
• просмотр материалов Сайта;
• использование сервисов;
• регистрацию в Личном кабинете;
• направление сообщений через формы обратной связи;
• иные способы использования Сайта.

Используя Сайт, Пользователь подтверждает, что ознакомился с условиями Соглашения и принимает их в полном объёме.

Настоящее Соглашение не устанавливает агентских, партнёрских или иных отношений, прямо не предусмотренных его условиями.

Все споры подлежат разрешению в соответствии с законодательством Республики Казахстан.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

РЕГИСТРАЦИЯ

Для доступа к отдельным сервисам требуется регистрация с созданием Личного кабинета.

Пользователь обязуется предоставлять достоверные и актуальные сведения. Администратор вправе заблокировать или удалить учётную запись при выявлении недостоверных данных.

Пользователь несёт ответственность за сохранность своих аутентификационных данных и все действия, совершённые с их использованием.

При регистрации Пользователь даёт согласие на получение информационных и рекламных уведомлений по телефону и электронной почте. Отказ от рассылок возможен путём обращения к Администратору по телефону +7 775 855 49 27 или по адресу электронной почты bula655@gmail.com.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ПРАВА И ОБЯЗАННОСТИ АДМИНИСТРАТОРА

Администратор вправе:
• направлять Пользователям информационные сообщения;
• временно ограничивать доступ к Сайту;
• проводить технические и профилактические работы;
• использовать отзывы Пользователей в статистических и маркетинговых целях.

Администратор не несёт ответственности за технические сбои, сбои линий связи, утрату данных, а также за действия третьих лиц.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ПРАВА И ОБЯЗАННОСТИ ПОЛЬЗОВАТЕЛЯ

Пользователь обязуется:
• соблюдать условия Соглашения;
• не нарушать законодательство Республики Казахстан;
• не причинять вред Сайту, Администратору и третьим лицам;
• не использовать материалы Сайта без согласия правообладателя.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ОГРАНИЧЕНИЕ ОТВЕТСТВЕННОСТИ

Администратор не гарантирует бесперебойную работу Сайта и не несёт ответственности за возможные убытки, связанные с его использованием, за исключением случаев, предусмотренных законом.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ

Пользователь даёт согласие на обработку персональных данных в соответствии с Законом РК № 94-V от 21 мая 2013 года «О персональных данных и их защите».

Администратор обрабатывает следующие данные:
• Ф. И. О., номер телефона, адрес электронной почты;
• техническую информацию (IP-адрес, браузер, статистику посещений).

Согласие может быть отозвано путём направления письменного заявления по адресу:
Республика Казахстан, г. Астана, ул. Алихан Бокейхан, дом 27/5, офис 16,
либо по электронной почте bula655@gmail.com.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ИЗМЕНЕНИЕ И РАСТОРЖЕНИЕ СОГЛАШЕНИЯ

Соглашение может быть изменено Администратором в одностороннем порядке. Актуальная версия публикуется на Сайте.

Пользователь вправе расторгнуть Соглашение, направив уведомление по адресу:
Республика Казахстан, г. Астана, ул. Алихан Бокейхан, дом 27/5, офис 16,
или по электронной почте bula655@gmail.com.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ИНФОРМАЦИЯ ОБ АДМИНИСТРАТОРЕ

Товарищество с ограниченной ответственностью «bibigul.agz»
БИН: 231140022192

Адрес: Республика Казахстан, город Астана,
улица Алихан Бокейхан, дом 27/5, офис 16

Банк: АО «KASPI BANK»
р/с: KZ02722S000031246804
БИК: CASPKZKA

Телефон: +7 775 855 49 27
Электронная почта: bula655@gmail.com`;

// OAuth через Google/Apple отключен - требует настройки провайдеров в Supabase

interface LoginProps {
  onLogin: (name: string) => void;
}

// Форматирование телефона в маску +7(XXX)XXX-XX-XX
function formatPhoneMask(value: string): string {
  // Убираем всё кроме цифр
  let digits = value.replace(/\D/g, '');

  // Если начинается с 8, заменяем на 7
  if (digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }
  // Если не начинается с 7, добавляем 7
  if (digits.length > 0 && !digits.startsWith('7')) {
    digits = '7' + digits;
  }

  // Ограничиваем 11 цифрами
  digits = digits.slice(0, 11);

  // Формируем маску
  if (digits.length === 0) return '';
  if (digits.length <= 1) return '+7';
  if (digits.length <= 4) return `+7(${digits.slice(1)}`;
  if (digits.length <= 7) return `+7(${digits.slice(1, 4)})${digits.slice(4)}`;
  if (digits.length <= 9) return `+7(${digits.slice(1, 4)})${digits.slice(4, 7)}-${digits.slice(7)}`;
  return `+7(${digits.slice(1, 4)})${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

// Извлечение чистого номера: +7(777)777-77-77 → +77777777777
function extractRawPhone(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  return digits.length > 0 ? `+${digits}` : '';
}

export const Login = memo(function Login({ onLogin }: LoginProps) {
  const { signIn, signUp, resetPassword } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [phone, setPhone] = useState(''); // Форматированный: +7(777)777-77-77
  const [password, setPassword] = useState('');

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneMask(e.target.value));
  }, []);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAgreement, setShowAgreement] = useState(false);

  const getErrorMessage = useCallback((message: string): string => {
    if (message.includes('Invalid login credentials') || message.includes('invalid_grant')) {
      return t.login.errors.invalidCredentials;
    }
    if (message.includes('Email not confirmed')) {
      return t.login.errors.emailNotConfirmed;
    }
    if (message.includes('User already registered')) {
      return t.login.errors.userExists;
    }
    if (message.includes('Password')) {
      return t.login.errors.passwordTooShort;
    }
    if (message.includes('email') && message.includes('not found')) {
      return t.login.errors.userNotFound;
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return t.login.errors.rateLimit;
    }
    return message || t.login.errors.default;
  }, [t]);

  const handlePhoneLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone || !password) {
      setError(t.login.fillAllFields);
      return;
    }

    if (!agreed) {
      setError(t.login.needAgreement);
      return;
    }

    const rawPhone = extractRawPhone(phone);

    setIsLoading(true);

    if (isSignUp) {
      const { error: signUpError } = await signUp(rawPhone, password);
      if (signUpError) {
        setError(getErrorMessage(signUpError.message));
        setIsLoading(false);
      } else {
        setError(null);
        setSuccessMessage(t.login.success.signUp);
        setIsLoading(false);
        setIsLoadingProfile(true);
        onLogin(rawPhone.slice(-4));
      }
    } else {
      const { error: signInError } = await signIn(rawPhone, password);
      if (signInError) {
        setError(getErrorMessage(signInError.message));
        setIsLoading(false);
      } else {
        setError(null);
        setSuccessMessage(t.login.success.signIn);
        setIsLoading(false);
        setIsLoadingProfile(true);
        onLogin(rawPhone.slice(-4));
      }
    }
  }, [phone, password, agreed, isSignUp, signUp, signIn, getErrorMessage, onLogin, t]);

  const handleForgotPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!phone) {
      setError(t.login.enterPhoneForReset);
      return;
    }

    setIsLoading(true);
    const { error: resetError } = await resetPassword(extractRawPhone(phone));

    if (resetError) {
      setError(getErrorMessage(resetError.message));
    } else {
      setSuccessMessage(t.login.resetPasswordSent);
    }

    setIsLoading(false);
  }, [phone, getErrorMessage, resetPassword, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent mb-2">
            DIAR
          </h1>
          <p className="text-gray-400">
            {showForgotPassword 
              ? t.login.forgotPasswordTitle 
              : (isSignUp ? t.login.signUpTitle : t.login.title)}
          </p>
        </div>

        {/* Language selector */}
        <div className="mb-6">
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
            >
              <option value="🇷🇺 RU">🇷🇺 RU</option>
              <option value="🇰🇿 KZ">🇰🇿 KZ</option>
              <option value="🇺🇸 EN">🇺🇸 EN</option>
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400 text-sm">
            {successMessage}
          </div>
        )}

        {/* Loading profile indicator */}
        {isLoadingProfile && (
          <div className="mb-4 p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-center justify-center gap-3 mb-2">
              <ButtonSpinner className="text-yellow-500" />
              <span className="text-yellow-400 text-sm font-medium">{t.login.success.loadingProfile}</span>
            </div>
            <p className="text-gray-500 text-xs text-center">
              {isSignUp ? t.login.success.creatingProfile : t.login.success.gettingProfile}
            </p>
            <div className="mt-3 w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full animate-pulse" style={{ width: '70%' }} />
            </div>
          </div>
        )}

        {/* Phone login form */}
        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4 mb-6">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="+7(___) ___-__-__"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? t.login.sending : t.login.sendInstructions}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setError(null);
                setSuccessMessage(null);
              }}
              className="w-full py-3 text-gray-400 hover:text-white transition-colors"
            >
              {t.login.backToLogin}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhoneLogin} className="space-y-4 mb-6">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="+7(___) ___-__-__"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-colors"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.login.passwordPlaceholder}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-colors"
              />
            </div>

            {!isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
                >
                  {t.login.forgotPassword}
                </button>
              </div>
            )}

            {!showForgotPassword && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-yellow-500 focus:ring-yellow-500/50"
                />
                <label htmlFor="agree" className="text-gray-400">
                  {t.login.agreeText}{' '}
                  <button
                    type="button"
                    onClick={() => setShowAgreement(true)}
                    className="text-yellow-500 hover:text-yellow-400 underline"
                  >
                    {t.login.privacyPolicy}
                  </button>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={(!agreed && !showForgotPassword) || isLoading || isLoadingProfile}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {(isLoading || isLoadingProfile) && <ButtonSpinner className="text-black" />}
              {isLoadingProfile
                ? t.login.success.loadingProfile
                : isLoading
                  ? (isSignUp ? t.login.signUpLoading : t.login.signInLoading)
                  : (isSignUp ? t.login.signUpButton : t.login.signInButton)}
            </button>
          </form>
        )}

        {!showForgotPassword && (
          <p className="text-center text-gray-500">
            {isSignUp ? t.login.hasAccount : t.login.noAccount}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-yellow-500 hover:text-yellow-400"
            >
              {isSignUp ? t.login.signInButton : t.login.signUpButton}
            </button>
          </p>
        )}
      </div>

      {/* User Agreement Modal */}
      {showAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAgreement(false)}>
          <div className="fixed inset-0 bg-black/60" />
          <div
            className="relative z-50 bg-slate-900 border border-slate-700 text-white rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-yellow-500 text-xl font-semibold">{t.login.privacyPolicy}</h2>
              <button onClick={() => setShowAgreement(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div
              className="overflow-y-auto flex-1 text-gray-300 text-sm whitespace-pre-wrap leading-relaxed pr-3"
              style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                scrollbarWidth: 'thin',
                scrollbarColor: '#475569 #1e293b',
              }}
            >
              {USER_AGREEMENT}
            </div>
            <div className="pt-4 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => {
                  setShowAgreement(false);
                  setAgreed(true);
                }}
                className="px-6 py-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black rounded-lg hover:shadow-lg hover:shadow-yellow-500/30 transition-all"
              >
                {t.login.acceptAgreement || 'Принимаю'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
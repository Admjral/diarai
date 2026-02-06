import { ArrowLeft, MessageCircle, Send, Users, Check, Instagram, Menu, X, QrCode, RefreshCw, Bot, Loader2, AlertCircle, ChevronDown, ChevronUp, Brain, Inbox, XCircle } from 'lucide-react';
import type { Screen } from '../types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { integrationsAPI, messengerAPI, type Integration, type MessengerConfig } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

interface IntegrationsProps {
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type SetupStep = 'idle' | 'creating' | 'qr' | 'connected' | 'disconnected';

export function Integrations({ onNavigate, showToast }: IntegrationsProps) {
  const { t } = useLanguage();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [messengerConfigs, setMessengerConfigs] = useState<MessengerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // WhatsApp setup state
  const [waSetupStep, setWaSetupStep] = useState<SetupStep>('idle');
  const [waQRCode, setWaQRCode] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waSessionStatus, setWaSessionStatus] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Telegram setup state
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgLoading, setTgLoading] = useState(false);

  // AI Settings state
  const [aiSettingsOpen, setAiSettingsOpen] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [escalationEnabled, setEscalationEnabled] = useState(true);
  const [escalationKeywords, setEscalationKeywords] = useState('');
  const [savingAiSettings, setSavingAiSettings] = useState(false);

  // Polling для статуса WhatsApp сессии
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const checkWhatsAppStatus = useCallback(async () => {
    try {
      const response = await messengerAPI.getWhatsAppStatus();
      if (response.success && response.data) {
        setWaSessionStatus(response.data.status);
        if (response.data.isConnected) {
          setWaSetupStep('connected');
          stopPolling();
          showToast(t.integrations.whatsappSetup?.connected || 'WhatsApp connected!', 'success');
          loadMessengerConfigs();
        } else {
          // Сессия НЕ подключена - проверяем статус
          // NO_SESSION = сессия была удалена или истекла
          if (response.data.status === 'NO_SESSION') {
            setWaSetupStep('disconnected');
            setWaSessionStatus('NO_SESSION');
            stopPolling();
            loadMessengerConfigs();
          } else if (response.data.status === 'STOPPED' || response.data.status === 'FAILED' || response.data.status === 'DISCONNECTED') {
            setWaSetupStep('disconnected');
            setWaSessionStatus(response.data.status);
            stopPolling();
            loadMessengerConfigs();
          } else if (response.data.status === 'SCAN_QR_CODE' || response.data.status === 'STARTING') {
            setWaSetupStep('qr');
          }
        }
      }
    } catch {
      // При ошибке проверяем, была ли сессия ранее
      const waConfig = messengerConfigs.find(c => c.type === 'whatsapp');
      if (waConfig?.sessionId) {
        // Была сессия, но сейчас ошибка - значит отключена
        setWaSetupStep('disconnected');
        setWaSessionStatus('NO_SESSION');
      } else {
        setWaSetupStep('idle');
        setWaSessionStatus('');
      }
      stopPolling();
    }
  }, [stopPolling, showToast, t, messengerConfigs]);

  const startPolling = useCallback(() => {
    stopPolling();
    checkWhatsAppStatus(); // Сразу проверяем
    pollingRef.current = setInterval(checkWhatsAppStatus, 3000);
  }, [checkWhatsAppStatus, stopPolling]);

  // Cleanup polling при размонтировании
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Загружаем интеграции при монтировании
  useEffect(() => {
    loadIntegrations();
    loadMessengerConfigs();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await integrationsAPI.getAll();
      setIntegrations(data);

      // Загружаем статистику для каждой интеграции
      const integrationTypes = ['WhatsApp Business', 'Telegram Bot', 'Instagram Direct'];
      const statsData: Record<string, number> = {};

      for (const type of integrationTypes) {
        try {
          const stat = await integrationsAPI.getStats(type);
          statsData[type] = stat.connectedClients;
        } catch {
          statsData[type] = 0;
        }
      }

      setStats(statsData);
    } catch (error: any) {
      console.error('Ошибка при загрузке интеграций:', error);
      showToast(t.integrations.loadError, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMessengerConfigs = async () => {
    try {
      const response = await messengerAPI.getConfigs();
      // Убеждаемся что configs - массив
      const configs = Array.isArray(response.configs) ? response.configs : [];
      setMessengerConfigs(configs);

      // Проверяем WhatsApp статус
      const waConfig = configs.find(c => c.type === 'whatsapp');
      if (waConfig?.sessionId) {
        // Если есть сессия - ВСЕГДА проверяем реальный статус с WAHA
        // (не доверяем флагу isConnected в БД)
        checkWhatsAppStatus();
      } else {
        // Нет конфига или нет сессии - сбрасываем состояние
        setWaSetupStep('idle');
        setWaSessionStatus('');
      }
    } catch (error) {
      console.error('Ошибка при загрузке конфигураций мессенджеров:', error);
      // При ошибке сбрасываем состояние - ничего не подключено
      setMessengerConfigs([]);
      setWaSetupStep('idle');
      setWaSessionStatus('');
    }
  };

  const isConnected = (type: string): boolean => {
    // Определяем тип мессенджера
    const messengerType = type.toLowerCase().includes('whatsapp') ? 'whatsapp' :
                          type.toLowerCase().includes('telegram') ? 'telegram' :
                          type.toLowerCase().includes('instagram') ? 'instagram' : null;

    if (messengerType) {
      // Ищем конфиг для этого типа мессенджера
      const config = messengerConfigs.find(c => c.type === messengerType);
      // Возвращаем true ТОЛЬКО если конфиг найден И isConnected === true
      // Если конфиг не найден - НЕ подключено
      return config?.isConnected === true;
    }

    // Для не-мессенджеров проверяем в integrations
    const integration = integrations.find(i => i.type === type);
    // Возвращаем true ТОЛЬКО если интеграция найдена И status === 'connected'
    return integration?.status === 'connected';
  };

  const getMessengerConfig = (type: string): MessengerConfig | undefined => {
    const messengerType = type.toLowerCase().includes('whatsapp') ? 'whatsapp' :
                          type.toLowerCase().includes('telegram') ? 'telegram' :
                          type.toLowerCase().includes('instagram') ? 'instagram' : null;
    return messengerConfigs.find(c => c.type === messengerType);
  };

  // WhatsApp Functions
  const handleCreateWhatsAppSession = async () => {
    setWaLoading(true);
    try {
      await messengerAPI.createWhatsAppSession();
      setWaSetupStep('qr');
      showToast(t.integrations.whatsappSetup?.sessionCreated || 'Session created!', 'success');
      // Автоматически запрашиваем QR-код
      handleGetWhatsAppQR();
      // Запускаем polling статуса
      startPolling();
    } catch (error) {
      console.error('Ошибка создания сессии:', error);
      showToast(t.integrations.whatsappSetup?.sessionError || 'Session error', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleGetWhatsAppQR = async () => {
    setWaLoading(true);
    try {
      const response = await messengerAPI.getWhatsAppQR();
      if (response.success && response.data?.value) {
        setWaQRCode(response.data.value);

        // Проверяем статус
        if (response.data.status === 'CONNECTED' || response.data.status === 'WORKING') {
          setWaSetupStep('connected');
          stopPolling();
          showToast(t.integrations.whatsappSetup?.connected || 'Connected!', 'success');
          loadMessengerConfigs();
        } else if (!pollingRef.current) {
          // Запускаем polling если ещё не идёт
          startPolling();
        }
      }
    } catch (error) {
      console.error('Ошибка получения QR-кода:', error);
      showToast(t.integrations.whatsappSetup?.qrError || 'QR error', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  // Reconnect WhatsApp (when session is disconnected)
  const handleReconnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      // Создаём новую сессию
      await messengerAPI.createWhatsAppSession();
      setWaSetupStep('creating');
      showToast(t.integrations.whatsappSetup?.sessionCreated || 'Session created!', 'success');
      // Получаем QR-код
      await handleGetWhatsAppQR();
      setWaSetupStep('qr');
      // Запускаем polling статуса
      startPolling();
    } catch (error) {
      console.error('Ошибка переподключения WhatsApp:', error);
      showToast(t.integrations.whatsappSetup?.reconnectError || 'Ошибка переподключения', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  // Telegram Functions
  const handleConnectTelegram = async () => {
    if (!tgBotToken.trim()) {
      showToast(t.integrations.telegramSetup?.invalidToken || 'Invalid token', 'error');
      return;
    }

    setTgLoading(true);
    try {
      await messengerAPI.connectTelegram(tgBotToken.trim());
      showToast(t.integrations.telegramSetup?.botConnected || 'Bot connected!', 'success');
      setTgBotToken('');
      loadMessengerConfigs();
    } catch (error: any) {
      console.error('Ошибка подключения Telegram:', error);
      showToast(error?.message || t.integrations.telegramSetup?.botError || 'Bot error', 'error');
    } finally {
      setTgLoading(false);
    }
  };

  // AI Settings Functions
  const openAiSettings = (type: string) => {
    const config = getMessengerConfig(type);
    if (config) {
      setAiEnabled(config.aiEnabled);
      setAiPrompt(config.aiSystemPrompt || '');
      setEscalationEnabled(config.escalationEnabled);
      setEscalationKeywords(config.escalationKeywords?.join(', ') || '');
    }
    setAiSettingsOpen(type);
  };

  const handleSaveAiSettings = async () => {
    if (!aiSettingsOpen) return;

    setSavingAiSettings(true);
    try {
      const messengerType = aiSettingsOpen.toLowerCase().includes('whatsapp') ? 'whatsapp' :
                            aiSettingsOpen.toLowerCase().includes('telegram') ? 'telegram' : 'instagram';

      await messengerAPI.saveConfig({
        type: messengerType,
        aiEnabled,
        aiSystemPrompt: aiPrompt,
        escalationEnabled,
        escalationKeywords: escalationKeywords.split(',').map(k => k.trim()).filter(Boolean),
      });

      showToast(t.integrations.aiSettings?.settingsSaved || 'Settings saved!', 'success');
      setAiSettingsOpen(null);
      loadMessengerConfigs();
    } catch (error) {
      console.error('Ошибка сохранения настроек AI:', error);
      showToast('Ошибка сохранения настроек', 'error');
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleConnect = async (type: string) => {
    try {
      if (isConnected(type)) {
        // Отключаем
        await integrationsAPI.disconnect(type);
        showToast(t.integrations.disconnected.replace('{type}', type), 'info');
      } else {
        // Подключаем
        await integrationsAPI.connect(type, {});
        showToast(t.integrations.connectedSuccess.replace('{type}', type), 'success');
      }
      // Перезагружаем список интеграций
      await loadIntegrations();
    } catch (error: any) {
      console.error('Ошибка при изменении статуса интеграции:', error);
      showToast(
        error?.message || t.integrations.statusChangeError,
        'error'
      );
    }
  };

  const integrationList = [
    {
      name: t.integrations.integrationList.whatsapp.name,
      type: 'whatsapp',
      description: t.integrations.integrationList.whatsapp.description,
      icon: <MessageCircle className="w-8 h-8" />,
      gradient: 'from-green-400 to-green-600',
      features: t.integrations.integrationList.whatsapp.features,
    },
    {
      name: t.integrations.integrationList.telegram.name,
      type: 'telegram',
      description: t.integrations.integrationList.telegram.description,
      icon: <Send className="w-8 h-8" />,
      gradient: 'from-blue-400 to-blue-600',
      features: t.integrations.integrationList.telegram.features,
    },
    {
      name: t.integrations.integrationList.instagram.name,
      type: 'instagram',
      description: t.integrations.integrationList.instagram.description,
      icon: <Instagram className="w-8 h-8" />,
      gradient: 'from-purple-500 via-pink-500 to-orange-500',
      features: t.integrations.integrationList.instagram.features,
    },
  ];

  const renderWhatsAppSetup = () => (
    <div className="mt-4 bg-slate-900/50 rounded-xl p-4 border border-slate-700">
      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
        <QrCode className="w-5 h-5 text-green-400" />
        {t.integrations.whatsappSetup?.title || 'Connect WhatsApp'}
      </h4>

      {/* Steps */}
      <div className="space-y-3 mb-4">
        <div className={`flex items-center gap-3 ${waSetupStep !== 'idle' ? 'text-green-400' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${waSetupStep !== 'idle' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-gray-500'}`}>1</div>
          <span className="text-sm">{t.integrations.whatsappSetup?.step1 || 'Create session'}</span>
        </div>
        <div className={`flex items-center gap-3 ${waSetupStep === 'qr' || waSetupStep === 'connected' ? 'text-green-400' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${waSetupStep === 'qr' || waSetupStep === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-gray-500'}`}>2</div>
          <span className="text-sm">{t.integrations.whatsappSetup?.step2 || 'Scan QR code'}</span>
        </div>
        <div className={`flex items-center gap-3 ${waSetupStep === 'connected' ? 'text-green-400' : 'text-gray-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${waSetupStep === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-gray-500'}`}>3</div>
          <span className="text-sm">{t.integrations.whatsappSetup?.step3 || 'Done!'}</span>
        </div>
      </div>

      {/* Actions */}
      {waSetupStep === 'idle' && (
        <button
          onClick={handleCreateWhatsAppSession}
          disabled={waLoading}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {waLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t.integrations.whatsappSetup?.creatingSession || 'Creating...'}
            </>
          ) : (
            <>
              <QrCode className="w-5 h-5" />
              {t.integrations.whatsappSetup?.createSession || 'Create session'}
            </>
          )}
        </button>
      )}

      {waSetupStep === 'qr' && (
        <div className="space-y-4">
          {waQRCode ? (
            <div className="bg-white p-4 rounded-xl mx-auto w-fit">
              <img
                src={`data:image/png;base64,${waQRCode}`}
                alt="WhatsApp QR Code"
                className="w-48 h-48"
              />
            </div>
          ) : (
            <div className="bg-slate-800 p-8 rounded-xl mx-auto w-fit flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
            </div>
          )}
          <p className="text-gray-400 text-sm text-center">
            {t.integrations.whatsappSetup?.scanInstructions || 'Open WhatsApp → Linked devices → Link a device → Scan QR'}
          </p>
          <button
            onClick={handleGetWhatsAppQR}
            disabled={waLoading}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${waLoading ? 'animate-spin' : ''}`} />
            {t.integrations.whatsappSetup?.refreshQR || 'Refresh QR'}
          </button>
        </div>
      )}

      {waSetupStep === 'qr' && waSessionStatus && waSessionStatus !== 'SCAN_QR_CODE' && (
        <div className="mt-2 px-3 py-2 bg-slate-800 rounded-lg">
          <p className="text-xs text-gray-400">
            {t.integrations.whatsappSetup?.statusLabel || 'Status'}: <span className="text-yellow-400 font-medium">{waSessionStatus}</span>
          </p>
        </div>
      )}

      {waSetupStep === 'connected' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-6 h-6 text-green-400" />
          <div>
            <span className="text-green-400 font-medium">{t.integrations.whatsappSetup?.connected || 'Connected!'}</span>
            <p className="text-xs text-green-400/60 mt-0.5">{t.integrations.whatsappSetup?.sessionActive || 'Session is active and receiving messages'}</p>
          </div>
        </div>
      )}

      {waSetupStep === 'disconnected' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="w-6 h-6 text-red-400" />
            <div>
              <span className="text-red-400 font-medium">
                {t.integrations.whatsappSetup?.sessionDisconnected || 'Сессия отключена'}
              </span>
              <p className="text-xs text-red-400/60 mt-0.5">
                {t.integrations.whatsappSetup?.sessionExpired || 'WhatsApp был отключен или сессия истекла'}
              </p>
            </div>
          </div>
          <button
            onClick={handleReconnectWhatsApp}
            disabled={waLoading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {waLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t.integrations.whatsappSetup?.reconnecting || 'Переподключение...'}
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                {t.integrations.whatsappSetup?.reconnect || 'Переподключить WhatsApp'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  const renderTelegramSetup = () => (
    <div className="mt-4 bg-slate-900/50 rounded-xl p-4 border border-slate-700">
      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
        <Bot className="w-5 h-5 text-blue-400" />
        {t.integrations.telegramSetup?.title || 'Connect Telegram bot'}
      </h4>

      {/* Steps */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-500">1</div>
          <span className="text-sm">{t.integrations.telegramSetup?.step1 || 'Create bot via @BotFather'}</span>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-500">2</div>
          <span className="text-sm">{t.integrations.telegramSetup?.step2 || 'Copy bot token'}</span>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-500">3</div>
          <span className="text-sm">{t.integrations.telegramSetup?.step3 || 'Paste and connect'}</span>
        </div>
      </div>

      {!isConnected('Telegram Bot') ? (
        <div className="space-y-3">
          <input
            type="text"
            value={tgBotToken}
            onChange={(e) => setTgBotToken(e.target.value)}
            placeholder={t.integrations.telegramSetup?.botTokenPlaceholder || 'Bot token (123456789:ABC...)'}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleConnectTelegram}
            disabled={tgLoading || !tgBotToken.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {tgLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t.integrations.telegramSetup?.connecting || 'Connecting...'}
              </>
            ) : (
              <>
                <Bot className="w-5 h-5" />
                {t.integrations.telegramSetup?.connectBot || 'Connect bot'}
              </>
            )}
          </button>
          <details className="text-sm">
            <summary className="text-blue-400 cursor-pointer hover:underline">
              {t.integrations.telegramSetup?.howToGetToken || 'How to get a token?'}
            </summary>
            <pre className="mt-2 p-3 bg-slate-800 rounded-lg text-gray-400 text-xs whitespace-pre-wrap">
              {t.integrations.telegramSetup?.tokenInstructions || '1. Open @BotFather\n2. Send /newbot\n3. Follow instructions\n4. Copy token'}
            </pre>
          </details>
        </div>
      ) : (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-6 h-6 text-blue-400" />
          <span className="text-blue-400 font-medium">{t.integrations.telegramSetup?.botConnected || 'Bot connected!'}</span>
        </div>
      )}
    </div>
  );

  const renderAiSettingsModal = () => {
    if (!aiSettingsOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              {t.integrations.aiSettings?.title || 'AI Settings'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            {/* Enable AI */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white">{t.integrations.aiSettings?.enableAI || 'Enable AI responses'}</span>
              <div
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${aiEnabled ? 'bg-purple-500' : 'bg-slate-600'} relative`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </div>
            </label>

            {/* AI Prompt */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t.integrations.aiSettings?.aiPrompt || 'System prompt'}</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t.integrations.aiSettings?.aiPromptPlaceholder || 'You are a company assistant...'}
                rows={4}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
              />
            </div>

            {/* Enable Escalation */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white">{t.integrations.aiSettings?.enableEscalation || 'Escalation to operator'}</span>
              <div
                onClick={() => setEscalationEnabled(!escalationEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${escalationEnabled ? 'bg-purple-500' : 'bg-slate-600'} relative`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${escalationEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </div>
            </label>

            {/* Escalation Keywords */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t.integrations.aiSettings?.escalationKeywords || 'Escalation keywords'}</label>
              <input
                type="text"
                value={escalationKeywords}
                onChange={(e) => setEscalationKeywords(e.target.value)}
                placeholder={t.integrations.aiSettings?.escalationPlaceholder || 'human, operator, manager'}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-6 border-t border-slate-700 flex gap-3">
            <button
              onClick={() => setAiSettingsOpen(null)}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleSaveAiSettings}
              disabled={savingAiSettings}
              className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingAiSettings ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t.integrations.aiSettings?.saveSettings || 'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center">
        <div className="text-white">{t.integrations.loading}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white">{t.integrations.title}</h1>
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-4 ml-auto">
              <button
                onClick={() => onNavigate('inbox')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white flex items-center gap-2 transition-colors"
              >
                <Inbox className="w-4 h-4" />
                <span>Чаты</span>
              </button>
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t.integrations.supportLink}</span>
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
                        onNavigate('inbox');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-green-400"
                    >
                      <Inbox className="w-5 h-5" />
                      <span>Чаты</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{t.integrations.supportLink}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-white mb-2">{t.integrations.channelsTitle}</h2>
          <p className="text-gray-400">
            {t.integrations.channelsDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrationList.map((integration, index) => {
            const connected = isConnected(integration.name);
            const connectedClients = stats[integration.name] || 0;
            const isExpanded = expandedCard === integration.name;

            return (
              <div
                key={index}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all"
              >
                {/* Icon and Status */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${integration.gradient} flex items-center justify-center`}>
                    {integration.icon}
                  </div>
                  {connected && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg">
                      <Check className="w-4 h-4" />
                      <span>{t.integrations.connectedStatus}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className="text-white mb-2">{integration.name}</h3>
                <p className="text-gray-400 mb-4">{integration.description}</p>

                {/* Connected Clients Count */}
                {connected && (
                  <div className="mb-4 flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-green-400" />
                    <span className="text-gray-400">
                      {t.integrations.connectedClients} <span className="text-white font-semibold">{connectedClients}</span>
                    </span>
                  </div>
                )}

                {/* Features */}
                <div className="space-y-2 mb-6">
                  {integration.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center gap-2 text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                {connected ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => openAiSettings(integration.name)}
                      className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Brain className="w-4 h-4" />
                      {t.integrations.aiSettings?.title || 'AI Settings'}
                    </button>
                    <button
                      onClick={() => handleConnect(integration.name)}
                      className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors"
                    >
                      {t.integrations.disconnect}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setExpandedCard(isExpanded ? null : integration.name)}
                      className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition-all flex items-center justify-center gap-2"
                    >
                      {t.integrations.connect}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {/* Expanded Setup */}
                    {isExpanded && integration.type === 'whatsapp' && renderWhatsAppSetup()}
                    {isExpanded && integration.type === 'telegram' && renderTelegramSetup()}
                    {isExpanded && integration.type === 'instagram' && (
                      <div className="mt-4 bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-center gap-3 text-yellow-400">
                          <AlertCircle className="w-5 h-5" />
                          <span className="text-sm">Instagram интеграция скоро будет доступна</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-6">
          <h3 className="text-white mb-3">{t.integrations.howItWorks}</h3>
          <p className="text-gray-300 mb-4">
            {t.integrations.howItWorksDescription}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-blue-400" />
                <p className="text-white font-semibold">{t.integrations.unifiedChat}</p>
              </div>
              <p className="text-gray-400 text-sm">{t.integrations.unifiedChatDescription}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-green-400" />
                <p className="text-white font-semibold">{t.integrations.crmConnection}</p>
              </div>
              <p className="text-gray-400 text-sm">{t.integrations.crmConnectionDescription}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-5 h-5 text-yellow-400" />
                <p className="text-white font-semibold">{t.integrations.quickResponses}</p>
              </div>
              <p className="text-gray-400 text-sm">{t.integrations.quickResponsesDescription}</p>
            </div>
          </div>
        </div>

        {/* Link to CRM */}
        <div className="mt-8 bg-slate-800/30 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white mb-2">{t.integrations.manageClients}</h3>
              <p className="text-gray-400 text-sm">
                {t.integrations.manageClientsDescription}
              </p>
            </div>
            <button
              onClick={() => onNavigate('crm')}
              className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition-all font-semibold"
            >
              {t.integrations.openCRM}
            </button>
          </div>
        </div>
      </main>

      {/* AI Settings Modal */}
      {renderAiSettingsModal()}
    </div>
  );
}

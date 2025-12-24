import { ArrowLeft, MessageCircle, Send, Users, Check, ExternalLink, Instagram, Menu, X } from 'lucide-react';
import { Screen } from '../App';
import { useState } from 'react';

interface IntegrationsProps {
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function Integrations({ onNavigate, showToast }: IntegrationsProps) {
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>(['WhatsApp Business']);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleConnect = (name: string) => {
    if (connectedIntegrations.includes(name)) {
      setConnectedIntegrations(connectedIntegrations.filter(i => i !== name));
      showToast(`${name} отключен`, 'info');
    } else {
      setConnectedIntegrations([...connectedIntegrations, name]);
      showToast(`${name} успешно подключен!`, 'success');
    }
  };

  const integrations = [
    {
      name: 'WhatsApp Business',
      description: 'Связь с клиентами через WhatsApp',
      icon: <MessageCircle className="w-8 h-8" />,
      gradient: 'from-green-400 to-green-600',
      features: ['Общение с клиентами', 'Получение сообщений', 'Отправка ответов'],
      connectedClients: 12,
    },
    {
      name: 'Telegram Bot',
      description: 'Общение с клиентами через Telegram',
      icon: <Send className="w-8 h-8" />,
      gradient: 'from-blue-400 to-blue-600',
      features: ['Чат с клиентами', 'AI-ответы', 'Уведомления'],
      connectedClients: 8,
    },
    {
      name: 'Instagram Direct',
      description: 'Сообщения от клиентов в Instagram',
      icon: <Instagram className="w-8 h-8" />,
      gradient: 'from-purple-500 via-pink-500 to-orange-500',
      features: ['Direct сообщения', 'Ответы клиентам', 'История переписки'],
      connectedClients: 5,
    },
  ];

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
            <h1 className="text-white">Интеграции</h1>
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-4 ml-auto">
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
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
                      <MessageCircle className="w-5 h-5" />
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
        <div className="mb-8">
          <h2 className="text-white mb-2">Каналы связи с клиентами</h2>
          <p className="text-gray-400">
            Подключите каналы коммуникации для общения с вашими клиентами из CRM
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration, index) => (
            <div
              key={index}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all"
            >
              {/* Icon and Status */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${integration.gradient} flex items-center justify-center`}>
                  {integration.icon}
                </div>
                {connectedIntegrations.includes(integration.name) && (
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg">
                    <Check className="w-4 h-4" />
                    <span>Подключено</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <h3 className="text-white mb-2">{integration.name}</h3>
              <p className="text-gray-400 mb-4">{integration.description}</p>

              {/* Connected Clients Count */}
              {connectedIntegrations.includes(integration.name) && (
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-green-400" />
                  <span className="text-gray-400">
                    Подключено клиентов: <span className="text-white font-semibold">{integration.connectedClients}</span>
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

              {/* Action Button */}
              {connectedIntegrations.includes(integration.name) ? (
                <div className="space-y-2">
                  <button className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Настройки
                  </button>
                  <button
                    onClick={() => handleConnect(integration.name)}
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors"
                  >
                    Отключить
                  </button>
                </div>
              ) : (
                <button
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition-all"
                  onClick={() => handleConnect(integration.name)}
                >
                  Подключить
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-6">
          <h3 className="text-white mb-3">💡 Как это работает</h3>
          <p className="text-gray-300 mb-4">
            Подключите каналы связи, чтобы общаться с клиентами прямо из CRM. Все сообщения от клиентов 
            будут автоматически привязаны к их профилям в системе.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-blue-400" />
                <p className="text-white font-semibold">Единый чат</p>
              </div>
              <p className="text-gray-400 text-sm">Все сообщения от клиентов в одном месте</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-green-400" />
                <p className="text-white font-semibold">Связь с CRM</p>
              </div>
              <p className="text-gray-400 text-sm">Автоматическая привязка к профилям клиентов</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-5 h-5 text-yellow-400" />
                <p className="text-white font-semibold">Быстрые ответы</p>
              </div>
              <p className="text-gray-400 text-sm">Отвечайте клиентам прямо из системы</p>
            </div>
          </div>
        </div>

        {/* Link to CRM */}
        <div className="mt-8 bg-slate-800/30 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white mb-2">Управление клиентами</h3>
              <p className="text-gray-400 text-sm">
                Перейдите в CRM, чтобы просмотреть всех клиентов и начать общение
              </p>
            </div>
            <button
              onClick={() => onNavigate('crm')}
              className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition-all font-semibold"
            >
              Открыть CRM
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
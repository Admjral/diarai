import { ArrowLeft, Users, Megaphone, Wallet, BarChart3, Download, Search, Edit2, Power, Plus, Minus, DollarSign, Loader2, Shield, Upload, Menu, X, Target, Sparkles } from 'lucide-react';
import type { Screen } from '../types';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminAPI, AdminStats, AdminUser, CampaignWithUser, WalletWithUser } from '../lib/api';
import { Toast } from './Toast';
import { useLanguage } from '../contexts/LanguageContext';

interface AdminPanelProps {
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type Tab = 'stats' | 'users' | 'campaigns' | 'wallets';

export function AdminPanel({ onNavigate, showToast }: AdminPanelProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignWithUser[]>([]);
  const [wallets, setWallets] = useState<WalletWithUser[]>([]);
  
  // Фильтры и поиск
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | 'Free' | 'Pro' | 'Business'>('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  
  // Модальное окно для операций с кошельком
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletWithUser | null>(null);
  const [walletAction, setWalletAction] = useState<'add' | 'withdraw' | 'set'>('add');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  
  // Модальное окно для импорта данных
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'leads' | 'clients' | 'campaigns' | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  
  // Модальное окно для деталей кампании
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithUser | null>(null);
  const [showCampaignDetailsModal, setShowCampaignDetailsModal] = useState(false);
  
  // Модальное окно для загрузки статистики кампании
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedCampaignForStats, setSelectedCampaignForStats] = useState<CampaignWithUser | null>(null);
  const [statsForm, setStatsForm] = useState({
    spent: '',
    conversions: '',
    budget: '',
  });
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Модальное окно для выбора пользователя перед экспортом
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'leads' | 'clients' | 'campaigns' | null>(null);
  const [exportUserId, setExportUserId] = useState<number | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Загрузка статистики
  const loadStats = useCallback(async () => {
    try {
      const data = await adminAPI.getStats();
      setStats(data);
    } catch (error: any) {
      console.error('Ошибка загрузки статистики:', error);
      showToast(t.adminPanel.statsLoadError, 'error');
    }
  }, [showToast]);

  // Загрузка пользователей
  const loadUsers = useCallback(async () => {
    try {
      const data = await adminAPI.getAllUsers();
      setUsers(data);
    } catch (error: any) {
      console.error('Ошибка загрузки пользователей:', error);
      showToast(t.adminPanel.usersLoadError, 'error');
    }
  }, [showToast]);

  // Загрузка кампаний
  const loadCampaigns = useCallback(async () => {
    try {
      const data = await adminAPI.getAllCampaigns();
      setCampaigns(data);
    } catch (error: any) {
      console.error('Ошибка загрузки кампаний:', error);
      showToast(t.adminPanel.campaignsLoadError, 'error');
    }
  }, [showToast]);

  // Загрузка кошельков
  const loadWallets = useCallback(async () => {
    try {
      const data = await adminAPI.getAllWallets();
      setWallets(data);
    } catch (error: any) {
      console.error('Ошибка загрузки кошельков:', error);
      showToast(t.adminPanel.walletsLoadError, 'error');
    }
  }, [showToast]);

  // Загрузка данных при смене вкладки
  useEffect(() => {
    setLoading(true);
    const loadData = async () => {
      switch (activeTab) {
        case 'stats':
          await loadStats();
          break;
        case 'users':
          await loadUsers();
          break;
        case 'campaigns':
          await loadCampaigns();
          break;
        case 'wallets':
          await loadWallets();
          break;
      }
      setLoading(false);
    };
    loadData();
  }, [activeTab, loadStats, loadUsers, loadCampaigns, loadWallets]);

  // Обновление плана пользователя
  const handleUpdatePlan = useCallback(async (userId: number, plan: 'Free' | 'Pro' | 'Business') => {
    try {
      await adminAPI.updateUserPlan(userId, plan);
      showToast(t.adminPanel.planUpdated, 'success');
      await loadUsers();
    } catch (error: any) {
      console.error('Ошибка обновления плана:', error);
      showToast(t.adminPanel.planUpdateError, 'error');
    }
  }, [loadUsers, showToast, t]);

  // Обновление роли пользователя
  const handleUpdateRole = useCallback(async (userId: number, role: 'user' | 'admin') => {
    try {
      await adminAPI.updateUserRole(userId, role);
      showToast(t.adminPanel.roleUpdated, 'success');
      await loadUsers();
    } catch (error: any) {
      console.error('Ошибка обновления роли:', error);
      showToast(t.adminPanel.roleUpdateError, 'error');
    }
  }, [loadUsers, showToast, t]);

  // Переключение статуса кампании
  const handleToggleCampaign = useCallback(async (campaignId: number, currentStatus: string) => {
    try {
      // Определяем следующий статус в зависимости от текущего
      let newStatus: string;
      
      if (currentStatus === t.adminPanel.status.active) {
        newStatus = t.adminPanel.status.paused;
      } else if (currentStatus === t.adminPanel.status.paused) {
        newStatus = t.adminPanel.status.onReview;
      } else if (currentStatus === t.adminPanel.status.onReview) {
        newStatus = t.adminPanel.status.active;
      } else {
        // Если статус неизвестен, переключаем на "Активна"
        newStatus = t.adminPanel.status.active;
      }
      
      await adminAPI.toggleCampaign(campaignId, newStatus);
      
      let message = '';
      if (newStatus === t.adminPanel.status.active) {
        message = t.adminPanel.campaignActivated;
      } else if (newStatus === t.adminPanel.status.paused) {
        message = t.adminPanel.campaignPaused;
      } else if (newStatus === t.adminPanel.status.onReview) {
        message = t.adminPanel.campaignSentForReview;
      }
      
      showToast(message, 'success');
      await loadCampaigns();
      await loadStats();
    } catch (error: any) {
      console.error('Ошибка изменения статуса кампании:', error);
      showToast(t.adminPanel.campaignStatusError, 'error');
    }
  }, [loadCampaigns, loadStats, showToast, t]);

  // Открыть модальное окно для выбора пользователя перед экспортом
  const openExportModal = useCallback((type: 'leads' | 'clients' | 'campaigns') => {
    setExportType(type);
    setExportUserId(null);
    setExportModalOpen(true);
  }, []);

  // Выполнить экспорт с выбранным пользователем
  const handleExport = useCallback(async () => {
    if (!exportType) return;

    setExportLoading(true);
    try {
      let blob: Blob;
      let filename: string;

      if (exportType === 'leads') {
        blob = await adminAPI.exportLeads(exportUserId || undefined);
        filename = exportUserId ? `leads_user_${exportUserId}.csv` : 'leads_all.csv';
      } else if (exportType === 'clients') {
        blob = await adminAPI.exportClients(exportUserId || undefined);
        filename = exportUserId ? `clients_user_${exportUserId}.csv` : 'clients_all.csv';
      } else {
        blob = await adminAPI.exportCampaignsStats(exportUserId || undefined);
        filename = exportUserId ? `campaigns_stats_user_${exportUserId}.csv` : 'campaigns_stats_all.csv';
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const userText = exportUserId 
        ? users.find(u => u.id === exportUserId)?.name || t.adminPanel.export.user
        : t.adminPanel.export.allUsers;
      
      const typeText = exportType === 'leads' ? t.adminPanel.export.typeLeads : exportType === 'clients' ? t.adminPanel.export.typeClients : t.adminPanel.export.typeCampaignStats;
      showToast(`${typeText} экспортированы (${userText})`, 'success');
      
      setExportModalOpen(false);
      setExportType(null);
      setExportUserId(null);
    } catch (error: any) {
      console.error('Ошибка экспорта:', error);
      const typeText = exportType === 'leads' ? t.adminPanel.export.typeLeadsGenitive : exportType === 'clients' ? t.adminPanel.export.typeClientsGenitive : t.adminPanel.export.typeCampaignStatsGenitive;
      showToast(`Ошибка экспорта ${typeText}`, 'error');
    } finally {
      setExportLoading(false);
    }
  }, [exportType, exportUserId, users, showToast]);

  // Старые обработчики для обратной совместимости (теперь открывают модальное окно)
  const handleExportLeads = useCallback(() => {
    openExportModal('leads');
  }, [openExportModal]);

  const handleExportClients = useCallback(() => {
    openExportModal('clients');
  }, [openExportModal]);

  const handleExportCampaignsStats = useCallback(() => {
    openExportModal('campaigns');
  }, [openExportModal]);

  // Операции с кошельком
  const openWalletModal = useCallback((wallet: WalletWithUser, action: 'add' | 'withdraw' | 'set') => {
    setSelectedWallet(wallet);
    setWalletAction(action);
    setWalletAmount('');
    setWalletNote('');
    setWalletModalOpen(true);
  }, []);

  // Импорт данных
  const handleImport = useCallback(async () => {
    if (!selectedUserId || !importFile || !importType) return;
    
    setImportLoading(true);
    try {
      let result;
      if (importType === 'leads') {
        result = await adminAPI.importLeads(selectedUserId, importFile);
      } else if (importType === 'clients') {
        result = await adminAPI.importClients(selectedUserId, importFile);
      } else {
        result = await adminAPI.importCampaignsStats(selectedUserId, importFile);
      }
      
      const message = result.errors > 0 
        ? `${result.message}. Создано: ${result.created}, Ошибок: ${result.errors}`
        : result.message;
      
      showToast(message, result.errors > 0 ? 'info' : 'success');
      
      setImportModalOpen(false);
      setImportFile(null);
      setSelectedUserId(null);
      setImportType(null);
      
      // Обновляем данные
      if (importType === 'campaigns') {
        await loadCampaigns();
        await loadStats();
      }
    } catch (error: any) {
      console.error('Ошибка импорта:', error);
      showToast(error.message || t.adminPanel.errors.import, 'error');
    } finally {
      setImportLoading(false);
    }
  }, [selectedUserId, importFile, importType, loadCampaigns, loadStats, showToast]);

  const handleWalletAction = useCallback(async () => {
    if (!selectedWallet || !walletAmount) return;
    
    const amount = parseFloat(walletAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast(t.adminPanel.invalidAmount, 'error');
      return;
    }

    setWalletLoading(true);
    try {
      if (walletAction === 'add') {
        await adminAPI.addFunds(selectedWallet.userId, amount, walletNote || undefined);
        showToast(`Кошелек пополнен на ${amount} ₸`, 'success');
      } else if (walletAction === 'withdraw') {
        await adminAPI.withdrawFunds(selectedWallet.userId, amount, walletNote || undefined);
        showToast(`С кошелька снято ${amount} ₸`, 'success');
      } else {
        await adminAPI.setBalance(selectedWallet.userId, amount, walletNote || undefined);
        showToast(`Баланс установлен: ${amount} ₸`, 'success');
      }
      setWalletModalOpen(false);
      await loadWallets();
      await loadStats();
    } catch (error: any) {
      console.error('Ошибка операции с кошельком:', error);
      showToast(error.message || t.adminPanel.errors.wallet, 'error');
    } finally {
      setWalletLoading(false);
    }
  }, [selectedWallet, walletAmount, walletNote, walletAction, loadWallets, loadStats, showToast]);

  // Открыть модальное окно для загрузки статистики
  const openStatsModal = useCallback((campaign: CampaignWithUser) => {
    setSelectedCampaignForStats(campaign);
    // Извлекаем числа из строк (убираем ₸ и форматирование)
    const spent = campaign.spent.replace(/[₸,\s]/g, '');
    const budget = campaign.budget.replace(/[₸,\s]/g, '');
    setStatsForm({
      spent: spent,
      conversions: campaign.conversions.toString(),
      budget: budget,
    });
    setStatsModalOpen(true);
  }, []);

  // Обновить статистику кампании
  const handleUpdateStats = useCallback(async () => {
    if (!selectedCampaignForStats) return;

    setStatsLoading(true);
    try {
      await adminAPI.updateCampaignStats(selectedCampaignForStats.id, {
        spent: statsForm.spent,
        conversions: parseInt(statsForm.conversions) || 0,
        budget: statsForm.budget,
      });
      
      showToast(t.adminPanel.campaignStatsUpdated, 'success');
      setStatsModalOpen(false);
      setSelectedCampaignForStats(null);
      await loadCampaigns();
      await loadStats();
    } catch (error: any) {
      console.error('Ошибка обновления статистики:', error);
      showToast(error.message || t.adminPanel.errors.updateStats, 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [selectedCampaignForStats, statsForm, loadCampaigns, loadStats, showToast]);

  // Фильтрация пользователей
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.name.toLowerCase().includes(userSearch.toLowerCase());
      const matchesPlan = userPlanFilter === 'all' || user.plan === userPlanFilter;
      return matchesSearch && matchesPlan;
    });
  }, [users, userSearch, userPlanFilter]);

  // Фильтрация кампаний
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      const matchesName = campaign.name.toLowerCase().includes(campaignSearch.toLowerCase());
      const matchesUser = campaign.user?.email.toLowerCase().includes(campaignSearch.toLowerCase()) ||
                         campaign.user?.name.toLowerCase().includes(campaignSearch.toLowerCase());
      return matchesName || matchesUser;
    });
  }, [campaigns, campaignSearch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate('dashboard')}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-yellow-400" />
                <h1 className="text-xl font-semibold text-white">Админ-панель</h1>
              </div>
            </div>
            {/* Mobile burger menu */}
            <div className="sm:hidden relative">
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
                        onNavigate('dashboard');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span>Вернуться на дашборд</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800 bg-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 'stats' as Tab, label: t.adminPanel.tabs.stats, icon: BarChart3 },
              { id: 'users' as Tab, label: t.adminPanel.tabs.users, icon: Users },
              { id: 'campaigns' as Tab, label: t.adminPanel.tabs.campaigns, icon: Megaphone },
              { id: 'wallets' as Tab, label: t.adminPanel.tabs.wallets, icon: Wallet },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap border-b-2 transition-colors flex-shrink-0 text-sm sm:text-base ${
                  activeTab === tab.id
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : (
          <>
            {/* Статистика */}
            {activeTab === 'stats' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Всего пользователей</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.totalUsers}</p>
                        <p className="text-green-400 text-sm mt-1">Активных: {stats.activeUsers}</p>
                      </div>
                      <Users className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Всего кампаний</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.totalCampaigns}</p>
                        <p className="text-green-400 text-sm mt-1">Активных: {stats.activeCampaigns}</p>
                      </div>
                      <Megaphone className="w-8 h-8 text-purple-400" />
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">{t.adminPanel.stats.leads}</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.totalLeads}</p>
                        <p className="text-gray-400 text-sm mt-1">{t.adminPanel.stats.deals}: {stats.totalDeals}</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-green-400" />
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Выручка</p>
                        <p className="text-2xl font-bold text-white mt-1">₸{Number(stats.revenue).toLocaleString()}</p>
                        <p className="text-gray-400 text-sm mt-1">Баланс кошельков: ₸{Number(stats.totalBalance).toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-yellow-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">{t.adminPanel.exportImport.title}</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">{t.adminPanel.exportImport.export}</h4>
                      <div className="flex flex-wrap gap-4">
                        <button
                          onClick={handleExportLeads}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {t.adminPanel.export.leads}
                        </button>
                        <button
                          onClick={handleExportClients}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {t.adminPanel.export.clients}
                        </button>
                        <button
                          onClick={handleExportCampaignsStats}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          {t.adminPanel.export.campaignStats}
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">{t.adminPanel.exportImport.import}</h4>
                      <div className="flex flex-wrap gap-4">
                        <button
                          onClick={() => {
                            setImportType('leads');
                            setImportModalOpen(true);
                          }}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {t.adminPanel.import.leads}
                        </button>
                        <button
                          onClick={() => {
                            setImportType('clients');
                            setImportModalOpen(true);
                          }}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {t.adminPanel.import.clients}
                        </button>
                        <button
                          onClick={() => {
                            setImportType('campaigns');
                            setImportModalOpen(true);
                          }}
                          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {t.adminPanel.import.campaignStats}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Пользователи */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t.adminPanel.search.userPlaceholder}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <select
                    value={userPlanFilter}
                    onChange={(e) => setUserPlanFilter(e.target.value as any)}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="all">Все планы</option>
                    <option value="Free">Free</option>
                    <option value="Pro">Pro</option>
                    <option value="Business">Business</option>
                  </select>
                </div>

                <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Email</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Имя</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">План</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Роль</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm break-words">{user.email}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-300 text-xs sm:text-sm break-words">{user.name}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <select
                              value={user.plan}
                              onChange={(e) => handleUpdatePlan(user.id, e.target.value as any)}
                              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            >
                              <option value="Free">Free</option>
                              <option value="Pro">Pro</option>
                              <option value="Business">Business</option>
                            </select>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              user.role === 'admin' 
                                ? 'bg-yellow-400/20 text-yellow-400' 
                                : 'bg-gray-400/20 text-gray-400'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Кампании */}
            {activeTab === 'campaigns' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t.adminPanel.search.campaignPlaceholder}
                      value={campaignSearch}
                      onChange={(e) => setCampaignSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <button
                    onClick={handleExportCampaignsStats}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    {t.adminPanel.export.campaignStats}
                  </button>
                </div>

                <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Название</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Пользователь</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Платформы</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Статус</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Бюджет</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCampaigns.map(campaign => (
                        <tr 
                          key={campaign.id} 
                          className="border-b border-slate-700/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                          onClick={(e) => {
                            // Предотвращаем открытие модального окна при клике на кнопку действий
                            if ((e.target as HTMLElement).closest('button')) {
                              return;
                            }
                            setSelectedCampaign(campaign);
                            setShowCampaignDetailsModal(true);
                          }}
                        >
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm break-words">{campaign.name}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-300 text-xs sm:text-sm break-words">
                            {campaign.user ? `${campaign.user.name} (${campaign.user.email})` : 'N/A'}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-300 text-xs sm:text-sm break-words">
                            {campaign.platforms.join(', ')}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              campaign.status === t.adminPanel.status.active 
                                ? 'bg-green-400/20 text-green-400'
                                : campaign.status === 'На проверке'
                                ? 'bg-yellow-400/20 text-yellow-400'
                                : 'bg-gray-400/20 text-gray-400'
                            }`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-300 text-xs sm:text-sm">{campaign.budget}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <div className="flex gap-1 sm:gap-2 flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStatsModal(campaign);
                                }}
                                className="px-2 sm:px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded text-xs sm:text-sm flex items-center gap-1 transition-colors whitespace-nowrap"
                                title={t.adminPanel.wallet.loadStats}
                              >
                                <BarChart3 className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{t.adminPanel.tabs.stats}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCampaign(campaign.id, campaign.status);
                                }}
                                className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm flex items-center gap-1 transition-colors whitespace-nowrap ${
                                  campaign.status === t.adminPanel.status.active
                                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                                    : campaign.status === t.adminPanel.status.onReview
                                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                    : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                }`}
                              >
                                <Power className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{campaign.status === t.adminPanel.status.active 
                                  ? t.adminPanel.wallet.pause 
                                  : campaign.status === t.adminPanel.status.onReview
                                  ? t.adminPanel.wallet.activate
                                  : t.adminPanel.wallet.activate}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Campaign Details Modal */}
            {showCampaignDetailsModal && selectedCampaign && (
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
                onClick={() => setShowCampaignDetailsModal(false)}
              >
                <div 
                  className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-[95%] sm:max-w-[90%] md:max-w-4xl max-h-[90vh] overflow-y-auto" 
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap min-w-0">
                        <h3 className="text-white text-lg sm:text-2xl font-bold break-words flex-1 min-w-0">{selectedCampaign.name}</h3>
                        <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                          selectedCampaign.status === t.adminPanel.status.active
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : selectedCampaign.status === t.adminPanel.status.onReview
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {selectedCampaign.status === 'Активна' ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                              {selectedCampaign.status}
                            </>
                          ) : (
                            selectedCampaign.status
                          )}
                        </span>
                      </div>
                      {selectedCampaign.user && (
                        <p className="text-gray-400 text-xs sm:text-sm break-words">
                          Пользователь: {selectedCampaign.user.name} ({selectedCampaign.user.email})
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowCampaignDetailsModal(false)}
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
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 min-w-0">
                        {selectedCampaign.platforms.map((platform, idx) => (
                          <span 
                            key={idx} 
                            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg text-xs sm:text-sm font-medium text-blue-300 whitespace-nowrap w-full sm:w-auto"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Ad Text */}
                    {selectedCampaign.audience?.adText && (
                      <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
                          <h4 className="text-white font-semibold text-sm">Текст объявления</h4>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/30 min-w-0">
                          <p className="text-gray-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                            {selectedCampaign.audience.adText}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Ad Image */}
                    {selectedCampaign.imageUrl && (
                      <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <Upload className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                          <h4 className="text-white font-semibold text-sm">Изображение кампании</h4>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/30">
                          <img 
                            src={selectedCampaign.imageUrl} 
                            alt={selectedCampaign.name}
                            className="w-full max-w-full h-auto rounded-lg object-contain"
                          />
                        </div>
                      </div>
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
                            <span className="text-white font-bold text-sm sm:text-base break-words text-right">{selectedCampaign.budget}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Потрачено</span>
                            <span className="text-white font-bold text-sm sm:text-base break-words text-right">{selectedCampaign.spent}</span>
                          </div>
                          <div className="flex justify-between items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">Конверсии</span>
                            <span className="text-white font-bold text-sm sm:text-base break-words text-right">{selectedCampaign.conversions}</span>
                          </div>
                        </div>
                      </div>

                      {/* Audience */}
                      {selectedCampaign.audience && (
                        <div className="bg-slate-900/40 rounded-xl p-4 sm:p-5 border border-slate-700/50">
                          <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-purple-400 flex-shrink-0" />
                            <h4 className="text-white font-semibold text-sm">Подобранная AI аудитория</h4>
                          </div>
                          <div className="space-y-4 min-w-0">
                            {selectedCampaign.audience.ageRange && (
                              <div className="min-w-0">
                                <span className="text-gray-400 text-xs sm:text-sm">Возраст: </span>
                                <span className="text-white font-semibold text-xs sm:text-sm break-words">{selectedCampaign.audience.ageRange} лет</span>
                              </div>
                            )}
                            {selectedCampaign.audience.interests && selectedCampaign.audience.interests.length > 0 && (
                              <div className="min-w-0">
                                <p className="text-gray-400 text-xs sm:text-sm mb-2">Интересы:</p>
                                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 min-w-0">
                                  {selectedCampaign.audience.interests.map((interest: string, idx: number) => (
                                    <span 
                                      key={idx} 
                                      className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium whitespace-nowrap w-full sm:w-auto"
                                    >
                                      {interest}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Кошельки */}
            {activeTab === 'wallets' && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Пользователь</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Баланс</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Валюта</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-300">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallets.map(wallet => (
                        <tr key={wallet.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-white text-xs sm:text-sm break-words">
                            {wallet.user ? `${wallet.user.name} (${wallet.user.email})` : `User ID: ${wallet.userId}`}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-300 font-semibold text-xs sm:text-sm">
                            {wallet.balance} {wallet.currency}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-300 text-xs sm:text-sm">{wallet.currency}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <div className="flex gap-1 sm:gap-2 flex-wrap">
                              <button
                                onClick={() => openWalletModal(wallet, 'add')}
                                className="px-2 sm:px-3 py-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded text-xs sm:text-sm flex items-center gap-1 transition-colors whitespace-nowrap"
                              >
                                <Plus className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{t.adminPanel.wallet.topUpShort}</span>
                              </button>
                              <button
                                onClick={() => openWalletModal(wallet, 'withdraw')}
                                className="px-2 sm:px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded text-xs sm:text-sm flex items-center gap-1 transition-colors whitespace-nowrap"
                              >
                                <Minus className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{t.adminPanel.wallet.withdrawShort}</span>
                              </button>
                              <button
                                onClick={() => openWalletModal(wallet, 'set')}
                                className="px-2 sm:px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded text-xs sm:text-sm flex items-center gap-1 transition-colors whitespace-nowrap"
                              >
                                <Edit2 className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{t.adminPanel.wallet.setShort}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Модальное окно для операций с кошельком */}
      {walletModalOpen && selectedWallet && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">
              {walletAction === 'add' && t.adminPanel.wallet.topUp}
              {walletAction === 'withdraw' && t.adminPanel.wallet.withdraw}
              {walletAction === 'set' && t.adminPanel.wallet.setBalance}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.adminPanel.wallet.user}</label>
                <p className="text-white">
                  {selectedWallet.user ? `${selectedWallet.user.name} (${selectedWallet.user.email})` : `User ID: ${selectedWallet.userId}`}
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.adminPanel.wallet.currentBalance}</label>
                <p className="text-white font-semibold">{selectedWallet.balance} {selectedWallet.currency}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {walletAction === 'set' ? t.adminPanel.wallet.newBalance : t.adminPanel.wallet.amount}
                </label>
                <input
                  type="number"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.adminPanel.wallet.note}</label>
                <textarea
                  value={walletNote}
                  onChange={(e) => setWalletNote(e.target.value)}
                  placeholder={t.adminPanel.wallet.note}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setWalletModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  disabled={walletLoading}
                >
                  {t.dashboard.cancel}
                </button>
                <button
                  onClick={handleWalletAction}
                  disabled={walletLoading || !walletAmount}
                  className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {walletLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t.adminPanel.wallet.processing}
                    </>
                  ) : (
                    t.adminPanel.wallet.confirm
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для импорта данных */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">
              {t.adminPanel.exportImport.import} {importType === 'leads' ? t.adminPanel.import.importTypeLeads : importType === 'clients' ? t.adminPanel.import.importTypeClients : t.adminPanel.import.importTypeCampaignStats}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.adminPanel.exportImport.selectUser}</label>
                <select
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">{t.adminPanel.exportImport.selectUserPlaceholder}</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.adminPanel.exportImport.selectCsvFile}</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-400 file:text-black hover:file:bg-yellow-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportFile(null);
                    setSelectedUserId(null);
                    setImportType(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  disabled={importLoading}
                >
                  {t.dashboard.cancel}
                </button>
                <button
                  onClick={handleImport}
                  disabled={importLoading || !selectedUserId || !importFile}
                  className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t.adminPanel.exportImport.importing}
                    </>
                  ) : (
                    t.adminPanel.exportImport.importButton
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для выбора пользователя перед экспортом */}
      {exportModalOpen && exportType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">
              {t.adminPanel.exportImport.export} {exportType === 'leads' ? t.adminPanel.export.typeLeadsGenitive : exportType === 'clients' ? t.adminPanel.export.typeClientsGenitive : t.adminPanel.export.typeCampaignStatsGenitive}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.adminPanel.exportImport.selectUser}</label>
                <select
                  value={exportUserId || ''}
                  onChange={(e) => setExportUserId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">{t.adminPanel.exportImport.allUsers}</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {exportUserId ? t.adminPanel.export.exportForUser : t.adminPanel.export.exportForAll}
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setExportModalOpen(false);
                    setExportType(null);
                    setExportUserId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  disabled={exportLoading}
                >
                  {t.dashboard.cancel}
                </button>
                <button
                  onClick={handleExport}
                  disabled={exportLoading}
                  className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {exportLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t.adminPanel.exportImport.exporting}
                    </>
                  ) : (
                    t.adminPanel.exportImport.exportButton
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для загрузки статистики кампании */}
      {statsModalOpen && selectedCampaignForStats && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">
              Загрузить статистику: {selectedCampaignForStats.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Потрачено (₸)</label>
                <input
                  type="number"
                  value={statsForm.spent}
                  onChange={(e) => setStatsForm({ ...statsForm, spent: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Конверсии</label>
                <input
                  type="number"
                  value={statsForm.conversions}
                  onChange={(e) => setStatsForm({ ...statsForm, conversions: e.target.value })}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Бюджет (₸)</label>
                <input
                  type="number"
                  value={statsForm.budget}
                  onChange={(e) => setStatsForm({ ...statsForm, budget: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setStatsModalOpen(false);
                    setSelectedCampaignForStats(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  disabled={statsLoading}
                >
                  {t.dashboard.cancel}
                </button>
                <button
                  onClick={handleUpdateStats}
                  disabled={statsLoading}
                  className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {statsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Обновление...
                    </>
                  ) : (
                    'Обновить статистику'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


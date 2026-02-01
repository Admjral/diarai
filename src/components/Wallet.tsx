import { Wallet as WalletIcon, Plus, RefreshCw, Loader2, ArrowDown, ArrowUp, CreditCard, Smartphone } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { walletAPI, Wallet, WalletTransaction, APIError } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

interface WalletProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function Wallet({ showToast }: WalletProps) {
  const { t } = useLanguage();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'kaspi' | 'direct'>('kaspi');
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      setLoadingTransactions(true);
      const result = await walletAPI.getTransactions();
      setTransactions(result.transactions);
    } catch (error) {
      console.error('Ошибка при загрузке транзакций:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await walletAPI.getWallet();
      setWallet(data);
      setError(null);
      // Загружаем транзакции при загрузке кошелька
      await loadTransactions();
    } catch (error) {
      console.error('Ошибка при загрузке кошелька:', error);
      let errorMessage = t.wallet.loadError;
      
      if (error instanceof APIError) {
        if (error.isNetworkError) {
          errorMessage = t.wallet.errorMessages.serverConnection;
        } else if (error.statusCode === 404) {
          errorMessage = t.wallet.errorMessages.userNotFound;
        } else if (error.statusCode === 401) {
          errorMessage = t.wallet.errorMessages.authError;
        } else if (error.statusCode === 500) {
          // Проверяем детали ошибки от сервера
          const errorDetails = (error as any).errorDetails || (error as any).serverErrorData?.details;
          const serverErrorData = (error as any).serverErrorData;
          
          // Проверяем различные варианты сообщений об ошибке модели Wallet
          const isWalletModelError = 
            errorDetails?.message?.includes('Unknown model') || 
            errorDetails?.message?.includes('wallet') ||
            errorDetails?.message?.includes('Prisma Client') ||
            errorDetails?.message?.includes('не найдена') ||
            errorDetails?.code === 'PRISMA_MODEL_NOT_FOUND' ||
            errorDetails?.code === 'UNKNOWN_MODEL' ||
            serverErrorData?.details?.message?.includes('Unknown model') ||
            serverErrorData?.details?.message?.includes('Wallet') ||
            serverErrorData?.error?.includes('Wallet') ||
            error.message?.includes('Wallet') ||
            error.message?.includes('prisma:generate');
          
          if (isWalletModelError) {
            errorMessage = t.wallet.errorMessages.prismaModelNotFound;
          } else if (errorDetails?.message) {
            errorMessage = `Ошибка сервера: ${errorDetails.message}`;
          } else if (serverErrorData?.details?.message) {
            errorMessage = `Ошибка сервера: ${serverErrorData.details.message}`;
          } else if (serverErrorData?.error) {
            errorMessage = serverErrorData.error;
          } else {
            errorMessage = error.message || t.wallet.errorMessages.genericError;
          }
        } else if (error.message?.includes('Unknown model') || error.message?.includes('Wallet')) {
          errorMessage = t.wallet.errorMessages.prismaModelNotFound;
        } else {
          errorMessage = error.message || t.wallet.loadError;
        }
        
        const errorDetails = (error as any).errorDetails || (error as any).serverErrorData?.details;
        console.error('Детали ошибки API:', {
          statusCode: error.statusCode,
          isNetworkError: error.isNetworkError,
          isServerError: error.isServerError,
          message: error.message,
          errorDetails: errorDetails,
          serverErrorData: (error as any).serverErrorData,
        });
      } else {
        errorMessage = t.wallet.errorMessages.connectionError;
      }
      
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, loadTransactions, t]);

  useEffect(() => {
    loadWallet();
    
    // Проверяем параметры URL после возврата с Kaspi
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const orderId = urlParams.get('orderId');
    
    if (status === 'success' && orderId) {
      showToast(t.wallet.paymentSuccess, 'success');
      // Очищаем URL параметры
      window.history.replaceState({}, '', window.location.pathname);
      // Обновляем кошелек и транзакции через небольшую задержку
      setTimeout(() => {
        loadWallet();
        loadTransactions();
      }, 2000);
    } else if (status === 'cancelled') {
      showToast(t.wallet.paymentCancelled, 'info');
      // Очищаем URL параметры
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadWallet, loadTransactions, showToast]);

  const handleAddFunds = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showToast(t.wallet.invalidAmount, 'error');
      return;
    }

    try {
      setIsAdding(true);
      
      if (paymentMethod === 'kaspi') {
        // Создаем заказ в Kaspi для пополнения кошелька
        const result = await walletAPI.createKaspiDepositOrder(parseFloat(amount));
        
        console.log('[Wallet] Результат создания заказа Kaspi:', result);
        
        if (result && result.paymentUrl) {
          // Перенаправляем пользователя на страницу оплаты Kaspi
          console.log('[Wallet] Перенаправление на:', result.paymentUrl);
          window.location.href = result.paymentUrl;
        } else {
          console.error('[Wallet] paymentUrl отсутствует в результате:', result);
          showToast(result?.message || t.wallet.paymentUrlError, 'error');
          setIsAdding(false);
        }
      } else {
        // Прямое пополнение (для тестирования или админов)
        const result = await walletAPI.addFunds(parseFloat(amount));
        showToast(t.wallet.walletToppedUp.replace('{amount}', parseFloat(amount).toLocaleString('ru-RU')), 'success');
        setShowAddForm(false);
        setAmount('');
        await loadWallet();
        setIsAdding(false);
      }
    } catch (error) {
      console.error('Ошибка при пополнении кошелька:', error);
      if (error instanceof APIError) {
        showToast(error.message || t.wallet.addFundsError, 'error');
      } else {
        showToast(t.wallet.addFundsError, 'error');
      }
      setIsAdding(false);
    }
  }, [amount, paymentMethod, showToast, loadWallet]);


  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center">
              <WalletIcon className="w-6 h-6 text-black" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold">{t.wallet.title}</h3>
              <p className="text-gray-400 text-sm">{t.wallet.balance}</p>
            </div>
          </div>
        </div>
        <div className="text-center py-6">
          <p className="text-red-400 mb-2 font-medium">{error || t.wallet.loadError}</p>
          {(error?.includes('prisma:generate') || error?.includes('Unknown model') || error?.includes('Модель Wallet') || error?.includes('Prisma Client')) && (
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mb-4 text-left">
              <p className="text-yellow-400 text-sm font-semibold mb-3">{t.wallet.instructionTitle}</p>
              <div className="space-y-2 mb-3">
                <p className="text-gray-300 text-sm">{t.wallet.instructionStep1}</p>
                <p className="text-gray-300 text-sm">{t.wallet.instructionStep2}</p>
                <code className="text-yellow-400 text-xs block bg-black/50 p-2 rounded">
                  cd server
                </code>
                <p className="text-gray-300 text-sm">{t.wallet.instructionStep3}</p>
                <code className="text-yellow-400 text-xs block bg-black/50 p-2 rounded mb-2">
                  npm run prisma:generate
                </code>
                <p className="text-gray-300 text-sm">{t.wallet.instructionStep4}</p>
                <code className="text-yellow-400 text-xs block bg-black/50 p-2 rounded">
                  npm run dev
                </code>
              </div>
              <p className="text-gray-400 text-xs mt-3 border-t border-slate-600 pt-3">
                {t.wallet.instructionReason}
              </p>
            </div>
          )}
          <button
            onClick={loadWallet}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-lg hover:from-yellow-500 hover:to-amber-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.common.loading}
              </>
            ) : (
              t.wallet.tryAgain
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 sm:p-6 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center flex-shrink-0">
            <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-white text-base sm:text-lg font-semibold truncate">{t.wallet.title}</h3>
            <p className="text-gray-400 text-xs sm:text-sm truncate">{t.wallet.balance}</p>
          </div>
        </div>
        <button
          onClick={loadWallet}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0"
          title={t.wallet.refresh}
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
        </button>
      </div>

      <div className="mb-6">
        <div className="text-gray-400 text-sm mb-2">{t.wallet.currentBalance}</div>
        <div className="text-2xl sm:text-3xl font-bold text-white mb-1 break-words">
          {formatBalance(wallet.balance)} {wallet.currency}
        </div>
        <div className="text-gray-500 text-xs break-words">
          {t.wallet.updated} {new Date(wallet.updatedAt).toLocaleString('ru-RU')}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {!showAddForm ? (
          <button
            onClick={() => {
              setShowAddForm(true);
              setAmount('');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm sm:text-base">{t.wallet.addFunds}</span>
          </button>
        ) : (
          <div className="w-full flex flex-col gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t.wallet.amount}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 text-sm sm:text-base"
              min="0"
              step="0.01"
            />
            
            {/* Выбор способа оплаты */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-400 mb-2">{t.wallet.paymentMethod}</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('kaspi')}
                  className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                    paymentMethod === 'kaspi'
                      ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                      : 'border-slate-600 bg-slate-700 text-gray-300 hover:border-slate-500'
                  }`}
                >
                  <Smartphone className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{t.wallet.kaspi}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('direct')}
                  className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                    paymentMethod === 'direct'
                      ? 'border-green-400 bg-green-400/10 text-green-400'
                      : 'border-slate-600 bg-slate-700 text-gray-300 hover:border-slate-500'
                  }`}
                >
                  <WalletIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{t.wallet.direct}</span>
                </button>
              </div>
              {paymentMethod === 'kaspi' && (
                <p className="text-xs text-gray-500">
                  Безопасная оплата через Kaspi.kz. Вы будете перенаправлены на страницу оплаты.
                </p>
              )}
              {paymentMethod === 'direct' && (
                <p className="text-xs text-gray-500">
                  Мгновенное пополнение баланса (для тестирования).
                </p>
              )}
            </div>
            
            <div className="flex gap-2 w-full">
              <button
                onClick={handleAddFunds}
                disabled={isAdding}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base min-w-0"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="whitespace-nowrap text-xs sm:text-sm">
                  {paymentMethod === 'kaspi' ? t.wallet.payWithKaspi : t.wallet.add}
                </span>
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setAmount('');
                  setPaymentMethod('kaspi');
                }}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-3 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors text-sm sm:text-base whitespace-nowrap min-w-0"
              >
                {t.wallet.cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* История транзакций */}
      <div className="mt-6">
        <button
          onClick={() => {
            setShowTransactions(!showTransactions);
            if (!showTransactions && transactions.length === 0) {
              loadTransactions();
            }
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <span className="text-gray-300 font-medium">{t.wallet.transactions}</span>
          <span className="text-gray-500 text-sm">
            {transactions.length > 0 && `(${transactions.length})`}
            {showTransactions ? '▼' : '▶'}
          </span>
        </button>

        {showTransactions && (
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {t.wallet.noTransactions}
              </div>
            ) : (
              transactions.map((transaction) => {
                const isPositive = transaction.type === 'deposit' || transaction.type === 'refund';
                const isNegative = transaction.type === 'withdrawal' || transaction.type === 'subscription';
                
                return (
                  <div
                    key={transaction.id}
                    className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 sm:p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {isPositive ? (
                          <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                        ) : isNegative ? (
                          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
                        ) : (
                          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-medium text-xs sm:text-sm break-words">
                            {transaction.type === 'deposit' && t.wallet.transactionType.deposit}
                            {transaction.type === 'withdrawal' && t.wallet.transactionType.withdrawal}
                            {transaction.type === 'subscription' && t.wallet.transactionType.subscription}
                            {transaction.type === 'refund' && t.wallet.transactionType.refund}
                          </div>
                          {transaction.description && (
                            <div className="text-gray-400 text-xs mt-1 break-words">
                              {transaction.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <div className={`font-semibold text-sm sm:text-base ${
                          isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-white'
                        }`}>
                          {isPositive ? '+' : '-'}
                          {parseFloat(transaction.amount).toLocaleString('ru-RU', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ₸
                        </div>
                        <div className="text-gray-500 text-xs mt-1 break-words">
                          {new Date(transaction.createdAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-slate-600 break-words">
                      Баланс: {parseFloat(transaction.balanceBefore).toLocaleString('ru-RU')} ₸ → {parseFloat(transaction.balanceAfter).toLocaleString('ru-RU')} ₸
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}


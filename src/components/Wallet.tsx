import { Wallet as WalletIcon, Plus, RefreshCw, Loader2, ArrowDown, ArrowUp, CreditCard, CheckCircle, Clock, ExternalLink, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { walletAPI, walletTopUpAPI, Wallet, WalletTransaction, WalletTopUpRequest, APIError } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

interface WalletProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type TopUpStep = 'idle' | 'amount' | 'qr' | 'waiting';

const KASPI_PAYMENT_LINK = 'https://pay.kaspi.kz/pay/7wfg2vrb';

export function Wallet({ showToast }: WalletProps) {
  const { t } = useLanguage();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  // New top-up flow state
  const [topUpStep, setTopUpStep] = useState<TopUpStep>('idle');
  const [activeRequest, setActiveRequest] = useState<WalletTopUpRequest | null>(null);

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
          const errorDetails = (error as any).errorDetails || (error as any).serverErrorData?.details;
          const serverErrorData = (error as any).serverErrorData;

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
          } else {
            errorMessage = t.wallet.errorMessages.genericError;
          }
        } else if (error.message?.includes('Unknown model') || error.message?.includes('Wallet')) {
          errorMessage = t.wallet.errorMessages.prismaModelNotFound;
        } else {
          errorMessage = error.message || t.wallet.loadError;
        }
      } else {
        errorMessage = t.wallet.errorMessages.connectionError;
      }

      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, loadTransactions, t]);

  // Check for active top-up request on load
  const checkActiveRequest = useCallback(async () => {
    try {
      const request = await walletTopUpAPI.getMyActive();
      if (request) {
        setActiveRequest(request);
        if (request.status === 'pending_payment') {
          setTopUpStep('qr');
          setAmount(request.amount);
        } else if (request.status === 'paid') {
          setTopUpStep('waiting');
          setAmount(request.amount);
        }
      }
    } catch (error) {
      console.error('Ошибка при проверке активного запроса:', error);
    }
  }, []);

  useEffect(() => {
    loadWallet();
    checkActiveRequest();
  }, [loadWallet, checkActiveRequest]);

  // Create top-up request
  const handleCreateRequest = useCallback(async () => {
    if (!amount || parseFloat(amount) < 100) {
      showToast('Минимальная сумма пополнения 100 ₸', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await walletTopUpAPI.create(parseFloat(amount), '');
      setActiveRequest(result.request);
      setTopUpStep('qr');
      showToast('Запрос создан. Оплатите по QR-коду.', 'success');
    } catch (error) {
      console.error('Ошибка при создании запроса:', error);
      if (error instanceof APIError) {
        showToast(error.message || 'Ошибка при создании запроса', 'error');
      } else {
        showToast('Ошибка при создании запроса', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, showToast]);

  // Mark as paid
  const handleMarkAsPaid = useCallback(async () => {
    if (!activeRequest) return;

    try {
      setIsSubmitting(true);
      const result = await walletTopUpAPI.markAsPaid(activeRequest.id);
      setActiveRequest(result.request);
      setTopUpStep('waiting');
      showToast('Ожидайте подтверждения от администратора', 'info');
    } catch (error) {
      console.error('Ошибка при отметке оплаты:', error);
      if (error instanceof APIError) {
        showToast(error.message || 'Ошибка при обновлении статуса', 'error');
      } else {
        showToast('Ошибка при обновлении статуса', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [activeRequest, showToast]);

  // Cancel/reset the flow
  const handleCancel = useCallback(() => {
    setTopUpStep('idle');
    setAmount('');
    // Note: We don't cancel the request on server, user can continue later
  }, []);

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

  // Render top-up UI based on step
  const renderTopUpUI = () => {
    switch (topUpStep) {
      case 'amount':
        return (
          <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 mt-4">
            <h4 className="text-white font-medium mb-4">Пополнение кошелька</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Сумма пополнения</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Введите сумму"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 pr-12"
                    min="100"
                    step="100"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">₸</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Минимальная сумма: 100 ₸</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateRequest}
                  disabled={isSubmitting || !amount || parseFloat(amount) < 100}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-lg hover:from-yellow-500 hover:to-amber-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Подтвердить
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-3 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        );

      case 'qr':
        return (
          <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Оплата через Kaspi</h4>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-slate-600 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                <img
                  src="/kaspi-qr.png"
                  alt="Kaspi QR код"
                  className="w-48 h-48 sm:w-64 sm:h-64 object-contain"
                />
              </div>

              <div className="text-lg font-semibold text-yellow-400">
                Переведите {formatBalance(amount)} ₸
              </div>

              <p className="text-gray-400 text-sm">
                Отсканируйте QR-код в приложении Kaspi или используйте ссылку ниже
              </p>

              {/* Mobile link button */}
              <a
                href={KASPI_PAYMENT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-5 h-5" />
                Оплатить по ссылке
              </a>

              <div className="border-t border-slate-600 pt-4 mt-4">
                <button
                  onClick={handleMarkAsPaid}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Оплатил
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Нажмите после оплаты для подтверждения администратором
                </p>
              </div>
            </div>
          </div>
        );

      case 'waiting':
        return (
          <div className="bg-slate-700/50 border border-yellow-500/30 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <h4 className="text-white font-medium">Ожидание подтверждения</h4>
                <p className="text-gray-400 text-sm">Сумма: {formatBalance(amount)} ₸</p>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-gray-300 text-sm">
                Ваш платёж находится на проверке. Администратор подтвердит
                пополнение в течение нескольких минут.
              </p>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  checkActiveRequest();
                  loadWallet();
                }}
                className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Проверить статус
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

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
          onClick={() => {
            loadWallet();
            checkActiveRequest();
          }}
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

      {/* Empty wallet hint */}
      {topUpStep === 'idle' && parseFloat(wallet.balance) === 0 && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-blue-300 text-xs sm:text-sm leading-relaxed">
            {t.wallet.emptyWalletHint}
          </p>
        </div>
      )}

      {/* Top-up button or flow */}
      {topUpStep === 'idle' ? (
        <button
          onClick={() => {
            setTopUpStep('amount');
            setAmount('');
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium"
        >
          <Plus className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm sm:text-base">{t.wallet.emptyWalletAction || t.wallet.addFunds}</span>
        </button>
      ) : (
        renderTopUpUI()
      )}

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

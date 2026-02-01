import { useState, useEffect, useCallback } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { paymentAPI, Payment, APIError } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

interface PaymentHistoryProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function PaymentHistory({ showToast }: PaymentHistoryProps) {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await paymentAPI.getHistory();
      setPayments(result.payments);
    } catch (error) {
      console.error('Ошибка при загрузке истории платежей:', error);
      let errorMessage = t.crm.paymentHistory.loadError;
      
      if (error instanceof APIError) {
        errorMessage = error.message || errorMessage;
      }
      
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: Payment['status']) => {
    const statusMap: Record<Payment['status'], string> = {
      pending: t.crm.paymentHistory.status.pending,
      processing: t.crm.paymentHistory.status.processing,
      completed: t.crm.paymentHistory.status.completed,
      failed: t.crm.paymentHistory.status.failed,
      cancelled: t.crm.paymentHistory.status.cancelled,
      refunded: t.crm.paymentHistory.status.refunded,
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'failed':
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'processing':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'pending':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      case 'refunded':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getPaymentMethodText = (method: string) => {
    const methodMap: Record<string, string> = {
      wallet: 'Кошелек',
      kaspi: 'Kaspi.kz',
    };
    return methodMap[method] || method;
  };

  const getPlanText = (plan: Payment['plan']) => {
    const planMap: Record<Payment['plan'], string> = {
      Start: 'Start',
      Pro: 'Pro',
      Business: 'Business',
    };
    return planMap[plan] || plan;
  };

  if (loading && payments.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white text-lg font-semibold">История платежей</h3>
            <p className="text-gray-400 text-sm">Все ваши платежи за подписки</p>
          </div>
        </div>
        <button
          onClick={loadPayments}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          title={t.crm.paymentHistory.update}
        >
          <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">История платежей пуста</p>
          <p className="text-gray-500 text-sm">Здесь будут отображаться все ваши платежи за подписки</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {getStatusIcon(payment.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        Подписка {getPlanText(payment.plan)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(payment.status)}`}>
                        {getStatusText(payment.status)}
                      </span>
                    </div>
                    <div className="text-gray-400 text-sm">
                      {getPaymentMethodText(payment.paymentMethod)}
                      {payment.kaspiOrderId && (
                        <span className="ml-2 text-xs">
                          (Заказ: {payment.kaspiOrderId.substring(0, 12)}...)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="text-white font-semibold text-lg">
                    {parseFloat(payment.amount).toLocaleString('ru-RU', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} {payment.currency}
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {new Date(payment.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
              
              {payment.paidAt && (
                <div className="text-xs text-gray-500 pt-2 border-t border-slate-600">
                  Оплачено: {new Date(payment.paidAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


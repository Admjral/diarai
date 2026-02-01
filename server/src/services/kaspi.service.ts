/**
 * Сервис для интеграции с Kaspi.kz Payment API
 */

interface KaspiOrderRequest {
  merchantId: string;
  orderId: string;
  amount: {
    value: number;
    currency: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  returnUrl: string;
  cancelUrl: string;
}

interface KaspiOrderResponse {
  orderId: string;
  paymentUrl: string;
  status: string;
}

interface KaspiWebhookPayload {
  orderId: string;
  status: string;
  paymentId?: string;
  amount?: number;
  timestamp?: string;
  signature?: string;
}

const KASPI_API_BASE_URL = process.env.KASPI_API_BASE_URL || 'https://kaspi.kz/api/v1';
const KASPI_MERCHANT_ID = process.env.KASPI_MERCHANT_ID;
const KASPI_API_KEY = process.env.KASPI_API_KEY;
const KASPI_WEBHOOK_SECRET = process.env.KASPI_WEBHOOK_SECRET;

/**
 * Создание заказа в Kaspi.kz
 */
export async function createKaspiOrder(
  amount: number,
  planName: string,
  userId: number,
  returnUrl: string,
  cancelUrl: string
): Promise<KaspiOrderResponse> {
  if (!KASPI_MERCHANT_ID || !KASPI_API_KEY) {
    throw new Error('Kaspi.kz credentials not configured. Set KASPI_MERCHANT_ID and KASPI_API_KEY in environment variables.');
  }

  const orderId = `sub_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const orderData: KaspiOrderRequest = {
    merchantId: KASPI_MERCHANT_ID,
    orderId,
    amount: {
      value: amount,
      currency: 'KZT',
    },
    items: [
      {
        name: `Подписка ${planName}`,
        quantity: 1,
        price: amount,
      },
    ],
    returnUrl,
    cancelUrl,
  };

  try {
    const response = await fetch(`${KASPI_API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KASPI_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Merchant-Id': KASPI_MERCHANT_ID,
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[kaspi.service] Ошибка создания заказа:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Failed to create Kaspi order: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    return {
      orderId: data.orderId || orderId,
      paymentUrl: data.paymentUrl || data.url || '',
      status: data.status || 'pending',
    };
  } catch (error: any) {
    console.error('[kaspi.service] Ошибка при создании заказа в Kaspi:', error);
    throw new Error(`Ошибка создания заказа в Kaspi.kz: ${error.message}`);
  }
}

/**
 * Создание заказа в Kaspi.kz для пополнения кошелька
 */
export async function createKaspiWalletDepositOrder(
  amount: number,
  userId: number,
  returnUrl: string,
  cancelUrl: string
): Promise<KaspiOrderResponse> {
  console.log('[kaspi.service] Создание заказа на пополнение:', {
    amount,
    userId,
    returnUrl,
    cancelUrl,
    hasMerchantId: !!KASPI_MERCHANT_ID,
    hasApiKey: !!KASPI_API_KEY,
    apiBaseUrl: KASPI_API_BASE_URL,
  });

  if (!KASPI_MERCHANT_ID || !KASPI_API_KEY) {
    const errorMsg = 'Kaspi.kz credentials not configured. Set KASPI_MERCHANT_ID and KASPI_API_KEY in environment variables.';
    console.error('[kaspi.service]', errorMsg, {
      hasMerchantId: !!KASPI_MERCHANT_ID,
      hasApiKey: !!KASPI_API_KEY,
    });
    throw new Error(errorMsg);
  }

  const orderId = `wallet_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const orderData: KaspiOrderRequest = {
    merchantId: KASPI_MERCHANT_ID,
    orderId,
    amount: {
      value: amount,
      currency: 'KZT',
    },
    items: [
      {
        name: `Пополнение кошелька`,
        quantity: 1,
        price: amount,
      },
    ],
    returnUrl,
    cancelUrl,
  };

  try {
    const response = await fetch(`${KASPI_API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KASPI_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Merchant-Id': KASPI_MERCHANT_ID,
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[kaspi.service] Ошибка создания заказа на пополнение:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Failed to create Kaspi wallet deposit order: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    console.log('[kaspi.service] Ответ от Kaspi API для пополнения:', {
      orderId: data.orderId,
      paymentUrl: data.paymentUrl,
      url: data.url,
      redirectUrl: data.redirectUrl,
      checkoutUrl: data.checkoutUrl,
      payment_link: data.payment_link,
      fullResponse: JSON.stringify(data, null, 2),
    });
    
    // Пробуем разные варианты названий поля paymentUrl
    const paymentUrl = data.paymentUrl || 
                      data.url || 
                      data.redirectUrl || 
                      data.checkoutUrl || 
                      data.payment_link ||
                      data.paymentLink ||
                      '';
    
    if (!paymentUrl) {
      console.error('[kaspi.service] paymentUrl не найден в ответе Kaspi API');
      console.error('[kaspi.service] Полный ответ:', JSON.stringify(data, null, 2));
      throw new Error('Kaspi API не вернул ссылку на оплату. Проверьте настройки Kaspi API.');
    }
    
    return {
      orderId: data.orderId || orderId,
      paymentUrl: paymentUrl,
      status: data.status || 'pending',
    };
  } catch (error: any) {
    console.error('[kaspi.service] Ошибка при создании заказа на пополнение в Kaspi:', error);
    throw new Error(`Ошибка создания заказа на пополнение в Kaspi.kz: ${error.message}`);
  }
}

/**
 * Проверка подписи webhook от Kaspi.kz
 */
export function verifyKaspiWebhook(payload: KaspiWebhookPayload, signature: string): boolean {
  if (!KASPI_WEBHOOK_SECRET) {
    console.warn('[kaspi.service] KASPI_WEBHOOK_SECRET не настроен, пропускаем проверку подписи');
    return true; // В режиме разработки можно пропустить проверку
  }

  try {
    // Создаем строку для подписи из payload
    const payloadString = JSON.stringify(payload);
    
    // В реальной реализации Kaspi.kz использует HMAC-SHA256
    // Здесь упрощенная версия для примера
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', KASPI_WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('[kaspi.service] Ошибка при проверке подписи webhook:', error);
    return false;
  }
}

/**
 * Получение статуса заказа в Kaspi.kz
 */
export async function getKaspiOrderStatus(orderId: string): Promise<{
  status: string;
  paymentId?: string;
  amount?: number;
}> {
  if (!KASPI_MERCHANT_ID || !KASPI_API_KEY) {
    throw new Error('Kaspi.kz credentials not configured');
  }

  try {
    const response = await fetch(`${KASPI_API_BASE_URL}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KASPI_API_KEY}`,
        'X-Merchant-Id': KASPI_MERCHANT_ID,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[kaspi.service] Ошибка получения статуса заказа:', {
        orderId,
        status: response.status,
        error: errorText,
      });
      throw new Error(`Failed to get order status: ${response.status}`);
    }

    const data = await response.json() as any;
    
    return {
      status: data.status || 'unknown',
      paymentId: data.paymentId,
      amount: data.amount?.value,
    };
  } catch (error: any) {
    console.error('[kaspi.service] Ошибка при получении статуса заказа:', error);
    throw new Error(`Ошибка получения статуса заказа: ${error.message}`);
  }
}

/**
 * Проверка, является ли статус успешным
 */
export function isKaspiPaymentSuccess(status: string): boolean {
  const successStatuses = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'];
  return successStatuses.includes(status.toUpperCase());
}

/**
 * Проверка, является ли статус неудачным
 */
export function isKaspiPaymentFailed(status: string): boolean {
  const failedStatuses = ['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
  return failedStatuses.includes(status.toUpperCase());
}


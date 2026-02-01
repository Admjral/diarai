// Типы мессенджеров
export type MessengerType = 'whatsapp' | 'telegram' | 'instagram';

// Унифицированный формат сообщения
export interface UnifiedMessage {
  id: string;
  messengerType: MessengerType;
  messengerId: string; // ID контакта в мессенджере (телефон/chat_id/instagram_id)
  userId: number; // ID пользователя DIAR

  // Контент
  text: string;
  mediaUrls?: string[];

  // Метаданные отправителя
  senderName?: string;
  senderAvatar?: string;

  // Направление
  direction: 'inbound' | 'outbound';

  // AI
  isAIGenerated?: boolean;
  aiConfidence?: number;

  // Статус
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';

  // Timestamps
  timestamp: Date;

  // Оригинальные данные мессенджера
  rawData?: Record<string, unknown>;
}

// Конфигурация мессенджера пользователя
export interface MessengerConfig {
  id: number;
  userId: number;
  type: MessengerType;
  credentials: MessengerCredentials;
  aiEnabled: boolean;
  aiSystemPrompt?: string;
  escalationKeywords: string[];
  isConnected: boolean;
}

// Credentials для разных мессенджеров
export type MessengerCredentials =
  | WhatsAppCredentials
  | TelegramCredentials
  | InstagramCredentials;

export interface WhatsAppCredentials {
  sessionId: string;
  phoneNumber?: string;
}

export interface TelegramCredentials {
  botToken: string;
  botUsername?: string;
}

export interface InstagramCredentials {
  accessToken: string;
  pageId: string;
  instagramAccountId: string;
}

// Разговор
export interface Conversation {
  id: string;
  userId: number;
  messengerId: string;
  messengerType: MessengerType;
  contactName: string;
  contactAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  status: 'active' | 'archived' | 'closed';
  assignedToId?: number;
}

// Webhook события
export interface WebhookEvent {
  type: 'message.received' | 'message.sent' | 'message.delivered' | 'message.read' | 'session.status';
  messenger: MessengerType;
  userId: number;
  data: UnifiedMessage | SessionStatusData;
  timestamp: Date;
}

export interface SessionStatusData {
  sessionId: string;
  status: 'connected' | 'disconnected' | 'qr_required';
  qrCode?: string;
}

// AI Response
export interface AIResponse {
  text: string;
  confidence: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  intent?: string;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// DIAR Backend Request
export interface DiarWebhookPayload {
  event: string;
  userId: number;
  messengerType: MessengerType;
  message?: UnifiedMessage;
  conversation?: Conversation;
  sessionStatus?: SessionStatusData;
  timestamp: string;
}

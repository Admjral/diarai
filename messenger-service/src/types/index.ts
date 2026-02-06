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

// ============================================
// Evolution API Types (WhatsApp Multi-Session)
// ============================================

// Состояние подключения Evolution API
// 'not_found' - добавлено для случаев когда instance не существует
export type EvolutionConnectionState = 'open' | 'connecting' | 'close' | 'qrcode' | 'not_found';

// Instance (сессия) Evolution API
export interface EvolutionInstance {
  instanceName: string;
  instanceId?: string;
  status: EvolutionConnectionState;
  serverUrl?: string;
  apikey?: string;
  owner?: string;
  profileName?: string;
  profilePictureUrl?: string;
}

// QR код Evolution API
export interface EvolutionQRCode {
  pairingCode?: string;
  code: string;
  base64: string;
  count: number;
}

// Статус сообщения Evolution API
export type EvolutionMessageStatus =
  | 'ERROR'
  | 'PENDING'
  | 'SERVER_ACK'
  | 'DELIVERY_ACK'
  | 'READ'
  | 'PLAYED';

// Сообщение Evolution API
export interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  pushName?: string;
  status?: EvolutionMessageStatus;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
      contextInfo?: {
        quotedMessage?: unknown;
      };
    };
    imageMessage?: {
      url: string;
      mimetype?: string;
      caption?: string;
      fileSha256?: string;
      fileLength?: number;
    };
    videoMessage?: {
      url: string;
      mimetype?: string;
      caption?: string;
    };
    audioMessage?: {
      url: string;
      mimetype?: string;
      ptt?: boolean;
    };
    documentMessage?: {
      url: string;
      mimetype?: string;
      fileName?: string;
      fileLength?: number;
    };
    stickerMessage?: {
      url: string;
      mimetype?: string;
    };
    contactMessage?: {
      displayName: string;
      vcard: string;
    };
    locationMessage?: {
      degreesLatitude: number;
      degreesLongitude: number;
      name?: string;
      address?: string;
    };
  };
  messageType?: string;
  messageTimestamp?: number;
}

// Webhook payload от Evolution API
export interface EvolutionWebhookPayload {
  event: EvolutionWebhookEvent;
  instance: string;
  data: EvolutionMessage | EvolutionConnectionUpdate | EvolutionQRCodeUpdate | EvolutionMessageStatusUpdate;
  destination?: string;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
}

// Типы событий webhook Evolution API
export type EvolutionWebhookEvent =
  | 'MESSAGES_UPSERT'
  | 'MESSAGES_UPDATE'
  | 'MESSAGES_DELETE'
  | 'SEND_MESSAGE'
  | 'CONNECTION_UPDATE'
  | 'QRCODE_UPDATED'
  | 'PRESENCE_UPDATE'
  | 'CHATS_UPSERT'
  | 'CHATS_UPDATE'
  | 'CHATS_DELETE'
  | 'CONTACTS_UPSERT'
  | 'CONTACTS_UPDATE'
  | 'GROUPS_UPSERT'
  | 'GROUPS_UPDATE';

// Обновление статуса подключения
export interface EvolutionConnectionUpdate {
  instance: string;
  state: EvolutionConnectionState;
  statusReason?: number;
}

// Обновление QR кода
export interface EvolutionQRCodeUpdate {
  instance: string;
  qrcode: EvolutionQRCode;
}

// Обновление статуса сообщения
export interface EvolutionMessageStatusUpdate {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  status: EvolutionMessageStatus;
  datetime?: string;
}

// Ответ на создание instance
export interface EvolutionCreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
  hash: string;
  settings: {
    reject_call: boolean;
    groups_ignore: boolean;
    always_online: boolean;
    read_messages: boolean;
    read_status: boolean;
  };
  qrcode?: {
    pairingCode?: string;
    code: string;
    base64: string;
    count: number;
  };
}

// Ответ на отправку сообщения
export interface EvolutionSendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: number;
  status: string;
}

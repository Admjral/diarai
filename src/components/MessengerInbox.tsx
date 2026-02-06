import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Settings,
  Archive,
  X,
  Bot,
  User,
  RefreshCw,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  QrCode,
  ArrowLeft,
  Paperclip,
  Mic,
  UserPlus,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  messengerAPI,
  MessengerConversation,
  MessengerMessage,
  MessengerConfig,
} from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

// Icons for messengers
const MessengerIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'whatsapp':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      );
    case 'telegram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
        </svg>
      );
    default:
      return <MessageSquare className={className} />;
  }
};

// Status icon for messages
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-3 h-3 text-white/50" />;
    case 'sent':
      return <Check className="w-3 h-3 text-white/70" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-white/70" />;
    case 'read':
      return <CheckCheck className="w-3 h-3 text-white" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-300" />;
    default:
      return null;
  }
};

// Format time for message bubbles (only hours:minutes)
const formatMessageTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

// Format time for conversation list
const formatListTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Вчера';
  } else if (days < 7) {
    return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }
};

// Date separator text
const formatDateSeparator = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

// Check if two dates are on different days
const isDifferentDay = (date1: string, date2: string) => {
  return new Date(date1).toDateString() !== new Date(date2).toDateString();
};

// Check if messages are from the same sender within 2 minutes (for grouping)
const isSameGroup = (msg1: MessengerMessage, msg2: MessengerMessage) => {
  if (msg1.sender !== msg2.sender) return false;
  const diff = Math.abs(new Date(msg2.createdAt).getTime() - new Date(msg1.createdAt).getTime());
  return diff < 2 * 60 * 1000; // 2 minutes
};

// Platform accent color helper
const getPlatformColor = (type: string) => {
  switch (type) {
    case 'whatsapp':
      return { text: 'text-emerald-400', bg: 'bg-emerald-500', bgLight: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    case 'telegram':
      return { text: 'text-sky-400', bg: 'bg-sky-500', bgLight: 'bg-sky-500/10', border: 'border-sky-500/20' };
    case 'instagram':
      return { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500', bgLight: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' };
    default:
      return { text: 'text-gray-400', bg: 'bg-gray-500', bgLight: 'bg-gray-500/10', border: 'border-gray-500/20' };
  }
};

import type { Screen } from '../types';

interface MessengerInboxProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onNavigate?: (screen: Screen) => void;
}

export const MessengerInbox = memo(function MessengerInbox({ showToast, onNavigate }: MessengerInboxProps) {
  const { t } = useLanguage();

  // State
  const [conversations, setConversations] = useState<MessengerConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<MessengerConversation | null>(null);
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [configs, setConfigs] = useState<MessengerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load data
  const loadInbox = useCallback(async () => {
    try {
      setIsLoading(true);
      const [inboxRes, configsRes] = await Promise.all([
        messengerAPI.getInbox({ messengerType: filterType || undefined }),
        messengerAPI.getConfigs(),
      ]);

      setConversations(inboxRes.conversations);
      setUnreadTotal(inboxRes.unreadTotal);
      setConfigs(configsRes.configs);
    } catch (error) {
      showToast('Ошибка загрузки чатов', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [filterType, showToast]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // Load conversation messages
  const loadConversation = useCallback(async (conversation: MessengerConversation) => {
    try {
      const res = await messengerAPI.getConversation(conversation.id);
      setMessages(res.messages);
      setSelectedConversation(conversation);

      if (conversation.unreadCount > 0) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c))
        );
        setUnreadTotal((prev) => Math.max(0, prev - conversation.unreadCount));
      }
    } catch (error) {
      showToast('Ошибка загрузки сообщений', 'error');
    }
  }, [showToast]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  };

  // Send message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || isSending) return;

    try {
      setIsSending(true);
      const res = await messengerAPI.sendMessage(selectedConversation.id, messageText.trim());

      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message]);
        setMessageText('');

        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, lastMessage: messageText.trim(), lastMessageAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (error) {
      showToast('Ошибка отправки сообщения', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Archive conversation
  const handleArchive = async (id: string) => {
    try {
      await messengerAPI.archiveConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedConversation?.id === id) {
        setSelectedConversation(null);
        setMessages([]);
      }
      showToast('Разговор архивирован', 'success');
    } catch (error) {
      showToast('Ошибка архивации', 'error');
    }
  };

  // Close conversation
  const handleClose = async (id: string) => {
    try {
      await messengerAPI.closeConversation(id);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'closed' } : c))
      );
      showToast('Разговор закрыт', 'success');
    } catch (error) {
      showToast('Ошибка закрытия', 'error');
    }
  };

  // Create lead from conversation
  const handleCreateLead = async (conversation: MessengerConversation) => {
    try {
      const result = await messengerAPI.createLeadFromConversation(conversation.id);
      if (result.success) {
        // Update conversation to show it has a lead
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, leadId: result.lead?.id } : c))
        );
        if (selectedConversation?.id === conversation.id) {
          setSelectedConversation({ ...selectedConversation, leadId: result.lead?.id });
        }
        showToast('Лид добавлен в CRM', 'success');
      }
    } catch (error: any) {
      if (error?.message?.includes('уже существует') || error?.message?.includes('already exists')) {
        showToast('Лид уже добавлен в CRM', 'info');
      } else {
        showToast('Ошибка добавления в CRM', 'error');
      }
    }
  };

  // Connect WhatsApp
  const handleConnectWhatsApp = async () => {
    try {
      await messengerAPI.createWhatsAppSession();
      const qrRes = await messengerAPI.getWhatsAppQR();
      setQrCode(qrRes.data.value);
      setShowQRModal(true);
    } catch (error) {
      showToast('Ошибка подключения WhatsApp', 'error');
    }
  };

  // Connect Telegram
  const handleConnectTelegram = () => {
    const existingConfig = configs.find((c) => c.type === 'telegram');
    if (existingConfig?.credentials && typeof existingConfig.credentials === 'object') {
      const creds = existingConfig.credentials as { botToken?: string };
      if (creds.botToken) {
        setTelegramToken(creds.botToken);
      }
    }
    setShowTelegramModal(true);
  };

  const handleSaveTelegramToken = async () => {
    if (!telegramToken.trim()) {
      showToast('Введите токен бота', 'error');
      return;
    }

    if (!/^\d{8,12}:[A-Za-z0-9_-]{35}$/.test(telegramToken.trim())) {
      showToast('Неверный формат токена. Токен должен быть в формате: 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'error');
      return;
    }

    try {
      setIsSavingTelegram(true);
      await messengerAPI.connectTelegram(telegramToken.trim());
      showToast('Telegram бот успешно подключен!', 'success');
      setShowTelegramModal(false);
      setTelegramToken('');
      loadInbox();
    } catch (error) {
      showToast('Ошибка подключения Telegram', 'error');
    } finally {
      setIsSavingTelegram(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.contactName.toLowerCase().includes(query) ||
        c.lastMessage?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Mobile state
  const [showMobileChat, setShowMobileChat] = useState(false);

  const handleSelectConversation = (conv: MessengerConversation) => {
    loadConversation(conv);
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
    setMessages([]);
  };

  // Render system message (escalation, status changes)
  const renderSystemMessage = (text: string, key: string) => (
    <div key={key} className="flex justify-center my-3">
      <span className="text-[11px] text-gray-500 bg-[#1e2030]/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
        {text}
      </span>
    </div>
  );

  // Render message bubble
  const renderMessageBubble = (msg: MessengerMessage, index: number) => {
    const isOutgoing = msg.sender !== 'customer';
    const isAI = msg.sender === 'ai';
    const isOperator = msg.sender === 'operator';

    const showDateSeparator = index === 0 ||
      (index > 0 && isDifferentDay(messages[index - 1].createdAt, msg.createdAt));

    // Check if this is part of a group (same sender, close in time)
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
    const isFirstInGroup = !prevMsg || !isSameGroup(prevMsg, msg) || showDateSeparator;
    const isLastInGroup = !nextMsg || !isSameGroup(msg, nextMsg);

    // If escalated, render as system message
    if (msg.isEscalated && msg.text === '') {
      return renderSystemMessage('Эскалировано оператору', msg.id);
    }

    // Bubble border radius based on grouping (Telegram-like)
    const getBubbleRadius = () => {
      if (!isOutgoing) {
        // Incoming (left)
        if (isFirstInGroup && isLastInGroup) return 'rounded-xl rounded-bl-[4px]';
        if (isFirstInGroup) return 'rounded-xl rounded-bl-md';
        if (isLastInGroup) return 'rounded-xl rounded-tl-md rounded-bl-[4px]';
        return 'rounded-xl rounded-tl-md rounded-bl-md';
      } else {
        // Outgoing (right)
        if (isFirstInGroup && isLastInGroup) return 'rounded-xl rounded-br-[4px]';
        if (isFirstInGroup) return 'rounded-xl rounded-br-md';
        if (isLastInGroup) return 'rounded-xl rounded-tr-md rounded-br-[4px]';
        return 'rounded-xl rounded-tr-md rounded-br-md';
      }
    };

    // Spacing between messages (tighter for Telegram-like feel)
    const marginBottom = isLastInGroup ? 'mb-3' : 'mb-0.5';

    return (
      <div key={msg.id}>
        {showDateSeparator && (
          <div className="flex justify-center my-5">
            <span className="text-[11px] text-gray-400 bg-[#1e2030]/80 backdrop-blur-sm px-4 py-1.5 rounded-full font-medium">
              {formatDateSeparator(msg.createdAt)}
            </span>
          </div>
        )}

        {/* System message for escalation - only show once before the first escalated message */}
        {msg.isEscalated && msg.text !== '' && (index === 0 || !messages[index - 1]?.isEscalated) && (
          <div className="flex justify-center my-2">
            <span className="text-[10px] text-orange-400/70 bg-orange-500/5 px-3 py-1 rounded-full flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              Эскалировано оператору
            </span>
          </div>
        )}

        <div className={`flex ${marginBottom} ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[80%] sm:max-w-[70%] px-3.5 py-2 relative shadow-sm ${getBubbleRadius()} ${
              !isOutgoing
                ? 'bg-[#212936] text-white'
                : isAI
                ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white'
                : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
            }`}
          >
            {/* Sender label - only on first message in group */}
            {isFirstInGroup && isAI && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-2.5 h-2.5 text-white/90" />
                </div>
                <span className="text-[11px] text-white/80 font-medium">AI-ассистент</span>
                {msg.aiConfidence && (
                  <span className="text-[10px] text-white/50 ml-1">
                    {Math.round(msg.aiConfidence * 100)}%
                  </span>
                )}
              </div>
            )}
            {isFirstInGroup && isOperator && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-2.5 h-2.5 text-white/90" />
                </div>
                <span className="text-[11px] text-white/80 font-medium">Вы</span>
              </div>
            )}

            <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.45]">{msg.text}</p>

            {/* Time + status */}
            <div className="flex items-center justify-end gap-0.5 mt-0.5 -mb-0.5">
              <span className={`text-[9px] leading-none ${isOutgoing ? 'text-white/50' : 'text-gray-500'}`}>
                {formatMessageTime(msg.createdAt)}
              </span>
              {isOutgoing && <StatusIcon status={msg.status} />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Filter capsule component
  const FilterCapsule = ({ type, label, icon }: { type: string | null; label: string; icon?: React.ReactNode }) => {
    const isActive = filterType === type;
    const colors = type ? getPlatformColor(type) : null;

    return (
      <button
        onClick={() => setFilterType(type)}
        className={`
          flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium
          transition-all duration-200 whitespace-nowrap
          ${isActive
            ? type === null
              ? 'bg-white/10 text-white shadow-sm'
              : `${colors?.bgLight} ${colors?.text} ${colors?.border} border shadow-sm`
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }
        `}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0c0f1a]">
      {/* Header - Minimalist */}
      <header className="border-b border-white/5 bg-[#0c0f1a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            {onNavigate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigate('dashboard')}
                className="text-gray-400 hover:text-white hover:bg-white/5 h-9 w-9 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Чаты
              </h1>
              {unreadTotal > 0 && (
                <span className="min-w-[20px] h-5 bg-red-500 text-white text-[11px] font-medium rounded-full flex items-center justify-center px-1.5">
                  {unreadTotal}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 sm:py-4">
        <div className="flex h-[calc(100vh-80px)] sm:h-[calc(100vh-110px)] bg-[#111422] rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl">

          {/* Sidebar - Conversation List */}
          <div className={`${showMobileChat ? 'hidden' : 'flex'} md:flex w-full md:w-[340px] border-r border-white/[0.06] flex-col`}>
            {/* Sidebar Header */}
            <div className="p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-white">Сообщения</h2>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={loadInbox}
                    className="text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    className="text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Поиск чатов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/10 focus:bg-white/[0.06] transition-all"
                />
              </div>

              {/* Filter Capsules */}
              <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-hide">
                <FilterCapsule type={null} label="Все" />
                <FilterCapsule
                  type="whatsapp"
                  label="WhatsApp"
                  icon={<MessengerIcon type="whatsapp" className="w-3 h-3" />}
                />
                <FilterCapsule
                  type="telegram"
                  label="Telegram"
                  icon={<MessengerIcon type="telegram" className="w-3 h-3" />}
                />
                <FilterCapsule
                  type="instagram"
                  label="Instagram"
                  icon={<MessengerIcon type="instagram" className="w-3 h-3" />}
                />
              </div>
            </div>

            <Separator className="bg-white/[0.06]" />

            {/* Conversation List */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-600" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-500">Нет разговоров</p>
                  <p className="text-xs text-gray-600 mt-1">Подключите мессенджер в настройках</p>
                </div>
              ) : (
                <div className="py-1">
                  {filteredConversations.map((conv, idx) => {
                    const platformColors = getPlatformColor(conv.messengerType);
                    const isSelected = selectedConversation?.id === conv.id;

                    return (
                      <div key={conv.id}>
                        {idx > 0 && (
                          <div className="px-4">
                            <Separator className="bg-white/[0.06]" />
                          </div>
                        )}
                        <div
                          onClick={() => handleSelectConversation(conv)}
                          className={`
                            px-4 py-4 cursor-pointer transition-all duration-150 relative
                            ${isSelected
                              ? 'bg-white/[0.06]'
                              : 'hover:bg-white/[0.03] active:bg-white/[0.05]'
                            }
                          `}
                        >
                          {/* Selected indicator */}
                          {isSelected && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-amber-500 rounded-r-full" />
                          )}

                          <div className="flex items-center gap-3.5">
                            {/* Avatar with platform badge */}
                            <div className="relative flex-shrink-0">
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center border border-white/[0.08] ${platformColors.bgLight}`}>
                                {/^\d/.test(conv.contactName) ? (
                                  <User className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <span className="text-base font-semibold text-white/90">
                                    {conv.contactName.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              {/* Platform badge */}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full ${platformColors.bg} flex items-center justify-center ring-[2px] ring-[#111422]`}>
                                <MessengerIcon type={conv.messengerType} className="w-2.5 h-2.5 text-white" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-medium text-white text-[14px] truncate">
                                    {conv.contactName}
                                  </span>
                                  {conv.leadId && (
                                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-medium rounded flex-shrink-0">
                                      CRM
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  {conv.lastMessageAt && (
                                    <span className={`text-[11px] ${conv.unreadCount > 0 ? 'text-amber-400 font-medium' : 'text-gray-500'}`}>
                                      {formatListTime(conv.lastMessageAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-[13px] text-gray-400 truncate pr-2">
                                  {conv.lastMessage || 'Нет сообщений'}
                                </p>
                                {conv.unreadCount > 0 && (
                                  <span className="min-w-[20px] h-5 bg-amber-500 text-black text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 flex-shrink-0">
                                    {conv.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={`${!showMobileChat ? 'hidden' : 'flex'} md:flex flex-1 flex-col bg-[#0c0f1a]`}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-[#111422]/80 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBackToList}
                      className="md:hidden text-gray-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/[0.08] ${getPlatformColor(selectedConversation.messengerType).bgLight}`}>
                        {/^\d/.test(selectedConversation.contactName) ? (
                          <User className="w-4 h-4 text-gray-400" />
                        ) : (
                          <span className="text-sm font-semibold text-white/90">
                            {selectedConversation.contactName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${getPlatformColor(selectedConversation.messengerType).bg} flex items-center justify-center ring-[2px] ring-[#111422]`}>
                        <MessengerIcon type={selectedConversation.messengerType} className="w-2 h-2 text-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white text-[14px] truncate max-w-[180px] sm:max-w-none">
                        {selectedConversation.contactName}
                      </h3>
                      <p className={`text-[11px] ${getPlatformColor(selectedConversation.messengerType).text} capitalize`}>
                        {selectedConversation.messengerType}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1e2030] border-white/10 rounded-xl shadow-xl">
                      <DropdownMenuItem
                        onClick={() => handleCreateLead(selectedConversation)}
                        className={`rounded-lg ${
                          selectedConversation.leadId
                            ? 'text-green-400 focus:text-green-300 focus:bg-green-500/10'
                            : 'text-gray-300 focus:text-white focus:bg-white/5'
                        }`}
                        disabled={!!selectedConversation.leadId}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {selectedConversation.leadId ? 'Уже в CRM' : 'Добавить в CRM'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchive(selectedConversation.id)} className="text-gray-300 focus:text-white focus:bg-white/5 rounded-lg">
                        <Archive className="w-4 h-4 mr-2" />
                        Архивировать
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleClose(selectedConversation.id)} className="text-gray-300 focus:text-white focus:bg-white/5 rounded-lg">
                        <X className="w-4 h-4 mr-2" />
                        Закрыть
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1">
                  <div className="px-5 sm:px-8 py-5">
                    {messages.map((msg, index) => renderMessageBubble(msg, index))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input - Modern */}
                <div className="px-4 sm:px-5 py-3.5 border-t border-white/[0.06] bg-[#111422]/80 backdrop-blur-sm">
                  <div className="flex items-end gap-2">
                    {/* Attachment button */}
                    <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors flex-shrink-0 mb-0.5">
                      <Paperclip className="w-[18px] h-[18px]" />
                    </button>

                    {/* Input field */}
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        placeholder="Сообщение..."
                        value={messageText}
                        onChange={handleTextareaChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-[14px] resize-none min-h-[46px] max-h-[140px] focus:outline-none focus:border-white/15 focus:bg-white/[0.06] placeholder:text-gray-500 transition-all leading-[1.4]"
                        rows={1}
                      />
                    </div>

                    {/* Send / Mic button */}
                    {messageText.trim() ? (
                      <button
                        onClick={handleSendMessage}
                        disabled={isSending}
                        className="w-9 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 flex items-center justify-center transition-all flex-shrink-0 mb-0.5 shadow-lg shadow-amber-500/20"
                      >
                        {isSending ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Send className="w-4 h-4 text-white" />
                        )}
                      </button>
                    ) : (
                      <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors flex-shrink-0 mb-0.5">
                        <Mic className="w-[18px] h-[18px]" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] flex items-center justify-center mb-5 border border-white/[0.06]">
                  <MessageSquare className="w-10 h-10 text-gray-600" />
                </div>
                <p className="text-lg text-white font-medium mb-1.5">Выберите чат</p>
                <p className="text-sm text-gray-500 text-center max-w-[260px]">
                  Выберите чат из списка слева или подключите мессенджер
                </p>
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  className="mt-5 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Настройки
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-[#111422] border-white/10 text-white max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Настройки мессенджеров</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="connections">
            <TabsList className="bg-white/[0.04] rounded-xl">
              <TabsTrigger value="connections" className="rounded-lg">Подключения</TabsTrigger>
              <TabsTrigger value="ai" className="rounded-lg">AI настройки</TabsTrigger>
            </TabsList>

            <TabsContent value="connections" className="space-y-3 mt-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <MessengerIcon type="whatsapp" className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-[14px]">WhatsApp</p>
                      <p className="text-xs text-gray-500">
                        {configs.find((c) => c.type === 'whatsapp')?.isConnected
                          ? 'Подключен'
                          : 'Не подключен'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleConnectWhatsApp}
                    size="sm"
                    className={
                      configs.find((c) => c.type === 'whatsapp')?.isConnected
                        ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl'
                    }
                  >
                    <QrCode className="w-4 h-4 mr-1.5" />
                    {configs.find((c) => c.type === 'whatsapp')?.isConnected ? 'QR' : 'Подключить'}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                      <MessengerIcon type="telegram" className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <p className="font-medium text-[14px]">Telegram Bot</p>
                      <p className="text-xs text-gray-500">
                        {configs.find((c) => c.type === 'telegram')?.isConnected
                          ? 'Подключен'
                          : 'Требует настройки'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleConnectTelegram}
                    size="sm"
                    className={
                      configs.find((c) => c.type === 'telegram')?.isConnected
                        ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl'
                        : 'bg-sky-500 hover:bg-sky-600 text-white rounded-xl'
                    }
                  >
                    <Bot className="w-4 h-4 mr-1.5" />
                    {configs.find((c) => c.type === 'telegram')?.isConnected ? 'Изменить' : 'Подключить'}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                      <MessengerIcon type="instagram" className="w-5 h-5 text-fuchsia-400" />
                    </div>
                    <div>
                      <p className="font-medium text-[14px]">Instagram</p>
                      <p className="text-xs text-gray-500">Скоро</p>
                    </div>
                  </div>
                  <Button size="sm" disabled className="rounded-xl opacity-40">
                    Скоро
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div>
                    <Label className="text-[14px]">AI автоответчик</Label>
                    <p className="text-xs text-gray-500 mt-0.5">Автоматические ответы на сообщения</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <Label className="text-[14px]">Системный промпт</Label>
                  <Textarea
                    placeholder="Инструкции для AI..."
                    className="mt-2 bg-white/[0.04] border-white/[0.08] rounded-xl"
                    rows={4}
                  />
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <Label className="text-[14px]">Ключевые слова для эскалации</Label>
                  <Input
                    placeholder="жалоба, возврат, оператор..."
                    className="mt-2 bg-white/[0.04] border-white/[0.08] rounded-xl"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Разделяйте запятой. При этих словах AI передаст разговор оператору.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="bg-[#111422] border-white/10 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessengerIcon type="whatsapp" className="w-5 h-5 text-emerald-400" />
              Подключение WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrCode ? (
              <>
                <div className="bg-white p-4 rounded-2xl shadow-xl">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="WhatsApp QR"
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-center text-gray-400 mt-4 text-sm leading-relaxed">
                  Откройте WhatsApp на телефоне<br />
                  Настройки → Связанные устройства → Привязка устройства
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-600" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Telegram Bot Modal */}
      <Dialog open={showTelegramModal} onOpenChange={setShowTelegramModal}>
        <DialogContent className="bg-[#111422] border-white/10 text-white max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessengerIcon type="telegram" className="w-5 h-5 text-sky-400" />
              Подключение Telegram Bot
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/15">
              <h4 className="font-medium text-sky-400 text-sm mb-3">Как создать бота:</h4>
              <ol className="space-y-2 text-[13px] text-gray-300">
                <li className="flex gap-2">
                  <span className="font-bold text-sky-400 flex-shrink-0">1.</span>
                  Откройте Telegram и найдите <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@BotFather</a>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-sky-400 flex-shrink-0">2.</span>
                  Отправьте команду <code className="bg-white/5 px-1.5 py-0.5 rounded">/newbot</code>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-sky-400 flex-shrink-0">3.</span>
                  Введите название и username бота
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-sky-400 flex-shrink-0">4.</span>
                  Скопируйте полученный токен сюда
                </li>
              </ol>
            </div>

            <div>
              <Label htmlFor="telegram-token" className="text-[13px]">Токен бота</Label>
              <Input
                id="telegram-token"
                type="text"
                placeholder="123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                className="mt-2 bg-white/[0.04] border-white/[0.08] text-white font-mono text-sm rounded-xl"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <p className="text-[12px] text-amber-400/80">
                <strong>Важно:</strong> Клиенты пишут боту, вы отвечаете через Чаты.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowTelegramModal(false)}
                className="flex-1 border-white/10 rounded-xl hover:bg-white/5"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSaveTelegramToken}
                disabled={!telegramToken.trim() || isSavingTelegram}
                className="flex-1 bg-sky-500 hover:bg-sky-600 rounded-xl"
              >
                {isSavingTelegram ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Подключение...
                  </>
                ) : (
                  'Подключить'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default MessengerInbox;

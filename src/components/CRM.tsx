import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Users, UserPlus, Target, CheckSquare, MessageSquare, Phone, Mail, MoreVertical, Send, Search, X, Edit, Trash2, Plus, Calendar, DollarSign, AlertCircle, Filter, Save, ArrowUpDown, TrendingUp, Clock, Loader2, Menu, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import type { Screen } from '../types';
import { leadsAPI, dealsAPI, tasksAPI, campaignsAPI, exportAPI, type ExportFormat } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getCache, setCache, cacheKeys } from '../lib/cache';
import { LeadListSkeleton, DealListSkeleton, TaskListSkeleton } from './SkeletonLoaders';
import { ConfirmDialog } from './ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CRMProps {
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type Tab = 'leads' | 'deals' | 'tasks' | 'chat';

interface Message {
  id: number;
  sender: 'client' | 'me';
  text: string;
  time: string;
  isAI: boolean;
}

// Компонент для задачи с поддержкой drag & drop
interface TaskItemProps {
  task: any;
  onTaskClick: (taskId: string) => void;
  onEdit: (task: any) => void;
  onDelete: (taskId: string) => void;
  isDeleting: string | null;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
  handleQuickStatusChange: (type: 'task', id: string, status: string) => void;
  formatDate: (date: string) => string;
  t: typeof import('../lib/translations').translations['🇷🇺 RU'];
}

function TaskItem({
  task,
  onTaskClick,
  onEdit,
  onDelete,
  isDeleting,
  getPriorityColor,
  getStatusColor,
  handleQuickStatusChange,
  formatDate,
  t,
}: TaskItemProps & { t: typeof import('../lib/translations').translations['🇷🇺 RU'] }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onTaskClick(task.id)}
      className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/50 transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : 'hover:scale-[1.02]'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-white">{task.title}</h3>
            <span className={`px-2 py-1 rounded-lg text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority === 'low' ? t.crm.priority.low : task.priority === 'medium' ? t.crm.priority.medium : task.priority === 'high' ? t.crm.priority.high : task.priority === 'urgent' ? t.crm.priority.urgent : task.priority}
            </span>
            <select
              value={task.status}
              onChange={(e) => {
                e.stopPropagation();
                handleQuickStatusChange('task', task.id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`px-2 py-1 rounded-lg text-xs border-0 cursor-pointer ${getStatusColor(task.status)}`}
            >
              <option value="todo">{t.crm.taskStatus.todo}</option>
              <option value="in_progress">{t.crm.taskStatus.inProgress}</option>
              <option value="done">{t.crm.taskStatus.done}</option>
              <option value="cancelled">{t.crm.taskStatus.cancelled}</option>
            </select>
          </div>
          {task.description && (
            <p className="text-gray-400 text-sm mb-2">{task.description}</p>
          )}
          {task.lead && (
            <p className="text-gray-500 text-sm">{t.crm.relatedTo} {task.lead.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="text-gray-400 hover:text-yellow-400"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            disabled={isDeleting === String(task.id)}
            className="text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting === String(task.id) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {task.dueDate && (
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>{t.crm.dueDate} {formatDate(task.dueDate)}</span>
            {new Date(task.dueDate) < new Date() && task.status !== 'done' && (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CRM({ onNavigate, showToast }: CRMProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [leadNotes, setLeadNotes] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({ totalLeads: 0, activeDeals: 0, pendingTasks: 0, totalAmount: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sensors для drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Данные из API
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'lead' | 'deal' | 'task'; id: string; name: string } | null>(null);
  
  // Модальные окна
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeadDetailsModal, setShowLeadDetailsModal] = useState(false);
  const [showDealDetailsModal, setShowDealDetailsModal] = useState(false);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Формы
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'new',
    stage: t.crm.placeholders.firstContact,
    source: '',
    notes: '',
    campaignId: null as number | null,
  });
  
  const [newDeal, setNewDeal] = useState({
    name: '',
    amount: '',
    currency: 'KZT',
    stage: 'lead',
    probability: 0,
    expectedCloseDate: '',
    notes: '',
    leadId: '',
  });
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
    leadId: '',
  });
  
  // Определяем функции загрузки ДО их использования в useEffect
  const loadLeadsFromAPI = async () => {
    const leadsData = await leadsAPI.getAll();
    setLeads(leadsData);
    setCache(cacheKeys.leads, leadsData);
    setStats(prev => ({ ...prev, totalLeads: leadsData.length }));
    setLoading(false);
  };

  const loadDealsFromAPI = async () => {
    const dealsData = await dealsAPI.getAll();
    setDeals(dealsData);
    setCache(cacheKeys.deals, dealsData);
    const activeDeals = dealsData.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length;
    const totalAmount = dealsData.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
    setStats(prev => ({ ...prev, activeDeals, totalAmount }));
    setLoading(false);
  };

  const loadTasksFromAPI = async () => {
    const tasksData = await tasksAPI.getAll();
    setTasks(tasksData);
    setCache(cacheKeys.tasks, tasksData);
    const pendingTasks = tasksData.filter((t: any) => t.status !== 'done' && t.status !== 'cancelled').length;
    setStats(prev => ({ ...prev, pendingTasks }));
    setLoading(false);
  };

  const loadData = async (useCache = true) => {
    setLoading(true);
    try {
      if (activeTab === 'leads') {
        // Проверяем кэш
        if (useCache) {
          const cached = getCache<any[]>(cacheKeys.leads);
          if (cached) {
            setLeads(cached);
            setStats(prev => ({ ...prev, totalLeads: cached.length }));
            setLoading(false);
            // Загружаем свежие данные в фоне
            loadLeadsFromAPI();
            return;
          }
        }
        await loadLeadsFromAPI();
      } else if (activeTab === 'deals') {
        // Проверяем кэш
        if (useCache) {
          const cached = getCache<any[]>(cacheKeys.deals);
          if (cached) {
            setDeals(cached);
            const activeDeals = cached.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length;
            const totalAmount = cached.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
            setStats(prev => ({ ...prev, activeDeals, totalAmount }));
            setLoading(false);
            // Загружаем свежие данные в фоне
            loadDealsFromAPI();
            return;
          }
        }
        await loadDealsFromAPI();
      } else if (activeTab === 'tasks') {
        // Проверяем кэш
        if (useCache) {
          const cached = getCache<any[]>(cacheKeys.tasks);
          if (cached) {
            setTasks(cached);
            const pendingTasks = cached.filter((t: any) => t.status !== 'done' && t.status !== 'cancelled').length;
            setStats(prev => ({ ...prev, pendingTasks }));
            setLoading(false);
            // Загружаем свежие данные в фоне
            loadTasksFromAPI();
            return;
          }
        }
        await loadTasksFromAPI();
      }
    } catch (error: any) {
      // Пытаемся использовать кэш при ошибке
      if (activeTab === 'leads') {
        const cached = getCache<any[]>(cacheKeys.leads);
        if (cached) {
          setLeads(cached);
          setStats(prev => ({ ...prev, totalLeads: cached.length }));
          setLoading(false);
          return;
        }
      } else if (activeTab === 'deals') {
        const cached = getCache<any[]>(cacheKeys.deals);
        if (cached) {
          setDeals(cached);
          const activeDeals = cached.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length;
          const totalAmount = cached.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
          setStats(prev => ({ ...prev, activeDeals, totalAmount }));
          setLoading(false);
          return;
        }
      } else if (activeTab === 'tasks') {
        const cached = getCache<any[]>(cacheKeys.tasks);
        if (cached) {
          setTasks(cached);
          const pendingTasks = cached.filter((t: any) => t.status !== 'done' && t.status !== 'cancelled').length;
          setStats(prev => ({ ...prev, pendingTasks }));
          setLoading(false);
          return;
        }
      }
      showToast(error.message || t.crm.errors.loadData, 'error');
      setLoading(false);
    }
  };

  const loadMessages = async (leadId: string) => {
    try {
      const lead = await leadsAPI.getById(leadId);
      if (lead && lead.messages) {
        const formattedMessages: Message[] = lead.messages.map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          sender: msg.sender === 'client' ? 'client' : 'me',
          text: msg.text || msg.content || '',
          time: new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAI: msg.isAI || msg.sender === 'ai' || msg.sender === 'assistant' || false,
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки сообщений:', error);
      showToast(error.message || t.crm.errors.loadMessages, 'error');
      setMessages([]);
    }
  };

  // Загрузка лидов при открытии модальных окон для выбора
  useEffect(() => {
    if ((showAddDealModal || showAddTaskModal) && leads.length === 0) {
      // Проверяем кэш сначала
      const cached = getCache<any[]>(cacheKeys.leads);
      if (cached) {
        setLeads(cached);
      } else {
        leadsAPI.getAll().then(data => {
          setLeads(data);
          setCache(cacheKeys.leads, data);
        }).catch(() => {});
      }
    }
  }, [showAddDealModal, showAddTaskModal]);
  
  // Загрузка данных при монтировании и смене вкладки
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab]);
  
  // Загрузка сообщений для выбранного лида
  useEffect(() => {
    if (selectedLead && activeTab === 'chat') {
      loadMessages(selectedLead);
    }
  }, [selectedLead, activeTab]);

  const tabs = [
    { id: 'leads' as Tab, label: t.crm.leads, icon: <UserPlus className="w-4 h-4" />, count: leads.length },
    { id: 'deals' as Tab, label: t.crm.deals, icon: <Target className="w-4 h-4" />, count: deals.length },
    { id: 'tasks' as Tab, label: t.crm.tasks, icon: <CheckSquare className="w-4 h-4" />, count: tasks.length },
    { id: 'chat' as Tab, label: t.crm.chat, icon: <MessageSquare className="w-4 h-4" />, count: null },
  ];
  
  // Загрузка заметок при выборе лида
  useEffect(() => {
    if (selectedLead) {
      const lead = leads.find(l => l.id === selectedLead);
      if (lead && lead.notes) {
        setLeadNotes(prev => ({ ...prev, [selectedLead]: lead.notes }));
      }
    }
  }, [selectedLead, leads]);
  
  // Автоскролл в чате
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedLead) return;
    
    setIsSendingMessage(true);
    try {
      // Здесь будет API для отправки сообщений
      const newMessage: Message = {
        id: messages.length + 1,
        sender: 'me',
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true,
      };
      setMessages([...messages, newMessage]);
      setMessage('');
      showToast(t.crm.messageSent, 'success');
    } catch (error: any) {
      showToast(error.message || t.crm.errors.sendMessage, 'error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleAddLead = async () => {
    if (!newLead.name || !newLead.phone || !newLead.email) {
      showToast(t.crm.fillRequiredFields, 'error');
      return;
    }
    
    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newLead.email)) {
      showToast(t.crm.errors.invalidEmail, 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      await leadsAPI.create({
        ...newLead,
        campaignId: newLead.campaignId || null,
        // Устанавливаем lastAction при создании
        lastAction: new Date().toISOString()
      });
      setShowAddLeadModal(false);
      setNewLead({
        name: '',
        phone: '',
        email: '',
        status: 'new',
        stage: t.crm.defaultStage,
        source: '',
        notes: '',
        campaignId: null,
      });
      showToast(t.crm.success.leadAdded, 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || t.crm.errors.createLead, 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddDeal = async () => {
    // Строгая проверка поля name
    if (!newDeal.name || typeof newDeal.name !== 'string' || newDeal.name.trim() === '') {
      showToast(t.crm.errors.fillDealName, 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      // Находим имя клиента из лида, если выбран лид
      const selectedLead = leads.find(l => l.id.toString() === newDeal.leadId);
      const clientName = selectedLead ? selectedLead.name : (newDeal.clientName || newDeal.name.trim());
      
      // Валидация и нормализация probability (0-100)
      let probabilityValue = 0;
      if (newDeal.probability) {
        const parsed = parseInt(newDeal.probability.toString(), 10);
        probabilityValue = Math.max(0, Math.min(100, parsed)); // Ограничиваем от 0 до 100
      }

      // Преобразование expectedCloseDate в ISO формат, если указана
      let expectedCloseDateValue: string | null = null;
      if (newDeal.expectedCloseDate && newDeal.expectedCloseDate.trim() !== '') {
        // Если это дата в формате YYYY-MM-DD, преобразуем в ISO
        const date = new Date(newDeal.expectedCloseDate);
        if (!isNaN(date.getTime())) {
          expectedCloseDateValue = date.toISOString();
        }
      }

      const dealData: any = {
        name: newDeal.name.trim(),
        amount: newDeal.amount ? parseFloat(newDeal.amount.toString()) : 0,
        currency: newDeal.currency || '₸',
        stage: newDeal.stage || 'lead',
        probability: probabilityValue,
        expectedCloseDate: expectedCloseDateValue,
        notes: newDeal.notes && newDeal.notes.trim() !== '' ? newDeal.notes.trim() : null,
        clientId: newDeal.leadId ? parseInt(newDeal.leadId.toString(), 10) : null,
      };
      
      // Добавляем clientName только если он есть
      if (clientName && clientName.trim() !== '') {
        dealData.clientName = clientName.trim();
      }
      
      console.log('Отправка данных сделки:', dealData);
      
      await dealsAPI.create(dealData);
      setShowAddDealModal(false);
      setNewDeal({
        name: '',
        amount: '',
        currency: 'KZT',
        stage: 'lead',
        probability: 0,
        expectedCloseDate: '',
        notes: '',
        leadId: '',
      });
      showToast(t.crm.success.dealAdded, 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || t.crm.errors.createDeal, 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddTask = async () => {
    if (!newTask.title) {
      showToast(t.crm.errors.fillTaskName, 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      // Преобразование dueDate в ISO формат, если указана
      let dueDateValue: string | null = null;
      if (newTask.dueDate && newTask.dueDate.trim() !== '') {
        // Если это дата в формате YYYY-MM-DD, преобразуем в ISO
        // Добавляем время для корректного парсинга (полночь UTC)
        const dateStr = newTask.dueDate.trim();
        const date = new Date(dateStr + 'T00:00:00.000Z');
        if (!isNaN(date.getTime())) {
          dueDateValue = date.toISOString();
        }
      }

      // Валидация clientId - должен быть положительным числом или null
      let clientIdValue: number | null = null;
      if (newTask.leadId) {
        const parsed = parseInt(newTask.leadId.toString(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          clientIdValue = parsed;
        }
      }

      const taskData: any = {
        title: newTask.title.trim(),
        description: newTask.description && newTask.description.trim() !== '' ? newTask.description.trim() : null,
        status: newTask.status || 'todo',
        priority: newTask.priority || 'medium',
        dueDate: dueDateValue,
        clientId: clientIdValue,
      };

      console.log('Отправка данных задачи:', taskData);

      await tasksAPI.create(taskData);
      setShowAddTaskModal(false);
      setNewTask({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: '',
        leadId: '',
      });
      showToast(t.crm.success.taskAdded, 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || t.crm.errors.createTask, 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteClick = (type: 'lead' | 'deal' | 'task', id: string | number) => {
    const idString = String(id);
    let itemName = '';
    if (type === 'lead') {
      const lead = leads.find(l => String(l.id) === idString);
      itemName = lead?.name || t.crm.leads.toLowerCase();
    } else if (type === 'deal') {
      const deal = deals.find(d => String(d.id) === idString);
      itemName = deal?.name || t.crm.deals.toLowerCase();
    } else if (type === 'task') {
      const task = tasks.find(t => String(t.id) === idString);
      itemName = task?.title || t.crm.tasks.toLowerCase();
    }
    
    setItemToDelete({ type, id: idString, name: itemName });
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    const { type, id } = itemToDelete;
    setIsDeleting(id);
    
    try {
      if (type === 'lead') {
        await leadsAPI.delete(id);
        showToast(t.crm.success.leadDeleted, 'success');
        if (selectedLead === id || String(selectedLead) === id) setSelectedLead(null);
      } else if (type === 'deal') {
        await dealsAPI.delete(id);
        showToast(t.crm.success.dealDeleted, 'success');
      } else if (type === 'task') {
        await tasksAPI.delete(id);
        showToast(t.crm.success.taskDeleted, 'success');
      }
      loadData(false); // Перезагружаем данные без кэша
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      showToast(error.message || t.crm.errors.delete, 'error');
    } finally {
      setIsDeleting(null);
    }
  };
  
  const handleUpdateLead = async (id: string, data: any) => {
    try {
      await leadsAPI.update(id, data);
      showToast(t.crm.success.leadUpdated, 'success');
      loadData(false); // Перезагружаем данные без кэша
      setShowEditModal(false);
      setEditingItem(null);
    } catch (error: any) {
      showToast(error.message || t.crm.errors.update, 'error');
    }
  };
  
  const handleUpdateDeal = async (id: string, data: any) => {
    try {
      await dealsAPI.update(id, data);
      showToast(t.crm.success.dealUpdated, 'success');
      loadData(false); // Перезагружаем данные без кэша
      setShowEditModal(false);
      setEditingItem(null);
    } catch (error: any) {
      showToast(error.message || t.crm.errors.update, 'error');
    }
  };
  
  const handleUpdateTask = async (id: string, data: any) => {
    try {
      await tasksAPI.update(id, data);
      showToast(t.crm.success.taskUpdated, 'success');
      loadData(false); // Перезагружаем данные без кэша
      setShowEditModal(false);
      setEditingItem(null);
    } catch (error: any) {
      showToast(error.message || t.crm.errors.update, 'error');
    }
  };

  // Обработчик завершения перетаскивания задачи
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = paginatedTasks.findIndex((task) => task.id === active.id);
      const newIndex = paginatedTasks.findIndex((task) => task.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newTasks = arrayMove(paginatedTasks, oldIndex, newIndex);
      
      // Обновляем локальное состояние для мгновенного отклика
      const allTasks = [...tasks];
      const startIndex = (currentPage - 1) * itemsPerPage;
      newTasks.forEach((task, index) => {
        const globalIndex = startIndex + index;
        if (allTasks[globalIndex]) {
          allTasks[globalIndex] = task;
        }
      });
      
      setTasks(allTasks);
      setCache(cacheKeys.tasks, allTasks);
      
      // Опционально: можно сохранить порядок на сервере
      // await tasksAPI.updateOrder(newTasks.map(t => t.id));
      
      showToast(t.crm.success.tasksOrderUpdated, 'success');
    }
  };
  
  const handleSaveNotes = async (leadId: string) => {
    try {
      await leadsAPI.update(leadId, { notes: leadNotes[leadId] || '' });
      showToast(t.crm.success.notesSaved, 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || t.crm.errors.save, 'error');
    }
  };
  
  const handleQuickStatusChange = async (type: 'lead' | 'task', id: string, newStatus: string) => {
    try {
      if (type === 'lead') {
        // При изменении статуса обновляем также lastAction
        await leadsAPI.update(id, { 
          status: newStatus,
          lastAction: new Date().toISOString()
        });
        showToast(t.crm.success.statusUpdated, 'success');
      } else if (type === 'task') {
        await tasksAPI.update(id, { status: newStatus });
        showToast(t.crm.success.statusUpdated, 'success');
      }
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || t.crm.errors.update, 'error');
    }
  };
  
  const formatDate = (date: string | Date | null) => {
    if (!date) return t.crm.notSpecified;
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU');
  };
  
  const formatTimeAgo = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const daysText = days === 1 
        ? t.crm.timeAgo.day 
        : (days < 5 ? t.crm.timeAgo.days2to4 : t.crm.timeAgo.days);
      return `${days} ${daysText}`;
    }
    if (hours > 0) {
      const hoursText = hours === 1 
        ? t.crm.timeAgo.hour 
        : (hours < 5 ? t.crm.timeAgo.hours2to4 : t.crm.timeAgo.hours);
      return `${hours} ${hoursText}`;
    }
    return t.crm.justNow;
  };
  
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      'new': 'bg-blue-500/20 text-blue-400',
      'contacted': 'bg-yellow-500/20 text-yellow-400',
      // 'Активный': 'bg-green-500/20 text-green-400', // Removed - using translation
      'qualified': 'bg-purple-500/20 text-purple-400',
      'converted': 'bg-green-500/20 text-green-400',
      'lost': 'bg-red-500/20 text-red-400',
    };
    return statusMap[status] || 'bg-gray-500/20 text-gray-400';
  };
  
  const getPriorityColor = (priority: string) => {
    const priorityMap: Record<string, string> = {
      'low': 'bg-blue-500/20 text-blue-400',
      'medium': 'bg-yellow-500/20 text-yellow-400',
      'high': 'bg-orange-500/20 text-orange-400',
      'urgent': 'bg-red-500/20 text-red-400',
    };
    return priorityMap[priority] || 'bg-gray-500/20 text-gray-400';
  };
  
  // Функция сортировки
  const sortData = <T extends any>(data: T[], sortBy: string, order: 'asc' | 'desc'): T[] => {
    const sorted = [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = (a.name || a.title || '').toLowerCase();
          bVal = (b.name || b.title || '').toLowerCase();
          break;
        case 'date':
          aVal = new Date(a.createdAt || a.lastAction || 0).getTime();
          bVal = new Date(b.createdAt || b.lastAction || 0).getTime();
          break;
        case 'amount':
          aVal = parseFloat(a.amount || 0);
          bVal = parseFloat(b.amount || 0);
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };
  
  // Фильтрация и сортировка данных
  const filteredLeads = sortData(
    leads.filter(lead => {
      const matchesSearch = lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    }),
    sortBy,
    sortOrder
  );
  
  const filteredDeals = sortData(
    deals.filter(deal => {
      const matchesSearch = deal.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.title?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || deal.stage === statusFilter;
      return matchesSearch && matchesStatus;
    }),
    sortBy,
    sortOrder
  );
  
  const filteredTasks = sortData(
    tasks.filter(task => {
      const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    }),
    sortBy,
    sortOrder
  );
  
  // Пагинация
  const totalPages = Math.ceil(
    (activeTab === 'leads' ? filteredLeads.length :
     activeTab === 'deals' ? filteredDeals.length :
     filteredTasks.length) / itemsPerPage
  );
  
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const paginatedDeals = filteredDeals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Просроченные задачи
  const overdueTasks = tasks.filter(task => 
    task.dueDate && 
    new Date(task.dueDate) < new Date() && 
    task.status !== 'done' && 
    task.status !== 'cancelled'
  );
  
  // Сброс страницы при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, sortBy, sortOrder]);

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
            <h1 className="text-white">{t.crm.title}</h1>
            {/* Desktop menu */}
            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              {/* Кнопка экспорта в заголовке - видна на всех устройствах */}
              {activeTab !== 'chat' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg"
                      title={t.crm.exportData}
                    >
                      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm font-medium hidden sm:inline">{t.crm.export}</span>
                      <ChevronDown className="w-3 h-3 hidden sm:inline" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 z-50">
                    {activeTab === 'leads' && (
                      <>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportLeadsCSV, 'info');
                              await exportAPI.exportLeads('csv', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.success.leadsExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {t.crm.exportCSV}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.exporting, 'info');
                              await exportAPI.exportLeads('xlsx', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.exportSuccess, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.exportError, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          {t.crm.exportExcel}
                        </DropdownMenuItem>
                      </>
                    )}
                    {activeTab === 'deals' && (
                      <>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportDealsCSV, 'info');
                              await exportAPI.exportDeals('csv', {
                                stage: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.success.dealsExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {t.crm.exportCSV}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportDealsExcel, 'info');
                              await exportAPI.exportDeals('xlsx', {
                                stage: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.success.dealsExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          {t.crm.exportExcel}
                        </DropdownMenuItem>
                      </>
                    )}
                    {activeTab === 'tasks' && (
                      <>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportTasksCSV, 'info');
                              await exportAPI.exportTasks('csv', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                                priority: priorityFilter !== 'all' ? priorityFilter : undefined,
                              });
                              showToast(t.crm.success.tasksExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {t.crm.exportCSV}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportTasksExcel, 'info');
                              await exportAPI.exportTasks('xlsx', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                                priority: priorityFilter !== 'all' ? priorityFilter : undefined,
                              });
                              showToast(t.crm.success.tasksExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          {t.crm.exportExcel}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t.crm.support}</span>
              </button>
              {activeTab === 'leads' && (
                <div className="hidden md:flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">{t.crm.chatMessages.totalLeads}</p>
                    <p className="text-white font-semibold">{stats.totalLeads}</p>
                  </div>
                </div>
              )}
              {activeTab === 'deals' && (
                <div className="hidden md:flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Активных сделок</p>
                    <p className="text-white font-semibold">{stats.activeDeals}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Общая сумма</p>
                    <p className="text-white font-semibold flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {stats.totalAmount.toLocaleString()} KZT
                    </p>
                  </div>
                </div>
              )}
              {activeTab === 'tasks' && (
                <div className="hidden md:flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Активных задач</p>
                    <p className="text-white font-semibold">{stats.pendingTasks}</p>
                  </div>
                  {overdueTasks.length > 0 && (
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">Просрочено</p>
                      <p className="text-red-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {overdueTasks.length}
                      </p>
                    </div>
                  )}
                </div>
              )}
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
                    {/* Кнопка экспорта в мобильном меню */}
                    {activeTab === 'leads' && (
                      <div className="border-b border-slate-700">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3">
                              <Download className="w-5 h-5" />
                              <span>Экспорт лидов</span>
                              <ChevronDown className="w-4 h-4 ml-auto" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 z-50">
                            <DropdownMenuItem
                              onClick={async () => {
                                setMobileMenuOpen(false);
                                try {
                                  showToast(t.crm.success.exportLeadsCSV, 'info');
                                  await exportAPI.exportLeads('csv', {
                                    status: statusFilter !== 'all' ? statusFilter : undefined,
                                  });
                                  showToast(t.crm.success.leadsExported, 'success');
                                } catch (error: any) {
                                  showToast(error.message || t.crm.errors.export, 'error');
                                }
                              }}
                              className="cursor-pointer text-white hover:bg-slate-700"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              {t.crm.exportCSV}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                setMobileMenuOpen(false);
                                try {
                                  showToast(t.crm.success.exportLeadsExcel, 'info');
                                  await exportAPI.exportLeads('xlsx', {
                                    status: statusFilter !== 'all' ? statusFilter : undefined,
                                  });
                                  showToast(t.crm.success.leadsExported, 'success');
                                } catch (error: any) {
                                  showToast(error.message || t.crm.errors.export, 'error');
                                }
                              }}
                              className="cursor-pointer text-white hover:bg-slate-700"
                            >
                              <FileSpreadsheet className="w-4 h-4 mr-2" />
                              {t.crm.exportExcel}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>{t.crm.support}</span>
                    </button>
                    {activeTab === 'leads' && (
                      <div className="px-4 py-3 border-t border-slate-700">
                        <p className="text-gray-400 text-xs mb-1">Всего лидов</p>
                        <p className="text-white font-semibold">{stats.totalLeads}</p>
                      </div>
                    )}
                    {activeTab === 'deals' && (
                      <div className="px-4 py-3 border-t border-slate-700 space-y-2">
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Активных сделок</p>
                          <p className="text-white font-semibold">{stats.activeDeals}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Общая сумма</p>
                          <p className="text-white font-semibold flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {stats.totalAmount.toLocaleString()} KZT
                          </p>
                        </div>
                      </div>
                    )}
                    {activeTab === 'tasks' && (
                      <div className="px-4 py-3 border-t border-slate-700 space-y-2">
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Активных задач</p>
                          <p className="text-white font-semibold">{stats.pendingTasks}</p>
                        </div>
                        {overdueTasks.length > 0 && (
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Просрочено</p>
                            <p className="text-red-400 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {overdueTasks.length}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-colors relative flex-shrink-0 text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black'
                  : 'bg-slate-800/50 border border-slate-700 text-gray-400 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-black/20' : 'bg-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        {activeTab !== 'chat' && (
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="relative w-full sm:max-w-md sm:flex-1">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.crm.search}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-colors text-sm sm:text-base"
                />
              </div>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-initial min-w-0 ${
                    showFilters || statusFilter !== 'all' || priorityFilter !== 'all'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black'
                      : 'bg-slate-800/50 border border-slate-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <Filter className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="text-xs sm:text-sm whitespace-nowrap">{t.crm.filters}</span>
                </button>
                <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                  <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0 hidden sm:inline">{t.crm.sortBy}</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-yellow-500/50 flex-1 sm:flex-initial min-w-0"
                  >
                    <option value="date">{t.crm.sortByDate}</option>
                    <option value="name">{t.crm.sortByName}</option>
                    {activeTab === 'deals' && <option value="amount">{t.crm.sortByAmount}</option>}
                    <option value="status">{t.crm.sortByStatus}</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-2 sm:px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-gray-400 hover:text-white transition-colors flex-shrink-0"
                    title={sortOrder === 'asc' ? t.crm.sortAscending : t.crm.sortDescending}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>
                {activeTab === 'leads' && (
                  <>
                    <button
                      onClick={() => setShowAddLeadModal(true)}
                      className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
                    >
                      <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t.crm.addLead}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-lg flex-shrink-0"
                          title={t.crm.exportData}
                        >
                          <Download className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-medium">Экспорт</span>
                          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 z-50">
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportLeadsCSV, 'info');
                              await exportAPI.exportLeads('csv', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.success.leadsExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {t.crm.exportCSV}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportLeadsExcel, 'info');
                              await exportAPI.exportLeads('xlsx', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.success.leadsExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          {t.crm.exportExcel}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                {activeTab === 'deals' && (
                  <>
                    <button
                      onClick={() => setShowAddDealModal(true)}
                      className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto flex-1 sm:flex-initial"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t.crm.createDeal}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-lg"
                          title={t.crm.exportData}
                        >
                          <Download className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-medium">Экспорт</span>
                          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 z-50">
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportDealsCSV, 'info');
                              await exportAPI.exportDeals('csv', {
                                stage: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.success.dealsExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {t.crm.exportCSV}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportDealsExcel, 'info');
                              await exportAPI.exportDeals('xlsx', {
                                stage: statusFilter !== 'all' ? statusFilter : undefined,
                              });
                              showToast(t.crm.success.dealsExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          {t.crm.exportExcel}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                {activeTab === 'tasks' && (
                  <>
                    <button
                      onClick={() => setShowAddTaskModal(true)}
                      className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto flex-1 sm:flex-initial"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t.crm.createTask}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-lg"
                          title={t.crm.exportData}
                        >
                          <Download className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-medium">Экспорт</span>
                          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 z-50">
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportTasksCSV, 'info');
                              await exportAPI.exportTasks('csv', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                                priority: priorityFilter !== 'all' ? priorityFilter : undefined,
                              });
                              showToast(t.crm.success.tasksExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {t.crm.exportCSV}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              showToast(t.crm.success.exportTasksExcel, 'info');
                              await exportAPI.exportTasks('xlsx', {
                                status: statusFilter !== 'all' ? statusFilter : undefined,
                                priority: priorityFilter !== 'all' ? priorityFilter : undefined,
                              });
                              showToast(t.crm.success.tasksExported, 'success');
                            } catch (error: any) {
                              showToast(error.message || t.crm.errors.export, 'error');
                            }
                          }}
                          className="cursor-pointer text-white hover:bg-slate-700"
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          {t.crm.exportExcel}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
            
            {/* Filters Panel */}
            {showFilters && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                {activeTab === 'leads' && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{t.crm.filterLabels.status}</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                    >
                      <option value="all">{t.crm.status.all}</option>
                      <option value="new">{t.crm.status.new}</option>
                      <option value="contacted">{t.crm.status.contact}</option>
                      <option value="qualified">{t.crm.status.qualified}</option>
                      <option value="converted">{t.crm.status.converted}</option>
                      <option value="lost">{t.crm.status.lost}</option>
                    </select>
                  </div>
                )}
                {activeTab === 'tasks' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{t.crm.filterLabels.status}</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                      >
                        <option value="all">{t.crm.status.all}</option>
                        <option value="todo">{t.crm.taskStatus.todo}</option>
                        <option value="in_progress">{t.crm.taskStatus.inProgress}</option>
                        <option value="done">{t.crm.taskStatus.done}</option>
                        <option value="cancelled">{t.crm.taskStatus.cancelled}</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{t.crm.filterLabels.priority}</span>
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                      >
                        <option value="all">{t.crm.status.all}</option>
                        <option value="low">{t.crm.priority.low}</option>
                        <option value="medium">{t.crm.priority.medium}</option>
                        <option value="high">{t.crm.priority.high}</option>
                        <option value="urgent">{t.crm.priority.urgent}</option>
                      </select>
                    </div>
                  </>
                )}
                {(statusFilter !== 'all' || priorityFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setPriorityFilter('all');
                    }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Сбросить
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content */}

        {activeTab === 'chat' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden h-[400px] sm:h-[500px] md:h-[600px] flex flex-col">
            {!selectedLead ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>{t.crm.chatMessages.selectLead}</p>
                  <button
                    onClick={() => setActiveTab('leads')}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow"
                  >
                    Перейти к лидам
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="border-b border-slate-700 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white">
                      {(() => {
                        const lead = leads.find(l => l.id === selectedLead);
                        return lead?.name?.[0]?.toUpperCase() || 'Л';
                      })()}
                    </div>
                    <div>
                      <h3 className="text-white">
                        {(() => {
                          const lead = leads.find(l => l.id === selectedLead);
                          return lead?.name || t.crm.placeholders.lead;
                        })()}
                      </h3>
                      <p className="text-gray-400">онлайн</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t.crm.chatMessages.noMessages}</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm px-4 py-3 rounded-2xl ${
                      msg.sender === 'me'
                        ? msg.isAI
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                          : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    {msg.isAI && msg.sender === 'me' && (
                      <div className="text-xs mb-1 opacity-80">AI Ответ</div>
                    )}
                    <p>{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'opacity-80' : 'text-gray-400'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-700 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={t.crm.chatMessages.messagePlaceholder}
                  className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSendingMessage || !message.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSendingMessage ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {isSendingMessage ? t.crm.chatMessages.sending : t.crm.chatMessages.send}
                </button>
              </div>
              <p className="text-gray-500 mt-2">
                {t.crm.chatMessages.aiDescription}
              </p>
            </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'leads' && (
          <div>
            {loading ? (
              <LeadListSkeleton count={5} />
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <UserPlus className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>{t.crm.noLeads}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setSelectedLead(lead.id);
                      setShowLeadDetailsModal(true);
                    }}
                    className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.02] hover:border-yellow-500/50"
                  >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center text-black">
                            {lead.name?.[0]?.toUpperCase() || 'Л'}
                          </div>
                          <div>
                            <h3 className="text-white mb-1">{lead.name}</h3>
                            <p className="text-gray-400">{lead.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingItem(lead);
                              setShowEditModal(true);
                            }}
                            className="text-gray-400 hover:text-yellow-400"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick('lead', lead.id);
                            }}
                            disabled={isDeleting === String(lead.id)}
                            className="text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDeleting === String(lead.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-500 mb-1">{t.crm.phone}</p>
                          <p className="text-gray-300">{lead.phone}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">Статус</p>
                          <select
                            value={lead.status}
                            onChange={(e) => handleQuickStatusChange('lead', String(lead.id), e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`px-3 py-1 rounded-lg text-sm border-0 cursor-pointer ${getStatusColor(lead.status)}`}
                          >
                            <option value="new">{t.crm.status.new}</option>
                            <option value="contacted">{t.crm.status.contact}</option>
                            <option value="qualified">{t.crm.status.qualified}</option>
                            <option value="converted">{t.crm.status.converted}</option>
                            <option value="lost">{t.crm.status.lost}</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">{t.crm.stage}</p>
                          <p className="text-gray-300">{lead.stage || t.crm.placeholders.firstContact}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">{t.crm.lastAction}</p>
                          <p className="text-gray-300">{lead.lastAction ? formatTimeAgo(lead.lastAction) : t.crm.none}</p>
                        </div>
                        {lead.campaign && (
                          <div className="col-span-2">
                            <p className="text-gray-500 mb-1">{t.crm.campaign}</p>
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-yellow-400" />
                              <p className="text-gray-300">{lead.campaign.name}</p>
                              <span className={`px-2 py-1 rounded-lg text-xs ${
                                lead.campaign.status === t.adminPanel.status.active ? 'bg-green-500/20 text-green-400' :
                                lead.campaign.status === t.adminPanel.status.onReview ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {lead.campaign.status}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            {/* Пагинация для лидов */}
            {filteredLeads.length > itemsPerPage && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  Назад
                </button>
                <span className="text-gray-400">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'deals' && (
          <div>
            {loading ? (
              <DealListSkeleton count={5} />
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>{t.crm.noDeals}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedDeals.map((deal) => (
                  <div
                    key={deal.id}
                    onClick={() => {
                      setSelectedDeal(deal.id);
                      setShowDealDetailsModal(true);
                    }}
                    className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/50 transition-all cursor-pointer hover:scale-[1.02]"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-white mb-2">{deal.name || deal.title}</h3>
                        {deal.lead && (
                          <p className="text-gray-400 text-sm">{deal.lead.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(deal);
                            setShowEditModal(true);
                          }}
                          className="text-gray-400 hover:text-yellow-400"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick('deal', deal.id);
                          }}
                          disabled={isDeleting === String(deal.id)}
                          className="text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting === String(deal.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Сумма</span>
                        <span className="text-white font-semibold flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {deal.amount || 0} {deal.currency || 'KZT'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{t.crm.stage}</span>
                        <span className="text-gray-300">{deal.stage || t.crm.status.new}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Вероятность</span>
                        <span className="text-gray-300">{deal.probability || 0}%</span>
                      </div>
                      {deal.expectedCloseDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Дата закрытия</span>
                          <span className="text-gray-300 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(deal.expectedCloseDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Пагинация для сделок */}
            {filteredDeals.length > itemsPerPage && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  Назад
                </button>
                <span className="text-gray-400">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div>
            {loading ? (
              <TaskListSkeleton count={5} />
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>{t.crm.noTasks}</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-4">
                  {/* Предупреждение о просроченных задачах */}
                  {overdueTasks.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      <div>
                        <p className="text-red-400 font-semibold">Просрочено задач: {overdueTasks.length}</p>
                        <p className="text-gray-400 text-sm">Некоторые задачи требуют внимания</p>
                      </div>
                    </div>
                  )}
                  <SortableContext
                    items={paginatedTasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {paginatedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onTaskClick={(taskId) => {
                          setSelectedTask(taskId);
                          setShowTaskDetailsModal(true);
                        }}
                        onEdit={(task) => {
                          setEditingItem(task);
                          setShowEditModal(true);
                        }}
                        onDelete={(taskId) => handleDeleteClick('task', taskId)}
                        isDeleting={isDeleting}
                        getPriorityColor={getPriorityColor}
                        getStatusColor={getStatusColor}
                        handleQuickStatusChange={handleQuickStatusChange}
                        formatDate={formatDate}
                        t={t}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            )}
            
            {/* Пагинация для задач */}
            {filteredTasks.length > itemsPerPage && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  Назад
                </button>
                <span className="text-gray-400">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white">{t.crm.addLead}</h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-gray-500 mb-2">Имя *</p>
                <input
                  type="text"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder={t.crm.enterName}
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">{t.crm.phone} *</p>
                <input
                  type="text"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder="+7 777 123 4567"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">{t.crm.email} *</p>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">{t.crm.stage}</p>
                <input
                  type="text"
                  value={newLead.stage}
                  onChange={(e) => setNewLead({ ...newLead, stage: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder={t.crm.placeholders.firstContact}
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">{t.crm.source}</p>
                <input
                  type="text"
                  value={newLead.source}
                  onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder={t.crm.leadSourcePlaceholder}
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Заметки</p>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                  rows={3}
                  placeholder={t.crm.placeholders.additionalInfo}
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">{t.crm.campaign}</p>
                <select
                  value={newLead.campaignId || ''}
                  onChange={(e) => setNewLead({ ...newLead, campaignId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="">Не выбрано</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleAddLead}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow mt-6"
            >
              {t.crm.addLead}
            </button>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      {showAddDealModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white">{t.crm.createDeal}</h3>
              <button
                onClick={() => setShowAddDealModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-gray-500 mb-2">Название *</p>
                <input
                  type="text"
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder={t.crm.placeholders.dealName}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 mb-2">Сумма</p>
                  <input
                    type="number"
                    value={newDeal.amount}
                    onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                    placeholder="0"
                  />
                </div>
                <div>
                  <p className="text-gray-500 mb-2">Валюта</p>
                  <select
                    value={newDeal.currency}
                    onChange={(e) => setNewDeal({ ...newDeal, currency: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                  >
                    <option value="KZT">KZT</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-2">Вероятность (%)</p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newDeal.probability}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    const clampedValue = Math.max(0, Math.min(100, value)); // Ограничиваем от 0 до 100
                    setNewDeal({ ...newDeal, probability: clampedValue });
                  }}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">{t.crm.relatedLead}</p>
                <select
                  value={newDeal.leadId}
                  onChange={(e) => setNewDeal({ ...newDeal, leadId: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="">Не выбран</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>{lead.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-gray-500 mb-2">Дата закрытия</p>
                <input
                  type="date"
                  value={newDeal.expectedCloseDate}
                  onChange={(e) => setNewDeal({ ...newDeal, expectedCloseDate: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Заметки</p>
                <textarea
                  value={newDeal.notes}
                  onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                  rows={3}
                  placeholder={t.crm.placeholders.additionalInfo}
                />
              </div>
            </div>

            <button
              onClick={handleAddDeal}
              disabled={isSaving}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.crm.creating}
                </>
              ) : (
                t.crm.createDeal
              )}
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white">
                {editingItem.name || editingItem.title ? t.crm.edit : t.crm.editTask}
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingItem.name && (
              // Edit Lead
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 mb-2">Имя *</p>
                  <input
                    type="text"
                    defaultValue={editingItem.name}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-name"
                  />
                </div>
                <div>
                  <p className="text-gray-500 mb-2">{t.crm.phone} *</p>
                  <input
                    type="text"
                    defaultValue={editingItem.phone}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-phone"
                  />
                </div>
                <div>
                  <p className="text-gray-500 mb-2">{t.crm.email} *</p>
                  <input
                    type="email"
                    defaultValue={editingItem.email}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-email"
                  />
                </div>
                <div>
                  <p className="text-gray-500 mb-2">Статус</p>
                  <select
                    defaultValue={editingItem.status}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-status"
                  >
                    <option value="new">{t.crm.placeholders.new}</option>
                    <option value="contacted">Контакт</option>
                    <option value="qualified">Квалифицирован</option>
                    <option value="converted">Конвертирован</option>
                    <option value="lost">Потерян</option>
                  </select>
                </div>
                <div>
                  <p className="text-gray-500 mb-2">{t.crm.stage}</p>
                  <input
                    type="text"
                    defaultValue={editingItem.stage}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-stage"
                  />
                </div>
                <div>
                  <p className="text-gray-500 mb-2">{t.crm.campaign}</p>
                  <select
                    defaultValue={editingItem.campaignId || ''}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-campaignId"
                  >
                    <option value="">Не выбрано</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    const name = (document.getElementById('edit-lead-name') as HTMLInputElement)?.value;
                    const phone = (document.getElementById('edit-lead-phone') as HTMLInputElement)?.value;
                    const email = (document.getElementById('edit-lead-email') as HTMLInputElement)?.value;
                    const status = (document.getElementById('edit-lead-status') as HTMLSelectElement)?.value;
                    const stage = (document.getElementById('edit-lead-stage') as HTMLInputElement)?.value;
                    const campaignId = (document.getElementById('edit-lead-campaignId') as HTMLSelectElement)?.value;
                    handleUpdateLead(editingItem.id, { name, phone, email, status, stage, campaignId: campaignId ? parseInt(campaignId) : null });
                  }}
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow mt-6"
                >
                  Сохранить изменения
                </button>
              </div>
            )}

            {editingItem.title && !editingItem.name && (
              // Edit Deal
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 mb-2">Название *</p>
                  <input
                    type="text"
                    defaultValue={editingItem.title || editingItem.name}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-deal-title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 mb-2">Сумма</p>
                    <input
                      type="number"
                      defaultValue={editingItem.amount}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                      id="edit-deal-amount"
                    />
                  </div>
                  <div>
                    <p className="text-gray-500 mb-2">Валюта</p>
                    <select
                      defaultValue={editingItem.currency}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                      id="edit-deal-currency"
                    >
                      <option value="KZT">KZT</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 mb-2">Вероятность (%)</p>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={editingItem.probability}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-deal-probability"
                  />
                </div>
                <button
                  onClick={() => {
                    const title = (document.getElementById('edit-deal-title') as HTMLInputElement)?.value;
                    const amount = parseFloat((document.getElementById('edit-deal-amount') as HTMLInputElement)?.value || '0');
                    const currency = (document.getElementById('edit-deal-currency') as HTMLSelectElement)?.value;
                    const probability = parseInt((document.getElementById('edit-deal-probability') as HTMLInputElement)?.value || '0');
                    handleUpdateDeal(editingItem.id, { title, amount, currency, probability });
                  }}
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow mt-6"
                >
                  Сохранить изменения
                </button>
              </div>
            )}

            {editingItem.title && editingItem.description !== undefined && (
              // Edit Task
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 mb-2">Название *</p>
                  <input
                    type="text"
                    defaultValue={editingItem.title}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-task-title"
                  />
                </div>
                <div>
                  <p className="text-gray-500 mb-2">Описание</p>
                  <textarea
                    defaultValue={editingItem.description}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 resize-none"
                    rows={3}
                    id="edit-task-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 mb-2">Приоритет</p>
                    <select
                      defaultValue={editingItem.priority}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                      id="edit-task-priority"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                      <option value="urgent">Срочный</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-2">Статус</p>
                    <select
                      defaultValue={editingItem.status}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                      id="edit-task-status"
                    >
                      <option value="todo">{t.crm.taskStatus.todo}</option>
                      <option value="in_progress">{t.crm.taskStatus.inProgress}</option>
                      <option value="done">{t.crm.taskStatus.done}</option>
                      <option value="cancelled">{t.crm.taskStatus.cancelled}</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const title = (document.getElementById('edit-task-title') as HTMLInputElement)?.value;
                    const description = (document.getElementById('edit-task-description') as HTMLTextAreaElement)?.value;
                    const priority = (document.getElementById('edit-task-priority') as HTMLSelectElement)?.value;
                    const status = (document.getElementById('edit-task-status') as HTMLSelectElement)?.value;
                    handleUpdateTask(editingItem.id, { title, description, priority, status });
                  }}
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow mt-6"
                >
                  Сохранить изменения
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      {showLeadDetailsModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-xl">Детали лида</h3>
              <button
                onClick={() => {
                  setShowLeadDetailsModal(false);
                  setSelectedLead(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const lead = leads.find(l => l.id === selectedLead);
              if (!lead) return null;
              return (
                <div className="space-y-6">
                  {/* Основная информация */}
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center text-black text-2xl font-bold">
                        {lead.name?.[0]?.toUpperCase() || 'Л'}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-lg mb-1">{lead.name}</h4>
                        <p className="text-gray-400">{lead.email}</p>
                      </div>
                    </div>

                    {lead.campaign && (
                      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <p className="text-gray-500 text-sm mb-2">{t.crm.campaign}</p>
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-yellow-400" />
                          <div className="flex-1">
                            <p className="text-white font-medium">{lead.campaign.name}</p>
                            <span className={`inline-block px-2 py-1 rounded-lg text-xs mt-1 ${
                              lead.campaign.status === t.adminPanel.status.active ? 'bg-green-500/20 text-green-400' :
                              lead.campaign.status === t.adminPanel.status.onReview ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {lead.campaign.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">{t.crm.phone}</p>
                        <p className="text-white">{lead.phone}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Статус</p>
                        <select
                          value={lead.status}
                          onChange={(e) => {
                            handleQuickStatusChange('lead', String(lead.id), e.target.value);
                            loadData(false);
                          }}
                          className={`px-3 py-1 rounded-lg text-sm border-0 cursor-pointer ${getStatusColor(lead.status)}`}
                        >
                          <option value="new">{t.crm.placeholders.new}</option>
                          <option value="contacted">Контакт</option>
                          <option value="qualified">Квалифицирован</option>
                          <option value="converted">Конвертирован</option>
                          <option value="lost">Потерян</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Этап</p>
                        <p className="text-white">{lead.stage || t.crm.defaultStage}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Последнее действие</p>
                        <p className="text-white">{lead.lastAction ? formatTimeAgo(lead.lastAction) : t.crm.placeholders.no}</p>
                      </div>
                    </div>
                  </div>

                  {/* Заметки */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 font-medium">Заметки</p>
                      <button
                        onClick={() => {
                          handleSaveNotes(lead.id);
                          showToast(t.crm.success.notesSaved, 'success');
                        }}
                        className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1 text-sm transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        Сохранить
                      </button>
                    </div>
                    <textarea
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                      rows={6}
                      placeholder={t.crm.placeholders.addNote}
                      value={leadNotes[lead.id] || lead.notes || ''}
                      onChange={(e) => setLeadNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                    ></textarea>
                  </div>

                  {/* Источник */}
                  <div>
                    <p className="text-gray-400 font-medium mb-2">{t.crm.source}</p>
                    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                      <p className="text-white">{lead.source || t.crm.placeholders.notSpecified}</p>
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="flex gap-3 pt-4 border-t border-slate-700">
                    <button
                      onClick={() => {
                        setEditingItem(lead);
                        setShowEditModal(true);
                        setShowLeadDetailsModal(false);
                      }}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-5 h-5" />
                      {t.crm.edit}
                    </button>
                    <button
                      onClick={() => {
                        setShowLeadDetailsModal(false);
                        setActiveTab('chat');
                      }}
                      className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-5 h-5" />
                      Написать сообщение
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Deal Details Modal */}
      {showDealDetailsModal && selectedDeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-xl">Детали сделки</h3>
              <button
                onClick={() => {
                  setShowDealDetailsModal(false);
                  setSelectedDeal(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const deal = deals.find(d => d.id === selectedDeal);
              if (!deal) return null;
              return (
                <div className="space-y-6">
                  {/* Основная информация */}
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                        <Target className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-lg mb-1">{deal.name || deal.title}</h4>
                        {deal.clientName && (
                          <p className="text-gray-400">Клиент: {deal.clientName}</p>
                        )}
                        {deal.lead && (
                          <p className="text-gray-400">Лид: {deal.lead.name}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Сумма</p>
                        <p className="text-white font-semibold flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {deal.amount || 0} {deal.currency || 'KZT'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Этап</p>
                        <p className="text-white">{deal.stage || t.crm.placeholders.new}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Вероятность</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-yellow-400 to-amber-500 h-2 rounded-full"
                              style={{ width: `${deal.probability || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-white text-sm">{deal.probability || 0}%</span>
                        </div>
                      </div>
                      {deal.expectedCloseDate && (
                        <div>
                          <p className="text-gray-500 text-sm mb-1">Дата закрытия</p>
                          <p className="text-white flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(deal.expectedCloseDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Заметки */}
                  {deal.notes && (
                    <div>
                      <p className="text-gray-400 font-medium mb-2">Заметки</p>
                      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                        <p className="text-white whitespace-pre-wrap">{deal.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Дополнительная информация */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 font-medium mb-2">Дата создания</p>
                      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                        <p className="text-white">{formatDate(deal.createdAt)}</p>
                      </div>
                    </div>
                    {deal.updatedAt && (
                      <div>
                        <p className="text-gray-400 font-medium mb-2">Последнее обновление</p>
                        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                          <p className="text-white">{formatDate(deal.updatedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Действия */}
                  <div className="flex gap-3 pt-4 border-t border-slate-700">
                    <button
                      onClick={() => {
                        setEditingItem(deal);
                        setShowEditModal(true);
                        setShowDealDetailsModal(false);
                      }}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-5 h-5" />
                      {t.crm.edit}
                    </button>
                    <button
                      onClick={() => {
                        setShowDealDetailsModal(false);
                        handleDeleteClick('deal', deal.id);
                      }}
                      className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {showTaskDetailsModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-xl">Детали задачи</h3>
              <button
                onClick={() => {
                  setShowTaskDetailsModal(false);
                  setSelectedTask(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const task = tasks.find(t => t.id === selectedTask);
              if (!task) return null;
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && task.status !== 'cancelled';
              return (
                <div className="space-y-6">
                  {/* Основная информация */}
                  <div className="bg-slate-900/50 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${
                        task.priority === 'urgent' ? 'from-red-500 to-red-600' :
                        task.priority === 'high' ? 'from-orange-500 to-orange-600' :
                        task.priority === 'medium' ? 'from-yellow-400 to-amber-500' :
                        'from-blue-500 to-blue-600'
                      } flex items-center justify-center text-white`}>
                        <CheckSquare className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-lg mb-2">{task.title}</h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-3 py-1 rounded-lg text-sm ${getPriorityColor(task.priority)}`}>
                            {task.priority === 'low' ? t.crm.priority.low : task.priority === 'medium' ? t.crm.priority.medium : task.priority === 'high' ? t.crm.priority.high : task.priority === 'urgent' ? t.crm.priority.urgent : task.priority}
                          </span>
                          <select
                            value={task.status}
                            onChange={(e) => {
                              handleQuickStatusChange('task', task.id, e.target.value);
                              loadData(false);
                            }}
                            className={`px-3 py-1 rounded-lg text-sm border-0 cursor-pointer ${getStatusColor(task.status)}`}
                          >
                            <option value="todo">{t.crm.taskStatus.todo}</option>
                            <option value="in_progress">{t.crm.taskStatus.inProgress}</option>
                            <option value="done">{t.crm.taskStatus.done}</option>
                            <option value="cancelled">{t.crm.taskStatus.cancelled}</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {task.description && (
                        <div className="col-span-2">
                          <p className="text-gray-500 text-sm mb-1">Описание</p>
                          <p className="text-white">{task.description}</p>
                        </div>
                      )}
                      {task.dueDate && (
                        <div>
                          <p className="text-gray-500 text-sm mb-1">Срок выполнения</p>
                          <p className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                            <Calendar className="w-4 h-4" />
                            {formatDate(task.dueDate)}
                            {isOverdue && <AlertCircle className="w-4 h-4" />}
                          </p>
                          {isOverdue && (
                            <p className="text-red-400 text-xs mt-1">Просрочено</p>
                          )}
                        </div>
                      )}
                      {task.lead && (
                        <div>
                          <p className="text-gray-500 text-sm mb-1">{t.crm.relatedToLead}</p>
                          <p className="text-white">{task.lead.name}</p>
                        </div>
                      )}
                      {task.assignedTo && (
                        <div>
                          <p className="text-gray-500 text-sm mb-1">Назначено</p>
                          <p className="text-white">{task.assignedTo}</p>
                        </div>
                      )}
                    </div>

                    {task.tags && task.tags.length > 0 && (
                      <div className="mt-4">
                        <p className="text-gray-500 text-sm mb-2">Теги</p>
                        <div className="flex flex-wrap gap-2">
                          {task.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-slate-700 text-gray-300 rounded-lg text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Дополнительная информация */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 font-medium mb-2">Дата создания</p>
                      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                        <p className="text-white">{formatDate(task.createdAt)}</p>
                      </div>
                    </div>
                    {task.updatedAt && (
                      <div>
                        <p className="text-gray-400 font-medium mb-2">Последнее обновление</p>
                        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                          <p className="text-white">{formatDate(task.updatedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Действия */}
                  <div className="flex gap-3 pt-4 border-t border-slate-700">
                    <button
                      onClick={() => {
                        setEditingItem(task);
                        setShowEditModal(true);
                        setShowTaskDetailsModal(false);
                      }}
                      className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-5 h-5" />
                      {t.crm.edit}
                    </button>
                    <button
                      onClick={() => {
                        setShowTaskDetailsModal(false);
                        handleDeleteClick('task', task.id);
                      }}
                      className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white">{t.crm.createTask}</h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-gray-500 mb-2">Название *</p>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder={t.crm.placeholders.taskName}
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Описание</p>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                  rows={3}
                  placeholder={t.crm.placeholders.taskDescription}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 mb-2">Приоритет</p>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                    <option value="urgent">Срочный</option>
                  </select>
                </div>
                <div>
                  <p className="text-gray-500 mb-2">Статус</p>
                  <select
                    value={newTask.status}
                    onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                  >
                    <option value="todo">{t.crm.taskStatus.todo}</option>
                    <option value="in_progress">{t.crm.taskStatus.inProgress}</option>
                    <option value="done">{t.crm.taskStatus.done}</option>
                    <option value="cancelled">{t.crm.taskStatus.cancelled}</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-2">{t.crm.relatedLead}</p>
                <select
                  value={newTask.leadId}
                  onChange={(e) => setNewTask({ ...newTask, leadId: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="">Не выбран</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>{lead.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-gray-500 mb-2">Срок выполнения</p>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>
            </div>

            <button
              onClick={handleAddTask}
              disabled={isSaving}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.crm.creating}
                </>
              ) : (
                t.crm.createTask
              )}
            </button>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDelete}
        title={
          itemToDelete?.type === 'lead'
            ? t.crm.deleteConfirmTitles.lead
            : itemToDelete?.type === 'deal'
            ? t.crm.deleteConfirmTitles.deal
            : t.crm.deleteConfirmTitles.task
        }
        description={
          itemToDelete
            ? t.crm.deleteConfirm.message.replace('{name}', itemToDelete.name || '')
            : t.crm.deleteConfirm.messageGeneric
        }
        confirmText={t.common.delete}
        cancelText={t.crm.cancel}
        variant="destructive"
        isLoading={isDeleting !== null}
      />
    </div>
  );
}
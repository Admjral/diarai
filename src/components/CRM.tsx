import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Users, UserPlus, Target, CheckSquare, MessageSquare, Phone, Mail, MoreVertical, Send, Search, X, Edit, Trash2, Plus, Calendar, DollarSign, AlertCircle, Filter, Save, ArrowUpDown, TrendingUp, Clock, Loader2, Menu } from 'lucide-react';
import { Screen } from '../App';
import { leadsAPI, dealsAPI, tasksAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getCache, setCache, cacheKeys } from '../lib/cache';
import { LeadListSkeleton, DealListSkeleton, TaskListSkeleton } from './SkeletonLoaders';
import { ConfirmDialog } from './ConfirmDialog';
// Временно отключено до установки зависимостей: npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
// import {
//   DndContext,
//   closestCenter,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   DragEndEvent,
// } from '@dnd-kit/core';
// import {
//   arrayMove,
//   SortableContext,
//   sortableKeyboardCoordinates,
//   useSortable,
//   verticalListSortingStrategy,
// } from '@dnd-kit/sortable';
// import { CSS } from '@dnd-kit/utilities';

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

// Компонент для задачи (drag & drop временно отключен)
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
}: TaskItemProps) {
  return (
    <div
      onClick={() => onTaskClick(task.id)}
      className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/50 transition-all cursor-pointer hover:scale-[1.02]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-white">{task.title}</h3>
            <span className={`px-2 py-1 rounded-lg text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority === 'low' ? 'Низкий' : task.priority === 'medium' ? 'Средний' : task.priority === 'high' ? 'Высокий' : task.priority === 'urgent' ? 'Срочный' : task.priority}
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
              <option value="todo">Новая</option>
              <option value="in_progress">В работе</option>
              <option value="done">Выполнена</option>
              <option value="cancelled">Отменена</option>
            </select>
          </div>
          {task.description && (
            <p className="text-gray-400 text-sm mb-2">{task.description}</p>
          )}
          {task.lead && (
            <p className="text-gray-500 text-sm">Связано с: {task.lead.name}</p>
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
            <span>Срок: {formatDate(task.dueDate)}</span>
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
  
  // Sensors для drag & drop (временно отключено)
  // const sensors = useSensors(
  //   useSensor(PointerSensor),
  //   useSensor(KeyboardSensor, {
  //     coordinateGetter: sortableKeyboardCoordinates,
  //   })
  // );
  
  // Данные из API
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
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
    stage: 'Первый контакт',
    source: '',
    notes: '',
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
  
  // Загрузка данных при монтировании и смене вкладки
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab]);
  
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
      showToast(error.message || 'Ошибка загрузки данных', 'error');
      setLoading(false);
    }
  };

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
  
  // Загрузка сообщений для выбранного лида
  useEffect(() => {
    if (selectedLead && activeTab === 'chat') {
      loadMessages(selectedLead);
    }
  }, [selectedLead, activeTab]);

  const tabs = [
    { id: 'leads' as Tab, label: 'Лиды', icon: <UserPlus className="w-4 h-4" />, count: leads.length },
    { id: 'deals' as Tab, label: 'Сделки', icon: <Target className="w-4 h-4" />, count: deals.length },
    { id: 'tasks' as Tab, label: 'Задачи', icon: <CheckSquare className="w-4 h-4" />, count: tasks.length },
    { id: 'chat' as Tab, label: 'Чат', icon: <MessageSquare className="w-4 h-4" />, count: null },
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

  const loadMessages = async (leadId: string) => {
    try {
      const lead = await leadsAPI.getById(leadId);
      if (lead.messages) {
        const formattedMessages: Message[] = lead.messages.map((msg: any) => ({
          id: msg.id,
          sender: msg.sender === 'client' ? 'client' : 'me',
          text: msg.text,
          time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAI: msg.isAI || false,
        }));
        setMessages(formattedMessages);
      }
    } catch (error: any) {
      showToast(error.message || 'Ошибка загрузки сообщений', 'error');
    }
  };
  
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
      showToast('Сообщение отправлено', 'success');
    } catch (error: any) {
      showToast(error.message || 'Ошибка отправки сообщения', 'error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleAddLead = async () => {
    if (!newLead.name || !newLead.phone || !newLead.email) {
      showToast('Заполните все обязательные поля', 'error');
      return;
    }
    
    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newLead.email)) {
      showToast('Введите корректный email адрес', 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      await leadsAPI.create({
        ...newLead,
        // Устанавливаем lastAction при создании
        lastAction: new Date().toISOString()
      });
      setShowAddLeadModal(false);
      setNewLead({
        name: '',
        phone: '',
        email: '',
        status: 'new',
        stage: 'Первый контакт',
        source: '',
        notes: '',
      });
      showToast('Лид успешно добавлен', 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || 'Ошибка создания лида', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddDeal = async () => {
    // Строгая проверка поля name
    if (!newDeal.name || typeof newDeal.name !== 'string' || newDeal.name.trim() === '') {
      showToast('Заполните название сделки', 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      // Находим имя клиента из лида, если выбран лид
      const selectedLead = leads.find(l => l.id.toString() === newDeal.leadId);
      const clientName = selectedLead ? selectedLead.name : (newDeal.clientName || newDeal.name.trim());
      
      const dealData: any = {
        name: newDeal.name.trim(),
        amount: newDeal.amount ? parseFloat(newDeal.amount.toString()) : 0,
        currency: newDeal.currency || '₸',
        stage: newDeal.stage || 'lead',
        probability: newDeal.probability ? parseInt(newDeal.probability.toString(), 10) : 0,
        expectedCloseDate: newDeal.expectedCloseDate || null,
        notes: newDeal.notes || null,
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
      showToast('Сделка успешно создана', 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || 'Ошибка создания сделки', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddTask = async () => {
    if (!newTask.title) {
      showToast('Заполните название задачи', 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      await tasksAPI.create({
        title: newTask.title,
        description: newTask.description || null,
        status: newTask.status,
        priority: newTask.priority,
        dueDate: newTask.dueDate || null,
        clientId: newTask.leadId ? parseInt(newTask.leadId.toString(), 10) : null,
      });
      setShowAddTaskModal(false);
      setNewTask({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: '',
        leadId: '',
      });
      showToast('Задача успешно создана', 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || 'Ошибка создания задачи', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteClick = (type: 'lead' | 'deal' | 'task', id: string | number) => {
    const idString = String(id);
    let itemName = '';
    if (type === 'lead') {
      const lead = leads.find(l => String(l.id) === idString);
      itemName = lead?.name || 'этот лид';
    } else if (type === 'deal') {
      const deal = deals.find(d => String(d.id) === idString);
      itemName = deal?.name || 'эту сделку';
    } else if (type === 'task') {
      const task = tasks.find(t => String(t.id) === idString);
      itemName = task?.title || 'эту задачу';
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
        showToast('Лид удален', 'success');
        if (selectedLead === id || String(selectedLead) === id) setSelectedLead(null);
      } else if (type === 'deal') {
        await dealsAPI.delete(id);
        showToast('Сделка удалена', 'success');
      } else if (type === 'task') {
        await tasksAPI.delete(id);
        showToast('Задача удалена', 'success');
      }
      loadData(false); // Перезагружаем данные без кэша
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      showToast(error.message || 'Ошибка удаления', 'error');
    } finally {
      setIsDeleting(null);
    }
  };
  
  const handleUpdateLead = async (id: string, data: any) => {
    try {
      await leadsAPI.update(id, data);
      showToast('Лид обновлен', 'success');
      loadData(false); // Перезагружаем данные без кэша
      setShowEditModal(false);
      setEditingItem(null);
    } catch (error: any) {
      showToast(error.message || 'Ошибка обновления', 'error');
    }
  };
  
  const handleUpdateDeal = async (id: string, data: any) => {
    try {
      await dealsAPI.update(id, data);
      showToast('Сделка обновлена', 'success');
      loadData(false); // Перезагружаем данные без кэша
      setShowEditModal(false);
      setEditingItem(null);
    } catch (error: any) {
      showToast(error.message || 'Ошибка обновления', 'error');
    }
  };
  
  const handleUpdateTask = async (id: string, data: any) => {
    try {
      await tasksAPI.update(id, data);
      showToast('Задача обновлена', 'success');
      loadData(false); // Перезагружаем данные без кэша
      setShowEditModal(false);
      setEditingItem(null);
    } catch (error: any) {
      showToast(error.message || 'Ошибка обновления', 'error');
    }
  };

  // Обработчик завершения перетаскивания задачи (временно отключено)
  // const handleDragEnd = async (event: DragEndEvent) => {
  //   const { active, over } = event;

  //   if (over && active.id !== over.id) {
  //     const oldIndex = paginatedTasks.findIndex((task) => task.id === active.id);
  //     const newIndex = paginatedTasks.findIndex((task) => task.id === over.id);

  //     const newTasks = arrayMove(paginatedTasks, oldIndex, newIndex);
      
  //     // Обновляем локальное состояние для мгновенного отклика
  //     const allTasks = [...tasks];
  //     const startIndex = (currentPage - 1) * itemsPerPage;
  //     newTasks.forEach((task, index) => {
  //       const globalIndex = startIndex + index;
  //       if (allTasks[globalIndex]) {
  //         allTasks[globalIndex] = task;
  //       }
  //     });
      
  //     setTasks(allTasks);
  //     setCache(cacheKeys.tasks, allTasks);
      
  //     // Опционально: можно сохранить порядок на сервере
  //     // await tasksAPI.updateOrder(newTasks.map(t => t.id));
      
  //     showToast('Порядок задач обновлен', 'success');
  //   }
  // };
  
  const handleSaveNotes = async (leadId: string) => {
    try {
      await leadsAPI.update(leadId, { notes: leadNotes[leadId] || '' });
      showToast('Заметки сохранены', 'success');
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || 'Ошибка сохранения', 'error');
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
        showToast('Статус обновлен', 'success');
      } else if (type === 'task') {
        await tasksAPI.update(id, { status: newStatus });
        showToast('Статус обновлен', 'success');
      }
      loadData(false); // Перезагружаем данные без кэша
    } catch (error: any) {
      showToast(error.message || 'Ошибка обновления', 'error');
    }
  };
  
  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Не указано';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU');
  };
  
  const formatTimeAgo = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} ${days === 1 ? 'день' : 'дней'} назад`;
    if (hours > 0) return `${hours} ${hours === 1 ? 'час' : 'часов'} назад`;
    return 'Только что';
  };
  
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      'new': 'bg-blue-500/20 text-blue-400',
      'Новый': 'bg-blue-500/20 text-blue-400',
      'contacted': 'bg-yellow-500/20 text-yellow-400',
      'Активный': 'bg-green-500/20 text-green-400',
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
            <h1 className="text-white">CRM</h1>
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center gap-4 ml-auto">
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Техподдержка</span>
              </button>
              {activeTab === 'leads' && (
                <div className="hidden md:flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Всего лидов</p>
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
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Техподдержка</span>
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
                  placeholder="Поиск..."
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
                  <span className="text-xs sm:text-sm whitespace-nowrap">Фильтры</span>
                </button>
                <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                  <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0 hidden sm:inline">Сортировка:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-yellow-500/50 flex-1 sm:flex-initial min-w-0"
                  >
                    <option value="date">По дате</option>
                    <option value="name">По имени</option>
                    {activeTab === 'deals' && <option value="amount">По сумме</option>}
                    <option value="status">По статусу</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-2 sm:px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-gray-400 hover:text-white transition-colors flex-shrink-0"
                    title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>
                {activeTab === 'leads' && (
                  <button
                    onClick={() => setShowAddLeadModal(true)}
                    className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto flex-1 sm:flex-initial"
                  >
                    <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Добавить лид</span>
                  </button>
                )}
                {activeTab === 'deals' && (
                  <button
                    onClick={() => setShowAddDealModal(true)}
                    className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto flex-1 sm:flex-initial"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Создать сделку</span>
                  </button>
                )}
                {activeTab === 'tasks' && (
                  <button
                    onClick={() => setShowAddTaskModal(true)}
                    className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto flex-1 sm:flex-initial"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Создать задачу</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Filters Panel */}
            {showFilters && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                {activeTab === 'leads' && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Статус:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                    >
                      <option value="all">Все</option>
                      <option value="new">Новый</option>
                      <option value="contacted">Контакт</option>
                      <option value="qualified">Квалифицирован</option>
                      <option value="converted">Конвертирован</option>
                      <option value="lost">Потерян</option>
                    </select>
                  </div>
                )}
                {activeTab === 'tasks' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Статус:</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                      >
                        <option value="all">Все</option>
                        <option value="todo">Новая</option>
                        <option value="in_progress">В работе</option>
                        <option value="done">Выполнена</option>
                        <option value="cancelled">Отменена</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Приоритет:</span>
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                      >
                        <option value="all">Все</option>
                        <option value="low">Низкий</option>
                        <option value="medium">Средний</option>
                        <option value="high">Высокий</option>
                        <option value="urgent">Срочный</option>
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
                  <p>Выберите лид из вкладки "Лиды" для начала общения</p>
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
                          return lead?.name || 'Лид';
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
                    <p>Нет сообщений. Начните общение!</p>
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
                  placeholder="Введите сообщение..."
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
                  {isSendingMessage ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
              <p className="text-gray-500 mt-2">
                AI автоматически генерирует ответы на основе контекста
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
                <p>Нет лидов. Добавьте первый лид!</p>
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
                          <p className="text-gray-500 mb-1">Телефон</p>
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
                            <option value="new">Новый</option>
                            <option value="contacted">Контакт</option>
                            <option value="qualified">Квалифицирован</option>
                            <option value="converted">Конвертирован</option>
                            <option value="lost">Потерян</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">Этап</p>
                          <p className="text-gray-300">{lead.stage || 'Первый контакт'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">Последнее действие</p>
                          <p className="text-gray-300">{lead.lastAction ? formatTimeAgo(lead.lastAction) : 'Нет'}</p>
                        </div>
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
                <p>Нет сделок. Создайте первую сделку!</p>
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
                        <span className="text-gray-500">Этап</span>
                        <span className="text-gray-300">{deal.stage || 'Новый'}</span>
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
                <p>Нет задач. Создайте первую задачу!</p>
              </div>
            ) : (
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
                  />
                ))}
              </div>
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
              <h3 className="text-white">Добавить лид</h3>
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
                  placeholder="Введите имя"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Телефон *</p>
                <input
                  type="text"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder="+7 777 123 4567"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Email *</p>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Этап</p>
                <input
                  type="text"
                  value={newLead.stage}
                  onChange={(e) => setNewLead({ ...newLead, stage: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder="Первый контакт"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Источник</p>
                <input
                  type="text"
                  value={newLead.source}
                  onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  placeholder="Откуда пришел лид"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Заметки</p>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                  rows={3}
                  placeholder="Дополнительная информация"
                />
              </div>
            </div>

            <button
              onClick={handleAddLead}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-xl hover:shadow-lg transition-shadow mt-6"
            >
              Добавить лид
            </button>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      {showAddDealModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white">Создать сделку</h3>
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
                  placeholder="Название сделки"
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
                  onChange={(e) => setNewDeal({ ...newDeal, probability: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Связанный лид</p>
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
                  placeholder="Дополнительная информация"
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
                  Создание...
                </>
              ) : (
                'Создать сделку'
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
                {editingItem.name || editingItem.title ? 'Редактировать' : 'Редактировать задачу'}
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
                  <p className="text-gray-500 mb-2">Телефон *</p>
                  <input
                    type="text"
                    defaultValue={editingItem.phone}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-phone"
                  />
                </div>
                <div>
                  <p className="text-gray-500 mb-2">Email *</p>
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
                    <option value="new">Новый</option>
                    <option value="contacted">Контакт</option>
                    <option value="qualified">Квалифицирован</option>
                    <option value="converted">Конвертирован</option>
                    <option value="lost">Потерян</option>
                  </select>
                </div>
                <div>
                  <p className="text-gray-500 mb-2">Этап</p>
                  <input
                    type="text"
                    defaultValue={editingItem.stage}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                    id="edit-lead-stage"
                  />
                </div>
                <button
                  onClick={() => {
                    const name = (document.getElementById('edit-lead-name') as HTMLInputElement)?.value;
                    const phone = (document.getElementById('edit-lead-phone') as HTMLInputElement)?.value;
                    const email = (document.getElementById('edit-lead-email') as HTMLInputElement)?.value;
                    const status = (document.getElementById('edit-lead-status') as HTMLSelectElement)?.value;
                    const stage = (document.getElementById('edit-lead-stage') as HTMLInputElement)?.value;
                    handleUpdateLead(editingItem.id, { name, phone, email, status, stage });
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
                      <option value="todo">Новая</option>
                      <option value="in_progress">В работе</option>
                      <option value="done">Выполнена</option>
                      <option value="cancelled">Отменена</option>
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Телефон</p>
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
                          <option value="new">Новый</option>
                          <option value="contacted">Контакт</option>
                          <option value="qualified">Квалифицирован</option>
                          <option value="converted">Конвертирован</option>
                          <option value="lost">Потерян</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Этап</p>
                        <p className="text-white">{lead.stage || 'Первый контакт'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-1">Последнее действие</p>
                        <p className="text-white">{lead.lastAction ? formatTimeAgo(lead.lastAction) : 'Нет'}</p>
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
                          showToast('Заметки сохранены', 'success');
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
                      placeholder="Добавить заметку..."
                      value={leadNotes[lead.id] || lead.notes || ''}
                      onChange={(e) => setLeadNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                    ></textarea>
                  </div>

                  {/* Источник */}
                  <div>
                    <p className="text-gray-400 font-medium mb-2">Источник</p>
                    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                      <p className="text-white">{lead.source || 'Не указан'}</p>
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
                      Редактировать
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
                        <p className="text-white">{deal.stage || 'Новый'}</p>
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
                      Редактировать
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
                            {task.priority === 'low' ? 'Низкий' : task.priority === 'medium' ? 'Средний' : task.priority === 'high' ? 'Высокий' : task.priority === 'urgent' ? 'Срочный' : task.priority}
                          </span>
                          <select
                            value={task.status}
                            onChange={(e) => {
                              handleQuickStatusChange('task', task.id, e.target.value);
                              loadData(false);
                            }}
                            className={`px-3 py-1 rounded-lg text-sm border-0 cursor-pointer ${getStatusColor(task.status)}`}
                          >
                            <option value="todo">Новая</option>
                            <option value="in_progress">В работе</option>
                            <option value="done">Выполнена</option>
                            <option value="cancelled">Отменена</option>
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
                          <p className="text-gray-500 text-sm mb-1">Связано с лидом</p>
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
                      Редактировать
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
              <h3 className="text-white">Создать задачу</h3>
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
                  placeholder="Название задачи"
                />
              </div>

              <div>
                <p className="text-gray-500 mb-2">Описание</p>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                  rows={3}
                  placeholder="Описание задачи"
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
                    <option value="todo">Новая</option>
                    <option value="in_progress">В работе</option>
                    <option value="done">Выполнена</option>
                    <option value="cancelled">Отменена</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-2">Связанный лид</p>
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
                  Создание...
                </>
              ) : (
                'Создать задачу'
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
            ? 'Удалить лид?'
            : itemToDelete?.type === 'deal'
            ? 'Удалить сделку?'
            : 'Удалить задачу?'
        }
        description={
          itemToDelete
            ? `Вы уверены, что хотите удалить "${itemToDelete.name}"? Это действие нельзя отменить.`
            : 'Вы уверены, что хотите удалить этот элемент? Это действие нельзя отменить.'
        }
        confirmText="Удалить"
        cancelText="Отмена"
        variant="destructive"
        isLoading={isDeleting !== null}
      />
    </div>
  );
}
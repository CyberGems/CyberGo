import { useState, useRef, SyntheticEvent, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { parseNaturalLanguageTask } from '../utils/nlpParser';
import { Calendar, Trash2, Clock, Check, Plus, Tag, RefreshCw, Keyboard, Save, X, ChevronRight, ChevronDown, ListChecks } from 'lucide-react';
import { Task, AppSettings } from '../types';

interface DashboardViewProps {
  tasks: Task[];
  settings: AppSettings;
  onSaveTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onSaveSettings: (settings: AppSettings) => void;
}

export default function DashboardView({
  tasks,
  settings,
  onSaveTask,
  onDeleteTask,
  onStartFocus,
  onSaveSettings
}: DashboardViewProps) {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'week' | 'overdue' | 'no-date'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inputError, setInputError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Power User States ---
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    priority: 4 as 1 | 2 | 3 | 4,
    dueDate: '',
    notes: '',
    blockedBy: ''
  });
  const [showKeyHints, setShowKeyHints] = useState(true);

  // --- Smart Lists States ---
  const [activeSmartListId, setActiveSmartListId] = useState<string | null>(null);
  const [smartListInputOpen, setSmartListInputOpen] = useState(false);
  const [smartListInputName, setSmartListInputName] = useState('');

  // --- Subtask States ---
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({});

  // --- Dependency States ---
  const [unlockedTaskIds, setUnlockedTaskIds] = useState<Set<string>>(new Set());

  // --- Batch Selection States ---
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [lastBatchIndex, setLastBatchIndex] = useState<number | null>(null);

  const taskCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const deleteConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Parsear texto en tiempo real para el input rápido superior
  const quickParsed = parseNaturalLanguageTask(inputText, tasks);

  // Obtener categorías únicas presentes en las tareas
  const categories = ['all', ...Array.from(new Set(tasks.map(t => t.category)))];

  // --- Manejo del Submit de Tarea ---
  const handleAddTask = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      setInputError(true);
      setTimeout(() => setInputError(false), 800);
      inputRef.current?.focus();
      return;
    }

    const uuid = () => Math.random().toString(36).substring(2, 15);
    
    const newTask: Task = {
      id: uuid(),
      title: quickParsed.title,
      category: quickParsed.category,
      priority: quickParsed.priority,
      dueDate: quickParsed.dueDate?.toISOString(),
      recurrence: quickParsed.recurrence,
      blockedBy: quickParsed.blockedBy,
      completed: false,
      createdAt: new Date().toISOString()
    };

    onSaveTask(newTask);
    setInputText('');
  };

  // --- Filtros de Tareas ---
  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const filteredTasks = tasks.filter(task => {
    // 1. Filtrar por Búsqueda (Soporte básico de tags/prioridad de búsqueda)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // Filtrar por prioridad si se especifica "p:1" o "p1"
      if (q.startsWith('p:') || q.startsWith('/p')) {
        const pVal = parseInt(q.charAt(2), 10);
        if (task.priority !== pVal) return false;
      } else if (q.startsWith('#')) {
        const cat = q.substring(1);
        if (!task.category.toLowerCase().includes(cat)) return false;
      } else {
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesCategory = task.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory) return false;
      }
    }

    // 2. Filtrar por pestaña de filtro rápido
    if (activeFilter === 'today') {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      if (due > todayEnd || due < now) return false; // Solo hoy futuros
    } else if (activeFilter === 'week') {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      if (due > weekEnd || due < now) return false; // Siguientes 7 días futuros
    } else if (activeFilter === 'overdue') {
      if (!task.dueDate || task.completed) return false;
      const due = new Date(task.dueDate);
      if (due >= now) return false; // Vencidos
    } else if (activeFilter === 'no-date') {
      if (task.dueDate) return false;
    }

    // 3. Filtrar por Categoría lateral
    if (selectedCategory !== 'all' && task.category !== selectedCategory) {
      return false;
    }

    return true;
  });

  // Ordenar: No completadas primero, luego por prioridad (1 es alta) y luego por fecha
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    
    // Si ambas están pendientes o completadas, ordenar por fecha
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Si ninguna tiene fecha, ordenar por prioridad
    return a.priority - b.priority;
  });

  // --- Dependency Utilities ---
  const isTaskBlocked = (task: Task): boolean => {
    if (!task.blockedBy || task.blockedBy.length === 0) return false;
    return task.blockedBy.some(blockerId => {
      const blocker = tasks.find(t => t.id === blockerId);
      return blocker && !blocker.completed;
    });
  };

  // --- Modificadores de Tarea Rápidos ---
  const handleToggleComplete = (task: Task) => {
    const wasCompleted = task.completed;
    onSaveTask({
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined
    });

    // Si se completó, detectar tareas desbloqueadas y animar
    if (!wasCompleted) {
      const newlyUnlocked = tasks.filter(t =>
        t.id !== task.id &&
        !t.completed &&
        t.blockedBy?.includes(task.id)
      );
      if (newlyUnlocked.length > 0) {
        const unlockedIds = new Set(newlyUnlocked.map(t => t.id));
        setUnlockedTaskIds(unlockedIds);
        setTimeout(() => setUnlockedTaskIds(new Set()), 2000);
      }
    }
  };

  const handleSnooze = (task: Task, minutes: number) => {
    if (!task.dueDate) return;
    const current = new Date(task.dueDate);
    current.setMinutes(current.getMinutes() + minutes);
    onSaveTask({
      ...task,
      dueDate: current.toISOString(),
      reminderTriggered: false
    });
  };

  // --- Inline Edit Handlers ---
  const startEdit = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      category: task.category,
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
      notes: task.notes || '',
      blockedBy: (task.blockedBy || []).join(', ')
    });
  }, []);

  const handleSaveEdit = () => {
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;
    const blockedByIds = editForm.blockedBy
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .filter(id => tasks.some(t => t.id === id && t.id !== task.id));

    onSaveTask({
      ...task,
      title: editForm.title.trim() || task.title,
      category: editForm.category.trim() || task.category,
      priority: editForm.priority,
      dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : undefined,
      notes: editForm.notes,
      blockedBy: blockedByIds.length > 0 ? blockedByIds : undefined
    });
    setEditingTaskId(null);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
  };

  // --- Subtask Handlers ---
  const toggleSubtask = (task: Task, subtaskId: string) => {
    const subs = task.subtasks ? [...task.subtasks] : [];
    const idx = subs.findIndex(s => s.id === subtaskId);
    if (idx === -1) return;
    subs[idx] = { ...subs[idx], completed: !subs[idx].completed };
    onSaveTask({ ...task, subtasks: subs });
  };

  const addSubtask = (task: Task) => {
    const title = (subtaskInputs[task.id] || '').trim();
    if (!title) return;
    const newSub: import('../types').Subtask = {
      id: Math.random().toString(36).substring(2, 15),
      title,
      completed: false
    };
    onSaveTask({ ...task, subtasks: [...(task.subtasks || []), newSub] });
    setSubtaskInputs(prev => ({ ...prev, [task.id]: '' }));
  };

  const deleteSubtask = (task: Task, subtaskId: string) => {
    const subs = (task.subtasks || []).filter(s => s.id !== subtaskId);
    onSaveTask({ ...task, subtasks: subs });
  };

  // --- Batch Selection Handlers ---
  const handleTaskClick = (task: Task, index: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setBatchSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(task.id)) next.delete(task.id);
        else next.add(task.id);
        return next;
      });
      setLastBatchIndex(index);
      setSelectedTaskId(task.id);
    } else if (e.shiftKey && lastBatchIndex !== null) {
      e.preventDefault();
      const start = Math.min(lastBatchIndex, index);
      const end = Math.max(lastBatchIndex, index);
      const rangeIds = sortedTasks.slice(start, end + 1).map(t => t.id);
      setBatchSelectedIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach(id => next.add(id));
        return next;
      });
      setSelectedTaskId(task.id);
    } else {
      setBatchSelectedIds(new Set());
      setLastBatchIndex(null);
      setSelectedTaskId(task.id);
    }
  };

  const batchComplete = () => {
    batchSelectedIds.forEach(id => {
      const task = tasks.find(t => t.id === id);
      if (task && !task.completed) {
        onSaveTask({ ...task, completed: true, completedAt: new Date().toISOString() });
      }
    });
    setBatchSelectedIds(new Set());
    setLastBatchIndex(null);
  };

  const batchDelete = () => {
    if (confirm(`¿Eliminar ${batchSelectedIds.size} tareas permanentemente?`)) {
      batchSelectedIds.forEach(id => onDeleteTask(id));
      setBatchSelectedIds(new Set());
      setLastBatchIndex(null);
      setSelectedTaskId(null);
    }
  };

  const batchSetPriority = (p: 1 | 2 | 3 | 4) => {
    batchSelectedIds.forEach(id => {
      const task = tasks.find(t => t.id === id);
      if (task) onSaveTask({ ...task, priority: p });
    });
  };

  const batchSetCategory = (cat: string) => {
    batchSelectedIds.forEach(id => {
      const task = tasks.find(t => t.id === id);
      if (task) onSaveTask({ ...task, category: cat });
    });
  };

  const batchSnooze = (minutes: number) => {
    batchSelectedIds.forEach(id => {
      const task = tasks.find(t => t.id === id);
      if (task && task.dueDate && !task.completed) {
        const current = new Date(task.dueDate);
        current.setMinutes(current.getMinutes() + minutes);
        onSaveTask({ ...task, dueDate: current.toISOString(), reminderTriggered: false });
      }
    });
  };

  // --- Smart List Handlers ---
  const applySmartList = (listId: string | null) => {
    if (!listId) {
      setActiveSmartListId(null);
      setActiveFilter('all');
      setSelectedCategory('all');
      setSearchQuery('');
      return;
    }
    const list = settings.smartLists.find(l => l.id === listId);
    if (!list) return;
    setActiveSmartListId(listId);
    setActiveFilter(list.filter);
    setSelectedCategory(list.category);
    setSearchQuery(list.searchQuery);
  };

  const saveCurrentAsSmartList = () => {
    const name = smartListInputName.trim();
    if (!name) return;
    const newList = {
      id: Math.random().toString(36).substring(2, 15),
      name,
      filter: activeFilter,
      category: selectedCategory,
      searchQuery
    };
    const updated = {
      ...settings,
      smartLists: [...settings.smartLists, newList]
    };
    onSaveSettings(updated);
    setSmartListInputOpen(false);
    setSmartListInputName('');
    setActiveSmartListId(newList.id);
  };

  // --- Keyboard Navigation (Vim-style) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT';

      // Si estamos editando inline, Enter/Escape manejan el form
      if (editingTaskId) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleSaveEdit();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancelEdit();
          return;
        }
        return;
      }

      // Ignorar si estamos en un input (pero permitir Escape para salir)
      if (isInput) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
          e.preventDefault();
        }
        return;
      }

      // Manejar Ctrl+A para seleccionar todas las visibles
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          setBatchSelectedIds(new Set(sortedTasks.map(t => t.id)));
          if (sortedTasks.length > 0) setSelectedTaskId(sortedTasks[0].id);
        }
        return;
      }

      // Ignorar otros modificadores
      if (e.altKey) return;

      const currentIndex = sortedTasks.findIndex(t => t.id === selectedTaskId);

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          if (sortedTasks.length === 0) return;
          if (selectedTaskId === null) {
            setSelectedTaskId(sortedTasks[0].id);
          } else {
            const nextIndex = Math.min(currentIndex + 1, sortedTasks.length - 1);
            setSelectedTaskId(sortedTasks[nextIndex].id);
          }
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          if (sortedTasks.length === 0) return;
          if (selectedTaskId === null) {
            setSelectedTaskId(sortedTasks[sortedTasks.length - 1].id);
          } else {
            const prevIndex = Math.max(currentIndex - 1, 0);
            setSelectedTaskId(sortedTasks[prevIndex].id);
          }
          break;
        case 'x':
          e.preventDefault();
          if (selectedTaskId) {
            const task = sortedTasks.find(t => t.id === selectedTaskId);
            if (task) handleToggleComplete(task);
          }
          break;
        case 'd':
          e.preventDefault();
          if (selectedTaskId) {
            if (deleteConfirmId === selectedTaskId) {
              onDeleteTask(selectedTaskId);
              setDeleteConfirmId(null);
              setSelectedTaskId(null);
            } else {
              setDeleteConfirmId(selectedTaskId);
              if (deleteConfirmTimerRef.current) clearTimeout(deleteConfirmTimerRef.current);
              deleteConfirmTimerRef.current = setTimeout(() => setDeleteConfirmId(null), 1500);
            }
          }
          break;
        case 'e':
          e.preventDefault();
          if (selectedTaskId) {
            const task = sortedTasks.find(t => t.id === selectedTaskId);
            if (task) startEdit(task);
          }
          break;
        case 'f':
          e.preventDefault();
          if (selectedTaskId) {
            const task = sortedTasks.find(t => t.id === selectedTaskId);
            if (task && !task.completed) onStartFocus(task);
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          e.preventDefault();
          if (selectedTaskId) {
            const task = sortedTasks.find(t => t.id === selectedTaskId);
            if (task) {
              onSaveTask({ ...task, priority: parseInt(e.key, 10) as 1 | 2 | 3 | 4 });
            }
          }
          break;
        case 's':
          e.preventDefault();
          if (selectedTaskId) {
            const task = sortedTasks.find(t => t.id === selectedTaskId);
            if (task && task.dueDate && !task.completed) handleSnooze(task, 15);
          }
          break;
        case 'm':
          e.preventDefault();
          if (selectedTaskId) {
            setBatchSelectedIds(prev => {
              const next = new Set(prev);
              if (next.has(selectedTaskId)) next.delete(selectedTaskId);
              else next.add(selectedTaskId);
              return next;
            });
            setLastBatchIndex(currentIndex >= 0 ? currentIndex : null);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedTaskId(null);
          setDeleteConfirmId(null);
          break;
        case '?':
          e.preventDefault();
          setShowKeyHints(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedTasks, selectedTaskId, deleteConfirmId, editingTaskId, tasks, startEdit]);

  // Auto-scroll de la tarea seleccionada
  useEffect(() => {
    if (selectedTaskId && taskCardRefs.current.has(selectedTaskId)) {
      taskCardRefs.current.get(selectedTaskId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedTaskId]);

  // Colores y Etiquetas de Prioridad
  const getPriorityInfo = (p: number) => {
    switch (p) {
      case 1: return { color: 'var(--accent-pink)', bg: 'rgba(255,0,127,0.1)', text: 'Alta / Urgente' };
      case 2: return { color: 'var(--accent-sapphire)', bg: 'rgba(0,136,255,0.1)', text: 'Importante' };
      case 3: return { color: 'var(--accent-amber)', bg: 'rgba(255,159,0,0.1)', text: 'Urgente' };
      default: return { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.02)', text: 'Normal' };
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      
      {/* Sub-Sidebar Categorías */}
      <div style={{
        width: '180px',
        borderRight: '1px solid var(--glass-border)',
        padding: '20px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: 'rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', fontWeight: 600, textTransform: 'uppercase', paddingLeft: '8px', marginBottom: '8px' }}>
          Categorías
        </div>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { setSelectedCategory(cat); setActiveSmartListId(null); }}
            style={{
              background: selectedCategory === cat ? 'rgba(255,255,255,0.04)' : 'transparent',
              border: 'none',
              color: selectedCategory === cat ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontFamily: 'var(--font-hud)',
              textTransform: 'uppercase',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s'
            }}
          >
            <span>{cat === 'all' ? 'Todas' : `#${cat}`}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {cat === 'all' ? tasks.length : tasks.filter(t => t.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      {/* Main Container */}
      <div className="view-container" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        
        {/* Superior: Barra de Búsqueda y Filtros Rápidos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              onClick={() => { setActiveFilter('all'); setActiveSmartListId(null); }}
              className={`hud-btn ${activeFilter === 'all' && !activeSmartListId ? 'hud-btn-active' : ''}`}
            >
              Todos
            </button>
            <button 
              onClick={() => { setActiveFilter('today'); setActiveSmartListId(null); }}
              className={`hud-btn ${activeFilter === 'today' && !activeSmartListId ? 'hud-btn-active' : ''}`}
            >
              Hoy
            </button>
            <button 
              onClick={() => { setActiveFilter('week'); setActiveSmartListId(null); }}
              className={`hud-btn ${activeFilter === 'week' && !activeSmartListId ? 'hud-btn-active' : ''}`}
            >
              Semana
            </button>
            <button 
              onClick={() => { setActiveFilter('overdue'); setActiveSmartListId(null); }}
              className={`hud-btn ${activeFilter === 'overdue' && !activeSmartListId ? 'hud-btn-active' : ''}`}
              style={{
                color: (activeFilter === 'overdue' && !activeSmartListId) ? '#fff' : 'var(--accent-pink)',
                borderColor: (activeFilter === 'overdue' && !activeSmartListId) ? 'var(--accent-pink)' : 'rgba(255,0,127,0.15)'
              }}
            >
              Vencidos ({tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now).length})
            </button>
            <button 
              onClick={() => { setActiveFilter('no-date'); setActiveSmartListId(null); }}
              className={`hud-btn ${activeFilter === 'no-date' && !activeSmartListId ? 'hud-btn-active' : ''}`}
            >
              Bandeja Entrada
            </button>

            {/* Smart Lists */}
            {settings.smartLists.map(list => (
              <button
                key={list.id}
                onClick={() => applySmartList(list.id)}
                className={`hud-btn ${activeSmartListId === list.id ? 'hud-btn-active' : ''}`}
                style={{ fontSize: '11px', padding: '6px 10px' }}
                title={`${list.name} | Filtro: ${list.filter} | Cat: ${list.category}`}
              >
                {list.name}
              </button>
            ))}

            {/* Save Smart List Button / Input */}
            {!smartListInputOpen ? (
              <button
                onClick={() => setSmartListInputOpen(true)}
                className="hud-btn"
                style={{ fontSize: '11px', padding: '6px 10px', color: 'var(--accent-cyan)', borderColor: 'rgba(0,240,255,0.1)' }}
                title="Guardar filtros actuales como vista personalizada"
              >
                + Guardar Vista
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  autoFocus
                  className="glass-input"
                  placeholder="Nombre de la vista..."
                  value={smartListInputName}
                  onChange={(e) => setSmartListInputName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCurrentAsSmartList();
                    if (e.key === 'Escape') { setSmartListInputOpen(false); setSmartListInputName(''); }
                  }}
                  style={{ width: '150px', padding: '4px 8px', fontSize: '12px' }}
                />
                <button onClick={saveCurrentAsSmartList} className="hud-btn hud-btn-active" style={{ padding: '4px 8px', fontSize: '11px' }}>
                  Guardar
                </button>
                <button onClick={() => { setSmartListInputOpen(false); setSmartListInputName(''); }} className="hud-btn" style={{ padding: '4px 8px', fontSize: '11px' }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Buscador */}
          <input
            type="text"
            className="glass-input"
            placeholder="Buscar... (ej: #trabajo, p:1)"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveSmartListId(null); }}
            style={{ width: '220px', padding: '6px 12px', fontSize: '13px' }}
          />
        </div>

        {/* Formulario Rápido Superior de Adición */}
        <form onSubmit={handleAddTask} className="glass-panel" style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'rgba(10, 10, 15, 0.5)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              ref={inputRef}
              type="text"
              className={`glass-input ${inputError ? 'pulse-glow-pink' : ''}`}
              placeholder="Nueva tarea... (ej: Respaldar base de datos el viernes a las 5pm /p1 #sistemas)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={{ 
                flex: 1,
                borderColor: inputError ? 'var(--accent-pink)' : undefined
              }}
            />
            <button 
              type="submit" 
              onClick={handleAddTask} 
              className="hud-btn hud-btn-active" 
              style={{ padding: '10px 18px' }}
            >
              <Plus size={16} /> AÑADIR
            </button>
          </div>
          
          {/* Live NLP Preview */}
          {inputText.trim() && (
            <div style={{
              display: 'flex',
              gap: '16px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-hud)',
              padding: '6px 8px',
              borderRadius: '4px',
              background: 'rgba(0,0,0,0.15)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="priority-dot" style={{ backgroundColor: getPriorityInfo(quickParsed.priority).color }} />
                P{quickParsed.priority} ({getPriorityInfo(quickParsed.priority).text})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={10} /> #{quickParsed.category.toUpperCase()}
              </span>
              {quickParsed.dueDate && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}>
                  <Calendar size={10} />
                  Vence: {quickParsed.dueDate.toLocaleString()}
                </span>
              )}
              {quickParsed.recurrence && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)' }}>
                  <RefreshCw size={10} />
                  Recurrente: {quickParsed.recurrence.type.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </form>

        {/* Batch Action Bar */}
        {batchSelectedIds.size > 0 && (
          <div className="glass-panel" style={{
            position: 'sticky',
            top: '0',
            zIndex: 20,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(4,4,6,0.9)',
            borderColor: 'var(--accent-emerald)'
          }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-hud)', color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {batchSelectedIds.size} TAREAS SELECCIONADAS
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-hud)', marginRight: '4px' }}>PRIORIDAD:</span>
              {[1, 2, 3, 4].map(p => (
                <button
                  key={p}
                  onClick={() => batchSetPriority(p as 1|2|3|4)}
                  className="hud-btn"
                  style={{ padding: '3px 8px', fontSize: '10px' }}
                >
                  P{p}
                </button>
              ))}
              <div style={{ width: '1px', height: '16px', background: 'var(--glass-border)', margin: '0 4px' }} />
              <button
                onClick={() => batchSetCategory('General')}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px' }}
              >
                #General
              </button>
              <button
                onClick={() => batchSetCategory('Trabajo')}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px' }}
              >
                #Trabajo
              </button>
              <button
                onClick={() => batchSetCategory('Personal')}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px' }}
              >
                #Personal
              </button>
              <div style={{ width: '1px', height: '16px', background: 'var(--glass-border)', margin: '0 4px' }} />
              <button
                onClick={() => batchSnooze(15)}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px' }}
              >
                +15M
              </button>
              <button
                onClick={() => batchSnooze(60)}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px' }}
              >
                +1H
              </button>
              <div style={{ width: '1px', height: '16px', background: 'var(--glass-border)', margin: '0 4px' }} />
              <button
                onClick={batchComplete}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--accent-emerald)', borderColor: 'rgba(0,255,135,0.15)' }}
              >
                <Check size={10} /> COMPLETAR
              </button>
              <button
                onClick={batchDelete}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--accent-pink)', borderColor: 'rgba(255,0,127,0.15)' }}
              >
                <Trash2 size={10} /> ELIMINAR
              </button>
              <button
                onClick={() => { setBatchSelectedIds(new Set()); setLastBatchIndex(null); }}
                className="hud-btn"
                style={{ padding: '3px 8px', fontSize: '10px' }}
              >
                <X size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Lista de Tareas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortedTasks.length > 0 ? (
            <AnimatePresence>
              {sortedTasks.map((task, index) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < now && !task.completed;
                const pInfo = getPriorityInfo(task.priority);
                const isSelected = selectedTaskId === task.id;
                const isEditing = editingTaskId === task.id;
                const isDeleteConfirm = deleteConfirmId === task.id;
                const isBatchSelected = batchSelectedIds.has(task.id);
                const isBlocked = isTaskBlocked(task);
                const isUnlocked = unlockedTaskIds.has(task.id);

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.15 }}
                    ref={(el) => {
                      if (el) taskCardRefs.current.set(task.id, el);
                    }}
                    className={`glass-card ${isUnlocked ? 'unlock-animation' : ''}`}
                    onClick={(e) => {
                      if (!isEditing && !isBlocked) handleTaskClick(task, index, e);
                    }}
                    onDoubleClick={() => {
                      if (!task.completed && !isBlocked) startEdit(task);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: expandedTaskId === task.id ? 'column' : 'row',
                      alignItems: isEditing || expandedTaskId === task.id ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      borderColor: isOverdue ? 'rgba(255,0,127,0.2)' : isUnlocked ? 'var(--accent-emerald)' : isBlocked ? 'var(--accent-gray)' : isBatchSelected ? 'var(--accent-emerald)' : isSelected ? 'var(--theme-color)' : 'var(--glass-border)',
                      background: task.completed ? 'rgba(255,255,255,0.01)' : isBlocked ? 'rgba(51,65,85,0.04)' : isBatchSelected ? 'rgba(0,255,135,0.04)' : isSelected ? 'rgba(255,255,255,0.03)' : 'rgba(18, 18, 26, 0.35)',
                      opacity: task.completed ? 0.6 : isBlocked ? 0.5 : (batchSelectedIds.size > 0 && !isBatchSelected) ? 0.45 : 1,
                      borderLeft: isBatchSelected ? '3px solid var(--accent-emerald)' : isUnlocked ? '3px solid var(--accent-emerald)' : isBlocked ? '3px solid var(--accent-gray)' : isSelected ? '3px solid var(--theme-color)' : undefined,
                      boxShadow: isUnlocked ? 'inset 4px 0 16px -4px var(--accent-emerald-glow)' : isBlocked ? 'none' : isBatchSelected ? 'inset 4px 0 16px -4px var(--accent-emerald-glow)' : isSelected ? 'inset 4px 0 16px -4px var(--theme-color-glow)' : undefined,
                      cursor: isEditing ? 'default' : isBlocked ? 'not-allowed' : 'pointer',
                      gap: '12px'
                    }}
                  >
{isEditing ? (
                       // --- INLINE EDIT MODE ---
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, width: '100%' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <label style={{ fontSize: '12px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TÍTULO</label>
                           <input
                             type="text"
                             className="glass-input"
                             value={editForm.title}
                             onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                             autoFocus
                             style={{ fontSize: '16px', fontWeight: 500, padding: '12px 14px' }}
                           />
                         </div>
                         <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'start' }}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
                             <label style={{ fontSize: '12px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRIORIDAD</label>
                             <select
                               className="glass-input"
                               value={editForm.priority}
                               onChange={(e) => setEditForm(prev => ({ ...prev, priority: parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 }))}
                               style={{ width: '140px', padding: '10px 12px', fontSize: '13px' }}
                             >
                               <option value={1}>P1 — Urgente/Importante</option>
                               <option value={2}>P2 — Importante</option>
                               <option value={3}>P3 — Urgente</option>
                               <option value={4}>P4 — Normal</option>
                             </select>
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
                             <label style={{ fontSize: '12px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FECHA Y HORA</label>
                             <input
                               type="datetime-local"
                               className="glass-input"
                               value={editForm.dueDate}
                               onChange={(e) => setEditForm(prev => ({ ...prev, dueDate: e.target.value }))}
                               style={{ width: '200px', padding: '10px 12px', fontSize: '13px', colorScheme: 'dark' }}
                             />
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                             <label style={{ fontSize: '12px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CATEGORÍA</label>
                             <input
                               type="text"
                               className="glass-input"
                               value={editForm.category}
                               onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                               placeholder="#categoría"
                               style={{ width: '120px', padding: '10px 12px', fontSize: '13px' }}
                             />
                           </div>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <label style={{ fontSize: '12px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NOTAS</label>
                           <textarea
                             className="glass-input"
                             value={editForm.notes}
                             onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                             placeholder="Notas adicionales..."
                             rows={3}
                             style={{ fontSize: '13px', resize: 'vertical', padding: '10px 12px' }}
                           />
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <label style={{ fontSize: '12px', fontFamily: 'var(--font-hud)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DEPENDENCIAS</label>
                           <input
                             type="text"
                             className="glass-input"
                             value={editForm.blockedBy}
                             onChange={(e) => setEditForm(prev => ({ ...prev, blockedBy: e.target.value }))}
                             placeholder="IDs de tareas bloqueantes separados por coma (ej: abc123, def456)"
                             style={{ fontSize: '13px', padding: '10px 12px' }}
                           />
                           <p style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-hud)', marginTop: '4px' }}>
                             Las tareas no se marcarán como completadas hasta que sus dependencias estén resueltas
                           </p>
                         </div>
                         <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                           <button
                             onClick={handleCancelEdit}
                             className="hud-btn"
                             style={{ padding: '8px 16px', fontSize: '12px' }}
                           >
                             <X size={14} /> Cancelar
                           </button>
                           <button
                             onClick={handleSaveEdit}
                             className="hud-btn hud-btn-active"
                             style={{ padding: '8px 16px', fontSize: '12px' }}
                           >
                             <Save size={14} /> Guardar (Ctrl+Enter)
                           </button>
                         </div>
                       </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px' }}>
                        {/* Fila Superior */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          {/* Sección Izquierda: Expandir + Checkbox + Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            {/* Botón Expandir / Indicador Subtasks */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTaskId(prev => prev === task.id ? null : task.id);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px',
                                transition: 'color 0.2s'
                              }}
                              title={expandedTaskId === task.id ? 'Contraer subtareas' : 'Expandir subtareas'}
                            >
                              {expandedTaskId === task.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            {/* Checkbox HUD */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isBlocked) handleToggleComplete(task);
                              }}
                              style={{
                                width: '20px',
                                height: '20px',
                                border: `1px solid ${task.completed ? 'var(--accent-emerald)' : isBlocked ? 'var(--accent-gray)' : 'var(--text-muted)'}`,
                                borderRadius: '4px',
                                background: task.completed ? 'rgba(0, 255, 135, 0.1)' : 'transparent',
                                cursor: isBlocked ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--accent-emerald)',
                                transition: 'all 0.2s',
                                opacity: isBlocked ? 0.3 : 1
                              }}
                            >
                              {task.completed && <Check size={14} strokeWidth={3} />}
                            </button>

                            {/* Info de Tarea */}
                            <div>
                              <div style={{
                                fontSize: '14px',
                                color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                textDecoration: task.completed ? 'line-through' : 'none',
                                fontWeight: 500
                              }}>
                                {task.title}
                              </div>
                              
                              {/* Meta Tags */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '10px', fontFamily: 'var(--font-hud)', textTransform: 'uppercase' }}>
                                <span style={{ color: pInfo.color, padding: '2px 6px', borderRadius: '3px', background: pInfo.bg }}>
                                  P{task.priority}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  #{task.category}
                                </span>
                                {task.dueDate && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOverdue ? 'var(--accent-pink)' : 'var(--text-secondary)' }}>
                                    <Clock size={9} />
                                    {new Date(task.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    {isOverdue && " [VENCIDA]"}
                                  </span>
                                )}
                                {task.recurrence && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)' }}>
                                    <RefreshCw size={9} />
                                    {task.recurrence.type}
                                  </span>
                                )}
                                {task.subtasks && task.subtasks.length > 0 && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}>
                                    <ListChecks size={9} />
                                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                  </span>
                                )}
                                {isBlocked && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-gray)', padding: '2px 6px', borderRadius: '3px', background: 'rgba(51,65,85,0.15)' }}>
                                    🔒 BLOQUEADA
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Sección Derecha: Acciones Rápidas */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isDeleteConfirm && (
                              <span style={{
                                fontSize: '10px',
                                fontFamily: 'var(--font-hud)',
                                color: 'var(--accent-pink)',
                                animation: 'pulse 0.8s infinite'
                              }}>
                                PULSA D PARA CONFIRMAR
                              </span>
                            )}

                            {/* Botón de Enfoque (Pomodoro) */}
                            {!task.completed && !isBlocked && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartFocus(task);
                                }}
                                className="hud-btn"
                                style={{ padding: '4px 10px', fontSize: '10px', color: 'var(--accent-cyan)', borderColor: 'rgba(0,240,255,0.1)' }}
                                title="Concentrarse en esta tarea"
                              >
                                <Clock size={11} /> ENFOQUE
                              </button>
                            )}

                            {/* Botón de Posponer Rápido (+15m) */}
                            {task.dueDate && !task.completed && !isBlocked && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSnooze(task, 15);
                                }}
                                className="hud-btn"
                                style={{ padding: '4px 8px', fontSize: '10px' }}
                                title="Posponer 15 minutos"
                              >
                                +15M
                              </button>
                            )}

                            {/* Botón Eliminar */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask(task.id);
                              }}
                              className="hud-btn"
                              style={{ padding: '6px', color: 'var(--accent-pink)', borderColor: 'rgba(255,0,127,0.15)' }}
                              title="Eliminar tarea"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Fila Inferior: Subtasks Expandidas */}
                        {expandedTaskId === task.id && (
                          <div style={{ width: '100%', paddingLeft: '34px', paddingTop: '4px' }}>
                            <div style={{
                              borderTop: '1px solid rgba(255,255,255,0.04)',
                              paddingTop: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              {task.subtasks && task.subtasks.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {task.subtasks.map(sub => (
                                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSubtask(task, sub.id);
                                        }}
                                        style={{
                                          width: '16px',
                                          height: '16px',
                                          border: `1px solid ${sub.completed ? 'var(--accent-emerald)' : 'var(--text-muted)'}`,
                                          borderRadius: '3px',
                                          background: sub.completed ? 'rgba(0, 255, 135, 0.08)' : 'transparent',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: 'var(--accent-emerald)'
                                        }}
                                      >
                                        {sub.completed && <Check size={10} strokeWidth={3} />}
                                      </button>
                                      <span style={{
                                        fontSize: '12px',
                                        color: sub.completed ? 'var(--text-muted)' : 'var(--text-secondary)',
                                        textDecoration: sub.completed ? 'line-through' : 'none',
                                        flex: 1
                                      }}>
                                        {sub.title}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteSubtask(task, sub.id);
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Sin subtareas. Añade una abajo.
                                </div>
                              )}
                              {/* Input para nueva subtarea */}
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <input
                                  type="text"
                                  className="glass-input"
                                  placeholder="Nueva subtarea..."
                                  value={subtaskInputs[task.id] || ''}
                                  onChange={(e) => setSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addSubtask(task);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addSubtask(task);
                                  }}
                                  className="hud-btn"
                                  style={{ padding: '4px 10px', fontSize: '11px' }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            <div style={{
              padding: '60px 0',
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.03)',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              No se encontraron tareas pendientes con los filtros seleccionados.
            </div>
          )}
        </div>

        {/* Keyboard Hints HUD */}
        {showKeyHints && sortedTasks.length > 0 && (
          <div style={{
            position: 'sticky',
            bottom: '12px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none'
          }}>
            <div style={{
              background: 'rgba(4, 4, 6, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '10px',
              fontFamily: 'var(--font-hud)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              pointerEvents: 'auto'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                <Keyboard size={10} /> Modo Vim
              </span>
              <span><kbd style={kbdStyle}>j/k</kbd> Navegar</span>
              <span><kbd style={kbdStyle}>x</kbd> Completar</span>
              <span><kbd style={kbdStyle}>d</kbd> Eliminar</span>
              <span><kbd style={kbdStyle}>e</kbd> Editar</span>
              <span><kbd style={kbdStyle}>f</kbd> Enfoque</span>
              <span><kbd style={kbdStyle}>1-4</kbd> Prioridad</span>
              <span><kbd style={kbdStyle}>s</kbd> +15m</span>
              <span><kbd style={kbdStyle}>m</kbd> Marcar</span>
              <span><kbd style={kbdStyle}>ctrl+a</kbd> Todas</span>
              <button
                onClick={() => setShowKeyHints(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px', marginLeft: '4px' }}
                title="Ocultar atajos"
              >
                <X size={10} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  padding: '1px 5px',
  borderRadius: '3px',
  fontFamily: 'var(--font-hud)',
  fontSize: '9px',
  color: 'var(--accent-cyan)',
  border: '1px solid rgba(255,255,255,0.08)'
};

import React, { useState, useEffect, useRef } from 'react';
import { parseNaturalLanguageTask } from '../utils/nlpParser';
import { Calendar, Tag, RefreshCw, Mic, ListPlus, Layers } from 'lucide-react';
import { Task } from '../types';

export default function QuickAddBox() {
  const [inputVal, setInputVal] = useState('');
  const [existingTasks, setExistingTasks] = useState<Task[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isInputEmpty, setIsInputEmpty] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    window.cyberGoAPI.getTasks().then(setExistingTasks);
  }, []);

  // Detectar modo bulk si hay separadores ;;
  const rawSegments = inputVal.includes(';;') ? inputVal.split(';;').filter(s => s.trim()) : [inputVal];
  const parsedSegments = rawSegments.map(seg => parseNaturalLanguageTask(seg.trim(), existingTasks));
  const isBulk = rawSegments.length > 1;

  // Web Speech API setup
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'es-ES';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final) {
          setInputVal(prev => prev ? prev + ' ' + final : final);
        }
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputVal('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    setIsInputEmpty(inputVal.trim() === '');
    setTimeout(() => inputRef.current?.focus(), 80);

    const handleGlobalOpen = () => {
      setInputVal('');
      setIsListening(false);
      window.cyberGoAPI.getTasks().then(setExistingTasks);
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    const unsubscribe = window.cyberGoAPI.onQuickAddOpen(handleGlobalOpen);
    return () => unsubscribe();
  }, [inputVal]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setInputVal('');
      await window.cyberGoAPI.closeQuickAddWindow();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!inputVal.trim()) return;

      const uuid = () => Math.random().toString(36).substring(2, 15);

      const segmentsToSave = isBulk ? parsedSegments : [parsedSegments[0]];
      
      for (const parsed of segmentsToSave) {
        const newTask: Task = {
          id: uuid(),
          title: parsed.title,
          category: parsed.category,
          priority: parsed.priority,
          dueDate: parsed.dueDate?.toISOString(),
          recurrence: parsed.recurrence,
          blockedBy: parsed.blockedBy,
          completed: false,
          createdAt: new Date().toISOString()
        };
        await window.cyberGoAPI.saveTask(newTask);
      }

      setInputVal('');
      await window.cyberGoAPI.closeQuickAddWindow();
    }
  };

  const mainParsed = parsedSegments[0];
  const priorityColor = mainParsed.priority === 1 ? 'var(--accent-pink)' :
                        mainParsed.priority === 2 ? 'var(--accent-sapphire)' :
                        mainParsed.priority === 3 ? 'var(--accent-amber)' : 'var(--text-muted)';

  return (
    <div className="quick-add-container">
      <div className="quick-add-box" style={{ border: `1px solid ${inputVal ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
        {/* Input Principal con iconos */}
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
          {isBulk && (
            <span style={{ color: 'var(--accent-cyan)', fontSize: '12px', fontFamily: 'var(--font-hud)' }}>
              <Layers size={14} />
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            className="quick-add-input"
            placeholder={isInputEmpty ? 'Ej: "Reunión equipo mañana 15:00 /p1 #trabajo"' : 'Añadir recordatorio...'}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={toggleVoice}
            style={{
              background: isListening ? 'rgba(255,0,127,0.15)' : 'transparent',
              border: `1px solid ${isListening ? 'var(--accent-pink)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '6px',
              color: isListening ? 'var(--accent-pink)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
            title={isListening ? 'Detener dictado' : 'Dictar con voz'}
          >
            <Mic size={14} />
          </button>
        </div>

        {/* Preview del Parser NLP en Tiempo Real */}
        <div className="quick-add-footer">
          <div className="quick-add-meta-preview">
            {inputVal.trim() ? (
              <>
                {isBulk ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}>
                    <ListPlus size={10} />
                    MODO BULK: {parsedSegments.length} tareas
                  </span>
                ) : (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        className="priority-dot" 
                        style={{ 
                          backgroundColor: priorityColor,
                          boxShadow: mainParsed.priority < 4 ? `0 0 8px ${priorityColor}` : 'none'
                        }} 
                      />
                      P{mainParsed.priority}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={10} color="var(--text-secondary)" />
                      {mainParsed.category.toUpperCase()}
                    </span>
                    {mainParsed.dueDate && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}>
                        <Calendar size={10} />
                        {mainParsed.dueDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {mainParsed.recurrence && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)' }}>
                        <RefreshCw size={10} />
                        {mainParsed.recurrence.type.toUpperCase()}
                      </span>
                    )}
                  </>
                )}
              </>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '12px 0',
                color: 'var(--text-muted)',
                fontSize: '14px',
                fontStyle: 'italic'
              }}>
                Ej: "Llamar a mamá /p2 #familia" o "Revisar informe en 10 minutos"
              </div>
            )}
          </div>
          
          <div className="quick-add-hints">
            {isListening ? (
              <span style={{ color: 'var(--accent-pink)', animation: 'pulse 1s infinite' }}>ESCUCHANDO...</span>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>ESC Cancelar</span>
                <span>ENTER Guardar</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
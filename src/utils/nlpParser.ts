import { Task } from '../types';

export interface ParsedTaskResult {
  title: string;
  category: string;
  priority: 1 | 2 | 3 | 4;
  dueDate?: Date;
  recurrence?: Task['recurrence'];
  blockedBy?: string[];
}

const MONTHS_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

const MONTHS_EN: Record<string, number> = {
  january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

const DAYS_ES: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
  jueves: 4, viernes: 5, sábado: 6, sabado: 6
};

const DAYS_EN: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
};

/**
 * Parsea una cadena de texto natural en español o inglés
 * y extrae la prioridad, categoría, fecha de vencimiento y recurrencia.
 */
export function parseNaturalLanguageTask(inputText: string, existingTasks: Task[] = []): ParsedTaskResult {
  let text = inputText.trim();
  
  let priority: 1 | 2 | 3 | 4 = 4; // Por defecto normal (4)
  let category = 'General';
  let dueDate: Date | undefined = undefined;
  let recurrence: Task['recurrence'] = undefined;
  let blockedBy: string[] | undefined = undefined;
  const now = new Date();
  let timeExtracted = false;

  // 1. Extraer Prioridad: /p1, /p2, /p3, /p4
  const priorityRegex = /\/p([1-4])\b/gi;
  const priorityMatch = priorityRegex.exec(text);
  if (priorityMatch) {
    priority = parseInt(priorityMatch[1], 10) as 1 | 2 | 3 | 4;
    text = text.replace(priorityRegex, '');
  }

  // 2. Extraer Categoría: #trabajo, #personal, #ideas, etc.
  const categoryRegex = /#([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+)\b/g;
  const categoryMatches = [...text.matchAll(categoryRegex)];
  if (categoryMatches.length > 0) {
    category = categoryMatches[0][1]; // Usar la primera coincidencia
    text = text.replace(categoryRegex, '');
  }

  // 3. Extraer Dependencias: depends:título o >>título o bloqueado por título
  const dependsRegex = /(?:depends:|>>|bloqueado\s+por)\s*([^#,]+?)(?=\s*(?:\/|#|$|,))/gi;
  const depMatches = [...text.matchAll(dependsRegex)];
  if (depMatches.length > 0 && existingTasks.length > 0) {
    blockedBy = [];
    depMatches.forEach(match => {
      const query = match[1].trim().toLowerCase();
      const found = existingTasks.find(t => t.title.toLowerCase().includes(query) && !t.completed);
      if (found && !blockedBy!.includes(found.id)) {
        blockedBy!.push(found.id);
      }
    });
    if (blockedBy.length === 0) blockedBy = undefined;
    text = text.replace(dependsRegex, '');
  }

  // 4. Extraer Recurrencia explícita: /r diario, /r semanal, /r mensual, /r daily, /r weekly, etc.
  const recRegex = /\/r\s+(diario|semanal|mensual|daily|weekly|monthly)\b/gi;
  const recMatch = recRegex.exec(text);
  if (recMatch) {
    const type = recMatch[1].toLowerCase();
    if (type === 'diario' || type === 'daily') {
      recurrence = { type: 'daily' };
    } else if (type === 'semanal' || type === 'weekly') {
      recurrence = { type: 'weekly', daysOfWeek: [new Date().getDay()] };
    } else if (type === 'mensual' || type === 'monthly') {
      recurrence = { type: 'monthly' };
    }
    text = text.replace(recRegex, '');
  }

  // Si no hay recurrencia explícita por comando, buscar términos implícitos semanales (ej: todos los lunes) o diarios
  if (!recurrence) {
    const weeklyTermsEs = /\b(?:cada|todos los)\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/gi;
    const weeklyTermsEn = /\b(?:every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
    
    let weeklyMatch = weeklyTermsEs.exec(text);
    if (!weeklyMatch) {
      weeklyTermsEs.lastIndex = 0;
      weeklyMatch = weeklyTermsEn.exec(text);
    }
    
    if (weeklyMatch) {
      const dayName = weeklyMatch[1].toLowerCase();
      const targetDay = DAYS_ES[dayName] !== undefined ? DAYS_ES[dayName] : DAYS_EN[dayName];
      recurrence = { type: 'weekly', daysOfWeek: [targetDay] };
      
      dueDate = new Date(now);
      let diff = targetDay - now.getDay();
      if (diff <= 0) diff += 7; // Próxima semana
      dueDate.setDate(dueDate.getDate() + diff);
      
      text = text.replace(weeklyMatch[0], '');
      timeExtracted = true;
    }
  }

  if (!recurrence) {
    const dailyTerms = /\b(cada día|todos los días|cada dia|todos los dias|every day|daily)\b/gi;
    if (dailyTerms.test(text)) {
      recurrence = { type: 'daily' };
      text = text.replace(dailyTerms, '');
    }
  }

  // 4. Analizar Fechas y Horas


  // Helper para parsear formato HH:MM (am/pm)
  const parseTime = (hoursStr: string, minutesStr?: string, ampm?: string): { h: number, m: number } => {
    let h = parseInt(hoursStr, 10);
    const m = minutesStr ? parseInt(minutesStr, 10) : 0;
    if (ampm) {
      const pm = ampm.toLowerCase() === 'pm';
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    return { h, m };
  };

  // REGLAS RELATIVAS RÁPIDAS: "en 15 minutos", "en 2 horas", "in 3 days"
  const relativeRegexEs = /\ben\s+(\d+)\s*(minuto|minutos|min|mins|hora|horas|h|hr|hrs|dia|dias|dí|días|d)\b/i;
  const relativeRegexEn = /\bin\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|h|hr|hrs|day|days|d)\b/i;
  
  let relativeMatch = relativeRegexEs.exec(text) || relativeRegexEn.exec(text);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    dueDate = new Date(now);
    
    if (unit.startsWith('min')) {
      dueDate.setMinutes(dueDate.getMinutes() + amount);
    } else if (unit.startsWith('h') || unit.startsWith('hr')) {
      dueDate.setHours(dueDate.getHours() + amount);
    } else if (unit.startsWith('d')) {
      dueDate.setDate(dueDate.getDate() + amount);
    }
    
    text = text.replace(relativeMatch[0], '');
    timeExtracted = true;
  }

  // REGLA: "hoy a las 15:30" / "today at 5pm"
  if (!timeExtracted) {
    const todayRegexEs = /\bhoy\s*(?:a\s*las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const todayRegexEn = /\btoday\s*(?:at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const todayMatch = todayRegexEs.exec(text) || todayRegexEn.exec(text);
    if (todayMatch) {
      const { h, m } = parseTime(todayMatch[1], todayMatch[2], todayMatch[3]);
      dueDate = new Date(now);
      dueDate.setHours(h, m, 0, 0);
      
      // Si la hora ya pasó hoy y no se especificó AM/PM, programar para mañana o ajustar PM si aplica
      if (dueDate <= now && !todayMatch[3]) {
        // Intentar agregar 12 horas si es formato 12h implícito (ej: son las 2pm, pide "a las 5", sumamos 12h si h < 12)
        if (h < 12 && h + 12 > now.getHours()) {
          dueDate.setHours(h + 12);
        } else {
          dueDate.setDate(dueDate.getDate() + 1); // Mañana
        }
      }
      
      text = text.replace(todayMatch[0], '');
      timeExtracted = true;
    }
  }

  // REGLA: "mañana a las 10am" / "tomorrow at 3pm"
  if (!timeExtracted) {
    const tomorrowRegexEs = /\bmañana\s*(?:a\s*las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const tomorrowRegexEn = /\btomorrow\s*(?:at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const tomorrowMatch = tomorrowRegexEs.exec(text) || tomorrowRegexEn.exec(text);
    if (tomorrowMatch) {
      const { h, m } = parseTime(tomorrowMatch[1], tomorrowMatch[2], tomorrowMatch[3]);
      dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 1);
      dueDate.setHours(h, m, 0, 0);
      
      text = text.replace(tomorrowMatch[0], '');
      timeExtracted = true;
    } else {
      // "mañana" / "tomorrow" solo (sin hora, por defecto 9:00 AM)
      const tomorrowOnlyEs = /\bmañana\b/i;
      const tomorrowOnlyEn = /\btomorrow\b/i;
      if (tomorrowOnlyEs.test(text) || tomorrowOnlyEn.test(text)) {
        dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(9, 0, 0, 0); // 9 AM por defecto
        text = text.replace(tomorrowOnlyEs, '').replace(tomorrowOnlyEn, '');
        timeExtracted = true;
      }
    }
  }

  // REGLA: "el lunes a las 18:00" / "on monday at 10am"
  if (!timeExtracted) {
    const dayOfWeekRegexEs = /\b(?:el\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s*(?:a\s*las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const dayOfWeekRegexEn = /\b(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(?:at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const dayMatch = dayOfWeekRegexEs.exec(text) || dayOfWeekRegexEn.exec(text);
    if (dayMatch) {
      const dayName = dayMatch[1].toLowerCase();
      const { h, m } = parseTime(dayMatch[2], dayMatch[3], dayMatch[4]);
      
      const targetDay = DAYS_ES[dayName] !== undefined ? DAYS_ES[dayName] : DAYS_EN[dayName];
      dueDate = new Date(now);
      
      let diff = targetDay - now.getDay();
      if (diff <= 0) diff += 7; // Próxima semana
      
      dueDate.setDate(dueDate.getDate() + diff);
      dueDate.setHours(h, m, 0, 0);
      
      text = text.replace(dayMatch[0], '');
      timeExtracted = true;
    }
  }

  // REGLA: "el 24 de mayo a las 18:30" / "may 24 at 10:30am"
  if (!timeExtracted) {
    const dateRegexEs = /\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:a\s*las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const dateRegexEn = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s*(?:at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    
    let dateMatch = dateRegexEs.exec(text);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const monthName = dateMatch[2].toLowerCase();
      const { h, m } = parseTime(dateMatch[3], dateMatch[4], dateMatch[5]);
      
      dueDate = new Date(now);
      dueDate.setMonth(MONTHS_ES[monthName], day);
      dueDate.setHours(h, m, 0, 0);
      
      // Si la fecha ya pasó este año, programarla para el próximo año
      if (dueDate < now) {
        dueDate.setFullYear(dueDate.getFullYear() + 1);
      }
      
      text = text.replace(dateMatch[0], '');
      timeExtracted = true;
    } else {
      dateMatch = dateRegexEn.exec(text);
      if (dateMatch) {
        const monthName = dateMatch[1].toLowerCase();
        const day = parseInt(dateMatch[2], 10);
        const { h, m } = parseTime(dateMatch[3], dateMatch[4], dateMatch[5]);
        
        dueDate = new Date(now);
        dueDate.setMonth(MONTHS_EN[monthName], day);
        dueDate.setHours(h, m, 0, 0);
        
        if (dueDate < now) {
          dueDate.setFullYear(dueDate.getFullYear() + 1);
        }
        
        text = text.replace(dateMatch[0], '');
        timeExtracted = true;
      }
    }
  }

  // Si ya tenemos fecha (por recurrencia semanal implícita) pero falta la hora, buscar si hay una hora explícita en el texto restante
  if (dueDate && timeExtracted) {
    const timeOnlyRegex = /\b(?:a\s*las|at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const timeMatch = timeOnlyRegex.exec(text);
    if (timeMatch && timeMatch[1]) {
      const probableHour = parseInt(timeMatch[1], 10);
      if (probableHour <= 24) {
        const { h, m } = parseTime(timeMatch[1], timeMatch[2], timeMatch[3]);
        dueDate.setHours(h, m, 0, 0);
        text = text.replace(timeMatch[0], '');
      }
    }
  }

  // 5. Limpiar espacios redundantes en el título final
  const cleanTitle = text
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: cleanTitle || 'Sin título',
    category,
    priority,
    dueDate,
    recurrence,
    blockedBy
  };
}

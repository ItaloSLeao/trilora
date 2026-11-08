import { validateFlashcards } from './flashcards.js';
import { validateStudySessions } from './study.js';

export const STORAGE_KEY = 'trilora-v1'; // Mantém os registros salvos na versão anterior.

export function localDate(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// setFullYear evita a conversão implícita dos anos 0–99 para 1900–1999.
// Meio-dia local também é usado na apresentação dos prazos.
export function calendarDate(year, month, day = 1) {
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}

export function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function initialData() {
  return {
    subjects: [
      { id: 's1', name: 'Engenharia de Software', color: '#7363dc' },
      { id: 's2', name: 'Estruturas de Dados', color: '#51b7a2' },
      { id: 's3', name: 'Banco de Dados', color: '#f3ad67' },
    ],
    tasks: [
      { id: 't1', title: 'Entregar levantamento de requisitos', subject: 's1', date: daysFromToday(2), priority: 'Alta', done: false },
      { id: 't2', title: 'Revisar árvores binárias', subject: 's2', date: daysFromToday(4), priority: 'Média', done: false },
      { id: 't3', title: 'Modelar diagrama entidade-relacionamento', subject: 's3', date: daysFromToday(7), priority: 'Média', done: false },
      { id: 't4', title: 'Definir proposta do projeto', subject: 's1', date: daysFromToday(-1), priority: 'Baixa', done: true },
    ],
  };
}

export function normalizeData(candidate) {
  if (!candidate || !Array.isArray(candidate.tasks) || !Array.isArray(candidate.subjects)) throw new TypeError('Estrutura de dados inválida.');
  const ids = new Set();
  const names = new Set();
  const uniqueId = id => {
    if (!validText(id, 1, 128) || id !== id.trim() || ids.has(id)) return false;
    ids.add(id);
    return true;
  };
  for (const s of candidate.subjects) {
    if (!s || !uniqueId(s.id) || !validText(s.name, 2, 80) || typeof s.color !== 'string' || !/^#[a-f\d]{6}$/i.test(s.color)) throw new TypeError('Disciplina inválida.');
    const name = s.name.trim().toLocaleLowerCase('pt-BR');
    if (names.has(name)) throw new TypeError('Disciplina duplicada.');
    names.add(name);
  }
  for (const t of candidate.tasks) {
    if (!t || !uniqueId(t.id) || !validTask(t, candidate.subjects) || typeof t.done !== 'boolean') throw new TypeError('Tarefa inválida.');
  }
  if (Object.hasOwn(candidate, 'flashcards')) {
    validateFlashcards(candidate.flashcards, candidate.subjects, uniqueId);
    if (Object.hasOwn(candidate.flashcards, 'sessions')) validateStudySessions(candidate.flashcards.sessions, uniqueId);
  }
  // Não descarta registros nem campos adicionais de dados existentes.
  return candidate;
}

export function loadData(storage) {
  let raw;
  try {
    raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
  } catch {
    return { status: 'read-error', data: null };
  }
  if (raw === null) return { status: 'empty', data: initialData(), raw };
  try {
    return { status: 'ready', data: normalizeData(JSON.parse(raw)), raw };
  } catch {
    return { status: 'corrupt', data: null, raw };
  }
}

export function saveData(data, storage, expectedRaw) {
  let raw;
  try {
    normalizeData(data);
    raw = JSON.stringify(data);
  } catch {
    return { ok: false, status: 'invalid-data' };
  }
  let target;
  try {
    target = storage ?? globalThis.localStorage;
  } catch {
    return { ok: false, status: 'read-error' };
  }
  const current = loadData(target);
  if (!['ready', 'empty'].includes(current.status)) return { ok: false, status: current.status };
  // Detecta alterações ocorridas desde a leitura desta aba, antes de gravar.
  if (expectedRaw !== undefined && current.raw !== expectedRaw) return { ok: false, status: 'conflict' };
  try {
    target.setItem(STORAGE_KEY, raw);
    return { ok: true, status: 'saved', raw };
  } catch {
    return { ok: false, status: 'write-error' };
  }
}

function validText(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

export function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function progress(tasks) {
  return tasks.length ? Math.round(tasks.filter(t => t.done).length * 100 / tasks.length) : 0;
}

export function filterTasks(tasks, { status = 'Todas', subject = null, query = '' } = {}) {
  const search = query.trim().toLocaleLowerCase('pt-BR');
  return tasks.filter(t =>
    (status === 'Todas' || (status === 'Pendentes' ? !t.done : t.done)) &&
    (subject === null || t.subject === subject) &&
    t.title.toLocaleLowerCase('pt-BR').includes(search)
  ).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'pt-BR'));
}

export function validTask(input, subjects) {
  return !!input && validText(input.title, 2, 120) &&
    subjects.some(s => s.id === input.subject) &&
    validDate(input.date) &&
    ['Alta', 'Média', 'Baixa'].includes(input.priority);
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

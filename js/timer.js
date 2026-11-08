export const CHECKPOINT_MS = 5000;
export const RELOAD_KEY = 'trilora-timer-reload';

export function timerOf(data) {
  return data.studyTimer ?? { active: null, sessions: [] };
}

export function withTimer(data, active, sessions = timerOf(data).sessions) {
  return { ...data, studyTimer: { ...timerOf(data), active, sessions } };
}

export function newTimer(id, subject, startedAt) {
  return { id, subject, startedAt, running: true, segments: [] };
}

function lastEnd(active) {
  return active.segments.at(-1)?.end ?? active.startedAt;
}

export function timerAnchor(active, wall, monotonic) {
  return { start: Math.max(wall, lastEnd(active)), monotonic };
}

export function checkpointTimer(active, anchor, monotonic) {
  if (!active.running || !anchor) return active;
  const end = anchor.start + Math.max(0, Math.floor(monotonic - anchor.monotonic));
  if (end <= lastEnd(active) || end <= anchor.start) return active;
  const segments = active.segments.slice();
  const segment = { start: anchor.start, end };
  if (segments.at(-1)?.start === anchor.start) segments[segments.length - 1] = segment;
  else segments.push(segment);
  return { ...active, segments };
}

export function resumeAfterReload(active, navigation, marker, wall) {
  const age = wall - marker?.savedAt;
  return !!active?.running && navigation === 'reload' && marker?.id === active.id &&
    Number.isSafeInteger(marker.savedAt) && age >= 0 && age <= 15000;
}

export function durationOf(segments) {
  return segments.reduce((duration, { start, end }) => duration + (end - start), 0);
}

export function finishTimer(active, subjectName, wall) {
  const { id, subject, startedAt, segments } = active;
  return { id, subject, subjectName, startedAt, endedAt: Math.max(wall, lastEnd(active)), durationMs: durationOf(segments), segments };
}

export function withCompletedTimer(data, record) {
  const { active, sessions } = timerOf(data);
  if (active?.id !== record.id || sessions.some(session => session.id === record.id)) return data;
  return withTimer(data, null, [...sessions, record]);
}

function validInstant(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
}

function validSegments(record, maxEnd) {
  if (!Array.isArray(record.segments)) return false;
  let previousEnd = record.startedAt;
  for (const segment of record.segments) {
    if (!segment || !validInstant(segment.start) || !validInstant(segment.end) ||
        segment.start < previousEnd || segment.end <= segment.start || segment.end > maxEnd) return false;
    previousEnd = segment.end;
  }
  return true;
}

function validReference(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && id === id.trim();
}

export function validateTimerData(timer, subjects, uniqueId) {
  if (!timer || !Array.isArray(timer.sessions)) throw new TypeError('Histórico de tempo inválido.');
  const { active, sessions } = timer;
  if (active !== null && (!active || !uniqueId(active.id) ||
      !subjects.some(subject => subject.id === active.subject) || !validInstant(active.startedAt) ||
      typeof active.running !== 'boolean' || !validSegments(active, Infinity))) {
    throw new TypeError('Cronômetro em andamento inválido.');
  }
  for (const record of sessions) {
    if (!record || !uniqueId(record.id) || !validReference(record.subject) ||
        typeof record.subjectName !== 'string' || record.subjectName.trim().length < 2 || record.subjectName.length > 80 ||
        !validInstant(record.startedAt) || !validInstant(record.endedAt) || record.endedAt < record.startedAt ||
        !validSegments(record, record.endedAt) || record.durationMs !== durationOf(record.segments)) {
      throw new TypeError('Sessão de tempo inválida.');
    }
  }
}

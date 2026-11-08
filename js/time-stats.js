function timeWithin(segments, start, end) {
  return segments.reduce((total, segment) =>
    total + Math.max(0, Math.min(segment.end, end) - Math.max(segment.start, start)), 0);
}

export function timeStatistics(sessions, subjects, now) {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const todayStart = midnight.getTime();
  midnight.setDate(midnight.getDate() - 6);
  const weekStart = midnight.getTime();
  const bySubject = new Map(subjects.map(subject =>
    [subject.id, { id: subject.id, name: subject.name, color: subject.color, durationMs: 0 }]));
  let total = 0;
  let today = 0;
  let week = 0;
  for (const record of sessions) {
    total += record.durationMs;
    today += timeWithin(record.segments, todayStart, now);
    week += timeWithin(record.segments, weekStart, now);
    if (!bySubject.has(record.subject)) {
      bySubject.set(record.subject, { id: record.subject, name: record.subjectName, color: '#7363dc', durationMs: 0 });
    }
    bySubject.get(record.subject).durationMs += record.durationMs;
  }
  const disciplines = [...bySubject.values()].sort((a, b) =>
    b.durationMs - a.durationMs || a.name.localeCompare(b.name, 'pt-BR'));
  return { total, today, week, disciplines };
}

export function formatDuration(milliseconds, clock = false) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  if (clock) return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
  return [hours && `${hours} h`, (hours || minutes) && `${minutes} min`, `${remainder} s`].filter(Boolean).join(' ');
}

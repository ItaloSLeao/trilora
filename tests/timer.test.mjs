import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData, saveData, STORAGE_KEY } from '../js/data.js';
import {
  checkpointTimer, durationOf, finishTimer, newTimer, resumeAfterReload,
  timerAnchor, timerOf, withCompletedTimer, withTimer,
} from '../js/timer.js';
import { formatDuration, timeStatistics } from '../js/time-stats.js';

const subjects = [
  { id: 's1', name: 'Matemática', color: '#7363dc' },
  { id: 's2', name: 'História', color: '#51b7a2' },
];
const legacy = { subjects, tasks: [], flashcards: { decks: [], cards: [], sessions: [] }, extra: 'preservar' };
const start = 1_700_000_000_000;
const draft = () => newTimer('session-1', 's1', start);

function storageOf(data) {
  let raw = JSON.stringify(data);
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; },
  };
}

test('cronômetro começa em zero e mede pelo relógio, mesmo sem callbacks intermediários', () => {
  const active = draft();
  const anchor = timerAnchor(active, start, 100);
  assert.equal(formatDuration(durationOf(active.segments), true), '00:00:00');
  const first = checkpointTimer(active, anchor, 7_640.9);
  const second = checkpointTimer(first, anchor, 61_450);
  assert.deepEqual(second.segments, [{ start, end: start + 61_350 }]);
  assert.equal(formatDuration(durationOf(second.segments), true), '00:01:01');
  assert.equal(checkpointTimer(second, anchor, 99), second);
});

test('pausa, retomada e encerramento contam somente intervalos ativos', () => {
  const active = draft();
  const first = checkpointTimer(active, timerAnchor(active, start, 0), 5_000);
  const paused = { ...first, running: false };
  assert.equal(checkpointTimer(paused, timerAnchor(first, start, 0), 70_000), paused);
  const resumed = { ...paused, running: true };
  const anchor = timerAnchor(resumed, start + 70_000, 70_000);
  const result = finishTimer(checkpointTimer(resumed, anchor, 73_500), 'Matemática', start + 73_500);
  assert.deepEqual(result, {
    id: 'session-1', subject: 's1', subjectName: 'Matemática', startedAt: start, endedAt: start + 73_500, durationMs: 8_500,
    segments: [{ start, end: start + 5_000 }, { start: start + 70_000, end: start + 73_500 }],
  });
  assert.equal(finishTimer(paused, 'Matemática', start + 70_000).durationMs, 5_000);
});

test('recarregamento retoma um ponto recente da mesma sessão e exclui a lacuna de navegação', () => {
  const first = draft();
  const active = checkpointTimer(first, timerAnchor(first, start, 0), 12_000);
  const marker = { id: active.id, savedAt: start + 12_000 };
  const now = start + 14_000;
  assert.equal(resumeAfterReload(active, 'reload', marker, now), true);
  for (const [navigation, evidence, wall] of [
    ['navigate', marker, now], ['back_forward', marker, now], ['reload', null, now],
    ['reload', { ...marker, id: 'other' }, now], ['reload', marker, now + 86_400_000],
    ['reload', marker, start],
  ]) assert.equal(resumeAfterReload(active, navigation, evidence, wall), false);
  assert.equal(resumeAfterReload({ ...active, running: false }, 'reload', marker, now), false);
  const reloaded = checkpointTimer(active, timerAnchor(active, now, 20), 3_020);
  assert.equal(durationOf(reloaded.segments), 15_000);
  assert.equal(finishTimer(active, 'Matemática', now + 86_400_000).durationMs, 12_000);
});

test('ajuste regressivo do relógio de parede não sobrepõe intervalos nem produz duração negativa', () => {
  const first = draft();
  const checkpoint = checkpointTimer(first, timerAnchor(first, start, 500), 2_500);
  const anchor = timerAnchor(checkpoint, start - 60_000, 0);
  const measured = checkpointTimer(checkpoint, anchor, 500);
  const result = finishTimer(measured, 'Matemática', start - 60_000);
  assert.deepEqual(result.segments, [{ start, end: start + 2_000 }, { start: start + 2_000, end: start + 2_500 }]);
  assert.equal(result.endedAt, start + 2_500);
  assert.equal(result.durationMs, 2_500);
});

test('rascunho e histórico usam trilora-v1, preservam dados legados e finalizam uma única vez', () => {
  const storage = storageOf(legacy);
  const original = loadData(storage);
  assert.deepEqual(original.data, legacy);
  assert.deepEqual(timerOf(original.data), { active: null, sessions: [] });
  const first = draft();
  const active = checkpointTimer(first, timerAnchor(first, start, 0), 5_000);
  const data = withTimer(original.data, active);
  assert.equal(saveData(data, storage, original.raw).ok, true);
  const checkpoint = loadData(storage);
  assert.deepEqual(timerOf(checkpoint.data).active, active);
  const record = finishTimer(active, 'Matemática', start + 5_000);
  const completed = withCompletedTimer(checkpoint.data, record);
  assert.equal(withCompletedTimer(completed, record), completed);
  assert.equal(saveData(completed, storage, checkpoint.raw).ok, true);
  assert.deepEqual(loadData(storage).data, { ...legacy, studyTimer: { active: null, sessions: [record] } });
  const afterSubjectRemoval = { ...completed, subjects: subjects.slice(1) };
  assert.equal(saveData(afterSubjectRemoval, storage).ok, true);
  assert.deepEqual(timerOf(loadData(storage).data).sessions, [record]);
});

test('falha ao encerrar conserva o rascunho e permite salvar a mesma sessão depois', () => {
  const first = draft();
  const active = checkpointTimer(first, timerAnchor(first, start, 0), 8_000);
  const storage = storageOf(withTimer(legacy, active));
  const loaded = loadData(storage);
  const record = finishTimer(active, 'Matemática', start + 8_000);
  const next = withCompletedTimer(loaded.data, record);
  const write = storage.setItem;
  storage.setItem = () => { throw Error('Quota'); };
  assert.deepEqual(saveData(next, storage, loaded.raw), { ok: false, status: 'write-error' });
  assert.deepEqual(timerOf(loadData(storage).data), { active, sessions: [] });
  storage.setItem = write;
  assert.equal(saveData(next, storage, loaded.raw).ok, true);
  assert.deepEqual(timerOf(loadData(storage).data).sessions, [record]);
});

test('validação rejeita duração negativa, sobreposição, duplicação e disciplina ativa ausente', () => {
  const first = draft();
  const active = checkpointTimer(first, timerAnchor(first, start, 0), 8_000);
  const record = finishTimer(active, 'Matemática', start + 8_000);
  for (const broken of [
    withTimer(legacy, { ...active, subject: 'absent' }),
    withTimer(legacy, active, [record]),
    withTimer(legacy, null, [{ ...record, durationMs: -1 }]),
    withTimer(legacy, null, [{ ...record, segments: [...record.segments, { start: start + 1, end: start + 2 }] }]),
    withTimer(legacy, null, [record, record]),
  ]) {
    const storage = storageOf(broken);
    const raw = storage.getItem(STORAGE_KEY);
    assert.equal(loadData(storage).status, 'corrupt');
    assert.equal(saveData(legacy, storage).status, 'corrupt');
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.equal(saveData(broken, storageOf(legacy)).status, 'invalid-data');
  }
});

test('estatísticas dividem sessões que cruzam dias e agregam disciplinas excluídas', () => {
  const today = new Date(2026, 10, 8).getTime();
  const week = new Date(2026, 10, 2).getTime();
  const sessions = [
    { subject: 's1', durationMs: 180_000, segments: [{ start: today - 60_000, end: today + 60_000 }, { start: today + 90_000, end: today + 150_000 }] },
    { subject: 'removed', subjectName: 'Geografia', durationMs: 60_000, segments: [{ start: week - 30_000, end: week + 30_000 }] },
  ];
  const stats = timeStatistics(sessions, subjects, today + 1_000_000);
  assert.equal(stats.total, 240_000);
  assert.equal(stats.today, 120_000);
  assert.equal(stats.week, 210_000);
  assert.deepEqual(stats.disciplines.map(({ name, durationMs }) => [name, durationMs]), [
    ['Matemática', 180_000], ['Geografia', 60_000], ['História', 0],
  ]);
  assert.equal(formatDuration(3_723_450), '1 h 2 min 3 s');
});

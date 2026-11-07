import test from 'node:test';
import assert from 'node:assert/strict';
import { progress, filterTasks, validTask, validDate, localDate, calendarDate, normalizeData, escapeHTML, saveData, loadData, STORAGE_KEY } from '../js/data.js';

const subjects = [{ id: 's1', name: 'Lógica', color: '#7363dc' }, { id: 's2', name: 'Cálculo', color: '#51b7a2' }];
const tasks = [
  { id: 'a', title: 'Prova de lógica', subject: 's1', date: '2026-11-10', priority: 'Alta', done: false },
  { id: 'b', title: 'Lista de cálculo', subject: 's2', date: '2026-11-05', priority: 'Média', done: true },
  { id: 'c', title: 'Revisar lógica', subject: 's1', date: '2026-11-07', priority: 'Baixa', done: false },
];

test('calcula o percentual de conclusão e trata lista vazia', () => {
  assert.equal(progress(tasks), 33);
  assert.equal(progress([]), 0);
});

test('filtra por situação, disciplina e pesquisa sem diferenciar maiúsculas', () => {
  assert.deepEqual(filterTasks(tasks, { status: 'Pendentes', subject: 's1', query: 'LÓGICA' }).map(t => t.id), ['c', 'a']);
  assert.deepEqual(filterTasks(tasks, { status: 'Concluídas' }).map(t => t.id), ['b']);
});

test('não altera a ordem original ao filtrar', () => {
  const ids = tasks.map(t => t.id);
  filterTasks(tasks);
  assert.deepEqual(tasks.map(t => t.id), ids);
});

test('valida tarefas e rejeita datas impossíveis', () => {
  const valid = { title: '  Fazer exercício  ', subject: 's1', date: '2026-11-30', priority: 'Alta' };
  assert.equal(validTask(valid, subjects), true);
  assert.equal(validTask({ ...valid, date: '2026-02-30' }, subjects), false);
  assert.equal(validTask({ ...valid, subject: 'inexistente' }, subjects), false);
  assert.equal(validTask({ ...valid, title: ' ' }, subjects), false);
});

test('normaliza dados inválidos e preserva dados válidos da versão anterior', () => {
  const result = normalizeData({ subjects, tasks });
  assert.equal(result.subjects.length, 2);
  assert.equal(result.tasks.length, 3);
  assert.throws(() => normalizeData(null), TypeError);
});

test('escapa conteúdo HTML fornecido pelo usuário', () => {
  assert.equal(escapeHTML('<script>"&</script>'), '&lt;script&gt;&quot;&amp;&lt;/script&gt;');
});

test('salva e recupera no mesmo formato de localStorage da versão 1.0', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  assert.equal(saveData({ subjects, tasks }, storage).ok, true);
  assert.ok(memory.has(STORAGE_KEY));
  assert.deepEqual(loadData(storage).data, { subjects, tasks });
});

function memoryStorage(raw = null) {
  return {
    raw, writes: 0,
    getItem(key) { assert.equal(key, STORAGE_KEY); return this.raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); this.raw = value; this.writes++; },
  };
}

const fixture = () => structuredClone({ subjects, tasks });

test('validação integral rejeita registros sem descartar silenciosamente dados', () => {
  const mutations = [
    d => { d.tasks = null; },
    d => { d.subjects.push({ ...d.subjects[0] }); },
    d => { d.tasks.push({ ...d.tasks[0] }); },
    d => { d.tasks[0].id = d.subjects[0].id; },
    d => { d.tasks[0].id = ''; },
    d => { d.tasks[0].id = ' a '; },
    d => { d.tasks[0].id = 'x'.repeat(129); },
    d => { d.subjects[0].name = ' '; },
    d => { d.subjects[0].name = 'x'.repeat(81); },
    d => { d.subjects[1].name = ' LÓGICA '; },
    d => { d.subjects[0].color = 'red'; },
    d => { d.subjects[0] = null; },
    d => { d.tasks[0].title = ''; },
    d => { d.tasks[0].title = 'x'.repeat(121); },
    d => { d.tasks[0].title = 123; },
    d => { d.tasks[0].subject = 'missing'; },
    d => { d.tasks[0].date = '2026-02-30'; },
    d => { d.tasks[0].date = 20261110; },
    d => { d.tasks[0].priority = 'Urgente'; },
    d => { d.tasks[0].done = 'false'; },
    d => { d.tasks[0] = null; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const data = fixture();
    mutate(data);
    const before = structuredClone(data);
    assert.throws(() => normalizeData(data), TypeError, `caso ${index}`);
    assert.deepEqual(data, before);
  }
});

test('datas respeitam formato, limites e anos bissextos sem depender de fuso horário', () => {
  for (const date of ['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31']) assert.equal(validDate(date), true, date);
  for (const date of ['0000-01-01', '1900-02-29', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01x']) assert.equal(validDate(date), false, date);
});

test('limites máximos e dados legados válidos são preservados, inclusive campos adicionais', () => {
  const data = fixture();
  data.tasks[0].id = 'x'.repeat(128);
  data.tasks[0].title = 'x'.repeat(120);
  data.subjects[0].name = 'x'.repeat(80);
  data.extra = { preserved: true };
  data.tasks[0].notes = 'Informação legada';
  const storage = memoryStorage(JSON.stringify(data));
  const loaded = loadData(storage);
  assert.equal(loaded.status, 'ready');
  assert.deepEqual(loaded.data, data);
  assert.equal(storage.writes, 0);
  assert.equal(saveData(loaded.data, storage, loaded.raw).ok, true);
  assert.deepEqual(JSON.parse(storage.raw), data);
});

test('ausência de chave gera demonstração; coleção vazia salva continua vazia', () => {
  const storage = memoryStorage();
  const empty = loadData(storage);
  assert.equal(empty.status, 'empty');
  assert.equal(empty.raw, null);
  assert.equal(empty.data.subjects.length, 3);
  assert.equal(storage.writes, 0);
  storage.raw = JSON.stringify({ subjects: [], tasks: [] });
  assert.deepEqual(loadData(storage), { status: 'ready', raw: storage.raw, data: { subjects: [], tasks: [] } });
});

test('JSON corrompido ou schema inválido preservam o conteúdo e bloqueiam gravação', () => {
  const invalid = fixture();
  invalid.tasks[0].subject = 'missing';
  for (const raw of ['', '{invalid', 'null', '{}', JSON.stringify(invalid)]) {
    const storage = memoryStorage(raw);
    assert.deepEqual(loadData(storage), { status: 'corrupt', data: null, raw });
    assert.deepEqual(saveData(fixture(), storage), { ok: false, status: 'corrupt' });
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
  }
});

test('falha de leitura não gera demonstração nem permite gravar', () => {
  let writes = 0;
  const storage = { getItem() { throw new Error('denied'); }, setItem() { writes++; } };
  assert.deepEqual(loadData(storage), { status: 'read-error', data: null });
  assert.deepEqual(saveData(fixture(), storage), { ok: false, status: 'read-error' });
  assert.equal(writes, 0);
});

test('acesso ao próprio localStorage é protegido, inclusive quando indisponível', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    for (const get of [() => { throw new Error('SecurityError'); }, () => undefined]) {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, get });
      assert.equal(loadData().status, 'read-error');
      assert.deepEqual(saveData(fixture()), { ok: false, status: 'read-error' });
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('falha de gravação não altera o conteúdo existente e permite tentar novamente', () => {
  const storage = memoryStorage(JSON.stringify(fixture()));
  const loaded = loadData(storage);
  const next = fixture();
  next.tasks[0].done = true;
  const setItem = storage.setItem;
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.deepEqual(saveData(next, storage, loaded.raw), { ok: false, status: 'write-error' });
  assert.equal(storage.raw, loaded.raw);
  storage.setItem = setItem;
  assert.equal(saveData(next, storage, loaded.raw).ok, true);
  assert.deepEqual(loadData(storage).data, next);
});

test('dados inválidos não chegam à gravação', () => {
  const storage = memoryStorage();
  assert.deepEqual(saveData({ subjects: [], tasks }, storage), { ok: false, status: 'invalid-data' });
  assert.equal(storage.writes, 0);
});

test('mudança da chave após a leitura bloqueia a gravação de estado obsoleto', () => {
  const storage = memoryStorage();
  const first = loadData(storage);
  assert.equal(saveData(fixture(), storage, first.raw).ok, true);
  const newer = storage.raw;
  assert.deepEqual(saveData(first.data, storage, first.raw), { ok: false, status: 'conflict' });
  assert.equal(storage.raw, newer);
  const loaded = loadData(storage);
  storage.raw = null;
  assert.equal(saveData(fixture(), storage, loaded.raw).status, 'conflict');
  assert.equal(storage.writes, 1);
});

test('calendário mantém anos com quatro dígitos e não aplica o deslocamento de 1900', () => {
  for (const date of ['0001-01-01', '0096-02-29', '0099-12-31', '0100-03-01', '0999-01-01', '1000-01-01', '2000-02-29', '9999-12-31']) {
    const [year, month, day] = date.split('-').map(Number);
    assert.equal(localDate(calendarDate(year, month - 1, day)), date);
    const legacy = fixture();
    legacy.tasks[0].date = date;
    const storage = memoryStorage(JSON.stringify(legacy));
    const loaded = loadData(storage);
    assert.equal(loaded.status, 'ready');
    assert.equal(storage.writes, 0);
    assert.equal(saveData(loaded.data, storage, loaded.raw).ok, true);
    assert.deepEqual(loadData(storage).data, legacy);
  }
  assert.equal(calendarDate(1, 0, 1).getDay(), 1); // 01/01/0001: segunda-feira.
  assert.equal(calendarDate(2000, 0, 1).getDay(), 6); // 01/01/2000: sábado.
  assert.equal(localDate(calendarDate(99, 12, 1)), '0100-01-01');
  assert.equal(localDate(calendarDate(100, -1, 1)), '0099-12-01');
  assert.equal(calendarDate(96, 2, 0).getDate(), 29);
  assert.equal(calendarDate(100, 2, 0).getDate(), 28);
});

test('ausência de filtro não colide com o ID de disciplina Todas', () => {
  const data = fixture();
  data.subjects[0].id = 'Todas';
  data.tasks.filter(t => t.subject === 's1').forEach(t => { t.subject = 'Todas'; });
  assert.doesNotThrow(() => normalizeData(data));
  assert.deepEqual(filterTasks(data.tasks, { subject: 'Todas' }).map(t => t.id), ['c', 'a']);
  assert.deepEqual(filterTasks(data.tasks, { subject: null }).map(t => t.id), ['b', 'c', 'a']);
  assert.deepEqual(filterTasks(data.tasks).map(t => t.id), ['b', 'c', 'a']);
  const storage = memoryStorage(JSON.stringify(data));
  assert.deepEqual(loadData(storage).data, data);
});

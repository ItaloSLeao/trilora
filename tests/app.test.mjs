import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as api from '../js/data.js';
import { flashcardsOf } from '../js/flashcards.js';
import { createFlashcardsUI } from '../js/flashcards-view.js';
import { timerOf } from '../js/timer.js';
import { createTimerUI, renderTimeStatistics } from '../js/timer-view.js';

// Executa os handlers reais sem dependências externas. Não substitui teste visual.
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
const fixture = () => ({
  subjects: [
    { id: 's1', name: 'Lógica', color: '#7363dc' },
    { id: 's2', name: 'Cálculo', color: '#51b7a2' },
    { id: 's3', name: 'Física', color: '#f3ad67' },
    { id: 's4', name: 'Química', color: '#7363dc' },
  ],
  tasks: [
    { id: 't1', title: 'Estudar lógica', subject: 's1', date: '2026-11-10', priority: 'Alta', done: false },
    { id: 't2', title: 'Lista de lógica', subject: 's1', date: '2026-11-11', priority: 'Baixa', done: false, notes: 'Preservar' },
    { id: 't3', title: 'Revisar cálculo', subject: 's2', date: '2026-11-12', priority: 'Média', done: true },
  ],
});

// Apenas os controles utilizados pelos formulários atuais são simulados.
// Cada montagem cria novos controles; ler innerHTML não revela alterações em .value.
const decode = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, key) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[key]);
const attribute = (text, name) => decode(text.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '');

function harness({ failWrite = false, failRead = false, raw = JSON.stringify(fixture()) } = {}) {
  const elements = new Map();
  const events = new Map();
  const alerts = [];
  let generatedIds = 0;
  let mountedForms = [];
  const element = id => {
    if (!elements.has(id)) {
      let html = '';
      elements.set(id, {
        textContent: 'Dados neste navegador.', attrs: {}, handlers: {},
        addEventListener(type, handler) { this.handlers[type] = handler; },
        setAttribute(key, value) { this.attrs[key] = value; },
        removeAttribute(key) { delete this.attrs[key]; },
        querySelector() { return { focus() {} }; },
        get innerHTML() { return html; },
        set innerHTML(value) {
          html = value;
          if (id !== 'modalroot') return;
          for (const formId of mountedForms) elements.delete(formId);
          mountedForms = [];
          for (const match of value.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)) {
            const formId = attribute(match[1], 'id');
            const form = element(formId);
            form.controls = {};
            for (const input of match[2].matchAll(/<input\b([^>]*)>/g)) {
              const initial = attribute(input[1], 'value');
              form.controls[attribute(input[1], 'name')] = { value: initial, defaultValue: initial };
            }
            for (const select of match[2].matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
              const options = [...select[2].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)];
              const option = options.find(o => /\bselected\b/.test(o[1])) ?? options[0];
              const initial = /\bvalue=/.test(option[1]) ? attribute(option[1], 'value') : decode(option[2]);
              form.controls[attribute(select[1], 'name')] = { value: initial, defaultValue: initial };
            }
            form.elements = { namedItem: name => form.controls[name] ?? null };
            form.reset = () => { for (const control of Object.values(form.controls)) control.value = control.defaultValue; };
            mountedForms.push(formId);
          }
        },
      });
    }
    return elements.get(id);
  };
  const storage = {
    raw, writes: 0, failWrite, failRead,
    getItem() { if (this.failRead) throw new Error('denied'); return this.raw; },
    setItem(key, value) { if (this.failWrite) throw new Error('quota'); this.raw = value; this.writes++; },
  };
  const context = vm.createContext({
    ...api, e: api.escapeHTML, flashcardsOf, createFlashcardsUI, timerOf, createTimerUI, renderTimeStatistics,
    addEventListener() {},
    loadData: () => api.loadData(storage),
    saveData: (data, unused, expectedRaw) => api.saveData(data, storage, expectedRaw),
    crypto: { randomUUID: () => `new-${++generatedIds}` }, alert: message => alerts.push(message), confirm: () => true,
    FormData: class { constructor(form) { this.form = form; } get(key) { return this.form.elements.namedItem(key)?.value ?? null; } },
    document: {
      getElementById: element, querySelector: () => element('notice'), querySelectorAll: () => [],
      addEventListener: (type, handler) => events.set(type, handler),
    },
  });
  vm.runInContext(source, context);
  return {
    storage, alerts, element,
    state: () => JSON.parse(vm.runInContext('JSON.stringify(data)', context)),
    click(dataset) {
      const button = { dataset, hasAttribute: name => Object.hasOwn(dataset, name.replace('data-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())) };
      events.get('click')({ target: { closest: () => button } });
    },
    fill(id, values) { for (const [name, value] of Object.entries(values)) element(id).elements.namedItem(name).value = value; },
    formValues: id => Object.fromEntries(Object.entries(element(id).controls).map(([name, control]) => [name, control.value])),
    submit(id, values) {
      if (values) for (const [name, value] of Object.entries(values)) element(id).elements.namedItem(name).value = value;
      const form = element(id);
      form.handlers.submit({ preventDefault() {}, currentTarget: form });
    },
    toggle(id = 't1', checked = true) {
      const target = { dataset: { toggle: id }, checked };
      events.get('change')({ target });
      return target;
    },
    change(id, value) { events.get('change')({ target: { id, value, dataset: {} } }); },
    evaluate: code => vm.runInContext(code, context),
  };
}

const values = { title: 'Nova atividade', subject: 's2', date: '2026-11-12', priority: 'Média' };
const subjectValues = { name: 'Biologia', color: '#123456' };
const operations = [
  ['criar tarefa', h => { h.click({ addTask: '' }); h.submit('taskForm', values); }, 'taskForm', d => { d.tasks.push({ id: 'new-1', ...values, done: false }); }],
  ['editar tarefa', h => { h.click({ editTask: 't1' }); h.submit('taskForm', values); }, 'taskForm', d => { Object.assign(d.tasks[0], values); }],
  ['criar disciplina', h => { h.click({ addSubject: '' }); h.submit('subjectForm', subjectValues); }, 'subjectForm', d => { d.subjects.push({ id: 'new-1', ...subjectValues }); }],
  ['excluir tarefa', h => h.click({ deleteTask: 't1' }), null, d => { d.tasks.splice(0, 1); }],
  ['excluir disciplina', h => h.click({ deleteSubject: 's3' }), null, d => { d.subjects.splice(2, 1); }],
  ['concluir tarefa', h => assert.equal(h.toggle().checked, !h.storage.failWrite), null, d => { d.tasks[0].done = true; }],
  ['reabrir tarefa', h => assert.equal(h.toggle('t3', false).checked, h.storage.failWrite), null, d => { d.tasks[2].done = false; }],
];

for (const [name, act, formId, updateExpected] of operations) {
  test(`interface mantém estado e formulário ao falhar em ${name}`, () => {
    const h = harness({ failWrite: true });
    const before = h.storage.raw;
    act(h);
    assert.deepEqual(h.state(), fixture());
    assert.equal(h.storage.raw, before);
    assert.match(h.element('notice').textContent, /não salva/i);
    assert.equal(h.element('notice').attrs.role, 'alert');
    if (formId) assert.deepEqual(h.formValues(formId), formId === 'taskForm' ? values : subjectValues);
    assert.equal(h.alerts.length, 1);
  });
  test(`interface confirma estado apenas após salvar: ${name}`, () => {
    const h = harness();
    act(h);
    const expected = fixture();
    updateExpected(expected);
    assert.deepEqual(h.state(), expected);
    assert.deepEqual(JSON.parse(h.storage.raw), expected);
    assert.equal(h.storage.writes, 1);
    assert.equal(h.alerts.length, 0);
    if (formId) assert.equal(h.element('modalroot').innerHTML, '');
  });
}

test('formulário conserva os valores e permite nova tentativa após falha', () => {
  const h = harness({ failWrite: true });
  h.click({ editTask: 't1' });
  const form = h.element('taskForm');
  h.fill('taskForm', values);
  h.submit('taskForm');
  assert.equal(h.element('taskForm'), form);
  assert.deepEqual(h.formValues('taskForm'), values);
  h.storage.failWrite = false;
  h.submit('taskForm');
  assert.equal(h.state().tasks[0].title, values.title);
  assert.equal(h.element('modalroot').innerHTML, '');
  assert.equal(h.element('notice').attrs.role, undefined);
});

for (const options of [{ raw: '{invalid' }, { failRead: true }]) {
  test(`inicialização bloqueia alterações e avisa sem substituir dados: ${JSON.stringify(options)}`, () => {
    const h = harness(options);
    const raw = h.storage.raw;
    assert.deepEqual(h.state(), { subjects: [], tasks: [] });
    assert.match(h.element('notice').textContent, /bloqueadas/);
    h.click({ addTask: '' });
    h.click({ addSubject: '' });
    assert.equal(h.element('modalroot').innerHTML, '');
    assert.equal(h.storage.raw, raw);
    assert.equal(h.storage.writes, 0);
  });
}

test('corrupção após a carga não é sobrescrita por uma ação da interface', () => {
  const h = harness();
  h.storage.raw = '{recoverable';
  h.click({ deleteTask: 't1' });
  assert.deepEqual(h.state(), fixture());
  assert.equal(h.storage.raw, '{recoverable');
  assert.equal(h.storage.writes, 0);
  assert.match(h.element('notice').textContent, /corrompidos/);
});

test('mudança em outra aba preserva o novo conteúdo e bloqueia estado obsoleto', () => {
  const h = harness();
  const other = fixture();
  other.tasks[0].title = 'Alterada em outra aba';
  h.storage.raw = JSON.stringify(other);
  assert.equal(h.toggle().checked, false);
  assert.deepEqual(h.state(), fixture());
  assert.deepEqual(JSON.parse(h.storage.raw), other);
  assert.match(h.element('notice').textContent, /outra aba/);
  h.click({ addTask: '' });
  assert.equal(h.element('modalroot').innerHTML, '');
});

test('falha de releitura após inicialização reverte a ação e bloqueia novas alterações', () => {
  const h = harness();
  const raw = h.storage.raw;
  h.storage.failRead = true;
  assert.equal(h.toggle().checked, false);
  assert.deepEqual(h.state(), fixture());
  assert.equal(h.storage.raw, raw);
  assert.equal(h.storage.writes, 0);
  assert.match(h.element('notice').textContent, /ler o armazenamento/);
  h.click({ addSubject: '' });
  assert.equal(h.element('modalroot').innerHTML, '');
});

test('edição pela interface preserva campos adicionais de registros existentes', () => {
  const legacy = fixture();
  legacy.metadata = { version: '1.1' };
  legacy.tasks[0].notes = 'Preservar';
  const h = harness({ raw: JSON.stringify(legacy) });
  assert.equal(h.storage.writes, 0);
  h.click({ editTask: 't1' });
  h.submit('taskForm', values);
  const saved = JSON.parse(h.storage.raw);
  assert.deepEqual(saved.metadata, legacy.metadata);
  assert.equal(saved.tasks[0].notes, 'Preservar');
  assert.equal(saved.tasks[0].title, values.title);
});

test('formulário de edição expõe os valores carregados nos controles', () => {
  const data = fixture();
  data.tasks[0].title = 'Revisar "A" & <B>';
  const h = harness({ raw: JSON.stringify(data) });
  h.click({ editTask: 't1' });
  assert.deepEqual(h.formValues('taskForm'), {
    title: data.tasks[0].title, subject: 's1', date: '2026-11-10', priority: 'Alta',
  });
  const typed = { ...values, title: '  Revisar "C" & <D>  ' };
  h.fill('taskForm', typed);
  assert.deepEqual(h.formValues('taskForm'), typed);
  h.storage.failWrite = true;
  h.submit('taskForm');
  assert.deepEqual(h.formValues('taskForm'), typed);
  h.storage.failWrite = false;
  h.submit('taskForm');
  const expected = structuredClone(data);
  Object.assign(expected.tasks[0], typed, { title: typed.title.trim() });
  assert.deepEqual(h.state(), expected);
  assert.deepEqual(JSON.parse(h.storage.raw), expected);
});

test('disciplina com tarefas não é excluída nem provoca gravação', () => {
  const h = harness();
  h.click({ deleteSubject: 's1' });
  assert.deepEqual(h.state(), fixture());
  assert.deepEqual(JSON.parse(h.storage.raw), fixture());
  assert.equal(h.storage.writes, 0);
  assert.match(h.alerts[0], /Remova as tarefas/);
});

test('filtro da interface distingue o ID Todas da opção sem filtro', () => {
  const data = fixture();
  data.subjects[0].id = 'Todas';
  data.tasks[0].subject = 'Todas';
  data.tasks[1].subject = 'Todas';
  const h = harness({ raw: JSON.stringify(data) });
  h.click({ page: 'tasks' });
  h.change('subjectFilter', 'Todas');
  const filtered = h.element('page').innerHTML;
  assert.match(filtered, /data-toggle="t1"/);
  assert.match(filtered, /data-toggle="t2"/);
  assert.doesNotMatch(filtered, /data-toggle="t3"/);
  assert.match(filtered, /value="Todas" selected/);
  h.change('subjectFilter', '');
  assert.equal(h.evaluate('subjectFilter'), null);
  const all = h.element('page').innerHTML;
  for (const task of data.tasks) assert.ok(all.includes(`data-toggle="${task.id}"`));
  assert.match(all, /value="" selected/);
  assert.equal(h.storage.writes, 0);
  assert.deepEqual(JSON.parse(h.storage.raw), data);
});

test('exclusão de disciplina selecionada limpa o filtro somente depois de salvar', () => {
  const h = harness({ failWrite: true });
  h.click({ page: 'tasks' });
  h.change('subjectFilter', 's3');
  h.click({ page: 'subjects' });
  h.click({ deleteSubject: 's3' });
  assert.equal(h.evaluate('subjectFilter'), 's3');
  h.storage.failWrite = false;
  h.click({ deleteSubject: 's3' });
  h.click({ page: 'tasks' });
  const html = h.element('page').innerHTML;
  assert.match(html, /value="" selected/);
  for (const task of fixture().tasks) assert.ok(html.includes(`data-toggle="${task.id}"`));
});

test('células vazias do calendário não exibem tarefas de meses adjacentes', () => {
  const data = fixture();
  data.tasks[0].date = '2026-10-31';
  const h = harness({ raw: JSON.stringify(data) });
  h.evaluate('month = calendarDate(2026, 10)');
  h.click({ page: 'calendar' });
  assert.doesNotMatch(h.element('page').innerHTML, /Estudar lógica/);
  h.click({ month: '-1' });
  assert.match(h.element('page').innerHTML, /Estudar lógica/);
});

for (const date of ['0001-01-01', '0096-02-29', '0099-12-31', '0100-03-01', '0999-01-01', '2000-02-29', '9999-12-31']) {
  test(`calendário exibe prazo válido sem modificar dados: ${date}`, () => {
    const data = fixture();
    data.tasks[0].date = date;
    const h = harness({ raw: JSON.stringify(data) });
    const [year, month] = date.split('-').map(Number);
    h.evaluate(`month = calendarDate(${year}, ${month - 1})`);
    h.click({ page: 'calendar' });
    const html = h.element('page').innerHTML;
    assert.ok(html.includes('<em title="Estudar lógica">Estudar lógica</em>'));
    const cells = [...html.matchAll(/<div class="day [^"]*">([^<]*)/g)].map(match => match[1].trim()).filter(Boolean);
    const expectedDays = date.startsWith('0096-02') || date.startsWith('2000-02') ? 29 : 31;
    assert.deepEqual(cells, Array.from({ length: expectedDays }, (_, index) => String(index + 1)));
    assert.equal(h.storage.writes, 0);
    assert.deepEqual(h.state(), data);
    assert.deepEqual(JSON.parse(h.storage.raw), data);
  });
}

test('navegação mensal respeita os limites 0001 e 9999 e atravessa o ano 0099', () => {
  const h = harness();
  h.evaluate('month = calendarDate(1, 0)');
  h.click({ page: 'calendar' });
  assert.match(h.element('page').innerHTML, /data-month="-1"[^>]*disabled/);
  h.click({ month: '-1' });
  assert.equal(h.evaluate('localDate(month)'), '0001-01-01');
  h.click({ month: '1' });
  assert.equal(h.evaluate('localDate(month)'), '0001-02-01');
  h.evaluate('month = calendarDate(9999, 11)');
  h.click({ page: 'calendar' });
  assert.match(h.element('page').innerHTML, /data-month="1"[^>]*disabled/);
  h.click({ month: '1' });
  assert.equal(h.evaluate('localDate(month)'), '9999-12-01');
  h.click({ month: '-1' });
  assert.equal(h.evaluate('localDate(month)'), '9999-11-01');
  h.evaluate('month = calendarDate(99, 11)');
  h.click({ month: '1' });
  assert.equal(h.evaluate('localDate(month)'), '0100-01-01');
  h.click({ month: '-1' });
  assert.equal(h.evaluate('localDate(month)'), '0099-12-01');
});

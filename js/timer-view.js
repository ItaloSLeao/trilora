import { escapeHTML as e } from './data.js';
import {
  CHECKPOINT_MS, RELOAD_KEY, checkpointTimer, durationOf, finishTimer, newTimer,
  resumeAfterReload, timerAnchor, timerOf, withCompletedTimer, withTimer,
} from './timer.js';
import { formatDuration, timeStatistics } from './time-stats.js';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

function history(data) {
  const names = new Map(data.subjects.map(subject => [subject.id, subject.name]));
  const records = [...timerOf(data).sessions].sort((a, b) => b.endedAt - a.endedAt);
  return `<section class="panel time-history" aria-labelledby="time-history-title">
    <h2 id="time-history-title">Histórico de estudos</h2>
    ${records.length ? `<ul class="time-list">${records.map(record => `
      <li class="time-record">
        <div>
          <strong>${e(names.get(record.subject) ?? record.subjectName)}</strong>
          <small>Início: ${dateTime.format(record.startedAt)} · Fim: ${dateTime.format(record.endedAt)}</small>
        </div>
        <strong>${formatDuration(record.durationMs)}</strong>
      </li>`).join('')}</ul>` : '<p>Nenhuma sessão registrada.</p>'}
  </section>`;
}

export function renderTimeStatistics(data, now = Date.now()) {
  const stats = timeStatistics(timerOf(data).sessions, data.subjects, now);
  const largest = stats.disciplines[0]?.durationMs || 1;
  return `<section class="time-totals" aria-label="Resumo do tempo de estudo">
    <article class="stat"><small>Total estudado</small><strong data-time-total>${formatDuration(stats.total)}</strong></article>
    <article class="stat"><small>Hoje</small><strong data-time-today>${formatDuration(stats.today)}</strong></article>
    <article class="stat"><small>Últimos sete dias</small><strong data-time-week>${formatDuration(stats.week)}</strong></article>
  </section>
  <section class="panel time-history" aria-labelledby="time-chart-title">
    <h2 id="time-chart-title">Tempo por disciplina</h2>
    ${stats.disciplines.length ? `<ul class="time-list">${stats.disciplines.map(subject => `
      <li class="time-chart-row">
        <div class="time-record"><span>${e(subject.name)}</span><strong>${formatDuration(subject.durationMs)}</strong></div>
        <div class="time-track" aria-hidden="true"><span style="width:${subject.durationMs * 100 / largest}%;background:${e(subject.color)}"></span></div>
      </li>`).join('')}</ul>` : '<p>Cadastre disciplinas para comparar seu tempo de estudo.</p>'}
  </section>
  ${history(data)}`;
}

function action(name, label, style = 'secondary') {
  return `<button type="button" class="${style}" data-timer-action="${name}">${label}</button>`;
}

export function createTimerUI({ getData, persist, render, pageElement, host }) {
  let anchor = null;
  let interval = null;
  let lastCheckpoint = 0;
  let checkpointFailed = false;
  let pending = null;
  let completed = null;
  const activeTimer = () => timerOf(getData()).active;
  const wall = () => host.Date.now();
  const monotonic = () => host.performance.now();
  const measure = active => checkpointTimer(active, anchor, anchor ? monotonic() : 0);

  function stop() {
    anchor = null;
    if (interval !== null) host.clearInterval(interval);
    interval = null;
  }

  function run(active) {
    stop();
    anchor = timerAnchor(active, wall(), monotonic());
    lastCheckpoint = anchor.monotonic;
    interval = host.setInterval(tick, 250);
  }

  function checkpoint() {
    const active = activeTimer();
    if (!active || !anchor) return false;
    const measured = measure(active);
    lastCheckpoint = monotonic();
    if (measured !== active) {
      checkpointFailed = !persist(withTimer(getData(), measured), { quiet: true });
    }
    return !checkpointFailed;
  }

  function updateClock() {
    const clock = pageElement.querySelector('[data-timer-clock]');
    if (clock) clock.textContent = formatDuration(durationOf(measure(activeTimer()).segments), true);
    const warning = pageElement.querySelector('[data-timer-warning]');
    if (warning) warning.textContent = checkpointFailed ? 'O ponto de recuperação ainda não foi salvo.' : '';
  }

  function tick() {
    if (monotonic() - lastCheckpoint >= CHECKPOINT_MS) checkpoint();
    updateClock();
  }

  function readReloadMarker() {
    try {
      const marker = host.sessionStorage.getItem(RELOAD_KEY);
      host.sessionStorage.removeItem(RELOAD_KEY);
      return marker === null ? null : JSON.parse(marker);
    } catch {
      return null;
    }
  }

  function onPageHide(event) {
    const active = activeTimer();
    if (!active) return;
    if (pending) {
      persist(withTimer(getData(), { ...active, running: false, segments: pending.segments }), { quiet: true });
    } else if (checkpoint() && !event.persisted) {
      try {
        host.sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ id: active.id, savedAt: wall() }));
      } catch {
        // O ponto gravado ainda pode ser retomado manualmente.
      }
    }
    stop();
  }

  host.document.addEventListener('visibilitychange', () => {
    if (!anchor) return;
    checkpoint();
    updateClock();
  });
  host.addEventListener('pagehide', onPageHide);
  host.addEventListener('pageshow', event => {
    if (event.persisted && activeTimer()) render();
  });
  const marker = readReloadMarker();
  const restored = activeTimer();
  if (restored?.running && resumeAfterReload(restored, host.performance.getEntriesByType('navigation')[0]?.type, marker, wall())) run(restored);

  function refresh(focus) {
    render();
    pageElement.querySelector(`[data-timer-action="${focus}"]`)?.focus();
  }

  function saveFinish() {
    const next = withCompletedTimer(getData(), pending);
    if (persist(next)) {
      completed = pending;
      pending = null;
      checkpointFailed = false;
      refresh('start');
    } else {
      refresh('retry');
    }
  }

  return {
    render() {
      const data = getData();
      const active = activeTimer();
      if (!active) {
        return `<section class="panel time-panel">
          <h2>Cronômetro livre</h2>
          ${completed ? `<p role="status">Sessão salva: <strong>${formatDuration(completed.durationMs)}</strong></p>` : ''}
          <div class="time-clock">00:00:00</div>
          ${data.subjects.length ? `<label for="timer-subject">Disciplina</label>
            <select class="field" id="timer-subject">${data.subjects.map(subject =>
              `<option value="${e(subject.id)}"${subject.id === completed?.subject ? ' selected' : ''}>${e(subject.name)}</option>`).join('')}</select>
            <div class="time-actions">${action('start', 'Iniciar', 'primary')}</div>`
          : '<p>Cadastre uma disciplina para iniciar o estudo.</p><button class="secondary" data-go="subjects">Ir para disciplinas</button>'}
        </section>${history(data)}`;
      }
      const subject = data.subjects.find(item => item.id === active.subject);
      const recovered = active.running && !anchor && !pending;
      const elapsed = pending?.durationMs ?? durationOf(measure(active).segments);
      return `<section class="panel time-panel">
        <h2>${e(subject.name)}</h2>
        <p role="status">${pending ? 'Gravação pendente' : recovered ? 'Sessão recuperada' : anchor ? 'Em andamento' : 'Em pausa'}</p>
        <div class="time-clock" role="timer"${pending ? '' : ' data-timer-clock'}>${formatDuration(elapsed, true)}</div>
        ${recovered ? '<p>Somente o tempo salvo foi recuperado. Continue a partir dele ou encerre a sessão.</p>' : ''}
        ${pending ? '<p role="alert">A sessão foi interrompida no tempo exibido. Tente salvar novamente.</p>' : ''}
        <p class="time-warning" role="status" data-timer-warning>${checkpointFailed ? 'O ponto de recuperação ainda não foi salvo.' : ''}</p>
        <div class="time-actions">${pending ? action('retry', 'Tentar salvar novamente', 'primary')
          : (anchor ? action('pause', 'Pausar') : action('resume', 'Continuar', 'primary')) + action('finish', 'Encerrar', anchor ? 'primary' : 'secondary')}</div>
      </section>${history(data)}`;
    },

    handleClick(button) {
      const data = getData();
      const active = activeTimer();
      const action = button.dataset.timerAction;
      if (action === 'start' && !active) {
        const subject = pageElement.querySelector('#timer-subject')?.value;
        if (!data.subjects.some(item => item.id === subject)) return;
        const next = newTimer(host.crypto.randomUUID(), subject, wall());
        if (persist(withTimer(data, next))) {
          completed = null;
          run(next);
          refresh('pause');
        }
      } else if (action === 'retry' && pending) {
        saveFinish();
      } else if (active && !pending) {
        if (action === 'pause' && anchor) {
          if (persist(withTimer(data, { ...measure(active), running: false }))) {
            stop();
            checkpointFailed = false;
            refresh('resume');
          }
        } else if (action === 'resume' && !anchor) {
          const next = { ...active, running: true };
          if (persist(withTimer(data, next))) {
            checkpointFailed = false;
            run(next);
            refresh('pause');
          }
        } else if (action === 'finish') {
          const subject = data.subjects.find(item => item.id === active.subject);
          pending = finishTimer(measure(active), subject.name, wall());
          stop();
          saveFinish();
        }
      }
    },
  };
}

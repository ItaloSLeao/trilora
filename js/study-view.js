import { escapeHTML as e } from './data.js';
import { finishStudy, rateStudy, revealStudy, startStudy, summarizeStudy } from './study.js';

export function openStudyDialog({ deck, cards, modalElement, save }) {
  const total = cards.filter(card => card.deck === deck.id).length;
  let session = null;
  let result = null;
  let saved = false;
  modalElement.innerHTML = `<dialog class="modal flash-dialog study-dialog" aria-labelledby="study-title">
    <header class="study-header">
      <h2 id="study-title">${e(deck.name)}</h2>
      <button type="button" class="secondary" data-study="close">Fechar</button>
    </header>
    <p class="study-progress" role="status"></p>
    <div class="study-stage">
      ${total ? `<p>${total} ${total === 1 ? 'cartão disponível' : 'cartões disponíveis'} para estudar.</p>
        <button type="button" class="primary" data-study="start" autofocus>Iniciar estudo</button>`
      : '<p>Adicione cartões em Gerenciar baralhos para iniciar o estudo.</p>'}
    </div>
  </dialog>`;
  const dialog = modalElement.querySelector('.study-dialog');
  const progress = dialog.querySelector('.study-progress');
  const stage = dialog.querySelector('.study-stage');

  function showCard() {
    const card = session.queue[session.index];
    const { correct, incorrect } = summarizeStudy(session.reviews);
    progress.textContent = `Cartão ${session.index + 1} de ${total} · Acertos: ${correct} · Erros: ${incorrect}`;
    stage.innerHTML = `<div class="study-card">
      <h3 id="study-question" tabindex="-1">Pergunta</h3>
      <p>${e(card.question)}</p>
    </div>
    ${session.revealed ? `<div class="study-card study-answer">
      <h3 id="study-answer" tabindex="-1">Resposta</h3>
      <p>${e(card.answer)}</p>
    </div>
    <div class="flash-actions study-actions">
      <button type="button" class="secondary flash-danger" data-study="incorrect" data-study-index="${session.index}">Errei</button>
      <button type="button" class="primary" data-study="correct" data-study-index="${session.index}">Acertei</button>
    </div>` : '<button type="button" class="primary study-actions" data-study="reveal">Mostrar resposta</button>'}`;
    stage.querySelector(session.revealed ? '#study-answer' : '#study-question').focus();
  }

  function showResults() {
    const stats = summarizeStudy(session.reviews);
    progress.textContent = 'Sessão concluída.';
    stage.innerHTML = `<h3 id="study-results" tabindex="-1">Resultado da sessão</h3>
      <dl class="study-results">
        <div><dt>Cartões estudados</dt><dd>${stats.total}</dd></div>
        <div><dt>Acertos</dt><dd>${stats.correct}</dd></div>
        <div><dt>Erros</dt><dd>${stats.incorrect}</dd></div>
        <div><dt>Percentual de acertos</dt><dd>${stats.percentage}%</dd></div>
      </dl>
      <button type="button" class="primary" data-study="start">Estudar novamente</button>`;
    stage.querySelector('#study-results').focus();
  }

  function mayClose() {
    return saved || !session?.reviews.length || confirm('Encerrar o estudo? As avaliações desta sessão ainda não foram salvas.');
  }

  function saveResult() {
    if (save(result)) {
      saved = true;
      showResults();
      return;
    }
    progress.textContent = 'Resultado pendente de gravação.';
    stage.innerHTML = `<p class="study-error" role="alert">Resultado ainda não salvo. Verifique o aviso de armazenamento antes de tentar novamente.</p>
      <button type="button" class="primary" data-study="retry">Tentar salvar novamente</button>`;
    stage.querySelector('[data-study="retry"]').focus();
  }

  dialog.addEventListener('cancel', event => { if (!mayClose()) event.preventDefault(); });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button[data-study]');
    if (!button || !dialog.contains(button)) return;
    const action = button.dataset.study;
    if (action === 'close') {
      if (mayClose()) dialog.close();
    } else if (action === 'start') {
      session = startStudy(deck, cards, crypto.randomUUID(), new Date().toISOString());
      result = null;
      saved = false;
      showCard();
    } else if (action === 'reveal') {
      session = revealStudy(session);
      showCard();
    } else if (action === 'incorrect' || action === 'correct') {
      const next = rateStudy(session, Number(button.dataset.studyIndex), action === 'correct');
      if (next === session) return;
      session = next;
      if (session.index < total) {
        showCard();
        return;
      }
      const completedAt = new Date(Math.max(Date.now(), Date.parse(session.startedAt))).toISOString();
      result = finishStudy(session, completedAt);
      saveResult();
    } else if (action === 'retry' && result && !saved) {
      saveResult();
    }
  });
  dialog.showModal();
}

import { escapeHTML as e } from './data.js';
import { advanceStudy, finishStudy, rateStudy, startStudy, summarizeStudy } from './study.js';

export function openStudyDialog({ deck, cards, modalElement, save }) {
  const total = cards.filter(card => card.deck === deck.id).length;
  let session = null;
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
    const review = session.reviews[session.index];
    const { correct, incorrect } = summarizeStudy(session.reviews);
    progress.textContent = `Cartão ${session.index + 1} de ${total} · Acertos: ${correct} · Erros: ${incorrect}`;
    stage.innerHTML = `<div class="study-card">
      <h3 id="study-question" tabindex="-1">Pergunta</h3>
      <p>${e(card.question)}</p>
    </div>
    ${review ? `<div class="study-card study-answer">
      <h3 id="study-answer" tabindex="-1">Resposta · ${review.correct ? 'Você marcou Acertei' : 'Você marcou Errei'}</h3>
      <p>${e(card.answer)}</p>
    </div>
    <button type="button" class="primary" data-study="next">Próximo cartão</button>
    <p class="study-error" role="alert"></p>`
    : `<div class="flash-actions">
      <button type="button" class="secondary flash-danger" data-study="incorrect">Errei</button>
      <button type="button" class="primary" data-study="correct">Acertei</button>
    </div>`}`;
    stage.querySelector(review ? '#study-answer' : '#study-question').focus();
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

  dialog.addEventListener('cancel', event => { if (!mayClose()) event.preventDefault(); });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.study;
    if (action === 'close') {
      if (mayClose()) dialog.close();
    } else if (action === 'start') {
      session = startStudy(deck, cards, crypto.randomUUID(), new Date().toISOString());
      saved = false;
      showCard();
    } else if (action === 'incorrect' || action === 'correct') {
      session = rateStudy(session, action === 'correct');
      showCard();
    } else if (action === 'next') {
      const next = advanceStudy(session);
      if (next.index < total) {
        session = next;
        showCard();
        return;
      }
      const completedAt = new Date(Math.max(Date.now(), Date.parse(next.startedAt))).toISOString();
      if (save(finishStudy(next, completedAt))) {
        session = next;
        saved = true;
        showResults();
      } else {
        stage.querySelector('.study-error').textContent = 'Resultado ainda não salvo. Verifique o aviso de armazenamento antes de tentar novamente.';
      }
    }
  });
  dialog.showModal();
}

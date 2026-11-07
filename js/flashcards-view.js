import { escapeHTML as e } from './data.js';
import { FLASHCARD_LIMITS as limits, flashcardsOf, validDeck, validCard, withFlashcard, withoutDeck, withoutCard } from './flashcards.js';

function action(label, name, id, classes = 'secondary') {
  return `<button type="button" class="${classes}" data-flash-action="${name}" data-flash-id="${e(id)}">${label}</button>`;
}

function cardCount(count) {
  return count === 1 ? '1 cartão' : `${count} cartões`;
}

function deckGrid(subjects, decks, cards) {
  if (!subjects.length) {
    return '<div class="panel empty"><p>Cadastre uma disciplina para criar seu primeiro baralho.</p><button class="primary" data-go="subjects">Ir para disciplinas</button></div>';
  }
  const counts = new Map();
  for (const card of cards) counts.set(card.deck, (counts.get(card.deck) ?? 0) + 1);
  const names = new Map(subjects.map(subject => [subject.id, subject.name]));
  return `<div class="toolbar">${action('+ Novo baralho', 'new-deck', '', 'primary')}</div>
    ${decks.length ? `<div class="flash-grid">${decks.map(deck => `<article class="panel flash-item">
      <span class="flash-tag">${e(names.get(deck.subject))}</span>
      <h2>${e(deck.name)}</h2>
      ${deck.description ? `<p class="flash-text">${e(deck.description)}</p>` : ''}
      <div class="flash-actions">
        <span>${cardCount(counts.get(deck.id) ?? 0)}</span>
        ${action('Abrir baralho', 'open', deck.id)}
      </div></article>`).join('')}</div>` : '<p class="panel empty">Crie um baralho para organizar seus cartões por disciplina.</p>'}`;
}

function deckDetail(deck, subject, cards) {
  return `<div class="toolbar flash-actions">
    ${action('← Baralhos', 'back', '')}
    ${action('Editar baralho', 'edit-deck', deck.id)}
    ${action('Excluir baralho', 'delete-deck', deck.id, 'secondary flash-danger')}
    ${action('+ Novo cartão', 'new-card', '', 'primary')}
  </div>
  <section class="panel flash-item">
    <span class="flash-tag">${e(subject.name)}</span>
    <h2 data-flash-heading tabindex="-1">${e(deck.name)}</h2>
    ${deck.description ? `<p class="flash-text">${e(deck.description)}</p>` : ''}
    <p>${cardCount(cards.length)}</p>
  </section>
  ${cards.length ? `<div class="flash-grid flash-cards">${cards.map(card => `<article class="panel flash-item">
    <div><h3>Pergunta</h3><p class="flash-text">${e(card.question)}</p></div>
    <div><h3>Resposta</h3><p class="flash-text">${e(card.answer)}</p></div>
    <div class="flash-actions">
      ${action('Editar cartão', 'edit-card', card.id)}
      ${action('Excluir cartão', 'delete-card', card.id, 'secondary flash-danger')}
    </div>
  </article>`).join('')}</div>` : '<p class="panel empty flash-cards">Este baralho ainda não tem cartões.</p>'}`;
}

export function createFlashcardsUI({ getData, persist, canEdit, render, pageElement, modalElement }) {
  let selectedDeck = null;

  function showDeck(id) {
    selectedDeck = id;
    render();
    pageElement.querySelector(id === null ? '[data-flash-action="new-deck"]' : '[data-flash-heading]')?.focus();
  }

  function formDialog(title, fields, submit) {
    modalElement.innerHTML = `<dialog class="modal flash-dialog" aria-labelledby="flash-dialog-title">
      <h2 id="flash-dialog-title">${title}</h2>
      <form class="form">
        ${fields}
        <div class="flash-actions">
          <button type="button" class="secondary" data-flash-cancel>Cancelar</button>
          <button type="submit" class="primary">Salvar</button>
        </div>
      </form>
    </dialog>`;
    const dialog = modalElement.querySelector('dialog');
    dialog.querySelector('[data-flash-cancel]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      submit(new FormData(event.currentTarget), () => dialog.close());
    });
    dialog.showModal();
  }

  function deckForm(deck) {
    const { subjects } = getData();
    formDialog(deck ? 'Editar baralho' : 'Novo baralho', `
      <label>Nome<input name="name" class="field" required autofocus minlength="2" maxlength="${limits.name}" value="${e(deck?.name)}"></label>
      <label>Disciplina<select name="subject" class="field" required>${subjects.map(subject =>
        `<option value="${e(subject.id)}"${subject.id === deck?.subject ? ' selected' : ''}>${e(subject.name)}</option>`
      ).join('')}</select></label>
      <label>Descrição (opcional)<textarea name="description" class="field" rows="3" maxlength="${limits.description}">\n${e(deck?.description)}</textarea></label>`,
    (form, close) => {
      const record = {
        id: deck?.id ?? crypto.randomUUID(),
        name: form.get('name').trim(),
        subject: form.get('subject'),
        description: form.get('description').trim(),
      };
      const data = getData();
      if (!validDeck(record, data.subjects)) {
        alert('Informe um nome com pelo menos dois caracteres e selecione uma disciplina.');
        return;
      }
      if (persist(withFlashcard(data, 'decks', record))) {
        close();
        showDeck(record.id);
      }
    });
  }

  function cardForm(deck, card) {
    formDialog(card ? 'Editar cartão' : 'Novo cartão', `
      <label>Pergunta<textarea name="question" class="field" rows="3" required autofocus maxlength="${limits.question}">\n${e(card?.question)}</textarea></label>
      <label>Resposta<textarea name="answer" class="field" rows="5" required maxlength="${limits.answer}">\n${e(card?.answer)}</textarea></label>`,
    (form, close) => {
      const record = {
        id: card?.id ?? crypto.randomUUID(),
        deck: deck.id,
        question: form.get('question').trim(),
        answer: form.get('answer').trim(),
      };
      const data = getData();
      if (!validCard(record, flashcardsOf(data).decks)) {
        alert('Preencha a pergunta e a resposta dentro dos limites indicados.');
        return;
      }
      if (persist(withFlashcard(data, 'cards', record))) {
        close();
        showDeck(deck.id);
      }
    });
  }

  return {
    render() {
      const data = getData();
      const { subjects } = data;
      const { decks, cards } = flashcardsOf(data);
      const deck = decks.find(item => item.id === selectedDeck);
      return deck
        ? deckDetail(deck, subjects.find(subject => subject.id === deck.subject), cards.filter(card => card.deck === deck.id))
        : deckGrid(subjects, decks, cards);
    },
    handleClick(button) {
      const { flashAction, flashId } = button.dataset;
      if (!flashAction) return;
      const data = getData();
      const { decks, cards } = flashcardsOf(data);
      const deck = decks.find(item => item.id === selectedDeck);
      if (flashAction === 'open') {
        if (decks.some(item => item.id === flashId)) showDeck(flashId);
        return;
      }
      if (flashAction === 'back') { showDeck(null); return; }
      if (!canEdit()) return;
      if (flashAction === 'new-deck' && data.subjects.length) { deckForm(); return; }
      if (!deck) return;
      if (flashAction === 'edit-deck') deckForm(deck);
      else if (flashAction === 'new-card') cardForm(deck);
      else if (flashAction === 'delete-deck') {
        const count = cards.filter(card => card.deck === deck.id).length;
        const contents = count ? ` e remover ${cardCount(count)}` : '';
        if (confirm(`Excluir o baralho “${deck.name}”${contents}?`) && persist(withoutDeck(data, deck.id))) showDeck(null);
      } else {
        const card = cards.find(item => item.id === flashId && item.deck === deck.id);
        if (!card) return;
        if (flashAction === 'edit-card') cardForm(deck, card);
        if (flashAction === 'delete-card' && confirm('Excluir este cartão?') && persist(withoutCard(data, card.id))) showDeck(deck.id);
      }
    },
  };
}

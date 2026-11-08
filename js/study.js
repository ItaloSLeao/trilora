import { flashcardsOf } from './flashcards.js';

export function startStudy(deck, cards, id, startedAt) {
  const queue = cards.filter(card => card.deck === deck.id);
  if (!queue.length) return null;
  return { id, deck: deck.id, subject: deck.subject, deckName: deck.name, startedAt, queue, index: 0, revealed: false, reviews: [] };
}

export function revealStudy(session) {
  if (session.revealed || !session.queue[session.index]) return session;
  return { ...session, revealed: true };
}

export function rateStudy(session, index, correct) {
  const card = session.queue[session.index];
  if (!card || !session.revealed || index !== session.index || typeof correct !== 'boolean') return session;
  return {
    ...session,
    index: session.index + 1,
    revealed: false,
    reviews: [...session.reviews, { card: card.id, correct }],
  };
}

export function summarizeStudy(reviews) {
  const total = reviews.length;
  const correct = reviews.filter(review => review.correct).length;
  return { total, correct, incorrect: total - correct, percentage: total ? Math.round(correct * 100 / total) : 0 };
}

export function finishStudy(session, completedAt) {
  if (session.index !== session.queue.length) return null;
  const { id, deck, subject, deckName, startedAt, reviews } = session;
  return { id, deck, subject, deckName, startedAt, completedAt, reviews };
}

export function withStudySession(data, record) {
  const collection = flashcardsOf(data);
  const sessions = collection.sessions ?? [];
  if (sessions.some(session => session.id === record.id)) return data;
  return { ...data, flashcards: { ...collection, sessions: [...sessions, record] } };
}

function validReference(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && id === id.trim();
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function validateStudySessions(sessions, uniqueId) {
  if (!Array.isArray(sessions)) throw new TypeError('Histórico de estudo inválido.');
  for (const session of sessions) {
    if (!session || !uniqueId(session.id) || !validReference(session.deck) || !validReference(session.subject) ||
        typeof session.deckName !== 'string' || session.deckName.trim().length < 2 || session.deckName.length > 80 ||
        !validTimestamp(session.startedAt) || !validTimestamp(session.completedAt) ||
        Date.parse(session.completedAt) < Date.parse(session.startedAt) ||
        !Array.isArray(session.reviews) || !session.reviews.length) {
      throw new TypeError('Sessão de estudo inválida.');
    }
    // O histórico continua válido após mover ou excluir baralhos, cartões e disciplinas.
    const reviewed = new Set();
    for (const review of session.reviews) {
      if (!review || !validReference(review.card) || reviewed.has(review.card) || typeof review.correct !== 'boolean') {
        throw new TypeError('Avaliação de cartão inválida.');
      }
      reviewed.add(review.card);
    }
  }
}

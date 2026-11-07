export const FLASHCARD_LIMITS = {
  name: 80,
  description: 500,
  question: 500,
  answer: 2000,
};

export function flashcardsOf(data) {
  return data.flashcards ?? { decks: [], cards: [] };
}

function textInRange(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

export function validDeck(deck, subjects) {
  return !!deck &&
    subjects.some(subject => subject.id === deck.subject) &&
    textInRange(deck.name, 2, FLASHCARD_LIMITS.name) &&
    textInRange(deck.description, 0, FLASHCARD_LIMITS.description);
}

export function validCard(card, decks) {
  return !!card &&
    decks.some(deck => deck.id === card.deck) &&
    textInRange(card.question, 1, FLASHCARD_LIMITS.question) &&
    textInRange(card.answer, 1, FLASHCARD_LIMITS.answer);
}

export function validateFlashcards(collection, subjects, uniqueId) {
  if (!collection || !Array.isArray(collection.decks) || !Array.isArray(collection.cards)) {
    throw new TypeError('Coleção de flashcards inválida.');
  }
  for (const deck of collection.decks) {
    if (!validDeck(deck, subjects) || !uniqueId(deck.id)) throw new TypeError('Baralho inválido.');
  }
  for (const card of collection.cards) {
    if (!validCard(card, collection.decks) || !uniqueId(card.id)) throw new TypeError('Flashcard inválido.');
  }
}

export function withFlashcard(data, kind, record) {
  const collection = flashcardsOf(data);
  const records = collection[kind];
  const next = records.some(item => item.id === record.id)
    ? records.map(item => item.id === record.id ? { ...item, ...record } : item)
    : [...records, record];
  return { ...data, flashcards: { ...collection, [kind]: next } };
}

export function withoutDeck(data, id) {
  const collection = flashcardsOf(data);
  return {
    ...data,
    flashcards: {
      ...collection,
      decks: collection.decks.filter(deck => deck.id !== id),
      cards: collection.cards.filter(card => card.deck !== id),
    },
  };
}

export function withoutCard(data, id) {
  const collection = flashcardsOf(data);
  return { ...data, flashcards: { ...collection, cards: collection.cards.filter(card => card.id !== id) } };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData, saveData, STORAGE_KEY } from '../js/data.js';
import { withoutDeck } from '../js/flashcards.js';
import { finishStudy, rateStudy, revealStudy, startStudy, summarizeStudy, withStudySession } from '../js/study.js';

const deck = { id: 'd1', subject: 's1', name: 'Álgebra', description: '' };
const cards = [
  { id: 'c1', deck: 'd1', question: 'O que é uma matriz?', answer: 'Uma tabela de elementos.' },
  { id: 'c2', deck: 'd1', question: 'O que é uma matriz quadrada?', answer: 'Tem o mesmo número de linhas e colunas.' },
];
const legacy = {
  subjects: [{ id: 's1', name: 'Matemática', color: '#7363dc' }],
  tasks: [],
  flashcards: { decks: [deck], cards },
};
const startedAt = '2026-11-07T12:00:00.000Z';
const completedAt = '2026-11-07T12:02:00.000Z';
const start = () => startStudy(deck, cards, 'session-1', startedAt);
const complete = () => {
  const second = rateStudy(revealStudy(start()), 0, false);
  return rateStudy(revealStudy(second), 1, true);
};

function storageOf(data) {
  let raw = JSON.stringify(data);
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; },
  };
}

test('avaliação exige resposta revelada e avança uma única vez', () => {
  assert.equal(startStudy(deck, [], 'empty', startedAt), null);
  const first = startStudy(deck, [...cards, { ...cards[0], id: 'other', deck: 'd2' }], 'session-1', startedAt);
  assert.deepEqual(first.queue.map(card => card.id), ['c1', 'c2']);
  assert.equal(rateStudy(first, 0, true), first);
  assert.equal(finishStudy(first, completedAt), null);
  const revealed = revealStudy(first);
  assert.equal(revealed.index, 0);
  assert.deepEqual(revealed.reviews, []);
  assert.equal(revealStudy(revealed), revealed);
  const second = rateStudy(revealed, 0, false);
  assert.equal(second.index, 1);
  assert.equal(second.revealed, false);
  assert.deepEqual(second.reviews, [{ card: 'c1', correct: false }]);
  assert.equal(rateStudy(second, 0, true), second);
  assert.equal(rateStudy(second, 1, true), second);
  const nextRevealed = revealStudy(second);
  assert.equal(rateStudy(nextRevealed, 0, true), nextRevealed);
});

test('resultado final registra acertos, erros e percentual por avaliação', () => {
  const session = complete();
  assert.equal(rateStudy(session, 1, true), session);
  assert.equal(revealStudy(session), session);
  const result = finishStudy(session, completedAt);
  assert.deepEqual(result, {
    id: 'session-1', deck: 'd1', subject: 's1', deckName: 'Álgebra', startedAt, completedAt,
    reviews: [{ card: 'c1', correct: false }, { card: 'c2', correct: true }],
  });
  assert.deepEqual(summarizeStudy(result.reviews), { total: 2, correct: 1, incorrect: 1, percentage: 50 });
  assert.equal(summarizeStudy([...result.reviews, { card: 'c3', correct: true }]).percentage, 67);
});

test('histórico opcional é compatível com dados legados e sobrevive à exclusão dos vínculos originais', () => {
  const storage = storageOf(legacy);
  const loaded = loadData(storage);
  assert.deepEqual(loaded.data, legacy);
  const record = finishStudy(complete(), completedAt);
  const updated = withStudySession(loaded.data, record);
  assert.equal(withStudySession(updated, record), updated);
  assert.equal(saveData(updated, storage, loaded.raw).ok, true);
  assert.deepEqual(loadData(storage).data, { ...legacy, flashcards: { ...legacy.flashcards, sessions: [record] } });
  const another = { ...record, id: 'session-2' };
  const continued = withStudySession(loadData(storage).data, another);
  assert.equal(saveData(continued, storage).ok, true);
  assert.deepEqual(loadData(storage).data.flashcards.sessions, [record, another]);
  const removed = { ...withoutDeck(continued, 'd1'), subjects: [] };
  assert.equal(saveData(removed, storage).ok, true);
  assert.deepEqual(loadData(storage).data.flashcards, { decks: [], cards: [], sessions: [record, another] });
});

test('gravação rejeita histórico malformado e protege o conteúdo recuperável', () => {
  const valid = withStudySession(legacy, finishStudy(complete(), completedAt));
  for (const mutate of [
    data => { data.flashcards.sessions = null; },
    data => { data.flashcards.sessions[0].id = 'c1'; },
    data => { data.flashcards.sessions[0].completedAt = '2026-11-06T12:00:00.000Z'; },
    data => { data.flashcards.sessions[0].reviews[0].correct = 'sim'; },
    data => { data.flashcards.sessions[0].reviews[1].card = 'c1'; },
  ]) {
    const broken = structuredClone(valid);
    mutate(broken);
    const storage = storageOf(broken);
    const raw = storage.getItem(STORAGE_KEY);
    assert.equal(loadData(storage).status, 'corrupt');
    assert.deepEqual(saveData(valid, storage), { ok: false, status: 'corrupt' });
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.deepEqual(saveData(broken, storageOf(valid)), { ok: false, status: 'invalid-data' });
  }
});

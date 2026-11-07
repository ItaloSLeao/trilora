import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, loadData, saveData } from '../js/data.js';
import { flashcardsOf, withFlashcard, withoutDeck, withoutCard } from '../js/flashcards.js';

const legacy = {
  subjects: [{ id: 's1', name: 'Física', color: '#7363dc' }, { id: 's2', name: 'Química', color: '#51b7a2' }],
  tasks: [{ id: 't1', title: 'Exercícios', subject: 's1', date: '2026-11-20', priority: 'Alta', done: false }],
  extra: { legacy: true },
};
const deck = { id: 'd1', subject: 's1', name: 'Mecânica', description: '' };
const card = { id: 'c1', deck: 'd1', question: 'Unidade de força?', answer: 'Newton' };
const otherDeck = { id: 'd2', subject: 's2', name: 'Estequiometria', description: 'Revisão' };
const otherCard = { id: 'c2', deck: 'd2', question: 'Unidade de quantidade de matéria?', answer: 'mol' };
const fixture = () => structuredClone({ ...legacy, flashcards: { decks: [deck, otherDeck], cards: [card, otherCard] } });

function storageOf(initial) {
  let raw = JSON.stringify(initial);
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; },
  };
}

test('adiciona baralho e cartão a dados legados usando a mesma chave', () => {
  const storage = storageOf(legacy);
  const loaded = loadData(storage);
  assert.deepEqual(loaded.data, legacy);
  assert.deepEqual(flashcardsOf(loaded.data), { decks: [], cards: [] });
  const next = withFlashcard(withFlashcard(loaded.data, 'decks', deck), 'cards', card);
  assert.equal(saveData(next, storage, loaded.raw).ok, true);
  assert.deepEqual(loadData(storage).data, { ...legacy, flashcards: { decks: [deck], cards: [card] } });
  assert.deepEqual(loaded.data, legacy);
});

test('edita baralho e cartão preservando seus IDs, vínculos e campos adicionais', () => {
  const data = fixture();
  data.flashcards.cards[0].extra = 42;
  const moved = { ...deck, name: 'Forças', subject: 's2', description: 'Segunda lei' };
  const edited = withFlashcard(withFlashcard(data, 'decks', moved), 'cards', { ...card, answer: 'N' });
  assert.deepEqual(edited, {
    ...legacy,
    flashcards: { decks: [moved, otherDeck], cards: [{ ...card, answer: 'N', extra: 42 }, otherCard] },
  });
  assert.equal(data.flashcards.decks[0].subject, 's1');
  assert.equal(data.flashcards.cards[0].answer, 'Newton');
  const storage = storageOf(data);
  assert.equal(saveData(edited, storage).ok, true);
  assert.deepEqual(loadData(storage).data, edited);
});

test('exclusão de cartão e exclusão em cascata afetam apenas os registros selecionados', () => {
  const data = fixture();
  const oneCard = withoutCard(data, 'c1');
  assert.deepEqual(oneCard, { ...legacy, flashcards: { decks: [deck, otherDeck], cards: [otherCard] } });
  const oneDeck = withoutDeck(data, 'd1');
  assert.deepEqual(oneDeck, { ...legacy, flashcards: { decks: [otherDeck], cards: [otherCard] } });
  assert.deepEqual(data, fixture());
});

test('validação bloqueia coleção, vínculos, IDs e campos inválidos sem sobrescrever dados', () => {
  const invalid = [
    data => { data.flashcards = null; },
    data => { delete data.flashcards.cards; },
    data => { data.flashcards.decks[0].subject = 'ausente'; },
    data => { data.flashcards.cards[0].deck = 'ausente'; },
    data => { data.flashcards.decks[0].id = 's1'; },
    data => { data.flashcards.cards[0].id = 'd1'; },
    data => { data.flashcards.decks[0].name = ' '; },
    data => { data.flashcards.decks[0].description = 'x'.repeat(501); },
    data => { data.flashcards.cards[0].question = ' '; },
    data => { data.flashcards.cards[0].answer = 'x'.repeat(2001); },
  ];
  for (const mutate of invalid) {
    const broken = fixture();
    mutate(broken);
    const validStore = storageOf(fixture());
    assert.deepEqual(saveData(broken, validStore), { ok: false, status: 'invalid-data' });
    assert.deepEqual(loadData(validStore).data, fixture());
    const brokenStore = storageOf(broken);
    const raw = brokenStore.getItem(STORAGE_KEY);
    assert.equal(loadData(brokenStore).status, 'corrupt');
    assert.deepEqual(saveData(fixture(), brokenStore), { ok: false, status: 'corrupt' });
    assert.equal(brokenStore.getItem(STORAGE_KEY), raw);
  }
});

test('falha de gravação conserva baralho, cartões e disciplinas no armazenamento', () => {
  const data = fixture();
  const storage = storageOf(data);
  storage.setItem = () => { throw Error('Quota'); };
  const raw = storage.getItem(STORAGE_KEY);
  assert.deepEqual(saveData(withoutDeck(data, 'd1'), storage, raw), { ok: false, status: 'write-error' });
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.deepEqual(loadData(storage).data, data);
});

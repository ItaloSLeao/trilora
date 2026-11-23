import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blank } from '../src/domain/model'
import { migrateLegacy, readLegacy } from '../src/infra/legacy'
import { decode, encode } from '../src/infra/portable'
import { AtlasRepository } from '../src/infra/repository'

const legacy = JSON.stringify({ subjects: [{ id: 's1', name: 'Física', color: '#123456', extra: true }], tasks: [{ id: 't1', title: 'Estudar luz', subject: 's1', priority: 'Alta', done: false, date: '0099-01-02' }], flashcards: { decks: [], cards: [], sessions: [{ id: 'hist', deck: 'apagado', subject: 'antiga', deckName: 'Lentes', startedAt: '2024-02-01T00:00:00.000Z', completedAt: '2024-02-01T01:00:00.000Z', reviews: [{ card: 'antigo', correct: true }] }] } })

describe('banco e importação', () => {
  let db: AtlasRepository
  beforeEach(() => { db = new AtlasRepository(crypto.randomUUID()) })
  afterEach(async () => { await db.delete() })
  it('abre vazio e confirma só uma das gravações concorrentes', async () => {
    expect(await db.load()).toEqual({ revision: 0, data: blank() })
    const attempts = await Promise.allSettled([db.write(0, () => blank()), db.write(0, () => blank())])
    expect(attempts.filter(a => a.status === 'fulfilled')).toHaveLength(1)
    expect((await db.load()).revision).toBe(1)
  })
  it('valida antes de substituir e conserva cópia anterior na mesma transação', async () => {
    const source = migrateLegacy(legacy)
    await db.write(0, () => source)
    await expect(db.write(1, d => ({ ...d, subjects: [] }), true)).rejects.toThrow()
    expect((await db.load()).data).toEqual(source)
    await db.write(1, () => blank(), true)
    expect(await db.backup()).toEqual(source)
  })
  it('bloqueia sobrescrita de corrupção preexistente', async () => {
    await db.table('records').put({ key: 'current', revision: 1, data: {} })
    await expect(db.write(1, () => blank())).rejects.toThrow()
    expect((await db.table('records').get('current')).data).toEqual({})
  })
  it('mantém campo adicional e histórico órfão na cópia exata e no round-trip', () => {
    const data = decode(legacy)
    expect(data.legacySource).toBe(legacy)
    expect(data.tasks[0]?.date).toBe('0099-01-02')
    expect(decode(encode(data))).toEqual(data)
  })
  it('diferencia origem vazia, indisponível, corrupção e versão desconhecida', () => {
    const storage = { getItem: vi.fn(() => null) } as unknown as Storage
    expect(() => readLegacy(() => storage)).toThrow(/ausente/)
    expect(() => readLegacy(() => { throw new Error() })).toThrow(/indisponível/)
    expect(() => decode('{')).toThrow(/corrompido/)
    expect(() => decode('{"format":"trilora-atlas","version":2}')).toThrow(/incompatível/)
    expect(() => decode('{"subjects":[],"tasks":[{}]}')).toThrow(/inválida/)
  })
})

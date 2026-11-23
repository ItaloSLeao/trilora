import { expect, it } from 'vitest'
import { migrateLegacy } from '../src/infra/legacy'
import { blank } from '../src/domain/model'
import {
  legacyHistory,
  recommendations,
  totals,
} from '../src/application/insights'

it('preserva histórico sem registros de origem e contabiliza somente segmentos concluídos', () => {
  const record = {
    id: 'saved',
    subject: 's0',
    subjectName: 'Antiga',
    startedAt: 100,
    endedAt: 2000,
    segments: [
      { start: 100, end: 550 },
      { start: 900, end: 1500 },
    ],
    durationMs: 1050,
  }
  const imported = {
    subjects: [{ id: 's', name: 'Ativa', color: '#405040' }],
    tasks: [],
    studyTimer: {
      sessions: [record],
      active: {
        id: 'open',
        subject: 's',
        startedAt: 3020,
        running: true,
        segments: [{ start: 3020, end: 4000 }],
      },
    },
  }
  const d = migrateLegacy(JSON.stringify(imported))
  expect(totals(d)).toEqual({ sessions: 1, attempts: 0, time: 1050 })
  expect(legacyHistory(d).active?.id).toBe('open')
  expect(() =>
    migrateLegacy(
      JSON.stringify({
        ...imported,
        studyTimer: {
          ...imported.studyTimer,
          sessions: [{ ...record, durationMs: 3000 }],
        },
      }),
    ),
  ).toThrow(/Duração/)
})
it('explica as recomendações a partir dos vínculos e prazos existentes', () => {
  const d = blank()
  expect(recommendations(d, '2026-11-23').map((r) => r.type)).toEqual(['plan'])
  d.tasks.push({
    id: 't',
    subject: 's',
    name: 'Estudar lentes',
    date: '2026-11-25',
    done: false,
    priority: 'Alta',
    goal: null,
  })
  const suggestions = recommendations(d, '2026-11-23')
  expect(suggestions).toHaveLength(1)
  expect(suggestions[0]).toMatchObject({
    title: 'Estudar lentes',
    target: '#agenda',
  })
  expect(suggestions[0]?.reason).toContain('25')
})

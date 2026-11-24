// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { blank } from '../src/domain/model'
import { projection } from '../src/intelligence/projection'
import { Intelligence } from '../src/intelligence/Center'
import { RemoteProvider } from '../src/intelligence/remote'

vi.mock('../src/application/workspace', () => ({
  useWorkspace: () => ({ data: blank(), report: vi.fn() }),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('a central desconectada só acessa a rede após ação e informa indisponibilidade', async () => {
  const fetch = vi.fn().mockRejectedValue(Error('Servidor indisponível'))
  vi.stubGlobal('fetch', fetch)
  render(
    <RemoteProvider>
      <Intelligence />
    </RemoteProvider>,
  )
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Usuário'), {
    target: { value: 'estudante' },
  })
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'credencial-de-teste' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Conectar' }))
  expect((await screen.findByRole('alert')).textContent).toContain(
    'indisponível',
  )
  expect(screen.queryByText('Compartilhar plano atual')).toBeNull()
})
it('a projeção não inclui perguntas, respostas, rascunhos nem textos de reflexão', () => {
  const d = blank()
  d.cards.push({
    id: 'c',
    deck: 'd',
    concept: 'k',
    question: 'privado',
    answer: 'privado',
  })
  d.sessions.push({
    id: 's',
    subject: 'sub',
    goal: 'g',
    activity: 'a',
    elapsedMs: 8,
    timed: true,
    startedAt: 10,
    endedAt: 30,
  })
  d.reflections.push({
    id: 'r',
    session: 's',
    achieved: 'privado',
    difficulty: 'privado',
    adjustment: 'privado',
    revisit: 'privado',
  })
  d.tasks.push({
    id: 't',
    subject: 'sub',
    goal: null,
    date: '2026-12-01',
    priority: 'Alta',
    name: 'Prova',
    assessment: true,
    done: false,
  })
  const shared = projection(d)
  expect(JSON.stringify(shared)).not.toContain('privado')
  expect(shared.map((f) => f.kind)).toEqual([
    'assessment',
    'card',
    'start',
    'session',
    'reflection',
  ])
})

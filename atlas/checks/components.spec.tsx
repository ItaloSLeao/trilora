// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { WorkspaceProvider } from '../src/application/workspace'
import { Knowledge } from '../src/features/Knowledge'

it('mantém o formulário digitado quando a gravação falha e permite nova tentativa', async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  render(
    <WorkspaceProvider>
      <Knowledge tab="subjects" />
    </WorkspaceProvider>,
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Nova disciplina' }),
  )
  const modal = screen.getByRole('dialog')
  const field = within(modal).getByLabelText('Nome') as HTMLInputElement
  fireEvent.change(field, { target: { value: 'Biologia' } })
  const failure = vi
    .spyOn(IDBObjectStore.prototype, 'put')
    .mockImplementationOnce(() => {
      throw new DOMException('Sem espaço', 'QuotaExceededError')
    })
  fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
  expect(await within(modal).findByRole('alert')).toBeTruthy()
  expect(field.value).toBe('Biologia')
  expect(screen.queryByRole('button', { name: 'Editar Biologia' })).toBeNull()
  failure.mockRestore()
  fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(
    await screen.findByRole('button', { name: 'Editar Biologia' }),
  ).toBeTruthy()
})

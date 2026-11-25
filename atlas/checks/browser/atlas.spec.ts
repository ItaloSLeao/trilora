import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

async function go(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name, exact: true })
    .click()
}
async function dialog(
  page: Page,
  button: string,
  fields: Record<string, string>,
) {
  await page.getByRole('button', { name: button, exact: true }).click()
  const modal = page.getByRole('dialog')
  for (const [label, value] of Object.entries(fields))
    await modal.getByLabel(label, { exact: true }).fill(value)
  await modal.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(modal).toBeHidden()
}
async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([])
}
const legacy = {
  subjects: [{ id: 's', name: 'Biologia', color: '#336644' }],
  tasks: [],
  flashcards: {
    decks: [{ id: 'd', subject: 's', name: 'Células', description: '' }],
    cards: [
      { id: 'c', deck: 'd', question: 'Que estrutura?', answer: 'Membrana' },
    ],
  },
}
test('planejar, praticar, avaliar e refletir com registros reais', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await dialog(page, 'Nova disciplina', { Nome: 'Biologia' })
  await go(page, 'Conhecimentos')
  await page.getByRole('link', { name: 'Conceitos', exact: true }).click()
  await dialog(page, 'Novo conceito', {
    Nome: 'Membrana',
    'Unidade temática': 'Citologia',
  })
  await page.getByRole('link', { name: 'Objetivos', exact: true }).click()
  await dialog(page, 'Novo objetivo', {
    'O que você quer conseguir fazer?': 'Explicar osmose',
  })
  await page.getByRole('link', { name: 'Atividades', exact: true }).click()
  await dialog(page, 'Nova atividade', { Nome: 'Desenhar o transporte' })
  await go(page, 'Agenda')
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Nome', { exact: true }).fill('Praticar transporte')
  await modal
    .getByLabel('Objetivo (opcional)')
    .selectOption({ label: 'Explicar osmose' })
  await modal.getByLabel('Prazo').fill('2026-11-23')
  await modal.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByRole('button', { name: 'Editar Praticar transporte' }).click()
  await modal.getByLabel('Nome', { exact: true }).fill('Revisar osmose')
  await modal.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Concluir Revisar osmose' }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Concluir Revisar osmose' }),
  ).toBeChecked()
  await page.getByLabel('Situação').selectOption('pending')
  await expect(
    page.getByRole('checkbox', { name: 'Concluir Revisar osmose' }),
  ).toHaveCount(0)
  await go(page, 'Flashcards')
  await dialog(page, 'Novo baralho', { Nome: 'Células' })
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
  await page.getByRole('button', { name: 'Novo cartão' }).click()
  await modal
    .getByLabel('Conceito (opcional)')
    .selectOption({ label: 'Membrana' })
  await modal.getByLabel('Pergunta').fill('Qual é o processo?')
  await modal.getByLabel('Resposta').fill('Osmose')
  await modal.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByRole('button', { name: 'Revisar pendentes' }).click()
  await expect(modal.getByText('Osmose', { exact: true })).toHaveCount(0)
  await modal.getByRole('button', { name: 'Mostrar resposta' }).focus()
  await page.keyboard.press('Enter')
  await expect(modal.getByText('Osmose', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Errei', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(modal.getByText(/Próxima revisão em/)).toBeVisible()
  await modal.getByRole('button', { name: 'Ver resumo' }).click()
  await expect(modal.getByText(/1 erro/)).toBeVisible()
  await modal.getByRole('button', { name: 'Concluir revisão' }).click()
  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(modal.getByText(/Erro · Próxima/)).toBeVisible()
  await page.keyboard.press('Escape')
  await go(page, 'Visão geral')
  await page.getByRole('link', { name: /Desenhar o transporte/ }).click()
  await expect(
    page.getByRole('combobox', { name: 'Atividade (opcional)', exact: true }),
  ).toHaveValue(/.+/)
  await page.getByRole('button', { name: 'Iniciar sessão' }).click()
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  await page.waitForTimeout(1140)
  await page.getByRole('button', { name: 'Pausar' }).click()
  await expect(
    page.getByRole('button', { name: 'Retomar', exact: true }),
  ).toBeVisible()
  const measured = await page.getByRole('timer').innerText()
  expect(measured).not.toBe('00:00:00')
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(measured)
  await page.getByRole('button', { name: 'Retomar', exact: true }).click()
  await page.getByRole('button', { name: 'Concluir prática' }).click()
  await page
    .getByLabel('O que você conseguiu realizar?')
    .fill('Expliquei o movimento da água.')
  await page
    .getByLabel('Qual dificuldade encontrou?', { exact: false })
    .fill('Relacionar concentração e fluxo.')
  await page.getByRole('button', { name: 'Salvar sessão e reflexão' }).click()
  await expect(
    page.getByRole('heading', { name: 'Progresso', exact: true }),
  ).toBeVisible()
  await page
    .locator('summary')
    .filter({ hasText: 'Desenhar o transporte' })
    .click()
  await expect(page.getByText('Expliquei o movimento da água.')).toBeVisible()
  await expect(page.getByText('0 acerto(s) · 1 erro(s)')).toBeVisible()
  await audit(page)
  await page.reload()
  await expect(page.getByText('0 acerto(s) · 1 erro(s)')).toBeVisible()
  expect(errors).toEqual([])
})
test('portabilidade exige confirmação, mantém origem e exporta cópia anterior', async ({
  page,
}) => {
  await page.goto('/')
  await dialog(page, 'Nova disciplina', { Nome: 'História' })
  await page.evaluate(
    (raw) => localStorage.setItem('trilora-v1', raw),
    JSON.stringify(legacy),
  )
  await go(page, 'Meus dados')
  await page.getByRole('button', { name: 'Ler Trilora original' }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await go(page, 'Conhecimentos')
  await expect(page.getByText('História', { exact: true })).toBeVisible()
  await go(page, 'Meus dados')
  await page.getByRole('button', { name: 'Ler Trilora original' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar importação' })
    .click()
  await expect(page.getByText(/Cópia integral disponível/)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('trilora-v1'))).toBe(
    JSON.stringify(legacy),
  )
  async function download(button: string) {
    const waiting = page.waitForEvent('download')
    await page.getByRole('button', { name: button, exact: true }).click()
    const path = await (await waiting).path()
    return readFile(path!, 'utf8')
  }
  const before = JSON.parse(
    await download('Baixar cópia anterior à importação'),
  )
  expect(before.data.subjects[0].name).toBe('História')
  const after = await download('Exportar dados')
  expect(JSON.parse(after).data.subjects[0].name).toBe('Biologia')
  const input = page.getByLabel('Arquivo JSON')
  await input.setInputFiles({
    name: 'invalido.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })
  await expect(page.getByRole('alert')).toContainText('corrompido')
  await input.setInputFiles({
    name: 'atlas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(after),
  })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar importação' })
    .click()
  await page.reload()
  await go(page, 'Conhecimentos')
  await expect(page.getByText('Biologia', { exact: true })).toBeVisible()
})
test('navegação por teclado, foco e largura de 320, 768 e 1360 px', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Painel de estudos' }),
  ).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Pular para o conteúdo' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await audit(page)
  for (const width of [320, 768, 1360]) {
    await page.setViewportSize({ width, height: 850 })
    for (const hash of [
      'painel',
      'agenda',
      'conhecimentos',
      'revisao',
      'estudo',
      'progresso',
      'dados',
    ]) {
      await page.goto('/#' + hash)
      await expect(
        page.getByRole('main').getByRole('heading', { level: 1 }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        hash + ' ' + width,
      ).toBe(true)
    }
  }
  await page.setViewportSize({ width: 320, height: 850 })
  await page.getByRole('button', { name: 'Abrir navegação' }).click()
  await go(page, 'Agenda')
  await expect(page.getByRole('main')).toBeFocused()
  await audit(page)
  await page.getByRole('button', { name: 'Nova disciplina' }).click()
  await audit(page)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Nova disciplina' }),
  ).toBeFocused()
})

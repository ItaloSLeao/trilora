import { test, expect } from '@playwright/test'
import { blank } from '../../src/domain/model'
test('PDF, fontes, aprovação, tentativa e adaptação contextual', async ({
  page,
}) => {
  test.skip(
    !process.env.ATLAS_QA_LOGIN,
    'Requer backend.tests.browser e PostgreSQL descartável',
  )
  test.setTimeout(120000)
  const data = blank()
  data.subjects.push({ id: 's', name: 'Biologia', color: '#123456' })
  data.concepts.push({
    id: 'c',
    subject: 's',
    unit: 'Botânica',
    name: 'Clorofila',
    prerequisite: null,
  })
  data.decks.push({ id: 'd', subject: 's', name: 'Plantas', description: '' })
  await page.goto('/#dados')
  await page.getByLabel('Arquivo JSON').setInputFiles({
    name: 'plano.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ format: 'trilora-atlas', version: 1, data }),
    ),
  })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmar importação' })
    .click()
  await page.goto('/#agenda')
  await page.getByRole('button', { name: 'Nova tarefa' }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Nome', { exact: true })
    .fill('Avaliação de botânica')
  await page.getByLabel('Avaliação acadêmica').check()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.goto('/#inteligencia')
  await page.getByLabel('Usuário').fill(process.env.ATLAS_QA_LOGIN!)
  await page.getByLabel('Senha').fill(process.env.ATLAS_QA_PASSWORD!)
  await page.getByRole('button', { name: 'Conectar', exact: true }).click()
  await page.getByLabel('Início do silêncio (hora)').fill('0')
  await page.getByLabel('Fim do silêncio (hora)').fill('0')
  await page.getByLabel('Limiar de erros').fill('1')
  await page.getByRole('button', { name: 'Salvar preferências' }).click()
  await expect(page.getByText('Preferências salvas.')).toBeVisible()
  await page.getByLabel('Compartilhar alterações futuras').check()
  await page.getByRole('link', { name: 'Biblioteca e tutor' }).click()
  await page
    .getByRole('combobox', { name: 'Conceito do tutor' })
    .selectOption('c')
  await page
    .getByLabel('PDF textual, DOCX, TXT ou Markdown')
    .setInputFiles(process.env.ATLAS_QA_PDF!)
  await page.getByRole('button', { name: 'Enviar e indexar' }).click()
  await page
    .getByRole('checkbox', { name: /botanica.pdf/ })
    .check({ timeout: 20000 })
  await page.getByLabel('Modo pedagógico').selectOption('Praticar')
  await page
    .getByLabel('Pergunta', { exact: true })
    .fill('Crie uma pergunta sobre clorofila.')
  await page.getByRole('button', { name: 'Enviar pergunta' }).click()
  await page.getByRole('button', { name: /botanica.pdf · p. 1/ }).click()
  await expect(page.locator('blockquote')).toContainText(
    'clorofila absorve luz',
  )
  await page.getByRole('button', { name: 'Revisar para flashcard' }).click()
  await page.getByRole('button', { name: 'Aprovar e salvar flashcard' }).click()
  await expect(page.getByText('Cartão salvo no Atlas.')).toBeVisible()
  await page.getByRole('link', { name: 'Flashcards', exact: true }).click()
  await page.getByRole('button', { name: 'Revisar pendentes' }).click()
  await page.getByRole('button', { name: 'Mostrar resposta' }).click()
  await page.getByRole('button', { name: 'Errei', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ver resumo' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Acompanhamento', exact: true }).click()
  await expect(async () => {
    await page.getByRole('button', { name: 'Atualizar central' }).click()
    await expect(page.getByText(/Clorofila: 1 erro/).first()).toBeVisible()
  }).toPass({ timeout: 10000 })
  await page.getByRole('link', { name: 'Praticar com o Tutor' }).first().click()
  await expect(
    page.getByRole('combobox', { name: 'Conceito do tutor' }),
  ).toHaveValue('c')
  await page.getByRole('checkbox', { name: /botanica.pdf/ }).check()
  await page
    .getByLabel('Pergunta', { exact: true })
    .fill('Outra questão de reforço sobre clorofila.')
  await page.getByRole('button', { name: 'Enviar pergunta' }).click()
  await page.getByRole('button', { name: 'Revisar para flashcard' }).click()
  await page.getByRole('button', { name: 'Aprovar e salvar flashcard' }).click()
  await page
    .getByLabel('Sua tentativa (somente nesta tela)')
    .fill('A clorofila absorve luz.')
  await page.getByRole('button', { name: 'Conferir critério' }).click()
  await page.getByRole('button', { name: 'Registrar acerto' }).click()
  await expect(
    page.getByText(/Tentativa registrada. Próxima revisão/),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Progresso', exact: true }).click()
  await expect(page.getByText('1 acerto(s) · 1 erro(s)')).toBeVisible()
})

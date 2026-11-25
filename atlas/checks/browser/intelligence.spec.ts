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
  await page.getByRole('link', { name: /Abrir perfil/ }).click()
  await page.getByLabel('Início do silêncio (hora)').fill('0')
  await page.getByLabel('Fim do silêncio (hora)').fill('0')
  await page.getByLabel('Limiar de erros').fill('1')
  await page.getByRole('button', { name: 'Salvar preferências' }).click()
  await expect(page.getByText('Preferências salvas.')).toBeVisible()
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await page.getByLabel('Compartilhar alterações futuras').check()
  await page.getByRole('link', { name: 'Tutor', exact: true }).click()
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click()
  await page
    .getByLabel('PDF textual, DOCX, TXT ou Markdown')
    .setInputFiles(process.env.ATLAS_QA_PDF!)
  await page.getByRole('button', { name: 'Enviar e indexar' }).click()
  await page
    .getByRole('checkbox', { name: /botanica.pdf/ })
    .check({ timeout: 20000 })
  await page.getByRole('link', { name: 'Tutor', exact: true }).click()
  await page.getByRole('checkbox', { name: /botanica.pdf/ }).check()
  await page.getByText('Modo e complexidade', { exact: true }).click()
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
  await page.getByLabel('Conceito do cartão (opcional)').selectOption('c')
  await page.getByRole('button', { name: 'Aprovar e salvar flashcard' }).click()
  await expect(page.getByText('Cartão salvo no Atlas.')).toBeVisible()
  await page.getByRole('button', { name: 'Nova conversa', exact: true }).click()
  await expect(page.getByLabel('Pergunta', { exact: true })).toBeFocused()
  await expect(
    page.getByRole('heading', { name: 'Nova conversa' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Revisar para flashcard' }),
  ).toHaveCount(0)
  const history = page.getByRole('complementary', {
    name: 'Histórico de conversas',
  })
  await history.getByRole('button', { name: /Crie uma pergunta/ }).click()
  await expect(
    page.getByRole('button', { name: 'Revisar para flashcard' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Flashcards', exact: true }).click()
  await page.getByRole('button', { name: 'Revisar pendentes' }).click()
  await page.getByRole('button', { name: 'Mostrar resposta' }).click()
  await page.getByRole('button', { name: 'Errei', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ver resumo' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Monitor', exact: true }).click()
  await expect(async () => {
    await page.getByRole('button', { name: 'Atualizar central' }).click()
    await expect(page.getByText(/Clorofila: 1 erro/).first()).toBeVisible()
  }).toPass({ timeout: 10000 })
  await page.getByRole('link', { name: 'Praticar com o Tutor' }).first().click()
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

test('explica quando a pergunta aguarda indexação ou seleção da fonte', async ({
  page,
}) => {
  let status = 'pendente'
  let delay = false
  await page.route('**/api/state', (route) => route.fulfill({ json: {} }))
  await page.route('**/api/conversations', (route) =>
    route.fulfill({ json: [] }),
  )
  await page.route('**/api/documents', async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, 800))
    await route.fulfill({
      json: [
        { id: 'doc', name: 'capítulo.pdf', subject: 's', concept: '', status },
      ],
    })
  })
  const data = blank()
  data.subjects.push({ id: 's', name: 'Biologia', color: '#123456' })
  await page.goto('/#dados')
  await page.getByLabel('Arquivo JSON').setInputFiles({
    name: 'plano.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ format: 'trilora-atlas', version: 1, data }),
    ),
  })
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Confirmar importação' }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/#inteligencia/tutor')
  await page.getByLabel('Usuário').fill('estudante')
  await page.getByLabel('Senha').fill('credencial-de-teste')
  await page.getByRole('button', { name: 'Conectar' }).click()
  const send = page.getByRole('button', { name: 'Enviar pergunta' })
  await page.getByLabel('Pergunta', { exact: true }).fill('O que é uma célula?')
  await expect(send).toBeDisabled()
  await expect(send).toHaveAccessibleDescription(/Aguarde a indexação/)
  delay = true
  await expect(
    page.getByRole('button', { name: 'Nova conversa', exact: true }),
  ).toBeEnabled()
  status = 'pronto'
  await expect(send).toHaveAccessibleDescription(
    /Marque pelo menos um documento/,
    { timeout: 10000 },
  )
  await page.getByRole('checkbox', { name: /capítulo.pdf/ }).check()
  await expect(send).toBeEnabled()
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click()
  await page.getByLabel('PDF textual, DOCX, TXT ou Markdown').setInputFiles({
    name: 'livro-grande.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
  })
  await expect(
    page.getByRole('button', { name: 'Enviar e indexar' }),
  ).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('O arquivo excede 4 MiB')
  await page.getByRole('link', { name: 'Tutor', exact: true }).click()
  await page.getByRole('checkbox', { name: /capítulo.pdf/ }).check()
  await expect(send).toBeEnabled()
  await page.setViewportSize({ width: 320, height: 850 })
  await expect(
    page.getByRole('log', { name: 'Mensagens da conversa' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('prática livre e perfil acessíveis pela navegação', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nova disciplina' }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Nome', { exact: true })
    .fill('Física')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Salvar', exact: true })
    .click()
  await page.getByRole('link', { name: 'Modo de estudo', exact: true }).click()
  await page.getByRole('button', { name: 'Refletir', exact: true }).click()
  await expect(
    page.getByText('Inicie uma prática para registrar a reflexão.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Praticar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Refletir', exact: true }).click()
  await page
    .getByLabel('O que você conseguiu realizar?')
    .fill('Resolvi uma equação.')
  await page.getByRole('button', { name: 'Salvar sessão e reflexão' }).click()
  await expect(
    page.getByRole('heading', { name: 'Progresso', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Entrar no perfil' }).click()
  await expect(page.getByLabel('Usuário')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Perfil', exact: true }),
  ).toBeVisible()
})

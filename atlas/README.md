# Trilora Atlas

Aplicação local para planejar, praticar, avaliar e refletir sobre o estudo. A implementação em React e TypeScript convive com o Trilora acadêmico original de JoabKaimon na raiz deste repositório.

## Executar

Com Node 22.12 ou superior e npm, execute a partir da raiz:

```sh
cd atlas
npm ci
npm run dev
```

Abra o endereço local indicado pelo Vite, normalmente http://127.0.0.1:5173. Use sempre a mesma origem e perfil para reencontrar seus registros. Fontes, ícones e ilustração acompanham o build. A instalação das dependências exige acesso ao registro npm.

## Acompanhamento opcional

Para conectar monitor, biblioteca e tutor com fontes ao Atlas, siga o [guia do backend e dos modelos](../docs/ai-integration/deployment.md). A interface só envia o plano quando o estudante autoriza a projeção ou seu compartilhamento contínuo.

## Primeiro percurso

1. No painel, cadastre uma disciplina. Em **Conhecimentos**, registre um conceito e sua unidade, crie um objetivo observável e associe uma atividade a ele.
2. Em **Agenda**, crie uma tarefa com prazo e objetivo. Clique em um dia para filtrar a lista.
3. Em **Flashcards**, crie um baralho, escolha **Abrir** e adicione um cartão. Use **Revisar pendentes**, tente responder de memória, revele a resposta e avalie a tentativa.
4. Abra a atividade sugerida no painel ou selecione o plano no **Modo de estudo**. Ao concluir a prática, registre sua realização e reflexão. Consulte o resultado em **Progresso**.
5. Em **Meus dados**, exporte uma cópia JSON. Para migrar do original, leia a chave na mesma origem ou selecione um arquivo com o valor integral da chave. Confira o resumo antes de confirmar.

## Verificação

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Para usar um Chromium já instalado em Linux, execute `ATLAS_CHROMIUM=/caminho/do/chromium npm run test:e2e`. O teste serve o conteúdo de `dist/` na porta local 4179, que precisa estar livre. Para testar o original, execute `node --test` na raiz.

[Audi­toria inicial](docs/auditoria.md) · [Arquitetura, dados e critérios](docs/engenharia.md) · [Fundamentação, matriz e avaliação pedagógica](docs/pedagogia.md) · [Verificação e roadmap](docs/entrega.md)

# Gerenciamento de flashcards

Cada baralho pertence a uma disciplina, e cada cartão pertence a um baralho. A aba **Flashcards** mostra o nome, a disciplina, a descrição opcional e a quantidade de cartões por baralho. Ao abri-lo, o estudante pode editar o baralho e criar, editar ou excluir cartões. A edição de um baralho permite escolher outra disciplina e mantém seus cartões associados.

## Regras e critérios de aceitação

| Ação | Resultado esperado |
| --- | --- |
| Abrir Flashcards sem disciplinas | A tela orienta o estudante a cadastrar uma disciplina. |
| Criar ou editar um baralho | O nome tem de 2 a 80 caracteres, a descrição opcional tem até 500 e a disciplina precisa existir. |
| Criar ou editar um cartão | Pergunta e resposta são obrigatórias, em texto, com até 500 e 2.000 caracteres, respectivamente. |
| Excluir um cartão | A confirmação afeta apenas o cartão escolhido. |
| Excluir um baralho | A confirmação informa quantos cartões serão removidos. Baralho e cartões são excluídos na mesma gravação. |
| Excluir uma disciplina com baralhos | A exclusão é bloqueada até que os baralhos sejam movidos ou excluídos. |
| Recarregar depois de salvar | Baralhos, cartões e vínculos permanecem disponíveis. |
| Falhar ao gravar | A alteração não é aplicada na interface. Um formulário aberto mantém os valores para nova tentativa. |

## Modelo de dados

A chave continua sendo `trilora-v1`. O campo opcional `flashcards` é gravado junto com as disciplinas e tarefas na primeira alteração bem-sucedida de um baralho ou cartão. A ausência do campo representa uma coleção vazia e não exige regravar dados legados.

```text
flashcards
  decks: [{ id, subject, name, description }]
  cards: [{ id, deck, question, answer }]
```

`subject` referencia o ID de uma disciplina. `deck` referencia o ID de um baralho. Os IDs são únicos entre disciplinas, tarefas, baralhos e cartões. A carga e a gravação validam os vínculos. Uma coleção malformada bloqueia alterações e preserva o conteúdo salvo para recuperação.

`js/flashcards.js` contém a validação e as operações sobre a coleção. `js/flashcards-view.js` monta as telas e os formulários e solicita as gravações pela persistência compartilhada. Esta etapa cobre o gerenciamento de conteúdo. Sessões de revisão e repetição espaçada ficam fora deste escopo.

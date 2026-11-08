# Flashcards

Cada baralho pertence a uma disciplina, e cada cartão pertence a um baralho. A aba **Flashcards** lista os baralhos para estudo por nome, disciplina e quantidade de cartões. A área **Gerenciar baralhos** mostra também a descrição opcional e permite editar baralhos e criar, editar ou excluir cartões. A edição de um baralho permite escolher outra disciplina e mantém seus cartões associados.

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
| Selecionar um baralho | O modal abre com a opção de iniciar o estudo. Se o baralho estiver vazio, orienta a adicionar cartões. |
| Iniciar ou avançar | A tela exibe a pergunta, o progresso, os contadores e o botão Mostrar resposta. |
| Mostrar resposta | Exibe a resposta abaixo da pergunta e disponibiliza Errei e Acertei. |
| Marcar Errei ou Acertei | Registra uma única avaliação e avança automaticamente. O próximo cartão volta a exibir apenas a pergunta e o botão Mostrar resposta. |
| Avaliar o último cartão | Salva a sessão e mostra total, acertos, erros e percentual de acertos arredondado. Uma falha permite tentar salvar o mesmo resultado novamente. |
| Estudar novamente | Inicia uma nova sessão com progresso zerado e mantém a sessão concluída. |
| Fechar o modal | O botão Fechar e Escape acionam o fechamento. Se houver avaliações pendentes, é necessário confirmar o descarte. O foco retorna ao baralho. |

## Modelo de dados

A chave continua sendo `trilora-v1`. O campo opcional `flashcards` é gravado junto com as disciplinas e tarefas na primeira alteração bem-sucedida de um baralho ou cartão. A ausência do campo representa uma coleção vazia e não exige regravar dados legados.

```text
flashcards
  decks: [{ id, subject, name, description }]
  cards: [{ id, deck, question, answer }]
  sessions: [{ id, deck, subject, deckName, startedAt, completedAt, reviews: [{ card, correct }] }]
```

`subject` referencia o ID de uma disciplina. `deck` referencia o ID de um baralho. Os IDs são únicos entre disciplinas, tarefas, baralhos e cartões. A carga e a gravação validam os vínculos. Uma coleção malformada bloqueia alterações e preserva o conteúdo salvo para recuperação.

O histórico opcional `sessions` é criado ao concluir a primeira sessão. Os IDs estáveis e horários UTC identificam cada sessão e permitem agregar dados futuramente. As avaliações registram a autoavaliação do estudante, e os totais são calculados a partir delas. O histórico preserva os vínculos que existiam na data do estudo, mesmo que o baralho seja movido ou que baralho, disciplina e cartões sejam excluídos depois. Sessões interrompidas não entram no histórico. Os dados continuam locais.

`js/flashcards.js` e `js/flashcards-view.js` cuidam da coleção e das telas de catálogo e gerenciamento. `js/study.js` define as transições e valida o histórico. `js/study-view.js` controla o modal de estudo e usa a persistência compartilhada para salvar os resultados. O estudo segue a ordem dos cartões no baralho.

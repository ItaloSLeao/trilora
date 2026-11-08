# Tempo de estudo e estatísticas

Abra [a prévia local](http://localhost:8000), vá a **Tempo de estudo**, selecione uma disciplina e clique em **Iniciar**. Pause e continue quantas vezes precisar. Use **Encerrar** para guardar a duração efetiva e consulte **Estatísticas** para comparar os tempos por disciplina.

| Situação | Comportamento esperado |
| --- | --- |
| Iniciar | O cronômetro começa em 00:00:00. A disciplina permanece vinculada até encerrar. |
| Trocar de aba | O tempo continua sendo medido enquanto a página mantém a sessão em andamento. |
| Pausar e continuar | Somente os intervalos em andamento entram na duração. |
| Recarregar | Uma recarga identificada com um ponto recente da mesma aba recupera a contagem e continua a partir do tempo salvo. Uma recarga sem essa confirmação oferece retomada manual. |
| Reabrir após interrupção | O último ponto salvo fica disponível para continuar ou encerrar. O intervalo fora da página não entra na duração. |
| Falhar ao encerrar | O cronômetro para na duração exibida e permite repetir a gravação do mesmo resultado. O último ponto gravado continua recuperável. |
| Excluir uma disciplina | O vínculo de uma sessão ativa impede a exclusão. Sessões concluídas mantêm o nome da disciplina registrado no encerramento. |

## Medição e recuperação

O relógio monotônico do navegador mede a duração entre dois instantes. As atualizações periódicas só redesenham o visor e tentam salvar pontos de recuperação, em geral a cada cinco segundos enquanto a página executa código. A aplicação também tenta salvar quando a visibilidade muda ou quando a página é encerrada. Se o navegador interromper a execução antes de uma gravação bem-sucedida, a recuperação alcança apenas o último ponto salvo.

A origem do navegador delimita o armazenamento. Use o mesmo endereço, porta e perfil para continuar com os dados já cadastrados. A aba ativa usa uma marca temporária no `sessionStorage` para distinguir uma recarga confirmada de uma nova navegação. Essa marca nunca serve para calcular o tempo que passou fora da página.

## Dados e totais

A coleção opcional `studyTimer` integra o registro existente em `trilora-v1`. O campo `active` guarda a sessão em andamento ou `null`. O campo `sessions` guarda sessões concluídas com ID, ID e nome da disciplina, início, fim, duração efetiva e intervalos ativos. Instantes e durações usam milissegundos inteiros. Os dados legados sem essa coleção continuam válidos e a coleção é criada ao iniciar a primeira sessão.

O total geral soma as sessões concluídas. **Hoje** e **Últimos sete dias** usam os dias corridos do calendário local, incluindo o dia atual, e distribuem os intervalos de estudo que atravessam a meia-noite. Sessões em andamento aparecem no cronômetro até serem encerradas e salvas.

`js/timer.js` mede os intervalos, valida o histórico e prepara a gravação. `js/time-stats.js` calcula as durações do painel. `js/timer-view.js` integra a interface e os eventos do navegador à persistência compartilhada.

## Validação

`node --test` cobre as regras com relógios controlados, a compatibilidade dos dados e os limites dos períodos. O roteiro de navegador do README verifica a recarga real e simula a interrupção, a troca de visibilidade e a falha de armazenamento. A entrega passou no Chrome e no Edge em modo headless, com larguras de 320 a 1.200 px.

A revisão de integração e acessibilidade é a próxima etapa do projeto. A verificação desta entrega não incluiu leitores de tela nem dispositivos físicos.

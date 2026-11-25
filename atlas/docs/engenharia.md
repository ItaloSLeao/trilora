# Arquitetura e contratos

A interface em `src/features` consome serviços de `application`, componentes de `ui` e regras puras de `domain`. O React apresenta exclusivamente o último estado confirmado. O provedor de aplicação serializa intenções de gravação na aba. `infra/repository.ts` executa leitura, comparação da revisão e escrita em uma única transação Dexie. Duas abas que partem da mesma revisão não podem confirmar estados divergentes. Uma aba em conflito conserva a entrada visível e solicita recarga. Copie um texto em edição antes de recarregar.

O IndexedDB `trilora-atlas`, versão 1, possui uma tabela `records`. O registro `current` guarda a revisão e o documento de domínio versionado. O registro `backup` guarda o estado imediatamente anterior à última substituição de dados existentes. A escolha de um documento facilita validar o grafo inteiro e confirmar sessão e reflexão atomicamente. O custo de ler e validar cresce com o histórico. Indexação por entidade e paginação dependem de medição em coleções maiores.

## Modelo e aceitação

| Entidade ou fluxo | Regra verificável |
| --- | --- |
| Disciplinas | UUID para criação e IDs estáveis na edição. Nomes únicos desconsiderando caixa e extremos. Exclusão confirmada só é aceita sem vínculos. |
| Conceitos | Pertencem a disciplina e unidade temática. Um pré-requisito opcional pertence à mesma disciplina. Ciclos impedem a gravação. |
| Objetivos e atividades | O objetivo pertence à disciplina e tem declaração observável e estado de conclusão manual. Cada atividade pertence a um objetivo. O plano exige objetivo aberto e atividade compatível. |
| Tarefas e calendário | Disciplina obrigatória, objetivo compatível opcional, prioridade, estado e prazo civil. Datas usam AAAA-MM-DD, navegação por mês local e dias válidos entre 0001 e 9999. Os filtros atuam na lista e na grade. |
| Baralhos e cartões | Baralho por disciplina, pergunta e resposta textuais, conceito opcional da mesma disciplina. Edições conservam o ID. |
| Revisões | Cada tentativa contém ID da rodada e do cartão, conceito e pergunta no momento da avaliação, instante, dia local, resultado manual, estágio e próximo dia. Cada par rodada/cartão ocorre uma vez. Tentativas já gravadas sobrevivem ao fechamento da rodada. |
| Sessões e reflexões | Há no máximo uma prática ativa. A conclusão grava sessão, atividade, objetivo e reflexão no mesmo documento. Realização obrigatória, dificuldade, revisão pretendida e ajuste de plano opcionais. |
| Histórico e recomendações | Eventos individuais alimentam os totais, as contagens por conceito e o histórico por cartão. Tempo e frequência representam engajamento. O painel explica a ação sugerida a partir de prática aberta, cartões novos/vencidos, prazo de até sete dias (incluindo atrasos) e atividades de objetivos abertos. Quando faltam cadastros, sugere o próximo cadastro. |

As demais entidades têm edição e retenção de histórico. A interface não oferece exclusão em cascata. Importações passam pela mesma validação de unicidade, vínculos e consistência do histórico.

## Revisão e tempo

Um cartão novo fica disponível imediatamente. Um erro coloca o cartão no estágio zero e o devolve no dia seguinte. Um acerto avança um estágio até o teto de quatro. Os estágios de um a quatro correspondem a 2, 4, 7 e 14 dias civis a partir da tentativa. A revisão guarda o dia local usado no cálculo para preservar o agendamento em viagens. Esses parâmetros são uma escolha de design a testar no piloto.

O relógio usa a diferença inteira entre leituras de performance.now() e a duração confirmada no início do segmento. A aplicação mantém o relógio ao navegar entre telas, tenta gravar a cada cinco segundos e ao ocultar a página. Em nova navegação recupera o último checkpoint em pausa. Perda abrupta pode perder a fração posterior à última gravação bem-sucedida. Ao falhar uma gravação de tempo, congela a medição para nova tentativa. Sessões sem cronômetro guardam zero milissegundos e são identificadas separadamente no histórico.

## Importação e recuperação

Uma base ausente abre vazia. Documento inválido, versão desconhecida ou acesso indisponível interrompem a operação e preservam o conteúdo encontrado. O Atlas só lê trilora-v1 após ação do usuário. Importa cadastros, prazos, baralhos e cartões. Mantém no documento a string JSON legada integral, inclusive campos desconhecidos, avaliações órfãs, nomes históricos e segmentos do cronômetro. O progresso integra as sessões concluídas e identifica tentativas legadas pelo nome do baralho e horário de conclusão da rodada. Cartões importados começam disponíveis para revisão, pois o original não registrava agendamentos. O cronômetro legado em aberto permanece arquivado com seu tempo confirmado, sem fabricar um objetivo ou uma reflexão.

O formato exportado contém format, version e data. A prévia de importação exige confirmação antes de substituir todo o Atlas. Uma sessão ativa impede a substituição. A versão anterior à troca fica disponível para download em Meus dados. Para recuperá-la, baixe-a e selecione esse arquivo na importação. Uma nova substituição conserva apenas uma geração de backup local. Cópias externas são necessárias para sobreviver à limpeza do navegador. Um banco corrompido deve ser preservado antes de uma recuperação especializada.

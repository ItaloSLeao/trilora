# Auditoria inicial do Trilora Atlas

A branch de desenvolvimento `feat/trilora-atlas` começou em `9caf1e9`, com árvore limpa. O Trilora 1.2.0 é uma aplicação estática de módulos ES sem dependências npm. A árvore contém uma página, quatro folhas de estilo, nove módulos JavaScript, dois documentos de domínio, cinco arquivos Node de teste e um roteiro Python para Chromium. A execução inicial de `node --test` passou nos cinco arquivos. O histórico atribui a versão inicial a JoabKaimon e as evoluções a Joab. O remoto upstream aponta para [o repositório original](https://github.com/JoabKaimon/trilora).

## Inventário e decisões

| Área | Comportamento observado | Decisão na reconstrução |
| --- | --- | --- |
| Organização | Disciplinas, prazos civis de 0001 a 9999, prioridades e calendário mensal | Preservar IDs, datas, disciplinas e conclusão. Acrescentar conceitos, objetivos e atividades. |
| Flashcards | Cartões de texto, revelação antes da avaliação manual. O histórico aceita referências a registros já excluídos | Guardar tentativas novas individualmente. Conservar o material de origem integral durante a importação. |
| Tempo | Relógio monotônico, intervalos ativos, checkpoints, encerramento idempotente; históricos podem conter disciplinas extintas | Separar duração de engajamento e resultado de aprendizagem. Recuperar somente o tempo confirmado. |
| Armazenamento | `trilora-v1` guarda um único JSON síncrono, com `subjects`, `tasks`, `flashcards` e `studyTimer` opcionais nos dois últimos casos. Campos adicionais são permitidos. Ausência pode mostrar demonstração | Banco independente, transações, importação explícita. Ausência no Atlas abre um painel vazio. |
| Interface e falhas | As telas originais confirmam após a gravação e mantêm formulários quando ela falha; a comparação entre abas não é atômica | Conservar entradas e adotar revisão transacional. Separar indisponibilidade, corrupção e versão desconhecida. |

A revisão original percorre a ordem do baralho. Faltam vínculos a conceitos, objetivos observáveis, reflexão e agendamento de revisões. O tempo isolado também não permite inferir aprendizagem. Esses limites orientam a ampliação.

## Licenciamento e limites

O commit inspecionado não apresenta arquivo de licença ou concessão no README. O trabalho local autorizado preserva os créditos e mantém a aplicação original disponível. Publicação ou redistribuição dependerá de esclarecer as permissões pertinentes com os titulares. As dependências npm mantêm seus próprios avisos.

Próxima etapa após esta auditoria: fundação em `atlas/`, com banco e testes próprios, preservando o contrato da aplicação original.

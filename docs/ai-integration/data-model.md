# Persistência e migrações

| Fonte | Entidades e integridade |
|---|---|
| IndexedDB do Atlas | Preserva o documento existente. O atributo opcional assessment em tarefas distingue avaliações. Ausência equivale a tarefa comum. Flashcards aprovados e autoavaliações usam os serviços anteriores e sua validação. Exporte com a versão atual antes de alternar versões. |
| account e workspace | UUID criado no servidor, login único, derivação de senha com bcrypt, projeção autorizada e revisão monotônica. A conta é obtida das credenciais autenticadas. |
| document e chunk | Bytes privados, hash SHA-256, disciplina, conceito, estado, tentativas e lease no documento. Cada fragmento tem ordinal único por documento, página quando existente, texto e vetor. O modelo de embeddings fica no documento. |
| conversation e message | Seleção fixa de documentos por conversa, proprietário, disciplina e conceito. Cada troca guarda pergunta, resultado validado, fontes recuperadas e tokens informados. |
| event e notice | Chaves compostas com proprietário. O ID determinístico do evento identifica tipo e entidade de origem. A recomendação agrupa regra e entidade, preservando a decisão manual enquanto o padrão continua. |
| report e usage | Resumo por semana civil e conta. Consumo por hora limita consultas, incluindo tentativas que falham. |
| push_subscription e push_delivery | Endpoint inscrito por conta, chaves privadas de entrega e deduplicação por dispositivo, recomendação e geração. |

A versão SQL aplicada consta de atlas_migration. Migrações 001 a 003 são aditivas. A exclusão de conta propaga a remoção no servidor. A exclusão de documento remove seus trechos e as conversas vinculadas, incluindo cópias de citações. Conexões devem sempre validar proprietário também nas consultas de fontes e históricos.

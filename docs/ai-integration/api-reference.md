# API de desenvolvimento

O schema OpenAPI gerado por FastAPI fica em /openapi.json e a documentação interativa em /docs no servidor local. Para requisições mutáveis envie X-Atlas-Action com valor 1, autenticação Basic e Content-Length. O proxy do frontend encaminha /api ao backend. Coleções aceitam offset a partir de zero.

| Recurso sob /api | Operações |
|---|---|
| health, state | Saúde do banco e estado autenticado com revisão, preferências e tokens |
| projection, preferences | PUT da projeção esperada ou das preferências validadas |
| events, notices, reports | GET de páginas de eventos, recomendações e relatórios |
| notices/{id} | PATCH de leitura, aceitação, rejeição ou conclusão |
| documents | POST de bytes brutos com query name, subject e concept opcional. GET da biblioteca privada |
| documents/{id}/retry, documents/{id}/source/{ordinal}, documents/{id}/file, documents/{id} | POST para reprocessar falha, GET para ler trecho ou baixar o original e DELETE para excluir |
| conversations, conversations/{id} | GET e POST de conversas; DELETE de histórico individual |
| conversations/{id}/messages | GET do histórico e POST de pergunta com resposta validada |
| conversations/{id}/stream | POST da mesma pergunta com fluxo NDJSON de rascunhos e conclusão ou erro |
| activities, progress | GET paginado de exercícios propostos e desempenho observado por conceito |
| push | GET da chave pública disponível, POST de inscrição e DELETE das inscrições desta conta |
| account | DELETE da conta autenticada e dos dados remotos |

HTTP 409 indica projeção desatualizada, 413 limita tamanho, 422 indica seleção ou formato inválido, 429 limita consumo e 503 indica falha de inferência. Uma conta não pode usar o ID de outra conta para consultar fonte ou conversa.

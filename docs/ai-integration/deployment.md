# Executar a integração local

São necessários Node 22.12 ou superior, npm, Docker com Compose e Ollama com modelos disponíveis. A aplicação acadêmica sem integração continua executável apenas com npm. Não há migração automática de registros do estudante.

1. Na raiz, copie backend/.env.example para backend/.env e preencha POSTGRES_PASSWORD com um segredo alfanumérico exclusivo. Os modelos CHAT_MODEL e EMBED_MODEL precisam existir na instância configurada. Para o modelo padrão, execute `ollama pull qwen2.5:3b`.
2. Para execução integral em contêineres, configure OLLAMA_HOST com um endereço acessível **a partir dos contêineres**. A porta de loopback do host não é a porta de loopback do contêiner. Restrinja o acesso ao provedor à rede de desenvolvimento. Para manter Ollama exclusivamente no loopback, use a alternativa nativa abaixo.
3. Na raiz, execute:

```sh
docker compose --env-file backend/.env up -d --build
docker compose --env-file backend/.env exec api python -m backend.db user estudante
npm --prefix atlas ci
npm --prefix atlas run dev
```

A CLI solicita a senha sem exibi-la. Abra o endereço impresso pelo Vite e entre em Acompanhamento. Antes de compartilhar, confira a conta e o plano local. Avaliações são cadastradas em Agenda, opção Avaliação acadêmica. A saúde da API está em http://127.0.0.1:8001/api/health. O Compose mantém volume PostgreSQL, executa migrações e inicia os dois workers após o banco estar pronto. Para parar, use `docker compose --env-file backend/.env stop`.

## API e Ollama no host

Inicie somente o serviço db no Compose. A porta padrão no host é 55432. Crie um ambiente virtual Python 3.13+ e instale backend/requirements.txt. No ambiente de cada terminal, configure DATABASE_URL para o banco atlas com o usuário e a senha escolhidos. Configure OLLAMA_HOST para http://127.0.0.1:11434. A partir da raiz:

```sh
python -m backend.db migrate
python -m backend.db user estudante
uvicorn backend.api:app --host 127.0.0.1 --port 8001 --no-access-log
```

Em outros terminais do mesmo ambiente, execute `python -m backend.worker index`, `python -m backend.worker monitor` e `npm --prefix atlas run dev`. O indexador usa limites POSIX e foi exercitado em Linux. Os modelos ficam no servidor Ollama. MODEL_TIMEOUT configura o timeout das chamadas; o padrão é 90 segundos. O cenário de execução local usa CPU por padrão para geração. OLLAMA_NUM_GPU permite ajustar esse parâmetro.

## Verificar

Na raiz execute `node --test`, `npm --prefix atlas test` e `npm --prefix atlas run build`. Com o ambiente Python ativo, execute `python -m pytest -q backend/tests`. Para incluir os testes de integração, defina ATLAS_TEST_DATABASE_URL apontando para um **banco de teste dedicado** com pgvector. Os testes executam migrações e criam contas temporárias. O worker do teste deve consumir somente a fila desse banco.

Com o build pronto, o mesmo banco dedicado e Chromium instalado, execute `python -m backend.tests.browser`. Deixe livres as portas 8001 e 4179. ATLAS_CHROMIUM pode indicar o executável Chromium. O roteiro inicia API e worker com provedor de teste explícito e roda Playwright. Para avaliação real de Ollama no corpus, execute `python -m backend.evaluation.run /tmp/atlas-resultados.json`. O arquivo registra resultados do modelo sobre materiais de teste. Não utilize uma base compartilhada com estudantes para esses comandos.

Push opcional requer chaves VAPID e VAPID_SUBJECT no ambiente dos processos API e monitor. O aluno deve autorizar explicitamente esta entrega em Preferências. Sem essas condições as notificações ficam na central.

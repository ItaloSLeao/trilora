# Trilora Atlas

**Organização acadêmica e apoio à aprendizagem autorregulada.**

Projeto acadêmico de Engenharia de Software para estudantes do ensino médio e universitários. O Atlas conecta planejamento, prática, avaliação e reflexão em um espaço de estudo com persistência local, revisão de flashcards e consulta a materiais com IA.

[Executar](#executar) · [Dados e privacidade](#dados-e-privacidade) · [Verificação](#verificação) · [Documentação](#documentação) · [Trilora original](#trilora-original)

## Funcionalidades

| Área | O que você pode fazer |
| --- | --- |
| **Visão geral e agenda** | Acompanhar sugestões para o dia, criar tarefas e avaliações, definir prioridades e consultar prazos no calendário. |
| **Conhecimentos** | Organizar disciplinas, conceitos, pré-requisitos, objetivos de aprendizagem e atividades. |
| **Flashcards** | Criar baralhos, responder antes de revelar a solução, avaliar a tentativa e acompanhar as revisões programadas. |
| **Modo de estudo** | Iniciar uma prática livre ou vinculada a um objetivo, usar o cronômetro com pausas e registrar uma reflexão ao terminar. |
| **Progresso** | Consultar sessões, tempo efetivo, tentativas por conceito e frequência de prática. |
| **Biblioteca e Tutor** | Enviar materiais, selecionar documentos e conversar com o tutor, abrindo os trechos citados. Revisar questões geradas antes de aprová-las como flashcards. |
| **Monitor** | Receber sugestões com justificativas, aceitar ou ignorar recomendações e consultar resumos semanais do plano compartilhado. |
| **Perfil e Meus dados** | Entrar na conta do serviço, ajustar preferências e exportar ou importar os registros acadêmicos locais. |

A organização acadêmica funciona no navegador. Biblioteca, Tutor e Monitor usam o backend opcional. A consulta ao Tutor começa pela seleção de materiais prontos, com disciplina, conceito e objetivo opcionais.

## Executar

### Ambiente completo

O script de desenvolvimento foi verificado em Linux. Tenha instalados:

- Node.js **22.12 ou superior** e npm.
- Python **3.13 ou superior**, com suporte a `venv` e pip.
- Docker em execução e Docker Compose com suporte a `--wait`.
- Ollama, Bash **4.3 ou superior** e `curl`.

Na primeira utilização, com o serviço Ollama ativo, baixe o modelo padrão e crie uma conta. Execute os comandos na raiz do repositório:

```bash
ollama pull qwen2.5:3b
./trilora-dev user estudante
```

A criação da conta pede uma senha de pelo menos 12 caracteres. Para iniciar o sistema, use:

```bash
./trilora-dev
```

Abra **http://127.0.0.1:5173** e entre pelo **Perfil**, no canto superior direito. Nas próximas sessões, use o mesmo comando de inicialização e a conta já cadastrada.

O script prepara as dependências, cria `backend/.env` quando necessário, inicia o PostgreSQL, aplica as migrações e executa API, workers e frontend. Ele também usa o Ollama local disponível ou inicia o serviço. A instalação inicial das dependências e o download do modelo exigem acesso à internet.

Use **Ctrl+C** para encerrar os processos iniciados pelo script. O banco continua disponível no volume Docker. A API responde em `http://127.0.0.1:8001/api/health`, com documentação interativa em `http://127.0.0.1:8001/docs`.

As variáveis de configuração estão em `backend/.env.example`. Os modelos de geração e embeddings podem ser definidos por `CHAT_MODEL` e `EMBED_MODEL`. As alternativas de execução e os detalhes de configuração estão no guia de desenvolvimento. [Guia de execução](docs/ai-integration/deployment.md)

<details>
<summary>Executar somente a organização acadêmica local</summary>

Com Node.js e npm instalados, rode na raiz:

```bash
npm --prefix atlas ci
npm --prefix atlas run dev
```

Abra o endereço indicado pelo Vite. Disciplinas, tarefas, calendário, flashcards, sessões e reflexões ficam disponíveis com armazenamento no navegador. Para acessar Biblioteca, Tutor e Monitor, inicie também os serviços pelo script completo.

</details>

### Primeiro uso

1. Cadastre uma disciplina e organize os prazos em **Agenda**.
2. Crie um baralho em **Flashcards** ou inicie uma prática no **Modo de estudo**.
3. Para consultar um material, entre pelo **Perfil**, envie o arquivo em **Biblioteca** e aguarde a indexação. Em **Tutor → Materiais**, marque o documento e faça a pergunta.
4. Confira as fontes da resposta. Questões geradas podem ser editadas e aprovadas antes de entrar nos flashcards.
5. No **Monitor**, autorize o compartilhamento do plano que deseja acompanhar. Consulte as tentativas e reflexões em **Progresso**.

## Dados e privacidade

| Dados | Armazenamento |
| --- | --- |
| Disciplinas, tarefas, conceitos, flashcards, tentativas, sessões e reflexões do Atlas | IndexedDB, no perfil do navegador e na origem utilizada. |
| Conta, arquivos enviados, fragmentos indexados, conversas, preferências e projeção autorizada do plano | PostgreSQL, com registros vinculados à conta. No Compose, o banco usa um volume persistente. |
| Registros da aplicação original | `localStorage`, na chave `trilora-v1`. |

Use o mesmo endereço e perfil do navegador para reencontrar os cadastros locais. A portabilidade desses registros é feita por **Meus dados → Exportar dados / Importar arquivo**. A conta do serviço permite recuperar documentos e conversas após entrar novamente. As credenciais da sessão ficam em memória e o login é solicitado após recarregar a aplicação.

A importação do Trilora original é iniciada pelo estudante, conserva o JSON de origem e exige confirmação antes de substituir dados do Atlas. Mantenha exportações em um local de sua confiança para recuperação após limpeza do navegador.

O upload envia o documento ao servidor configurado. A indexação usa o provedor de embeddings e a conversa usa os trechos recuperados dos materiais selecionados. O plano acadêmico chega ao Monitor mediante autorização. Os fluxos de dados, a retenção e os mecanismos de exclusão estão documentados. [Segurança e privacidade](docs/ai-integration/security-and-privacy.md)

## Arquitetura

O frontend usa **React, TypeScript e Vite**, com validação Zod e persistência IndexedDB por Dexie. O backend é um monólito **FastAPI**, com Pydantic, psycopg, **PostgreSQL/pgvector** e o cliente oficial do **Ollama**. Os workers cuidam da indexação e da avaliação periódica do plano.

```text
trilora/
├── atlas/
│   ├── src/                  Interface, aplicação, domínio e persistência local
│   ├── checks/               Testes unitários, componentes e navegador
│   └── docs/                 Arquitetura e fundamentação pedagógica do Atlas
├── backend/
│   ├── migrations/           Migrações SQL versionadas
│   ├── tests/                Testes de serviços e integração
│   └── evaluation/           Corpus e avaliação reproduzível do RAG
├── docs/ai-integration/      Documentação do Monitor, Tutor e Adaptive
├── index.html, css/, js/     Aplicação Trilora original
├── tests/                   Regressão da aplicação original
├── compose.yaml             Banco, API e workers em contêineres
└── trilora-dev              Inicialização do ambiente de desenvolvimento
```

As recomendações do Monitor e do motor Adaptive seguem regras determinísticas e apresentam as evidências usadas. O Tutor combina busca textual e vetorial para recuperar fontes antes da geração. Os contratos e as decisões de integração estão detalhados na documentação técnica. [Arquitetura](docs/ai-integration/architecture.md)

## Verificação

Com as dependências instaladas, execute na raiz:

```bash
node --test
npm --prefix atlas test
npm --prefix atlas run typecheck
npm --prefix atlas run build
backend/.venv/bin/python -m pytest -q backend/tests
```

Os comandos verificam a regressão original, as regras e componentes do Atlas, os tipos, o build e os serviços Python. Para incluir os testes de integração do backend, defina `ATLAS_TEST_DATABASE_URL` apontando para um banco de teste dedicado com pgvector.

Para o percurso completo em Chromium, com o build pronto, o banco de teste configurado e as portas 8001 e 4179 livres:

```bash
backend/.venv/bin/python -m backend.tests.browser
```

O roteiro inicia os serviços de teste e usa um provedor controlado. `ATLAS_CHROMIUM` pode indicar um executável Chromium já instalado. A avaliação com modelos reais, os resultados observados e os limites das verificações estão registrados no protocolo do RAG. [Avaliação técnica](docs/ai-integration/evaluation.md)

## Documentação

| Tema | Leitura |
| --- | --- |
| Instalação e configuração | [Execução local, Docker, modelos e workers](docs/ai-integration/deployment.md) |
| Engenharia do Atlas | [Regras, persistência e importação](atlas/docs/engenharia.md) |
| Pedagogia | [Fundamentação, matriz de rastreabilidade e plano de avaliação](atlas/docs/pedagogia.md) |
| Integração e API | [Arquitetura](docs/ai-integration/architecture.md) · [Modelo de dados](docs/ai-integration/data-model.md) · [Referência da API](docs/ai-integration/api-reference.md) |
| Acompanhamento | [Monitor acadêmico](docs/ai-integration/academic-monitor.md) · [Aprendizagem adaptativa](docs/ai-integration/adaptive-learning.md) |
| Tutor e materiais | [Pipeline RAG](docs/ai-integration/rag-pipeline.md) · [Fundamentos científicos](docs/ai-integration/scientific-foundations.md) |
| Privacidade | [Autorização, isolamento e retenção](docs/ai-integration/security-and-privacy.md) |
| Evidências e evolução | [Entrega e roadmap do Atlas](atlas/docs/entrega.md) · [Avaliação da integração](docs/ai-integration/evaluation.md) |

A fundamentação orienta o projeto a partir da aprendizagem autorregulada, da recuperação ativa e da prática distribuída. A eficácia educacional do Atlas depende da avaliação com estudantes e docentes prevista no plano pedagógico.

## Trilora original

A versão **1.2.0** em HTML, CSS e JavaScript está na raiz. Reúne disciplinas, tarefas, calendário, flashcards com avaliação manual, cronômetro e estatísticas. Para executá-la, sirva os arquivos por HTTP:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra **http://127.0.0.1:8000**. Os registros usam a chave `trilora-v1`, com validação integral e detecção de conflitos antes da gravação. As regras dos módulos estão documentadas. [Flashcards](docs/flashcards.md) · [Tempo de estudo e estatísticas](docs/tempo-estudo.md)

O teste de navegador da versão original pode ser executado com `python3 -B tests/browser_smoke.py /caminho/do/chromium`. Ele utiliza uma origem temporária e um perfil descartável para verificar os fluxos e a persistência.

## Origem e créditos

O Atlas é uma reconstrução incremental do Trilora, projeto acadêmico iniciado por **JoabKaimon**. O histórico deste repositório registra a autoria e as evoluções da aplicação. [Repositório de origem](https://github.com/JoabKaimon/trilora)

A definição de uma licença de distribuição para o projeto segue pendente. As dependências conservam suas próprias licenças e avisos. O contexto da reconstrução e as condições identificadas constam da auditoria inicial. [Auditoria do Atlas](atlas/docs/auditoria.md)

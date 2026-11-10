# Trilora 1.2.0 — Organizador acadêmico

Projeto de Engenharia de Software em HTML, CSS e JavaScript. Reúne planejamento acadêmico, revisão com flashcards e acompanhamento do tempo de estudo.

## Funcionalidades e uso

- **Disciplinas.** Cadastre disciplinas com cores e acompanhe o andamento das tarefas na visão geral. A exclusão é bloqueada enquanto houver tarefas, baralhos ou uma sessão de tempo ativa vinculada.
- **Tarefas e calendário.** Crie e edite tarefas com disciplina, prazo e prioridade. Marque-as como concluídas, use a pesquisa e os filtros e veja os prazos na grade mensal.
- **Flashcards.** Em **Gerenciar baralhos**, crie baralhos por disciplina e cadastre perguntas e respostas. Para revisar, escolha um baralho e clique em **Iniciar estudo**. Use **Mostrar resposta**, depois **Errei** ou **Acertei**. Ao final, veja o resultado e, se quiser, estude novamente. As revisões concluídas ficam no histórico local. [Regras dos flashcards](docs/flashcards.md)
- **Tempo de estudo.** Escolha uma disciplina e use **Iniciar**, **Pausar**, **Continuar** e **Encerrar**. O histórico registra a duração efetiva, excluindo pausas, e o último ponto salvo pode ser recuperado após uma interrupção. [Regras do cronômetro](docs/tempo-estudo.md)
- **Estatísticas.** Consulte o total de tempo estudado, o tempo de hoje e dos últimos sete dias, o gráfico por disciplina e o histórico das sessões.

## Estrutura

```text
trilora/
├── index.html                Página principal
├── css/
│   ├── style.css             Estilo da versão inicial
│   ├── improvements.css     Melhorias visuais
│   ├── flashcards.css       Layout de baralhos, cartões e formulários
│   └── timer.css             Cronômetro, histórico e gráfico
├── js/
│   ├── app.js                Interface e interações
│   ├── data.js               Validação e persistência compartilhadas
│   ├── flashcards.js         Regras e operações de baralhos e cartões
│   ├── flashcards-view.js    Catálogo e gerenciamento de flashcards
│   ├── study.js              Regras da sessão e histórico
│   ├── study-view.js         Modal de estudo
│   ├── timer.js              Regras, recuperação e dados do cronômetro
│   ├── timer-view.js         Interface do cronômetro e das estatísticas
│   └── time-stats.js         Durações e agregação por período e disciplina
├── docs/
│   ├── flashcards.md        Modelo de dados e critérios de aceitação
│   └── tempo-estudo.md       Regras de tempo, recuperação e estatísticas
├── tests/
│   ├── data.test.mjs         Regras e persistência
│   ├── app.test.mjs          Fluxos da interface com DOM simulado
│   ├── flashcards.test.mjs   Integridade e persistência de baralhos e cartões
│   ├── study.test.mjs        Progressão, resultado e histórico de estudo
│   ├── timer.test.mjs        Cronômetro, recuperação e agregação de tempo
│   └── browser_smoke.py     Verificação em navegador Chromium
├── package.json              Configuração dos testes
└── README.md
```

## Como executar

Como a aplicação agora utiliza módulos JavaScript (`type="module"`), rode-a por um servidor HTTP local em vez de abrir o arquivo pelo protocolo `file://`.

No Visual Studio Code, você pode utilizar uma extensão de servidor local como Live Server. Se tiver Python 3 instalado, também pode executar na pasta do projeto:

```bash
python -m http.server 8000 --bind 127.0.0.1
```

Depois, acesse `http://localhost:8000`.

**O GitHub Pages não exige instalação de nada:** ele já disponibiliza os arquivos por HTTP/HTTPS.

## Executar testes

Com Node.js instalado (sem dependências de terceiros):

```bash
npm test
```

Também é possível executar diretamente, sem npm:

```bash
node --test
```

Os testes cobrem progresso, filtragem, ordenação, validação, escape de HTML, compatibilidade dos dados legados, corrupção, erros de acesso/leitura/gravação, conflito entre estados e confirmação das operações da interface somente depois de salvar. As operações usam múltiplos registros e conferem o estado esperado completo, incluindo a preservação dos registros não envolvidos, a exclusão individual e a reversão de concluída para pendente.

Os testes da interface executam os handlers reais com DOM simulado, sem dependências de terceiros. Os formulários possuem controles com `.value`, inicializados a partir do HTML; o preenchimento e a coleta de `FormData` usam esses controles. Assim, os testes verificam valores e preservação após falhas, em vez de depender apenas de `innerHTML`. O simulador cobre somente os controles utilizados atualmente: não verifica layout, validação nativa ou todos os comportamentos do DOM, nem substitui testes manuais no navegador.

Para testar em um navegador real, use Python 3 e informe o caminho de um Chrome ou Edge instalado:

```powershell
python -B tests/browser_smoke.py "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

O roteiro abre um servidor em `127.0.0.1` com porta temporária e executa o navegador em modo headless com perfil descartável. Verifica tarefas, calendário, flashcards, cronômetro e estatísticas, incluindo a recarga real da página e o layout de 320 a 1.200 px. Usa relógio controlado e simula a interrupção seguida de uma nova navegação, os diálogos de confirmação e os erros de armazenamento. A verificação não abrange interação manual, leitores de tela ou outros motores de navegador.

## Etapa 1 — Integridade e persistência

### Compatibilidade e validação

A chave continua sendo `trilora-v1`. O formato inclui `subjects` e `tasks`, com `flashcards` e `studyTimer` opcionais. Dados válidos da versão 1.1 são carregados sem migração nem gravação automática. Campos adicionais existentes são preservados nas operações. Coleções vazias salvas são válidas e não recebem demonstração.

A validação é integral, tanto na carga quanto antes de salvar:

- IDs são strings de 1 a 128 caracteres, sem espaços nas extremidades e únicos em todo o conjunto de disciplinas e tarefas. IDs antigos, como `s1` e `t1`, continuam válidos; não se exige UUID.
- Nomes de disciplinas têm de 2 a 80 caracteres, e títulos de tarefas, de 2 a 120. O mínimo considera o texto sem espaços nas extremidades; o máximo considera a string completa.
- Disciplinas não podem repetir nomes, desconsiderando maiúsculas e espaços nas extremidades. Cores seguem o formato hexadecimal de seis dígitos.
- Toda tarefa referencia uma disciplina existente, possui prioridade `Alta`, `Média` ou `Baixa` e conclusão booleana.
- Datas são strings `AAAA-MM-DD`, entre os anos 0001 e 9999, com validação do calendário e dos anos bissextos, independente de fuso horário.

Esse intervalo também é suportado pelo calendário: os anos são formatados com quatro dígitos e construídos sem o deslocamento implícito de 1900 para anos menores que 100. A navegação mensal não ultrapassa janeiro de 0001 nem dezembro de 9999; o campo de prazo declara os mesmos limites. A correção não restringe o intervalo anterior, não migra nem descarta prazos existentes.

O filtro de disciplina usa `null` para representar a ausência de filtro; no seletor, essa opção usa valor vazio, que não é um ID válido. Identificadores de domínio não têm significado especial: uma disciplina com ID `Todas` continua sendo preservada e pode ser filtrada normalmente. Esse estado é exclusivo da interface e não altera o formato salvo em `trilora-v1`.

Ao excluir a disciplina selecionada, o filtro volta a mostrar todas as disciplinas depois que a exclusão é salva. As células vazias que completam a grade mensal não mostram tarefas de meses adjacentes. Cada tarefa aparece no seu próprio mês.

Se qualquer registro for inválido, o conjunto não é carregado parcialmente. Nenhum registro é descartado silenciosamente. A aplicação bloqueia alterações e preserva o conteúdo original para recuperação, inclusive quando o JSON é legível, mas incompatível com essas regras.

### Estados do armazenamento

| Estado | Comportamento |
|---|---|
| Chave ausente (`empty`) | Apresenta a demonstração em memória. Grava somente quando uma operação é salva. |
| Conteúdo válido (`ready`) | Carrega os registros existentes e permite alterações. |
| JSON ou dados inválidos (`corrupt`) | Mantém o conteúdo original, informa o problema e bloqueia alterações. Não apresenta demonstração. |
| Falha de acesso ou leitura (`read-error`) | Informa a indisponibilidade e bloqueia alterações. Não trata a falha como armazenamento vazio. |

`loadData` retorna `{ status, data, raw }` quando a leitura ocorre; em falha de leitura retorna `{ status: 'read-error', data: null }`. `normalizeData` lança `TypeError` para um conjunto inválido, em vez de remover registros ou retornar demonstração.

`saveData` retorna `{ ok, status }`, incluindo `raw` no sucesso. Distingue dados inválidos, corrupção preexistente, falha de leitura, conflito e falha de gravação. O acesso ao próprio `localStorage` fica dentro do tratamento de erros.

### Confirmação das alterações

Criação, edição, exclusão e conclusão montam um novo estado sem alterar o estado confirmado. A interface só o adota após `setItem` terminar com sucesso. Se a gravação falhar, o estado anterior é mantido, o aviso permanece visível, formulários continuam abertos com seu conteúdo e caixas de conclusão retornam ao valor anterior. Falhas de gravação permitem nova tentativa.

Antes de gravar, a aplicação relê a chave e compara o conteúdo com a leitura anterior. Se outra aba tiver alterado ou removido os dados, a operação é bloqueada e pede recarregamento. Se a releitura detectar corrupção ou erro de acesso, também bloqueia novas alterações até recarregar. O conteúdo encontrado não é substituído.

### Recuperação e limitações

Quando houver aviso de corrupção, preserve uma cópia do valor exato de `trilora-v1` nas ferramentas de armazenamento do navegador antes de qualquer intervenção. Não limpe os dados do site nem remova a chave como tentativa de correção: isso elimina a fonte de recuperação. A recuperação deve ser feita sobre uma cópia; esta etapa não inclui reparo automático, importação ou exportação pela interface. Após corrigir o conteúdo ou restabelecer o acesso, recarregue a página. Não é preciso apagar registros para resolver indisponibilidade de armazenamento.

O bloqueio por corrupção mostra uma coleção vazia apenas como estado seguro da interface, com aviso explícito de que ela não representa os dados salvos. O original permanece na chave. Um conjunto parcialmente válido também permanece intacto para recuperação externa.

A comparação antes de gravar reduz sobrescritas entre abas, mas leitura e gravação não formam uma transação atômica: duas abas gravando ao mesmo tempo ainda podem entrar em conflito. Não há sincronização automática entre abas. O armazenamento continua síncrono, limitado pelo navegador e sem backup automático. O sucesso de `setItem` não protege contra uma limpeza posterior dos dados do site.

## Publicar no GitHub Pages

1. Após a aprovação da versão, atualize a referência de `origin/main` e confirme que ela é ancestral do commit validado. Registre o SHA que está publicado para facilitar uma eventual reversão.
2. Confirme em **Settings → Pages** que a fonte de publicação é a raiz (`/`) de `main`, onde fica o `index.html`. Os módulos e estilos usam caminhos relativos compatíveis com o subdiretório `/trilora/`. O aplicativo é estático.
3. Integre por avanço rápido se a `main` continuar ancestral da versão. Se a branch estiver protegida, use um pull request que preserve os commits e confirme o SHA que será publicado antes de enviar a tag anotada da versão.
4. Acompanhe a implantação em **Actions**. Quando concluir, abra o [Trilora publicado](https://joabkaimon.github.io/trilora/) e verifique disciplinas, tarefas, calendário, revisão de flashcards, cronômetro e estatísticas. Use um perfil separado com dados de teste para o teste de gravação.

Se for preciso corrigir a implantação, prefira publicar um commit que mantenha o esquema atual. Versões antigas podem remover os campos de flashcards e tempo de estudo ao gravar em `trilora-v1`. Antes de testar uma reversão com dados reais, guarde uma cópia do valor dessa chave na origem publicada.

## Armazenamento e limitações

O sistema usa a chave `trilora-v1` no `localStorage` e mantém os registros já existentes na mesma origem (endereço web) e navegador. Isso não sincroniza dados entre dispositivos. Se o usuário limpar os dados do site, os registros locais podem ser perdidos. Ainda não há autenticação, banco de dados remoto ou suporte a múltiplos usuários.

O conjunto de demonstração aparece somente quando não existem dados salvos. Os testes automatizados não substituem os testes manuais no navegador.

# Entrega do MVP

| Fase | Evidência | Limite e continuidade |
| --- | --- | --- |
| Auditoria | Branch limpa na base 9caf1e9, inventário, contratos e regressão inicial | A árvore original não apresenta licença explícita. Esclarecer direitos antes de distribuir. |
| Fundação | React, configuração estrita, banco separado e cinco testes iniciais de persistência | A persistência depende da origem e perfil do navegador. |
| Organização | Cadastros relacionados, filtros, calendário e testes de vínculos e datas civis | A consistência curricular dos conceitos depende do autor. |
| Núcleo pedagógico | Revisões individuais, espaçamento determinístico, relógio controlável, recuperação e reflexão | A autoavaliação mede o julgamento do estudante. |
| Integração | Recomendações com motivo, calendários, indicadores, arquivo portátil e backup transacional | O Atlas trabalha em um dispositivo por vez. |
| Qualidade | Suítes de domínio, integração, componente e navegador, compilação e regressão | Próxima etapa proposta: piloto formativo com estudantes e docentes. |

## Verificações efetivamente realizadas

- Cinco arquivos da suíte original passaram com Node na raiz. O roteiro HTML original completou 109 verificações com Brave/Chromium via Playwright e perfil temporário. Foi necessário usar esse lançador porque o comando original com --dump-dom excedeu 45 segundos.
- Treze testes Vitest cobrem validação, persistência, concorrência, corrupção, falha e repetição de gravação, cópia anterior, importação histórica, integridade do grafo, intervalos de revisão, pausas e encerramento único. React Testing Library usa DOM simulado no teste de formulário.
- Três cenários Playwright executaram o build de produção. O percurso principal cria dados pela interface, edita e conclui tarefa, revela e avalia um cartão por teclado, verifica seu histórico, inicia a atividade recomendada, pausa, recarrega, retoma, registra a reflexão e consulta o progresso. O segundo cenário cancela e confirma importações, confere o legado intacto e lê os downloads. O terceiro verifica navegação, foco e largura.
- As sete telas foram verificadas a 320, 768 e 1360 px para transbordamento horizontal. A inspeção visual do painel incluiu desktop e celular. Na abertura da prévia, os pedidos de recursos ficaram na origem local.
- A meta é WCAG 2.2 AA. Foram exercitados teclado, retorno do foco, link de salto e adaptação à largura (critérios relacionados a 2.1.1, 2.4.1, 2.4.3 e 1.4.10). As análises axe nas telas de painel, progresso, agenda móvel e diálogo de disciplina completaram sem violações detectadas nas regras A/AA selecionadas. Leitores de tela, dispositivos físicos, outros motores e conformidade integral exigem avaliação adicional.
- A checagem estrita de tipos e o build Vite passaram. A compilação remove anotações de otimização do pacote Zod que o Rollup não interpreta.

## Evoluções condicionadas a avaliação e autorização

| Possibilidade | Dependências e riscos | Hipótese e avaliação |
| --- | --- | --- |
| Explicação cruzada, compartilhamento, revisão por pares e mediação docente | Rubrica, consentimento, controle de acesso, moderação e proteção de menores | Verificar se os comentários geram explicações mais precisas, por avaliação docente independente. |
| Sincronização, FastAPI e PostgreSQL | Identidade, resolução de conflitos, isolamento de contas, retenção e exclusão de dados, custos e operação | Medir falhas de retomada entre dispositivos e necessidade real de trabalho remoto. |
| Adaptação de revisões | Dados longitudinais consentidos, validação prospectiva e opção de desativar | Comparar retenção posterior e carga de revisão com a regra atual. |
| Questões e orientações geradas por IA | Revisão de conteúdo, privacidade, orçamento, avaliação de erros e alternativa manual | Avaliar precisão e transferência em tarefa inédita antes de oferecer ao estudante. |

A adequação da interface e os efeitos educacionais aguardam o [piloto descrito na fundamentação](pedagogia.md).

# Trilora

O Trilora é um projeto acadêmico de Engenharia de Software para estudantes do ensino médio e universitários. O escopo inclui organização acadêmica, flashcards com autoavaliação e cronômetro de estudos com histórico e estatísticas.

## Desenvolvimento

- Verifique a branch, o estado do Git e os testes existentes antes de editar. Preserve alterações locais e trabalhe em branches de desenvolvimento. Faça commits locais descritivos por entrega.
- Evolua em ordem: estabilização, gerenciamento de flashcards, revisão, cronômetro, estatísticas, integração e qualidade, documentação e entrega. Ao concluir uma fase, registre evidências, limitações e a próxima etapa.
- Mantenha HTML, CSS e JavaScript modular. Separe interface, regras de negócio e persistência conforme o sistema crescer. Use disciplinas como cadastro compartilhado entre os módulos e proteja os vínculos ao editar ou excluir.
- Preserve a chave `trilora-v1` e os dados existentes. Teste migrações quando o esquema mudar. Diferencie armazenamento vazio, corrupção e indisponibilidade. Não confirme alterações antes de salvar nem descarte conteúdo recuperável.
- Use cartões de texto com avaliação manual. O cronômetro deve excluir pausas, calcular duração a partir de instantes medidos e permitir recuperação segura após interrupções. Calcule estatísticas com durações reais em milissegundos inteiros.
- Peça aprovação antes de integrar à `main`, publicar, excluir dados existentes, introduzir serviços externos ou custos, mudar significativamente a arquitetura ou ampliar o escopo. Autenticação, backend e sincronização ficam para evolução futura.

## Verificação e documentação

- Execute `node --test` na raiz e verifique a sintaxe dos módulos alterados. Cubra regras de negócio, integração, persistência, falhas e regressões. Use relógios controláveis nos testes de duração.
- Verifique fluxos de interface em navegador real quando o ambiente permitir, com dados de teste e origem isolada. Informe limitações da verificação e não trate testes simulados como validação de navegador.
- Preserve navegação por teclado, foco visível, rótulos claros e layout responsivo. Mantenha o README e a documentação acadêmica em `docs/` alinhados ao código e aos critérios de aceitação.

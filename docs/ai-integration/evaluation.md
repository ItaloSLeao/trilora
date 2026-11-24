# Avaliação reproduzível

## Corpus documental e gabaritos

A pasta [backend/evaluation](../../backend/evaluation) contém três materiais originais de teste em português sobre oficinas fictícias, sete perguntas e respostas esperadas. Os nomes próprios e detalhes das oficinas permitem conferir a origem de uma resposta. Há cinco casos respondíveis, incluindo um que exige combinar agenda e roteiro, e dois casos sem resposta. Um destes exclui explicitamente o documento que contém a resposta. O gabarito é por documento. Não há anotação exaustiva de relevância por fragmento.

1. Use uma conta e base de testes. Carregue os três arquivos da pasta corpus, aguarde o estado de indexação concluída e associe os IDs retornados aos nomes dos arquivos. Preserve o texto dos documentos. Submeta cada pergunta de cases.json em uma conversa nova no modo documental restrito, selecionando exatamente os arquivos de selected.
2. Registre o commit, a versão do banco, os modelos de geração e embedding, os parâmetros de fragmentação, filtros, fusão e geração e o equipamento utilizado. Fixe configurações entre execuções. Para comparar alternativas, repita o mesmo conjunto de perguntas com cada configuração e alterne a ordem das configurações. Registre a primeira chamada separadamente para distinguir aquecimento.
3. Para cada pergunta, conserve para inspeção a resposta, os trechos recuperados na ordem, a localização aberta por cada referência, a duração total medida por relógio monotônico e o uso informado pelo provedor. Conte uma abstenção quando a resposta declara insuficiência dos materiais e deixa a pergunta sem solução documental. Faça essa anotação lendo a resposta.
4. Monte uma lista JSON com uma linha por caso usando os campos id, retrieved, cited, abstained, latency_ms e tokens. Retrieved e cited são listas ordenadas de nomes dos arquivos, derivadas dos IDs observados. Use tokens nulo quando o provedor não informar. Uma linha de formato ilustrativo é `{"id":"i1","retrieved":["recursao.txt"],"cited":["recursao.txt"],"abstained":false,"latency_ms":320,"tokens":null}`.
5. Execute a partir da raiz:

   ```sh
   python3 backend/evaluation/score.py /caminho/resultados.json --k 2
   ```

O avaliador elimina repetições de documento mantendo a primeira posição. Para cada caso respondível, precisão mede o número de documentos relevantes entre os primeiros k dividido pelo menor valor entre k e número de documentos permitidos. Posições não preenchidas contam como erros. Recall mede quantos documentos do gabarito aparecem nessas posições sobre o total do gabarito. A saída calcula a média por pergunta, a taxa de abstenção nos casos negativos, a lista de abstenções desnecessárias e as referências fora da seleção ou ausentes da recuperação. A mediana de latência abrange todos os casos. Os totais de tokens mostram quantas consultas informaram uso. Para um provedor tarifado, estime o custo com os tokens separados de entrada e saída e a tarifa datada da execução. Mantenha essa informação indisponível se faltar uma das parcelas.

## Rubrica humana por afirmação

Dois revisores examinam independentemente cada resposta, os trechos e o gabarito. Para cada afirmação substantiva, cada revisor marca sustentada, contradita ou ausente no material autorizado. Para cada referência aberta, registra se identifica o documento e localização corretos e se o trecho sustenta a afirmação associada. Registra também se cada trecho recuperado responde diretamente, apenas contextualiza ou é irrelevante. Relate as contagens por categoria, os denominadores e as divergências antes da conciliação. Um documento do gabarito citado com um trecho irrelevante pode passar na métrica de recuperação e falhar na rubrica de fidelidade.

Para o modo de orientação, registre se a primeira resposta preserva a oportunidade de o estudante produzir seu próprio raciocínio. Para atividade gerada, confira resposta esperada, clareza do enunciado e possibilidade de revisar antes de gravar. Mudanças de desempenho precisam de tarefa inédita com avaliação independente e acompanhamento posterior. O corpus curto mede regressões técnicas do roteiro. Generalização para turmas, PDFs extensos e matérias distintas requer amostragem adicional.

## Cenários para recomendações

| Arranjo com relógio fixo | O que observar |
| --- | --- |
| Conceito sem tentativas | Contagens zero, informação de amostra insuficiente e ausência de conclusão sobre aprendizado. |
| Prazo próximo, cartão pendente, pré-requisito sem prática | Justificativa identifica condições observadas e deixa explícito se a prática foi sugerida por ausência de evidência. |
| Erros recorrentes, seguidos de nova tentativa confirmada | Os totais mudam exatamente uma vez e a priorização pode ser recalculada com o mesmo conjunto de evidências. |
| Mesmo evento ou mesmo intervalo processado duas vezes | Um único efeito persistente para o evento ou a recomendação. |
| Intervenção rejeitada ou recomendação vencida | A decisão anterior permanece consultável e reapresentação respeita a política do motor. |
| Objetivo concluído e nenhuma atividade futura associada | A justificativa reflete o estado registrado pelo estudante. |
| Duas contas com dados de teste diferentes | Fontes, notificações e referências retornadas correspondem à identidade autenticada em cada consulta. |

Este arquivo descreve o protocolo e a instrumentação do avaliador. Uma execução do tutor com um provedor real precisa de resultados observados para publicar métricas. O protocolo, por si só, não estabelece fidelidade, custo ou ganho educacional do Atlas.

## Execução de engenharia

O roteiro Playwright percorre PDF textual, página citada, cartão revisado, tentativa, recomendação, reabertura contextual, nova tentativa e progresso. Usa PostgreSQL e pgvector reais com provedor explícito de teste. O pytest também cobre o agendador com relógio controlado e nenhum navegador conectado, acesso entre contas, citação inválida, timeout, quota, remoção e formatos de ingestão. Web Push exige verificação de entrega em um navegador e com chaves VAPID válidas.

Na primeira execução local com qwen2.5:3b em CPU, a precisão documental macro em k=2 foi de 0,60 e o recall macro foi de 1,00 para cinco perguntas respondíveis. A latência mediana das sete consultas foi de 68,4 segundos, com 4.826 tokens reportados. A execução foi retomada com timeout maior após uma consulta exceder 90 segundos. Todas as referências apontaram para documentos selecionados e recuperados. A revisão manual encontrou afirmações adicionais no caso i1, citação inadequada no caso m1 e material relevante ignorado no caso j2. Nas duas perguntas sem resposta, o texto reconheceu a lacuna, mas citou material relacionado. Por isso a taxa estrutural de abstinência foi 0/2 nessa execução. O contrato passou a exigir indicação explícita de suficiência. O backend agora remove respostas e citações insuficientes no modo restrito. Esses resultados caracterizam um corpus de engenharia pequeno.

O build de produção, a checagem TypeScript, os cinco arquivos da regressão Node original e os 15 testes Vitest passaram. O smoke test do Compose iniciou banco, migrações e dois workers e confirmou retorno HTTP 200 na API. A suíte de backend cobre também autorização de inscrição Web Push, aviso sem dados acadêmicos e deduplicação com transmissor controlado. Uma entrega pelo serviço real do navegador permanece por verificar.

No reteste direcionado após a mudança de contrato, o Ollama devolveu abstinência explícita nos dois casos sem evidência. Os cinco casos respondíveis do primeiro ensaio permanecem como resultados daquela versão do prompt. A melhoria observada abrange os dois casos repetidos. A revisão semântica de citações e a avaliação com estudantes continuam em aberto.

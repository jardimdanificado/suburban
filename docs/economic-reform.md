# Reforma econômica e responsabilidade de governo

## Problemas corrigidos

- A seleção de emprego dependia de um único secretário estar fisicamente trabalhando, inclusive para liberar resultados. Agora o empregador recebe o candidato presencialmente quando o balcão não atende; a seleção também troca de canal após adiamentos ou um dia de espera. A inscrição registra a data que faltava em `appliedAt`.
- Vagas anunciadas e vagas com dinheiro para uma jornada de folha são mostradas separadamente. O desemprego usa adultos disponíveis; empresários e agentes públicos são ocupados, menores e pessoas sob custódia ficam fora do denominador.
- O relatório anterior podia mostrar custeio positivo enquanto o tesouro se esvaziava com investimentos. A previsão passou a mostrar ambos os fluxos. Novos investimentos automáticos têm limite de desembolso após a fundação; investimentos deliberados pela Câmara continuam possíveis, preservando a reserva.
- Custeio somava a folha à despesa observada que já incluía salários. O alvo agora usa o maior dos dois, evitando reter dinheiro em duplicidade nas instalações.
- A venda minoritária de ações fazia a empresa perder elegibilidade a custeio municipal, mesmo mantendo controle estatal. O controle público acima de 50% continua sendo reconhecido. Distribuições em sociedades mistas respeitam todos os acionistas.
- Imóveis residenciais municipais podiam receber o primeiro aluguel, mas a cobrança diária ignorava o tesouro. A receita recorrente agora é cobrada. Moradia social continua gratuita.

## Receitas, crédito e dinheiro externo

A cidade começa com o banco estatal e dois bancos privados locatários do empresarial. Cada banco privado recebe R$ 15.000 de investimento externo registrado, integralizado pelo fundador. O aporte não sai da prefeitura e entra explicitamente na oferta monetária local. Depósitos permanecem totalmente lastreados; nenhum empréstimo pode gastar o depósito de um cliente.

Os bancos preservam 21 dias de operação antes de conceder crédito. Esse prazo cobre folha, aluguel e a carência das empresas financiadas. O refinanciamento pelo tesouro é reservado ao banco público; bancos privados usam seu capital.

O limite padrão de negociação de participações públicas é 7% por dia, compartilhado entre as empresas. Ofertas não executadas podem permanecer no livro, mas não permitem ultrapassar o teto de execução diário. Operações especiais aprovadas em lei têm tramitação própria. Ações vendidas geram receita somente quando um comprador realmente paga.

Excedentes municipais podem ser exportados para compradores externos. A venda retira mercadoria real, preserva estoque para consumo local e materiais das obras contratadas, limita lotes por hora e evita reciclar importações caras em exportações artificiais. Nas empresas inteiramente públicas, parte do resultado disponível retorna ao tesouro; empresas mistas distribuem resultados aos acionistas.

A repartição nacional de tributos fornece um repasse nominal previsível por morador, registrado em conta externa identificada. É a principal concessão de jogo para representar a federação fora do mapa: não corresponde a receita gerada pela cidade. Existe teto no parâmetro e a população pode votar a política de cooperação fiscal. Importações retiram dinheiro da cidade; exportações, investimento externo e repasses nacionais acrescentam dinheiro, sempre contabilizado em `externalNet`.

## Tributos sem confisco involuntário

- IPTU, IPVA, terrenos ociosos e grandes riquezas usam taxas **anuais**, apropriadas em 360 dias. Frações de centavo acumulam para o próximo dia.
- Grandes riquezas consideram caixa, poupança, imóveis, veículos e participação empresarial, deduzindo dívidas. A propriedade diretamente registrada no nome da pessoa não é contada novamente como patrimônio da empresa.
- IPTU protege uma faixa da moradia principal. IPVA protege mobilidade de baixo valor e usa o valor do veículo existente, depreciado pela conservação.
- IR considera renda recebida e desconta o imposto salarial já retido. Retenções de dividendos e aluguéis não se somam novamente ao IR: constituem a cobrança mínima/antecipação.
- Empréstimos, aportes de capital e resgates de poupança não são renda tributável.
- Tributos preservam a subsistência e têm teto diário de cobrança sobre o caixa livre. Falta de liquidez gera dívida tributária registrada, sem criar dinheiro, saldo negativo ou pagamento fictício.
- A cobrança diária é idempotente, inclusive após carregar um snapshot.

## Aprovação e voto

A avaliação usa desemprego real, resultado de custeio, caixa, solvência das estatais, continuidade financeira dos serviços, iluminação abastecida, pavimentação nas ruas usadas, obras atrasadas, corpos aguardando destinação e processos antigos sem resposta judicial. Absolvição fundamentada é resposta judicial; não se exige condenar qualquer acusado para pontuar.

Após a fase inicial, resultados gerais impõem um teto à aprovação. Caixa esgotado e colapso das estatais impõem um teto adicional. Promessas e propaganda não apagam essas falhas. O voto individual recebe razões explícitas sobre economia e serviços, com peso material diferente por eleitor. As correntes políticas continuam divergindo sobre as soluções, mas nenhuma é tratada como indiferente a serviços essenciais.

Os indicadores de caixa são financeiros: não substituem fila, estoque ou presença física dos funcionários. As falhas de folha continuam interrompendo o trabalho real e geram eventos ligados ao serviço afetado.

## Catálogo implementado

As políticas abaixo estão disponíveis no painel fiscal e podem ser alteradas por projeto de lei, voto e sanção. Os valores são padrões para novas cidades; mudanças deliberadas persistem no save. A migração ativa os novos tributos por padrão e atualiza a antiga cota automática de 1% para 7%, preservando uma cota estabelecida explicitamente por lei.

| Política | Padrão | Efeito |
|---|---:|---|
| Grandes riquezas: alíquota anual | 1.50% | Tributa somente patrimônio líquido acima da isenção; desconta dívidas. |
| Grandes riquezas: faixa isenta | 2000000 | Protege o pequeno patrimônio; inclui imóveis, veículos e ações sem duplicar o ativo da empresa. |
| IPTU: alíquota anual | 1.20% | Cobrança sobre imóveis privados; patrimônio municipal é imune. |
| IPTU: isenção da moradia principal | 120000 | Abate o valor da casa ocupada pelo próprio contribuinte. |
| IPTU: multiplicador de imóvel vazio | 1.5 | Aumenta o custo de manter imóveis privados desocupados. |
| Terrenos ociosos: alíquota anual | 2.00% | Incide em terrenos privados sem prédio ou obra contratada. |
| IPVA: alíquota anual | 2.00% | Tributa veículos ativos de acordo com o valor real de fabricação. |
| IPVA: faixa isenta por proprietário | 30000 | Protege a mobilidade básica e pequenos equipamentos. |
| Imposto de renda: alíquota máxima | 25.00% | Sobre renda diária acima da faixa isenta; desconta imposto salarial já retido. |
| Imposto de renda: faixa diária isenta | 6000 | Salários, aluguéis e dividendos entram na apuração, sem taxar empréstimos ou resgates. |
| Dividendos: retenção | 10.00% | Retenção paga pelo acionista sobre distribuições efetivamente recebidas. |
| Aluguéis: retenção | 8.00% | Renda imobiliária privada compõe o imposto de renda, com crédito da retenção. |
| Heranças em dinheiro: alíquota | 4.00% | Somente transmissões privadas; o espólio sem herdeiro retorna ao município. |
| Imposto de consumo: multiplicador | 1 | Ajusta as alíquotas por ramo já existentes; preserva o teto de 50%. |
| Alimentos: redução de imposto | 25.00% | Reduz o imposto de alimentos para preservar o poder de compra. |
| Consumo de equipamentos: adicional | 3.00% | Adicional sobre roupas e equipamentos de mobilidade. |
| Exportação de excedentes municipais | Ativa | Vende estoque físico excedente depois da reserva para demanda local e obras. |
| Exportação: dias de proteção do estoque | 3 | Alimentos e materiais essenciais permanecem disponíveis para consumo e projetos locais. |
| Exportação: lote máximo por hora | 12 | Limita a velocidade de absorção pelo mercado externo. |
| Exportação: repasse ao tesouro | 65.00% | Transfere parte da receita líquida ao tesouro preservando o capital operacional. |
| Locação de imóveis municipais | Ativa | Permite locar imóveis comerciais e residenciais municipais; habitação social continua protegida. |
| Locação municipal: desconto | 10.00% | Desconto sobre novos contratos municipais de aluguel. |
| Distribuição de lucro empresarial | 35.00% | Limita dividendos ao lucro realizado e ao caixa livre após a reserva operacional. |
| Reserva de folha empresarial em dias | 3 | Evita prender uma semana inteira de salários em toda pequena empresa. |
| Custeio: dias de caixa por serviço | 2 | Dimensiona o caixa operacional das instalações públicas. |
| Contratação direta pelos empregadores | Ativa | Entrevistas no empregador quando o balcão municipal não atende; candidatura nunca depende indefinidamente de um secretário. |
| Vagas divulgadas no quadro público | 128 | Amplia a divulgação de vagas, incluindo empresas distantes do centro. |
| Tolerância para chegada à entrevista | 180 | Dá tempo para deslocamento e necessidades básicas sem contratar candidatos ausentes. |
| Crédito pessoal: juros diários | 0.10% | Juros com limite de risco, reserva bancária e proteção da subsistência. |
| Reserva de operação dos bancos em dias | 21 | Protege a operação antes de conceder novos empréstimos. |
| Crédito: múltiplo da renda diária | 12 | Limita empréstimos pessoais pela renda verificável; depósitos continuam integralmente lastreados. |
| Tributos: teto diário do caixa disponível | 20.00% | Protege subsistência e operação; o restante vira dívida tributária registrada. |
| Alerta fiscal: horizonte em dias | 30 | Antecipa revisão de receita antes do esgotamento do caixa livre. |
| Revisão fiscal preventiva | Ativa | Encaminha propostas tributárias ao Legislativo em vez de alterar impostos sem votação. |
| Repartição nacional de receitas por morador/dia | 1200 | Repasse externo previsível de receitas nacionais; registrado na oferta monetária e nas contas públicas. |
| Receita livre destinada a obras | 12.00% | Reabastece a verba de obras apenas quando os serviços e a reserva estão protegidos. |

Valores monetários do catálogo são centavos nos preços iniciais. Cada alíquota é identificada como anual, diária ou incidente na transação.

## Próximas 40 políticas propostas

Estas políticas são um plano de expansão, **não efeitos já implementados**. Cada uma exige uma base observável, custo efetivo e consequências distributivas antes de entrar em votação.

| Política | Mecânica proposta e limite | Conflito político |
|---|---|---|
| 1. Imposto sobre ganho de capital | Cobrar somente ganho realizado contra custo de aquisição, compensando prejuízos | Investidores versus financiamento público |
| 2. ITBI | Taxar transferência imobiliária e isentar primeira moradia de baixo valor | Mercado imobiliário versus arrecadação |
| 3. ITCMD sobre ativos | Avaliar heranças de ações e imóveis; parcelar quando não houver caixa | Continuidade familiar versus redistribuição |
| 4. Contribuição de melhoria | Cobrar parte da valorização mensurada depois de pavimentação concluída | Proprietários beneficiados versus demais contribuintes |
| 5. Outorga de potencial construtivo | Vender direito de construir andares adicionais respeitando infraestrutura | Densidade e habitação versus sobrecarga |
| 6. Imposto sobre segunda residência | Alíquota adicional em imóveis residenciais além da moradia principal | Rentistas versus compradores iniciantes |
| 7. Progressividade temporal de terreno vazio | Escalonar cobrança após períodos verificáveis de ociosidade | Propriedade versus uso do solo |
| 8. Taxa de congestionamento | Cobrança por uso efetivo de trechos saturados, com passe de baixa renda | Mobilidade individual versus trânsito coletivo |
| 9. Tarifa de estacionamento | Medir tempo em vagas públicas e reservar vagas de serviço | Comércio local versus ordenamento urbano |
| 10. Tarifa de coleta por volume | Cobrar por lixo entregue, com franquia doméstica | Grandes geradores versus subsídio universal |
| 11. Depósito retornável | Caução paga na compra e restituída na devolução física da embalagem | Custo ao consumidor versus reciclagem |
| 12. Taxa de carbono | Cobrar emissões reais por receita produtiva, sem criar poluição virtual | Indústria versus saúde ambiental |
| 13. Royalties minerais | Cobrar extração física de minério e reservar parte para recuperação ambiental | Mineradoras versus patrimônio coletivo |
| 14. Taxa turística | Cobrar hospedagem efetiva de visitantes externos | Turismo versus serviços usados por visitantes |
| 15. Patentes municipais | Licenciar pesquisa real com royalties temporários e expiração | Inovação privada versus acesso ao conhecimento |
| 16. Zona econômica especial | Reduzir tributo em área limitada por prazo e exigir emprego adicional | Incentivo produtivo versus renúncia fiscal |
| 17. Crédito fiscal ao primeiro emprego | Reembolsar parte de salários pagos a novos trabalhadores, com teto | Empresários versus uso do orçamento |
| 18. Seguro-desemprego contributivo | Fundo separado, contribuição real e duração limitada do benefício | Proteção versus encargos sobre emprego |
| 19. Fundo de garantia salarial | Receber contribuição de empregadores e pagar atrasos até um limite | Proteção trabalhista versus risco moral |
| 20. Aprendizagem remunerada | Contratos de duração limitada e habilidade adquirida trabalhando | Formação versus trabalho barato |
| 21. Jornada e horas extras | Registrar presença e remunerar excedente com efeito em fadiga | Renda versus produtividade e saúde |
| 22. Negociação coletiva | Sindicato e empregadores pactuam salários por setor com greve possível | Poder do trabalho versus custo produtivo |
| 23. Creches vinculadas ao emprego | Financiamento misto e vagas reais liberam cuidadores para trabalhar | Contribuintes versus famílias trabalhadoras |
| 24. Portabilidade bancária | Transferir dívida com pagamento ao credor antigo e comparação de taxa | Concorrência versus retenção de clientes |
| 25. Seguro de depósitos | Prêmio bancário para fundo com patrimônio limitado; sem garantia infinita | Estabilidade versus subsídio ao risco |
| 26. Limite de concentração de crédito | Teto por cliente/setor sobre o capital do banco | Crescimento rápido versus diversificação |
| 27. Provisionamento de inadimplência | Reconhecer perda provável e reduzir dividendos antes da insolvência | Acionistas versus credores |
| 28. Liquidação bancária ordenada | Separar depósitos, vender carteira de crédito e distribuir perdas por prioridade | Resgate público versus disciplina de mercado |
| 29. Obrigações municipais | Vender títulos a compradores com dinheiro; juros e principal futuros | Obras imediatas versus dívida pública |
| 30. Limite de endividamento público | Relacionar serviço da dívida à receita recorrente, com período de ajuste | Estímulo versus sustentabilidade |
| 31. Concessões de infraestrutura | Leilão com tarifa, prazo, metas e multa, preservando continuidade | Eficiência privada versus controle público |
| 32. PPP de disponibilidade | Pagar por serviço efetivamente disponível, com passivo futuro visível | Investimento versus obrigação de longo prazo |
| 33. Compras públicas competitivas | Propostas de fornecedores com preço, prazo e capacidade verificáveis | Concorrência versus favorecimento |
| 34. Preferência ao fornecedor local | Margem limitada de preferência, mostrando o custo adicional | Emprego local versus preço ao contribuinte |
| 35. Fundo de estabilização | Poupar receitas extraordinárias e liberar em recessão por regra | Serviços presentes versus proteção futura |
| 36. Fundo soberano municipal | Comprar carteira diversificada com limite de risco e transparência | Rendimento público versus risco financeiro |
| 37. Antitruste | Identificar concentração real, impedir fusões ou exigir desinvestimento | Escala produtiva versus concorrência |
| 38. Aluguel social temporário | Vale condicionado à renda e prazo, sem transferir título do imóvel | Proteção versus aumento indireto de aluguéis |
| 39. Controle de aluguel em emergência | Reajuste limitado por prazo com resposta de oferta e manutenção | Inquilinos versus proprietários |
| 40. Orçamento participativo | Eleitores escolhem projetos dentro de verba já financiada | Prioridades de bairro versus planejamento central |

## Validação

Os testes de reforma cobrem instituições privadas iniciais, leis aprováveis, tributos anuais e fracionários, proteção da subsistência, origem externa de recursos, exportação com estoque protegido, limite diário de ações, contratação presencial sem secretário, aluguel recorrente, reserva bancária, aprovação em crise e snapshots.

O script `scripts/audit-economic-reform.mjs` executa a cidade real, sem teletransportar moradores ou saltar a logística. População, duração e semente são configuráveis por `SUBURBAN_ECON_POPULATION`, `SUBURBAN_ECON_DAYS` e `SUBURBAN_ECON_SEED`. Ele registra caixa, desemprego, bancos, empréstimos, aprovação, exportações e conservação de dinheiro. Resultados de uma semente não garantem equilíbrio em qualquer mapa ou programa político.

### Rodadas observadas

Resultados de integração em mapa 128, semente 1337, sem dinheiro de fixture:

| População inicial | Duração | Desemprego final | Tesouro no último fechamento | Dinheiro conservado |
|---:|---:|---:|---:|---|
| 64 | 70 dias | 4,69% | R$ 39.600,77 | Sim, em todos os fechamentos |
| 512 | 7 dias | 25,98% | R$ 288.849,29 | Sim, em todos os fechamentos |

Na rodada de 512 moradores, o desemprego observado caiu de 56,84% no primeiro fechamento para 25,98%; ainda existiam 53 vagas anunciadas. Na rodada de 64 moradores, o pior fechamento teve desemprego de 14,06%. Os bancos privados estavam ambos operando após sete dias na cidade maior; na cidade pequena, encerraram a operação ao longo da rodada de 70 dias. A fundação de duas instituições não é uma garantia pública de perpetuidade ou lucro: três bancos podem não caber num mercado pequeno.

As séries completas estão em `docs/economic-reform-results.json`. As rodadas antecederam os últimos ajustes de compatibilidade, contabilização agregada e limites de aprovação; são evidência de integração da reforma, não uma previsão exata para toda combinação de leis e mapas.

A verificação focada passou em **83 testes**, incluindo **17 cenários novos de reforma**. Após o último ajuste da memória/contabilidade de aprovação, os 28 testes centrais foram executados novamente e passaram. Todas as alterações JavaScript passaram na checagem de sintaxe e o diff passou na checagem de espaços/conflitos.

A suíte geral foi executada, mas **não está certificada como verde**. Ela já apresenta falhas no HEAD de referência; também há fixtures antigas que pressupõem outra seleção, outra ordem de fundação ou outros tempos em cenários judiciais. Algumas expectativas de valores iniciais, locação pública e cota de ações foram atualizadas para a nova especificação. Falhas restantes não foram mascaradas com skip nem usadas para declarar aprovação global. Um exemplo reproduzido no HEAD é a expectativa de capacidade de frete de 12 contra a capacidade corrente de 48 no cenário de especialista em iluminação.

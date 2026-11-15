# Campanha familiar

A janela **Minha família** abre junto com a cidade. Escolha uma origem e um adulto sem cargo público. A origem define uma transferência inicial única do tesouro: trabalhador recebe R$ 1.500, artesão recebe R$ 12.000 e comerciante recebe R$ 8.000, nos preços de fundação. Não são criados prédios, mercadorias ou dinheiro nessa escolha.

## Primeira partida

1. Escolha **Artesão**, selecione uma pessoa e pressione **Começar com esta pessoa**.
2. Em **Negócios**, escolha **Milho** e abra uma **Fazenda**. A abertura procura um terreno compatível, compra o lote inteiro e implanta uma lavoura pequena. Terrenos e construções continuam sujeitos ao relevo e aos recursos disponíveis.
3. Confira o caixa da empresa. Use **Aportar R$ 100** quando precisar financiar sementes, compras ou salários. O dinheiro sai do familiar selecionado.
4. Em **Contratos**, escolha a empresa fornecedora e aceite um pedido de milho. O cliente reserva o pagamento e o orçamento do transporte.
5. Aguarde o expediente, o cultivo e a colheita. Quando existir estoque, pressione **Despachar estoque**. Cargas parciais são permitidas. A entrega física conclui a venda; reservar ou despachar uma carga não conta como entrega.
6. Abra **Família** para procurar emprego, acompanhar entrevistas, escolher uma moradia e indicar um sucessor. Em **Construir**, compre terrenos e contrate obras próprias.

O relógio da barra superior permite pausar e acelerar. A agenda mostra os compromissos e o que falta para avançar.

## Decisões e consequências

- **Emprego:** candidaturas usam os requisitos, entrevistas e trajetos da simulação. O jogador escolhe a vaga; a contratação não é garantida. Alimentação, descanso, consumo básico e execução do trabalho continuam autônomos.
- **Empresa:** o fundador assume trabalho operacional. É possível aportar capital, aumentar salários, permitir aprendizes e comprar insumos de fornecedores com estoque real. As receitas produtivas existentes continuam válidas.
- **Construção:** terrenos são comprados pelo preço cadastrado. As obras manuais ocupam 2×2 células; moradias têm dois andares. A abertura rápida usa até 6×6 células nas lavouras ao ar livre e 2×2 nas demais obras. Construção exige pedras, frete, construtora e trabalho; lavoura ao ar livre exige terreno, sementes e operação.
- **Contratos:** até três ativos, com prazo de três dias. O preço é fixado na aceitação, 15% acima do preço corrente. O cliente reserva o valor dos produtos mais uma verba de frete. Saldo não gasto retorna ao cliente. Cancelamento ou atraso reduz a reputação comercial; cargas pendentes são canceladas pelo fluxo normal de logística.
- **Pedidos públicos:** compram estoque alimentar real para a prefeitura e param quando o estoque e as cargas recebidas atingem o limite. Não são um comprador externo infinito. Pedidos comerciais dependem das necessidades e do caixa das empresas.
- **Família:** parceiros recíprocos e descendentes entram no núcleo. A sucessão escolhe o adulto indicado ou outro sobrevivente. A campanha não duplica patrimônio: a transmissão dos bens continua pertencendo ao sistema de heranças.
- **Política:** **Entrar na disputa política** permite que o familiar participe da seleção normal de candidaturas e cargos. Elegibilidade, partido, eleições e votos continuam necessários. Vereadores da família podem apresentar propostas; a Câmara decide. Assumir cargo público mantém as restrições empresariais existentes.

Compras automáticas de empresas, imóveis, participações, veículos, aplicações bancárias e busca de outro emprego deixam de usar os familiares controlados. Novos cargos públicos exigem adesão política explícita. Os demais cidadãos preservam sua autonomia. Aluguel de abrigo e consumo básico continuam automáticos para manter as rotinas de sobrevivência.

## Objetivo e continuidade

Cumpra três contratos e mantenha estas condições simultâneas durante um dia simulado:

- Todos os familiares vivos têm moradia.
- Alimentação e saúde de cada familiar são pelo menos 40.
- Uma empresa da família possui um dia de folha reservado, com mínimo de R$ 10 nos preços de fundação.
- O saldo pessoal somado da família é pelo menos R$ 300 nos preços de fundação.

Perder uma condição reinicia o período de estabilidade. A vitória libera a continuidade da partida. Falência e derrota eleitoral não encerram a campanha; a ausência de sobreviventes encerra a linhagem.

## Persistência e verificação

O estado da campanha pertence à cidade e acompanha os snapshots, saves e comandos do worker. Ordens da interface usam `familyAction`, cuja implementação valida o familiar e a propriedade antes de modificar empresas ou contratar serviços.

```sh
node --test tests/family_campaign.test.mjs
node scripts/audit-family-campaign.mjs
```

A auditoria usa uma cidade real, com relevo e obras de fundação. Ela dirige somente as decisões familiares e avança o relógio normal, sem criar colheitas, teletransportar moradores ou concluir obras artificialmente. `SUBURBAN_FAMILY_SEED`, `SUBURBAN_FAMILY_POPULATION` e `SUBURBAN_FAMILY_DAYS` permitem repetir outras condições. O resultado registra entregas, moradia, estabilidade e conservação monetária.

Esta primeira campanha usa a construção, os preços, as receitas e as eleições existentes. Edição manual dos cômodos, preços comerciais individuais, negociação direta de casamento e campanha eleitoral dirigida ainda não possuem controles familiares próprios. As ferramentas de observação da simulação continuam disponíveis fora da janela familiar.

### Rodada verificada

Na semente 1337, com 24 moradores e obras de fundação ativas, a auditoria concluiu a primeira entrega no minuto 955 (dia 1, 15h55) e venceu a campanha no minuto 5038 (dia 4, 11h58). Foram três contratos concluídos e 1.440 minutos contínuos de estabilidade. A conservação monetária foi conferida a cada minuto. A moradia própria contratada ainda aguardava materiais; a família estava abrigada pela economia existente. O resultado desta semente está em `docs/family-campaign-results.json`.

Os testes focados cobrem transferência inicial, propriedade, colheita e frete reais, reserva financeira, vencimento, autoridade, adesão política, sucessão e condição sustentada de vitória. Um teste com worker real verifica início, abertura de empresa e exportação completa do save. A interface foi percorrida por cliques nas seis abas, incluindo início, abertura da lavoura e aceitação de contrato, sem erros JavaScript.

A bateria focada e as regressões selecionadas passaram em 41 testes. Uma bateria adicional encontrou cinco falhas reproduzidas no HEAD anterior: uma de privatização e quatro de produção/política. O cenário antigo de saneamento com 128 moradores por 20 dias foi interrompido após quatro minutos; a suíte geral não foi certificada.

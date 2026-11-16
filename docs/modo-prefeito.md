# Modo prefeito: governo indireto

Abra **Jogar como prefeito** no menu principal ou em **Ferramentas**. Clique em **Assumir a prefeitura** para vincular a campanha ao partido do prefeito atual. A entrada não cria dinheiro, bens ou um novo prefeito. Use uma cidade sem campanha familiar ou personagem sob controle.

O objetivo é manter o partido na prefeitura. Outro integrante do mesmo partido pode assumir sem encerrar a campanha. Se uma pessoa de outro partido assumir, por eleição, sucessão ou afastamento, a campanha termina e a simulação para. A tela de derrota permite encerrar a campanha e continuar observando a cidade. Não é possível reiniciar a campanha nessa mesma cidade.

## Decisões do jogador

O painel tem sete áreas: **Situação**, **Obras**, **Custeio**, **Gabinete**, **Políticas**, **Câmara** e **Ordens**.

- **Situação:** acompanhe avaliação, calendário eleitoral, compromissos do mandato, alimentação, moradia, secretarias com titular e o próximo decreto.
- **Obras:** contrate instalações com a verba municipal de obras, inclusive fazendas verticais de duas a oito andares. Abra empresas municipais de qualquer ramo produtivo ou de serviço e instale atividades de andar empresarial (redação, instituto de pesquisa, editora e banco) em andares públicos vagos. Contrate habitação social conforme a fila real de moradores sem casa, priorize a pavimentação de trechos por circulação, conserve vias danificadas, instale postes de iluminação pública em pontos escuros com rua e faça reparo preventivo em imóveis municipais. O planejamento existente encontra o terreno; orçamento, acesso, materiais, construtora e trabalhadores continuam necessários. Altere a prioridade de obras públicas entre baixa, normal e urgente. Obras usam a verba aprovada, separada do tesouro.
- **Custeio:** transfira recursos do tesouro para empresas municipais ou contrate reparo, limpeza e jardinagem em imóveis públicos. A seção de participações propõe estatização e privatização de empresas à Câmara, respeitando a cota diária e a disponibilidade de compradores; o prefeito também pode ofertar participações públicas dentro da cota diária e transferir o resultado de uma estatal ao tesouro. Os programas municipais recuperam mercados em dificuldade, pagam vale-aluguel a famílias sem casa, subsidiam a entrada de um financiamento habitacional real, emprestam a um morador para comprar 5% de uma estatal e compram alimentos para a reserva das refeições públicas. Os serviços reservam dinheiro e aguardam execução física.
- **Gabinete:** nomeie e exonere os titulares das dez secretarias cujo sistema de escolha é a nomeação do prefeito. Prefeito, vice e vereadores não acumulam pasta. Cada secretário continua sendo um cidadão com trabalho, e a secretaria responsável pode vetar medidas pendentes da própria área. Se a pasta for eleita pela Câmara ou pelo povo, é preciso propor a mudança do sistema antes de nomear. A administração revisa vagas diariamente, então nomeie um substituto para escolher agora.
- **Políticas:** reúne tributos, preços, proteção social, ordem, transportes, economia, eleições, justiça e identidade municipal. Escolha o instrumento **Projeto na Câmara** ou **Decreto do prefeito**. Projetos dependem de um vereador apresentar a medida e da votação; o prefeito tem canal direto apenas para a verba de obras. Decretos não passam por votação inicial, mas a secretaria responsável pode vetar e a Câmara pode derrubar o veto por dois terços. Um decreto por intervalo, com o prazo exibido no painel; gastar orçamento, mudar propriedade, identidade, remuneração ou regras eleitorais exige projeto de lei. Em eleições, o prefeito pode convocar um bandeiraço por hora entre 7h e 20h para a candidatura do próprio partido, usando militantes, bandeiras e ponto de rua já disponíveis.
- **Câmara:** peça dotação reforçada ou transferência para a verba de obras, acompanhe a tramitação recente e decida a sanção ou o veto dos projetos aprovados. A sessão, a apresentação e a votação continuam acontecendo de forma autônoma; projetos podem aguardar quórum, parecer de secretaria ou condições de execução.
- **Ordens:** consulte as últimas 80 decisões e abra os contratos de obra correspondentes. A fila de obras, os serviços e a Câmara mostram a execução real.

## Regras que continuam valendo

- O município procura o terreno e negocia o preço. Contratar uma instalação não garante insumos, caixa ou trabalhadores.
- Estatização e privatização pagam ou recebem conforme o valor das participações; a transferência depende de compradores e do caixa disponível.
- A pavimentação consome uma pedra e duas unidades de trabalho por tile, preserva a altura original e exige rota real. A ampliação da prefeitura e das moradias populares respeita a construtora, a titularidade e o limite de doze pavimentos.
- A reserva social do município é preservada nos gastos do tesouro.
- Impostos, benefícios, salário mínimo, efetivo policial, regulação de substâncias, discriminação, código penal, tarifas de comércio e política econômica continuam sujeitos aos limites legais e à tramitação.
- A agenda automática do mandato, as novas obras do planejador público, o socorro público para abrir cadeias produtivas e a revisão fiscal automática deixam as decisões ao jogador. Obras herdadas e projetos aprovados pela Câmara continuam sendo executados.
- Funcionamento dos serviços, folha, abastecimento, iniciativas privadas, instituições, eleições e campanhas partidárias continuam autônomos.
- Editor de mapa, intervenções do observador e patrocínio externo ficam indisponíveis durante a campanha.

O estado da campanha e as ordens seguem o mesmo fluxo de sincronização do worker e de exportação da cidade. **Encerrar campanha e voltar à simulação** devolve a gestão automática e encerra o controle dessa campanha.

## Escopo desta versão

O modo usa governo indireto e as filas existentes. A localização de novas obras é automática. Atividades de andar empresarial exigem um empresarial municipal com andar vago; o prefeito instala a atividade, mas não escolhe o layout do andar. Não há ferramenta para pintar áreas ou designar escavações manualmente. Prioridades não substituem necessidades urgentes, disponibilidade e regras das cadeias produtivas. Não há objetivo final de vitória: a campanha continua enquanto o partido permanecer na prefeitura.

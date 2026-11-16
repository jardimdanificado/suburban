# Modo prefeito: governo indireto

Abra **Jogar como prefeito** no menu principal ou em **Ferramentas**. Clique em **Assumir a prefeitura** para vincular a campanha ao partido do prefeito atual. A entrada não cria dinheiro, bens ou um novo prefeito. Use uma cidade sem campanha familiar ou personagem sob controle.

O objetivo é manter o partido na prefeitura. Outro integrante do mesmo partido pode assumir sem encerrar a campanha. Se uma pessoa de outro partido assumir, por eleição, sucessão ou afastamento, a campanha termina e a simulação para. A tela de derrota permite encerrar a campanha e continuar observando a cidade. Não é possível reiniciar a campanha nessa mesma cidade.

## Decisões do jogador

A campanha começa com o mapa livre. Os atalhos de **Construir**, **Serviços**, **Gabinete**, **Políticas** e **Decisões** ficam na barra original de ícones. Aprovação, prazo eleitoral e verba de obras aparecem no rodapé. Use o controle de janelas existente para recolher os painéis.

Clique em imóveis, moradores e canteiros para abrir ordens do local. Imóveis municipais permitem custeio, manutenção, limpeza e jardinagem; moradores permitem consultar ajuda habitacional e avaliar uma nomeação; obras permitem acompanhar materiais, trabalho e prioridade. O botão de inspeção abre o cadastro completo.

Em **Construir**, escolha o tipo e clique em **Escolher terreno no mapa**. Os terrenos públicos ou anunciados disponíveis aparecem destacados. Clique em um terreno, revise a ordem e escolha **Contratar aqui**. A validação usa exatamente esse lote: se for incompatível, a contratação falha sem procurar outro local. **Esc** cancela a escolha. Também existe contratação em local automático.

**Decisões** reúne leis aguardando sanção, falta de alimentos, demanda habitacional e obras bloqueadas. As ações usam os sistemas reais da cidade. Obras, serviços e tributos mostram uma tarefa por vez, escolhida no seletor, em vez de empilhar todos os formulários. As áreas completas continuam disponíveis:

- **Situação:** acompanhe avaliação, calendário eleitoral, compromissos do mandato, alimentação, moradia, secretarias com titular e o próximo decreto.
- **Obras:** contrate instalações com a verba municipal de obras, inclusive fazendas verticais de duas a oito andares. Abra empresas municipais de qualquer ramo produtivo ou de serviço e instale atividades de andar empresarial (redação, instituto de pesquisa, editora e banco) em andares públicos vagos. Contrate habitação social conforme a fila real de moradores sem casa, priorize a pavimentação de trechos por circulação, conserve vias danificadas, instale postes de iluminação pública em pontos escuros com rua e faça reparo preventivo em imóveis municipais. O jogador pode escolher um terreno existente ou usar a busca automática; orçamento, acesso, materiais, construtora e trabalhadores continuam necessários. Altere a prioridade de obras públicas entre baixa, normal e urgente. Obras usam a verba aprovada, separada do tesouro.
- **Custeio:** transfira recursos do tesouro para empresas municipais ou contrate reparo, limpeza e jardinagem em imóveis públicos. A seção de participações propõe estatização e privatização de empresas à Câmara, respeitando a cota diária e a disponibilidade de compradores; o prefeito também pode ofertar participações públicas dentro da cota diária e transferir o resultado de uma estatal ao tesouro. Os programas municipais recuperam mercados em dificuldade, pagam vale-aluguel a famílias sem casa, subsidiam a entrada de um financiamento habitacional real, emprestam a um morador para comprar 5% de uma estatal e compram alimentos para a reserva das refeições públicas. Os serviços reservam dinheiro e aguardam execução física.
- **Gabinete:** nomeie e exonere os titulares das dez secretarias cujo sistema de escolha é a nomeação do prefeito. Prefeito, vice e vereadores não acumulam pasta. Cada secretário continua sendo um cidadão com trabalho, e a secretaria responsável pode vetar medidas pendentes da própria área. Se a pasta for eleita pela Câmara ou pelo povo, é preciso propor a mudança do sistema antes de nomear. A administração revisa vagas diariamente, então nomeie um substituto para escolher agora.
- **Políticas:** reúne tributos, preços, proteção social, ordem, transportes, economia, eleições, justiça e identidade municipal. Escolha o instrumento **Projeto na Câmara** ou **Decreto do prefeito**. Projetos dependem de um vereador apresentar a medida e da votação; o prefeito tem canal direto apenas para a verba de obras. Decretos não passam por votação inicial, mas a secretaria responsável pode vetar e a Câmara pode derrubar o veto por dois terços. Um decreto por intervalo, com o prazo exibido no painel; gastar orçamento, mudar propriedade, identidade, remuneração ou regras eleitorais exige projeto de lei. Em eleições, o prefeito pode convocar um bandeiraço por hora entre 7h e 20h para a candidatura do próprio partido, usando militantes, bandeiras e ponto de rua já disponíveis.
- **Câmara:** peça dotação reforçada ou transferência para a verba de obras, acompanhe a tramitação recente e decida a sanção ou o veto dos projetos aprovados. A sessão, a apresentação e a votação continuam acontecendo de forma autônoma; projetos podem aguardar quórum, parecer de secretaria ou condições de execução.
- **Ordens:** consulte as últimas 80 decisões e abra os contratos de obra correspondentes. A fila de obras, os serviços e a Câmara mostram a execução real.

## Regras que continuam valendo

- O município valida o terreno escolhido ou procura um automaticamente e negocia o preço. Contratar uma instalação não garante insumos, caixa ou trabalhadores.
- Estatização e privatização pagam ou recebem conforme o valor das participações; a transferência depende de compradores e do caixa disponível.
- A pavimentação consome uma pedra e duas unidades de trabalho por tile, preserva a altura original e exige rota real. A ampliação da prefeitura e das moradias populares respeita a construtora, a titularidade e o limite de doze pavimentos.
- A reserva social do município é preservada nos gastos do tesouro.
- Impostos, benefícios, salário mínimo, efetivo policial, regulação de substâncias, discriminação, código penal, tarifas de comércio e política econômica continuam sujeitos aos limites legais e à tramitação.
- A agenda automática do mandato, as novas obras do planejador público, o socorro público para abrir cadeias produtivas e a revisão fiscal automática deixam as decisões ao jogador. Obras herdadas e projetos aprovados pela Câmara continuam sendo executados.
- Funcionamento dos serviços, folha, abastecimento, iniciativas privadas, instituições, eleições e campanhas partidárias continuam autônomos.
- Editor de mapa, intervenções do observador e patrocínio externo ficam indisponíveis durante a campanha.

O estado da campanha e as ordens seguem o mesmo fluxo de sincronização do worker e de exportação da cidade. **Encerrar campanha e voltar à simulação** devolve a gestão automática e encerra o controle dessa campanha.

## Escopo desta versão

O modo usa governo indireto e as filas existentes. Novas obras podem usar um lote existente escolhido no mapa ou a localização automática. Atividades de andar empresarial exigem um empresarial municipal com andar vago; o prefeito instala a atividade, mas não escolhe o layout do andar. Não há ferramenta para pintar áreas ou designar escavações manualmente. Prioridades não substituem necessidades urgentes, disponibilidade e regras das cadeias produtivas. Não há objetivo final de vitória: a campanha continua enquanto o partido permanecer na prefeitura.

## Compromissos, avisos e campanha dirigida

Os avisos aparecem em janelas móveis. **Revisar** abre a decisão correspondente; **Dispensar aviso** ou **×** fecha a janela. A central continua mostrando as pendências, mesmo depois de dispensadas. Leis, falta de comida, demanda habitacional, obras bloqueadas, baixa aprovação e eleições abertas usam o estado real da cidade.

Em **Compromissos**, assuma uma meta de três dias: garantir dois dias de alimentos, reduzir em 25% a falta de moradia ou entregar mais uma obra pública. Só pode haver uma meta ativa, e cada tipo pode ser assumido uma vez por mandato. Acompanhe o progresso e abra a gestão responsável pelo botão **Trabalhar nesta meta**. Cumprir cria uma memória eleitoral positiva; deixar o prazo acabar cria uma memória negativa. Não há prêmio em dinheiro nem garantia de reeleição.

Em **Campanha**, escolha organização automática ou controle manual dos atos e materiais do seu partido. O controle manual suspende a contratação automática desses materiais, o recrutamento automático de rua e os bandeiraços automáticos do partido; adversários continuam atuando. Durante a eleição, contrate panfletos, bandeiras, faixas ou pinturas autorizadas, acompanhando a execução e o gasto partidário. Cada material admite um contrato diário por candidatura, entre 7h e 22h. Trabalhador, estoque, caixa partidário, autorização e acesso continuam necessários. Bandeiraços podem usar um ponto escolhido no mapa, próximo de uma rua, respeitando a convocação por hora entre 7h e 20h.

Abra um canteiro no mapa ou na fila para **Pausar obra** ou **Retomar obra**, consultar progresso e mudar prioridade. A pausa impede trabalho e conclusão; não desfaz pagamentos nem remessas contratadas. Os trabalhadores deixam a obra pausada e podem assumir outras tarefas. A escolha manual do terreno continua validando exatamente o lote selecionado.

## Pausas para decisões do prefeito

Ao assumir a prefeitura, a simulação pausa e abre **Assumir a prefeitura**. Escolha de uma a três promessas do catálogo real, revise as secretarias na segunda etapa e clique em **Confirmar governo e continuar**. As nomeações usam os requisitos e o sistema de escolha de cada pasta; cargos eleitos pela Câmara ou pelo povo mantêm suas regras. É possível manter os titulares atuais ao confirmar.

Quando a apuração termina e o partido continua no poder, uma nova janela de formação do governo abre, inclusive em reeleições. O programa escolhido entra na avaliação do mandato. Se outro partido vencer, continua valendo a derrota da campanha. O início da campanha eleitoral também pausa para escolher até três promessas da candidatura própria antes da divulgação automática do programa.

Cada projeto aprovado que aguarda sanção abre uma janela com autor, votação e prazo restante. **Sancionar agora** encaminha a execução imediatamente pelas regras vigentes; **Vetar projeto** registra o veto, sujeito à derrubada pela Câmara. Cada projeto tem sua janela, e a simulação continua durante o prazo de veto. Sem resposta até o prazo, ocorre sanção tácita e a janela fecha automaticamente. Apenas posse, formação do governo e escolha do programa eleitoral pausam a simulação; fechar ou recolher outras janelas não responde por você.

As decisões pendentes e a seleção de promessas são salvas na cidade. A pausa também bloqueia minutos e avanço rápido no worker. Ao terminar a última decisão, o jogo retoma se estava rodando; uma pausa manual anterior é preservada. Avisos informativos usam janelas comuns e podem ser dispensados sem interromper a simulação.

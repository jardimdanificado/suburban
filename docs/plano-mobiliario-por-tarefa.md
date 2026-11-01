# Plano detalhado: móveis, equipamentos e tarefas dos moradores

## Objetivo

Fazer cada tarefa que ocorre em um prédio corresponder a um posto físico coerente. O morador deve caminhar até o móvel ou equipamento, ocupar uma vaga livre, orientar-se para usá-lo, executar a tarefa e liberar o espaço ao terminar. Tarefas de rua, deslocamento e transporte continuam tendo destinos físicos próprios, mas não devem receber móveis internos artificiais.

Este documento especifica o catálogo de interação e sua cobertura por tarefa. Ele complementa [`plano-interiores-vivos.md`](plano-interiores-vivos.md), que define navegação, reservas, worker, câmera e renderização. A implementação atual mantém os perfis em `city_furniture_catalog.js`: cada tarefa tem um destino declarado, uma interação mobiliada ou uma alternativa espacial explícita; cada ramo industrial usa estação nominal; móveis têm footprint e ponto de aproximação; e o grafo refinado de navegação bloqueia footprints e abre somente os vãos declarados de portas.

## Princípio de desenho

Um móvel só é interativo quando descreve uma ação que a simulação já executa ou precisa executar. Cada instância terá:

- ID determinístico por prédio, andar, cômodo, tipo e índice;
- footprint de colisão, área de acesso e uma ou mais vagas de uso;
- posição e orientação do móvel, da vaga e do morador;
- poses/ações visuais disponíveis e duração/capacidade quando aplicável;
- condições de uso (tipo de sala, propriedade, estoque, energia, fila, tarefa);
- alternativas válidas e motivo de indisponibilidade.

O layout lógico é fonte comum para navegação e desenho. Renderização, câmera, seleção, FPS e ordem de criação não escolhem móveis, não reservam vagas e não alteram a simulação. Os objetos decorativos podem ser renderizados sem ação, mas nunca bloqueiam portas ou caminhos se não tiverem footprint declarado.

## Vocabulário de móveis e postos

| Família | Móveis/equipamentos planejados | Vaga/pose de uso | Capacidade inicial |
|---|---|---|---:|
| Dormir | cama individual, cama de casal com lados separados, beliche/catre de cela | ponto ao lado para entrar; pose deitado alinhada ao colchão | 1 por cama/lado |
| Banheiro | vaso, pia, chuveiro/área de banho, armário e cesto | vaga frontal para vaso e pia; área de banho sem sobreposição | 1 por equipamento |
| Alimentação | mesa, cadeiras, balcão, banco de refeitório, geladeira, fogão/forno | cadeira voltada à mesa; balcão para atendimento/preparo | 1 por assento/estação |
| Trabalho | mesa/escrivaninha, cadeira, bancada, torno, prensa, forno, tear, máquina, equipamento de campo | vaga de operador do lado de operação; pose de pé ou sentada | 1 por estação, mais vagas só se o ativo suportar |
| Atendimento | balcão, guichê, mesa de consulta, cadeira de espera, recepção | vaga do atendente e vaga separada do cliente | 1 atendente e 1 cliente por módulo |
| Saúde | maca, cadeira clínica, mesa de exame, armário de remédios | lado de acesso livre para profissional e paciente | 1 paciente por maca |
| Lazer/social | sofá, poltrona, cadeira, mesa baixa, banco, mesa de jogo, brinquedo infantil | assentos distintos, frente para interlocutor/objeto | capacidade definida por assentos |
| Limpeza | carrinho, pia de serviço, armário, vassoura, esfregão, pá | ponto de alcance do objeto/sujeira, sem teleportar o trabalhador | 1 por equipamento carregado |
| Logística | prateleira/estoque, mesa de separação, doca, carrinho, bancada de expedição | posições de coleta e entrega distintas | por doca/posição de carga |
| Justiça e segurança | mesa de ocorrência, quadro de evidências, armário de provas, balcão de registro, grade/cela | posições de registro, análise, atendimento e detenção | conforme salas/equipamento |
| Uso público | cabine eleitoral, bebedouro, banco, balcão de serviço, catraca/guichê | abordagem frontal e fila explícita | 1 por cabine/guichê |
| Externo | banco de praça, mesa de piquenique, varanda/cobertura, canteiro, árvore, rocha, poço | ponto transitável/alcance com elevação física quando necessário | por assento, ponto de coleta ou célula |

Capacidades acima são propostas iniciais; filas que já têm contrato FIFO mantêm a ordem atual. Não criar capacidade econômica por criar uma cadeira. A disponibilidade do posto e a disponibilidade do serviço continuam sendo verificações diferentes.

## Matriz de todas as tarefas observadas

O inventário combina as tarefas literais atribuídas no código com `INDOOR_TASKS` e `OUTDOOR_WORK` em `city_interiors.js`. Nomes dinâmicos ou novos deverão entrar no catálogo central de tarefas, para que o teste de cobertura detecte a ausência de destino ou fallback.

| Tarefa | Posto/móvel de destino | Ação física e término | Fallback / regra |
|---|---|---|---|
| `energy` | cama no quarto; leito/catre na cela; sofá/catre de abrigo quando houver descanso autorizado | caminhar ao lado, deitar, repousar pelo intervalo atual, levantar e liberar | manter dormir ao relento apenas pela regra existente; sem cama inventada |
| `toilet` | vaso sanitário da instalação/unidade reservada | fila FIFO; entrar na vaga frontal, usar, concluir cobrança/efeito uma vez, sair | banheiro inacessível ou removido libera reserva e replaneja; capacidade de saneamento não muda |
| `hygiene` | chuveiro/área de banho; pia apenas se a ação existente for lavar mãos/rosto | aproximar, executar higiene, encerrar e liberar | quando não houver chuveiro, usar o fallback sanitário existente sem alegar banho visual |
| `water` | bebedouro, torneira/bomba de serviço ou balcão de água da utility | alcançar o ponto, encher/consumir conforme o fluxo vigente | ponto de água apenas se a instalação oferece água; lago é último recurso externo |
| `food` | loja: balcão/caixa; refeitório: mesa e cadeira; cozinha: fogão/balcão conforme o fluxo | cliente vai ao balcão para compra; comer exige mesa/assento só onde o sistema realmente representa refeição | lojas sem sala de jantar atendem no balcão; pagamento/consumo não duplica |
| `workmeal` | mesa de refeitório com cadeira vaga e geladeira/cozinha como infraestrutura | interromper trabalho, sentar, consumir porção, restaurar tarefa anterior e liberar assento | não iniciar se faltar a oferta/estoque ou o piso de refeição exigido |
| `provisions` | prateleira de despensa, armário doméstico ou balcão de retirada | alcançar estoque, retirar provisões e voltar à rotina | hoje pode ser resolução lógica sem entrar; só tornar presença requisito se fluxo atual exigir |
| `care` | berço, cama infantil, trocador/mesa de cuidado e cadeira do responsável | criança ocupa berço/trocador; cuidador ocupa posição lateral acessível, sem compartilhar vaga | respeitar faixa etária e relação familiar; se falta equipamento, manter cuidado abstrato existente |
| `caregiving` | tapete/mesa de atividade infantil, cadeira ou banco próximo | adulto vai à posição de acompanhamento e criança à própria vaga/atividade | nenhum efeito se a criança/responsável não estiver disponível |
| `health` | maca ou cadeira de consulta; mesa clínica para profissional | paciente entra na vaga, profissional alcança posição de atendimento, tratamento conclui uma vez | usar clínica/hospital conforme regras atuais; sem maca/rota, aguardar ou redirecionar |
| `shopping` | lavanderia: máquina livre; comércio: prateleira e balcão/caixa | cliente acessa o objeto comprado ou máquina conforme tarefa concreta | não mandar toda compra a uma máquina; lavanderia e varejo têm perfis distintos |
| `supplies` | estoque de mercado/depósito, prateleira e balcão de retirada | buscar item e deixar o prédio com inventário atualizado uma vez | água de lago é outra tarefa (`lake-water`), não um móvel de loja |
| `work` | estação da profissão, equipamento da indústria, mesa de escritório ou célula de campo | caminhar à posição do operador; executar ciclo de produção somente após chegada; rodar tarefa como hoje | sem equipamento especializado, usar bancada genérica documentada; campo usa célula real, não móvel interior |
| `manage` | mesa gerencial/escrivaninha, cadeira e arquivo | sentar/operar no posto da própria empresa; cumprir período de gestão | posto locado usa andar/cômodo arrendado; sem sala, fallback administrativo atual |
| `work-wait` | assento de espera na recepção/vestiário da empresa | sentar enquanto aguarda reabertura/condição de trabalho; revalidar ao acordar | fora do prédio pode usar banco existente; não reservar posto produtivo enquanto espera |
| `construction` | prancheta/mesa de projeto para administração e posto operacional no canteiro | planejar na mesa quando fluxo administrativo; construtor trabalha no local de obra/depósito | não colocar equipe dentro do prédio ainda em construção; ferramenta carregada pode ser visual, sem inventário novo |
| `job-interview` | mesa de entrevista e duas cadeiras, ou guichê de emprego | candidato senta frente ao entrevistador; registrar resultado após chegada | manter hora/local agendados e cancelar reserva se entrevista mudar |
| `research` | mesa de pesquisa, quadro/lab e assentos de entrevista | pesquisador trabalha no laboratório/mesa; entrevistas usam duas vagas frente a frente | pesquisa de campo segue destino externo; progresso de estudo não duplica durante entrevista |
| `interview` | duas cadeiras em mesa de entrevista (pesquisa, justiça ou trabalho, com perfil contextual) | entrevistador e pessoa entrevistada ocupam vagas diferentes e orientam-se entre si | se cidadão sair/recusar, encerrar encontro e liberar as duas vagas |
| `council-session` | plenário com assento por membro, mesa da presidência e posição de fala | membro ocupa assento designado; fala usa posição de plenário; encerra pela sessão vigente | manter regra de presença/voto; câmara pequena não inventa assentos |
| `vote` | cabine/urna e fila de votação | cidadão entra na cabine reservada, vota e sai; voto só após chegada | seção sem cabine acessível aguarda/replaneja sem registrar voto |
| `clean` | carrinho/armário de limpeza; para fezes, ferramenta e ponto acessível da ocorrência; banheiro com posto sanitário | recolher no ponto real, registrar limpeza após contato, retornar equipamento | não pagar conclusão sem chegar; escopo interno/frente continua distinto |
| `informal-service` | posto relacionado ao pedido de faxina, jardinagem ou reparo; ferramenta correspondente | prestador alcança área de serviço, executa e conclui; contrato paga uma vez | jardinagem pode ser externa; falta de ferramenta acessível adia/cancela conforme gig |
| `leisure` | sofá, poltrona, mesa de jogo, equipamento de lazer ou banco público conforme destino | ocupar uma vaga e permanecer pelo período de lazer; liberar ao terminar | lazer ao ar livre usa banco/quadra; não criar interiores para prédio sem atividade de lazer |
| `social` | sala de estar: sofá/poltronas em pares; praça: banco/mesa; visita: assentos disponíveis | participantes ocupam vagas distintas frente a frente e conversam | consentimento/alcance social continuam vindo da simulação; lotação causa espera ou outro destino |
| `visit` | sala de estar da casa visitada, assentos frente a frente | visitante entra pela porta, segue a sala e ocupa assento; anfitrião pode usar outro | respeitar acesso e residência; sem rota ou cadeira, cancelar/aguardar, nunca teleportar |
| `outdoor_leisure` | cadeira de varanda, banco de cobertura, mesa externa ou espreguiçadeira | ocupar ponto da unidade/andar correto; usar altura e orientação reais | só varanda/cobertura existentes; respeitar acesso ao imóvel e vaga |
| `sit` | banco público ou assento livre | aproximar, virar, sentar até `sitUntil` e levantar | reserva do banco expira/libera em cancelamento; cidadão não aparece sentado em móvel ocupado |
| `walk` | nenhum móvel; caminho externo/circulação | usar navegação do mundo, passarelas e saídas | pedestres continuam caminhando mesmo sem destino interno |
| `lake-water` | margem/poço/ponto de coleta, balde ou bomba portátil representativa | alcançar a margem, coletar quantidade permitida e voltar; sem vaga interior | respeitar água disponível, qualidade e rota; não usar água de lago como bebedouro interno |
| `transport` | doca/área de carga, mesa de expedição, veículo e ponto de coleta/entrega | acessar carga, transportar e descarregar nos endpoints físicos | rota e veículo determinam presença; não exigir cadeira de escritório para entrega |
| `paint-purchase` | balcão/estoque de tintas, amostras e caixa | cliente chega, seleciona/retira, paga conforme evento atual | sem estoque, informar indisponibilidade; nenhuma compra fora do balcão se presença for exigida |
| `paint-delivery` | garagem/estoque de material e zona de descarga no destino | retirar tinta/ferramenta, carregar e entregar fisicamente | veículo/carga continuam sendo fontes de verdade; sem duplicar itens |
| `campaign` | rua: púlpito/placa de campanha ou ponto de abordagem; loja: balcão de material quando missão é retirada | fala/abordagem no espaço público ou retirada no balcão pela missão | separar campanha de rua, comício e retirada de material; não obrigar campanha a entrar em prédio |
| `urban-graffiti` | parede legal/designada, escada/plataforma e caixa de tinta | chegar ao trecho de parede e desenhar no lado alcançável | ferramenta e autorização controlam execução; nada de sentar em bancada genérica |
| `police-patrol` | viatura/armário de equipamento e área de despacho da delegacia; rua durante patrulha | equipar-se na delegacia e patrulhar pontos externos | o deslocamento de patrulha não fica parado num móvel; usar equipamento só na preparação |
| `police-response` | armário/estação de despacho apenas antes da saída; local do incidente depois | receber chamado, deslocar-se e agir no ponto externo | resposta não é sessão de cadeira; prioridade e tempo atuais prevalecem |
| `police-investigation` | mesa de evidências, quadro de caso, armário de provas e posições de entrevista | inspecionar cena no lugar real; entrevistas frente a frente; análise em mesa; fases explícitas | cada fase usa ponto correspondente; testemunho não é registrado antes da entrevista presencial |
| `police-oversight` | escrivaninha/mesa de revisão, arquivos e quadro de evidências em sala independente | revisor chega ao posto, consulta provas e conclui revisão | separar da mesa do investigador original; liberar em interrupção |
| `police-arrest-escort` | nenhum móvel durante escolta; cela reservada ao chegar | policial acompanha pessoa até entrada/cela; pessoa só ocupa cela ao chegar | manter vínculo, rota conjunta e reserva de cela; sem cama/assento de escolta |
| `police-restitution` | balcão seguro de restituição, mesa de conferência e armário de bens; saída para recuperar/entregar | conferir item no balcão e transferir propriedade apenas após entrega | recuperação externa é viagem; conferência não substitui localização real do bem |
| `justice-report` | balcão de registro, cadeira do cidadão e mesa do atendente | registrar BO após cidadão alcançar a delegacia e interagir com atendente | sem guichê/agente/rota, aguardar; nunca registrar ao iniciar deslocamento |
| `custody` | cela com cama/catre, sanitário e ponto de refeição/água | pessoa detida ocupa a cela; necessidades usam instalações reservadas; refeição usa bandeja/mesa conforme cadeia | manter capacidade física e escolta; não sobrepor leito, vaso e vaga da cela |
| `custody-escort` | nenhum móvel durante transporte; sala de espera/retorno somente nos estados existentes | acompanhar pessoa entre prisão e hospital; sair/entrar pelas portas | cidadão não fica sentado enquanto está sendo escoltado |
| `custody-water` | ponto de captação externo, recipiente/bomba e reservatório da prisão | funcionário coleta, carrega, entra e entrega no reservatório | entrega só ao chegar; preservar qualidade, quantidade e fase de ida/retorno |
| `funeral` | maca/carrinho funerário, área de preparo e bancos/altar da cerimônia quando aplicável | carregar corpo e sair fisicamente; preparar/realizar cerimônia nos locais existentes | não inventar velório se fluxo só coleta/transporta; distinguir corpo de cidadão ativo |
| `combat-flee` | nenhum móvel; abrigo/caminho para local seguro | fugir pelo caminho externo até segurança | portas/saídas podem bloquear rota, mas móveis não são destino da fuga |

### Observações de cobertura

- `toilet`, `hygiene`, `food` e `workmeal` usam regras de saneamento, fila e pagamento existentes. Reservar assentos/equipamentos sem substituir essas regras.
- `work`, `manage`, `construction` e tarefas profissionais são grupos, não um único móvel: o tipo do prédio, a função do morador, o ramo da missão e o tipo de cômodo escolhem o posto específico.
- `care`, `caregiving`, `social` e `interview` podem envolver duas pessoas. A reserva deve ser atômica para o conjunto de vagas; cancelar um participante libera ambas.
- `police-investigation`, `transport`, `funeral`, `paint-delivery` e `campaign` são máquinas de estados com fases em locais diferentes; um único móvel no prédio não descreve a tarefa inteira.
- `work-wait` pode ocorrer na recepção, na rua ou em casa; usar assento apenas quando a pessoa realmente está dentro de espaço com assento acessível.
- Tarefas como `walk`, `combat-flee`, `police-response`, `police-arrest-escort` e `custody-escort` não têm destino de móvel. Sua cobertura correta é declarar `destinationKind: path/vehicle/person/site`, para não confundir “sem móvel” com tarefa esquecida.

## Catálogo profissional: móvel exato por tipo de prédio

O catálogo atual já fornece muitas famílias de equipamento em `WORKSTATIONS`; o plano é tornar os usos abaixo explícitos, com footprint, lado de operação e animação compatível. A lista é determinística e deverá ser cruzada com todas as chaves registradas de `BUILDING_TYPES` em teste de cobertura.

| Tipo(s) / ramo | Posto principal planejado | Auxiliares e vagas |
|---|---|---|
| `townhall`, `council_chamber` | mesa administrativa; mesa parlamentar e assentos do plenário | balcão de atendimento, espera, posição da presidência |
| `builder` | prancheta de obras no escritório; ferramentas no canteiro | mesa de plantas, cavalete, depósito e doca |
| `carrier`, `bike_rack` | mesa de despacho; rack/baia de bicicleta | área de retirada e devolução, área de carga |
| `lamp_service` | bancada de lamparinas | armário de óleo, prateleira e bancada de reparo |
| `cleaner`, `waste_collector`, `recycler` | lavadora/triagem/prensa conforme função | carrinho, pia, depósito e doca |
| `mint`, `publisher`, `paper_mill` | prensa de moedas/encadernação/papel | mesa de inspeção e caixas de produto |
| `bakery`, `kitchen`, `popular_refectory` | forno/fogão e bancada de preparo | balcão de retirada, geladeira, mesa e cadeiras se houver refeição |
| `market`, `greengrocer`, lojas de roupa/esporte/bicicleta e `thrift_store` | balcão ou banca e prateleiras/racks | caixa, estoque e pontos de atendimento separados |
| `cycle_workshop`, `tailor`, `furniture`, `artisan`, `pottery` | cavalete de solda, máquina de costura, bancada de marcenaria/cestaria, roda de oleiro | ferramenta, material de entrada, bancada de inspeção e prateleira de saída |
| `laundromat` | máquina de lavar por vaga | cesto, mesa de dobra, balcão; cliente usa máquina, funcionário usa estação separada |
| `clinic`, `hospital` | maca, mesa clínica e posto de enfermagem | cadeira do paciente, assento de espera, armário e pia |
| `bank` | guichê/mesa de atendimento e escrivaninha de gestão | duas posições por atendimento, arquivo e fila |
| `research_institute`, `newsroom` | mesa de pesquisa/redação | assentos para entrevista, quadro/arquivo e posto de laboratório quando a pesquisa exigir |
| fábricas de metal/mineração (`steel_mill`, `aluminum_smelter`, `iron_mine`, `bauxite_mine`, `foundry`, `toolmaker`, `bearing_factory`, `cycle_parts`) | forno, perfuratriz, torno ou prensa conforme cadeia | lado de operador, área de material, proteção e ponto de manutenção |
| fábricas de borracha, pneus, quadros, correntes e skates | extrator, misturador, prensa, solda, torno ou linha de montagem conforme produto | posições sequenciais sem bloqueio entre estações; caixas de entrada/saída |
| fábricas têxteis, de calçados e bandeiras (`weaving`, `sports_shoes`, `flagmaker`, `saddle_factory`) | tear, máquina de costura ou bancada de selim | operador sentado quando a estação comportar, rolo/tecido e prateleira |
| alimentos e agricultura (`dairy_farm`, `cheesemaker`, `poultry`, `flour_mill`, `pasta_factory`, `cannery`, `herb_farm`, `fiber_farm`) | tanque, ninho/comedouro, moenda, laminador, conservas ou secador | postos repetidos, armazenamento local e área de coleta; campo continua no terreno |
| madeira, cerâmica e materiais (`forestry`, `sawmill`, `charcoal`, `clay_pit`, `brickworks`, `sand_pit`, `glassworks`, `paintworks`, `composting`) | serra, forno, extrator, peneira, tanque ou leira conforme ramo | acesso seguro e área de carga/descarga; extração é externa quando o perfil indicar |
| `utility`, `public_toilet`, `paid_toilet`, `park`, `sports_center`, `library`, `theater`, `leisure` | bomba/guichê, vaso e pia, bancos, aparelhos, estantes, poltronas/assentos e equipamentos de lazer | público e trabalhador têm vagas distintas; biblioteca inclui mesa de leitura; teatro coloca público frente ao palco |
| `office_tower` e locatários | mobiliário do prédio arrendatário dentro da unidade física alugada | preservar identidade do locatário, andar e revisão de layout; nunca desenhar equipamento no andar errado |
| habitação e `jail` | cama, banheiro, mesa/refeição, assentos sociais; cama e sanitário de cela | respeitar quantidade real de unidades, instalações e vagas por moradia |

Para os tipos de indústria, o catálogo de referência atual em `city_furniture_catalog.js` mapeia explicitamente: `steel_mill` forno siderúrgico; `bauxite_mine` perfuratriz; `aluminum_smelter` forno de alumínio; `rubber_grove` bancada de extração; `rubberworks` misturador; `bearing_factory` torno; `frame_factory` gabarito de solda; `deck_factory` serra; `tire_factory` prensa; `chain_factory` torno; `safety_equipment` prensa; `saddle_factory` costura; `cycle_parts` torno; `sports_shoes` costura; `skate_workshop` montagem; `cycle_assembler` linha; `cycle_shop` balcão; `sports_shop` balcão esportivo; `cycle_workshop` cavalete; `bicycle_rental` rack; `kitchen` fogão; `artisan` bancada; `forestry` serra; `sawmill` serra de tábuas; `charcoal` forno de carvão; `iron_mine` perfuratriz; `foundry` forno de fundição; `toolmaker` torno; `clay_pit` extrator; `brickworks` forno de tijolos; `sand_pit` peneira; `glassworks` forno de vidro; `furniture` bancada de marcenaria; `fiber_farm` secador; `flagmaker` máquina de costura; `paintworks` misturador; `weaving` tear; `newsroom` mesa; `clothing_store` arara; `laundromat` lavadora; `thrift_store` arara; `tailor` máquina de costura; `dairy_farm` tanque de leite; `cheesemaker` cuba; `poultry` ninhos/comedouros; `flour_mill` moenda; `pasta_factory` laminador; `cannery` tanque de conservas; `soapworks` tanque de sabão; `herb_farm` secador; `pharmacy` laboratório; `paper_mill` prensa; `publisher` encadernação; `pottery` roda; `composting` leira; `research_institute` mesa; `bank` mesa de atendimento. Tipos sem entrada específica recebem bancada genérica somente enquanto perfil justificar o fallback.

## Catálogo por cômodo residencial e público

| Cômodo | Móveis | Tarefas atendidas | Regras de montagem |
|---|---|---|---|
| `bedroom` | cama(s), mesa de cabeceira, armário, baú; geladeira só onde a planta/segmento permitir | `energy`, alguns `care`, `provisions` quando estoque doméstico é real | primeiro garantir passagem até porta; cama com acesso lateral e slot de deitar; geladeira não substitui mesa de refeição |
| `bathroom` | vaso, pia, chuveiro, armário/cesto opcional | `toilet`, `hygiene`, `clean`, `water` se houver torneira | vaso e pia têm acessos separados; não remover vaga/quantidade de instalações sanitárias existentes |
| `dining` | mesa, 1–4 cadeiras, geladeira/estação de servir | `food`, `workmeal`, `social`, `caregiving` | assento indica orientação para a mesa; geladeira não bloqueia porta; fila de refeição usa regra atual |
| `workspace` | posto específico da profissão, cadeira quando estação sentada, armário de ferramenta | `work`, `manage`, `construction`, `research`, `clean`, serviços | posto específico tem precedência sobre bancada genérica; ferramenta decorativa não gera insumo/produção |
| `office` | escrivaninha, cadeira, arquivo, cadeira de visitante | `manage`, `work`, `job-interview`, `interview`, `police-oversight`, `justice-report` quando for gabinete | duas vagas de reunião precisam estar desimpedidas; função e locação escolhem o interior físico correto |
| `plenary` | mesa de plenário, cadeira por membro, púlpito | `council-session` | assentos atribuídos estáveis por pessoa/sessão; não usar uma única cadeira de escritório para todos |
| `service` | balcão, guichê, caixa, display/estoque adequado ao prédio | `food`, `shopping`, `supplies`, `water`, `paint-purchase`, `justice-report` | atendente e cliente não compartilham slot; estoque visual não altera inventário sozinho |
| `treatment` | maca, mesa clínica, cadeira e bancada/lab | `health`, atendimento médico de custódia | vaga de paciente e profissional distinta, sem maca atravessando porta |
| `laundry` | lavadora, cesto, mesa de dobra, assento de espera | `shopping` em lavanderia, trabalho do funcionário | máquina tem reserva própria e estado ocupado; não confundir tarefa do cliente com tarefa produtiva |
| `cell` | cama/catre, sanitário, prateleira, bandeja/mesa rebatível | `custody`, `energy`, `toilet`, `food` | cama e sanitário coexistem sem sobreposição; pessoa tem cela reservada; acesso de escolta continua possível |
| `balcony` / `roof_terrace` | cadeira/banco, vaso de planta e mesa pequena | `outdoor_leisure`, `leisure`, alguns encontros sociais | geometria respeita beiral/guarda-corpo e altura real; capacidade não excede área transitável |
| `waiting` / circulação | banco de espera somente em bolsões largos; sinalização, sem obstáculo em corredor | `work-wait`, filas de atendimento, espera por vaga | manter largura de rota; área de fila é grafo separado da vaga de uso |

## Poses e animação

Ativos atuais expõem `idle`, `run` e `use`; confirmar conteúdo real de `data/model` antes de associar pose. O contrato do catálogo deve selecionar pose pelo equipamento, não pelo rótulo genérico da tarefa:

1. Em pé e alcançando: balcão, máquina, bancada, limpeza e atendimento.
2. Sentado: cadeira de trabalho, assento de refeição, espera, entrevista, plenário e visita.
3. Deitado: cama e maca com orientação no eixo comprido; cama exige pose de sono, maca usa pose clínica se houver.
4. Agachado/ajoelhado: vaso, limpeza de chão e coleta baixa, somente se houver pose aceitável.
5. Operação específica: torno, tear, prensa, volante, forno, bomba, caixa e instrumentos; se não houver animação, usar `use` com ponto/facing coerentes e registrar o limite visual. Não rotular como sentado/deitado sem pose.

Antes de criar novos quadros, listar para cada tipo de equipamento: pose existente reutilizável, pose aceitável com orientação, lacuna visual e alternativa provisória. Roupa, chapéu, bicicleta, tonalidade de pele e sombras permanecem montados como hoje.

## Reserva, chegada e validação

Fluxo único proposto: `seeking → queued → reserved → entering → walking → using → leaving → completed/cancelled`.

- A escolha da vaga deve ocorrer antes de iniciar a rota. O estado autoritativo guarda IDs, não referências a objetos renderizados.
- A tarefa só recebe `arrived=true` quando o cidadão termina a rota pelo grafo e está dentro da tolerância do ponto de uso. Efeito econômico, voto, tratamento, refeição ou produção exigidos pelo fluxo só acontecem depois disso.
- Duas pessoas podem cruzar na circulação, mas nunca ocupar a mesma vaga de equipamento. Móveis com lados distintos podem ter vagas separadas; o footprint do móvel permanece bloqueado.
- Para interação em dupla, reservar as vagas do par como operação atômica. Para fila FIFO, a fila reserva a próxima vaga sem permitir corte de fila por replanejamento.
- Mudança de tarefa, urgência, morte, demolição, reforma, troca de emprego/casa, equipamento sem energia/estoque e rota inválida liberam toda reserva relacionada.
- Se a rota falhar, tentar outra vaga/equipamento compatível; depois esperar em fila limitada; por fim aplicar o fallback funcional existente. Nunca manter cidadão preso indefinidamente.
- Durante migração de snapshots antigos, reconstruir um destino válido ou sair/replanejar. Nunca duplicar reserva de cômodo e reserva de móvel como autoridades concorrentes.

## Sequência de implementação

### Fase A — Inventário e contratos

1. Criar catálogo único de tarefa: identificador, contexto, destino, perfil de posto, mobiliário obrigatório, condição de chegada, capacidade, fallback e possibilidade de interação em dupla.
2. Importar/gerar a lista de tarefas e prédios registrados e falhar se houver tarefa ou tipo sem perfil explícito. `no-furniture` é um perfil válido apenas para deslocamento/missão externa com destino declarado.
3. Relacionar cada consumidor de efeito a `arrived`, preservando cobranças, consumo, votos, produtividade e periodicidade atuais.

### Fase B — Geometria navegável

1. Evoluir layout determinístico para representar paredes e vãos de porta; quartos acessíveis por porta real e escadas ligando andares com abertura visual correspondente.
2. Gerar móveis a partir do perfil do cômodo e do prédio; cada móvel declara footprint, aproximação, slots e facing.
3. Planejar primeiro cômodos estreitos e rota porta→banheiro/quarto. Se não couber, gerar variante menor ou fallback, sem expandir a planta de forma fictícia.
4. Bloquear células/volumes ocupados no pathfinding, validar giro/rotação e garantir vaga sem interseção com parede, equipamento ou cidadão já usando.

### Fase C — Interações-base

Implementar nesta ordem, com progressão visível: cama e sono; vaso/pia/chuveiro; balcão e assento de refeição; mesa de trabalho; atendimento clínico; espera e conversa; lavanderia e varejo; plenário/urna; manutenção/limpeza/logística; justiça, policiamento e tarefas especiais; perfis de todos os ramos industriais e instalações abertas.

Para cada integração: rota → chegada → pose/uso → efeito existente uma vez → saída → liberação. Trabalhar por grupo vertical e manter produção/alimentação/saneamento intactos ao integrar.

### Fase D — Visualização e desempenho

1. Inspetor tem controle Interior/Fachada, andar e seleção de pessoa; o recorte mostra apenas pavimento escolhido, com parede baixa opcional.
2. Mostrar tarefa em curso no próprio posto por pose, facing, ocupação e pequeno indicador de estado; evitar texto repetido sobre todos os moradores.
3. Agrupar/instanciar móveis e interpolar posições internas no worker como já ocorre para movimento; não sincronizar meshes ou caminhos gráficos no estado autoritativo.
4. Manter simulação de todos os edifícios; detalhe gráfico é sob demanda. Abrir interior não altera clocks, rotas, RNG econômico ou resultado de tarefa.

## Cobertura mínima por tarefa e validação

Cada perfil deve ter cenário com caminho acessível e cenário sem caminho. Critérios gerais:

- reproduzível sob mesma seed e não consome RNG global para decoração;
- todos os prédios registrados mapeiam para posto ou fallback intencional;
- todos os valores de tarefa encontrados/novos mapeiam para móvel ou `no-furniture` com destino físico;
- rota atravessa porta/escada corretamente, contorna footprint e não cruza parede fechada;
- disputa por cadeira, vaso, máquina, guichê e cela reserva vagas separadas e libera na saída;
- caminho inválido, móvel removido, mudança de tarefa, emergência e morte não deixam reservas ou loops;
- efeito não ocorre antes da chegada e ocorre uma única vez; FIFO permanece FIFO;
- abertura/fechamento do inspetor e troca de andar não mudam posição, tempo ou efeito;
- no visual, pessoa fica alinhada ao lado certo, pose corresponde ao móvel, animações de caminhada/uso são legíveis e roupas/sombras permanecem corretas;
- medir simulação, worker/bridge e renderização em separado nos cenários do plano geral; comparar a mesma seed e configuração e não tratar benchmark Node como FPS.

## Implementação e critérios fechados

- `TASK_FURNITURE_PROFILES` e `TASK_DESTINATION_KINDS` cobrem cada tarefa encontrada no jogo; tarefas de rota/ambiente estão explicitamente marcadas como espaciais, e todas as demais resolvem para móveis realmente registrados em algum cômodo compatível.
- As plantas de todos os tipos registrados em `BUILDING_TYPES` passam por validação de limites e não sobreposição de footprints. As cinco tipologias residenciais têm cama/berço/assento; o beliche duplo é um móvel com duas posições verticais e mantém a circulação do cômodo.
- `interiorRoute` usa uma malha de quartos de 0,25 m, passa pelos vãos internos, mantém a entrada externa no térreo e evita os volumes declarados de mobiliário. Os caminhos de aproximação por família de tarefa e as plantas estreitas/rotacionadas têm testes dedicados.
- A vaga só entra em uso quando o cidadão chega; o worker recebe a posição compacta; o inspetor permite alternar fachada, andar e corte de paredes. Filas, cobrança, produção, saneamento e efeitos existentes permanecem nas rotinas autoritativas.
- As animações usam `idle`, `run` e `use` disponíveis; sono e exame usam pose deitada alinhada ao móvel, e assentos usam a pose sentada. Equipamentos sem animação exclusiva continuam usando a pose de operação existente, com orientação e posição física corretas.

Cobertura automatizada focada: 64 testes passaram em uma rodada, incluindo tarefas, footprints, quartos, reservas, uso de balcões, varandas/coberturas, justiça, torres, worker e modelos. A rodada de 20 dias e a inspeção visual com casa ocupada, banheiro público, prédio locado e sombras são registradas no plano geral conforme forem concluídas.

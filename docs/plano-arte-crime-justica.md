# Plano de arte urbana, crime, perícia e justiça

Status: implementação em andamento. A fundação registra corpos persistentes, IML/crematório, obras em camadas, ocorrências com testemunhas, BO presencial, investigação e autorizações legislativas. O fluxo judicial inclui acusação separada da prisão, audiência com juiz e defesa pública, contratação de defesa privada, sentença, multa, pena finita e recurso. Já existem furto de dinheiro, objetos, refeições e bicicletas, invasão para usar banheiro, depredação com limpeza contratada, ferimentos regionais e porrete fabricado, comprado, usado e desgastado. Roubo violento agora combina agressão física, transferência de dinheiro existente e dois registros criminais ligados; a ação autônoma é noturna, rara e depende de temperamento, risco, ressentimento e saldo da vítima. Um golpe grave na cabeça pode interromper temporariamente tarefas, conversa e deslocamento. Delegacias com equipe podem designar oficial para patrulha diurna física e diligência presencial: o investigador visita cenas externas, tenta ouvir testemunhas acessíveis e retorna à unidade antes de concluir. Ainda faltam turnos noturnos, resposta física a chamados, abuso policial e integração política das ordens.

Auditoria de sobrevivência: reinício determinístico na seed `2120920325`, Terras Altas, 256×256, 512 habitantes e atualização de simulação equivalente a 32×. Ao fim de 15 dias, havia 512 vivos, zero mortes e zero corpos. A primeira chamada direta de `stepMinute()` foi descartada porque não executa o deslocamento normal; a medição válida usou `update()` para avançar tempo e movimento juntos. Esse cenário limpo não reproduziu a queda de população relatada no save recarregado, então comparar com o estado salvo e inspecionar diferenças de inicialização ainda está pendente.

Verificação parcial de custódia: `tests/justice_custody.test.mjs` cobre alimentação após sentença, soltura no prazo, detração do tempo cautelar, condenação durante deslocamento, replanejamento de rota sem teletransporte, soltura legislativa sem apagar condenação, escala das habilidades jurídicas, recurso mantido, antecedentes após morte sob custódia e autorização parlamentar para executar prisão após condenação. Esses testes não comprovam o conjunto do plano nem substituem a auditoria física e econômica da simulação.

Verificação de regressão parcial: os oito testes novos de custódia passam. A execução de `political_production_reform`, `global_search` e `ui` encontrou 22 falhas; a comparação com uma cópia de `HEAD` confirmou as mesmas 22 falhas anteriores (incluindo `Fixture starter purchase`). A validação completa de UI e política continua pendente. Novas habilidades usam inicialização determinística própria para preservar o consumo da sequência aleatória das habilidades existentes.

Perícia parcial: morte registra circunstâncias e vestígios físicos sem copiar a autoria para o laudo. A autópsia aguarda perito disponível, estima uma janela de horário conforme habilidade e atraso, encaminha indícios de violência à polícia e anexa prova ao homicídio existente sem duplicá-lo. A polícia pode concluir sem suspeito. `tests/justice_autopsy.test.mjs` cobre esses caminhos; os quatro testes de autópsia e os oito de custódia passam. Transporte funerário físico, deterioração com efeitos sanitários e adulteração de laudos ainda exigem implementação e validação.

Limpeza de arte parcial: obras pichadas podem gerar bicos financiados pelo proprietário. O trabalhador se desloca ao ponto acessível, recebe da reserva e remove a camada contratada, preservando a anterior e o histórico. Mudança da camada cancela e estorna a reserva. Após condenação, o gasto efetivo pode ser ressarcido em parcelas conforme saldo, sem cobrança duplicada. Os seis testes de `justice_art_cleaning.test.mjs` passam junto dos 12 testes de perícia e custódia. A produção artística espontânea, materiais, suportes em interiores e acesso a andares continuam pendentes.

Furtos e roubo, etapa parcial: encontros próximos podem gerar furtos raros conforme honestidade, risco, motivação, oportunidade e horário, com intervalo individual de um dia. Dinheiro é transferido entre contas; objetos e refeições são removidos do inventário da vítima e entram no do autor. A recuperação limita-se ao saldo ou bem remanescente e objetos exigem proximidade física para devolução. O roubo violento autônomo só é considerado à noite, com temperamento e tolerância ao risco altos, honestidade baixa, ressentimento contra a vítima e dinheiro disponível. A agressão gera ferimento e caso próprio; o dinheiro transferido gera caso de roubo vinculado à agressão, sem criar fundos. Os três testes de `justice_robbery.test.mjs`, seis de `justice_theft.test.mjs` e cinco de `justice_weapons.test.mjs` passaram. Com as etapas atuais, passam 132 testes `justice*.test.mjs`. Inventários pessoais participam do estoque geral. Ainda faltam cadeia de receptação, coleta física de bens apreendidos, crimes adicionais e balanceamento em execução longa.

Patrulhamento policial, etapa inicial: durante o turno pago das 08h às 17h, uma delegacia pode liberar um funcionário apto para caminhar por pontos alcançáveis nas ruas próximas e retornar ao posto. Necessidades urgentes, falta de rota, caixa salarial, equipe insuficiente para atender casos pendentes ou fim do turno interrompem ou encerram a ronda sem teletransporte. Um oficial em patrulha próximo reduz a oportunidade de furto; se presencia um crime, sua atenção aumenta a chance de registrar e identificar o suspeito, sempre com as mesmas regras de presença, distância, cômodo e visibilidade. O painel da delegacia informa oficial e estado da ronda. Quatro testes em `justice_patrol.test.mjs` cobrem seleção de turno, rota e retorno, efeito em furto/testemunho e movimento real pela simulação. Patrulha noturna, resposta a chamados em campo, apreensão e comandos abusivos ainda não existem.

Investigação presencial, etapa inicial: ocorrências com cena externa e rota disponível designam um funcionário da delegacia para sair fisicamente, inspecionar o local e tentar entrevistar testemunhas que ainda estejam vivas, conscientes, livres e alcançáveis. Só os relatos que essas pessoas já registraram podem indicar suspeito; a investigação não consulta autoria oculta do evento. O agente recebe salário durante o deslocamento e volta à delegacia antes da análise final. Casos documentais e interiores permanecem na análise de mesa. Necessidade urgente, agente indisponível e bloqueio de rota ficam registrados; nenhum deles teletransporta o investigador. Quatro testes em `justice_field_investigation.test.mjs` cobrem ida e volta, entrevista cooperativa, encerramento por perda do agente e movimento pelo ciclo real da simulação. O conjunto `justice*.test.mjs` passa com 137 testes; com grafo interno e sincronização do condutor, a rodada de integração passa com 142. Investigação interna, entrevistas repetidas após nova evidência e resposta policial a chamados seguem pendentes.

Invasão por serviço, etapa parcial: quando a necessidade de banheiro está crítica e a pessoa aguardou 90 minutos sem acesso legal, ela pode tentar usar um banheiro de funcionários em comércio ou indústria privada. A rota e o uso do cômodo são físicos; apenas o uso concluído registra a infração. A instalação arca com o uso sem pagamento, e observadores reais podem testemunhar conforme a visibilidade interior. Acesso autorizado não produz ocorrência; existe limite de uma ocorrência por pessoa e imóvel por dia. Dois testes de `justice_trespass_service.test.mjs` passam. Outras formas de invasão, resistência, denúncia do proprietário e balanceamento de frequência ainda faltam.

Veículos, etapa parcial: furto de veículo estacionado altera posse e acesso ao uso, mantendo dono legal, identidade e histórico de compra. Posse é consultada em viagens e capacidade de carga; venda normal de veículo furtado é bloqueada. Repintura usa o serviço existente e cobra o possuidor. Reconhecimento pelo dono depende de proximidade, luz e cor (repintura reduz a chance); veículo estacionado pode ser retomado, e condutor pode ser denunciado ou confrontado. Prisão encerra condução e recupera a posse legal sem teleportar o veículo. Os sete testes novos passam, totalizando 31 testes específicos de justiça. Os testes existentes de veículos/pintura têm 17 falhas que também foram reproduzidas em HEAD, sem novas falhas nesse conjunto. Cadeia de receptação, investigação de veículos e balanceamento prolongado ainda precisam de trabalho.

Percepção parcial: ocorrências guardam contexto espacial; observadores precisam compartilhar cômodo, andar e altura. Posições internas reais substituem a porta externa; edifícios bloqueiam observação exterior. Luz, distância, saúde, inconsciência e confusão influenciam a observação. Ser vítima não garante identificação. A descoberta posterior de bens ausentes permite BO sem criar testemunhas oculares; rotas de denúncia interrompidas voltam à fila. Os sete testes de `justice_perception.test.mjs` passam, com 38 testes específicos de justiça passando no total. Visibilidade por portas/janelas entre cômodos, índices espaciais e validação visual continuam pendentes.

Ferimentos e combate, etapa parcial: ferimentos aplicam multiplicadores regionais temporários à carga pessoal e em veículos, ao deslocamento externo/interno e à eficiência do trabalho, sem reescrever habilidades. Frete acima da capacidade após lesão é deixado no local e volta à fila; tratamento médico válido acelera a recuperação. Artesãos agora consomem madeira e fibras reais para fabricar porretes duráveis; moradores com segurança baixa e maior tolerância ao risco podem comprá-los, e golpes consomem durabilidade e aumentam dano sem tornar um alvo saudável facilmente letal. Trauma grave na cabeça pode deixar a pessoa inconsciente por período limitado, interrompendo rota, conversa e atividade, mas mantendo necessidades e tratamento; o temporizador restaura a consciência. O painel mostra arma e desgaste. Cinco testes em `justice_weapons.test.mjs` cobrem produção, compra paga, combate, durabilidade e recuperação física por furto; cinco testes de `justice_injury_effects.test.mjs` cobrem as consequências regionais; `justice_unconsciousness_simulation.test.mjs` verifica que a pessoa não percorre uma rota enquanto está inconsciente e acorda depois do prazo. Sangramento, rendição, outras armas e recuperação clínica detalhada continuam pendentes.

Depredação e conhecimento, etapa parcial: danos exigem alcance e visibilidade do autor e geram ocorrência com histórico; destruição preserva autoria, posição e cadastro, visível no painel. Observadores que identificaram o autor de um crime guardam fatos no sistema social, permitindo circulação por relatos. Protestos contra homenagens dependem de memórias ou crenças pessoais, inclusive acusações acreditadas, sem consultar o autor oculto do motor. Leituras de arte compartilham IDs com os fatos sociais e não sobrescrevem memórias criminais. Os seis testes novos de `justice_art_protest.test.mjs` passam, totalizando 49 testes específicos. Fragmentos renderizados, reconstrução, encomendas artísticas e circulação de decisões judiciais ainda precisam de implementação.

Revisão legal, etapa parcial: cada ocorrência preserva regra original e histórico de revisões vinculadas à votação. Alterações mais favoráveis podem descriminalizar, reduzir pena/multa, liberar prisão ou remover efeitos políticos; recriminalização e agravamento não reabrem nem agravam fatos antigos. Reparação judicial de limpeza continua como obrigação civil. Multas são cobradas por saldo restante e devoluções por revisão ficam registradas, sem criação de dinheiro quando falta caixa no tesouro. Os nove testes de `justice_penal_review.test.mjs` passam, totalizando 58 testes específicos. A circulação pública dessas decisões e a validação integral das combinações de leis na simulação ainda estão pendentes.

Corrupção, migração parcial: denúncias descobertas criam um único encaminhamento para a polícia com vínculo ao esquema financeiro. Documentos têm procedência e análise policial; ausência de documento não revela o autor oculto. Condenações atuais passam a refletir decisões judiciais, enquanto deliberações legislativas anteriores ficam preservadas separadamente; novas propostas de condenação criminal pela Câmara são rejeitadas. Cassação política continua separada. Os seis testes de `justice_corruption.test.mjs` passam (64 testes específicos no total), assim como o teste atualizado de integração institucional. Julgamento individual de todos os coautores, obstrução policial e difusão completa das decisões ainda estão pendentes.

Defesa e fraude, etapa parcial: tribunal e recurso deixam de consultar o indicador interno de fraude. A defesa pode comparar identificações registradas com depoimentos disponíveis ou documentos originais e apresentar contradições, com chance dependente da habilidade. Fraude não descoberta pode sustentar condenação injusta; uma nova revisão em recurso pode descobrir divergências e anular a condenação, encerrando pena e devolvendo multas por transferência real. Os cinco testes de `justice_defense_review.test.mjs` passam (69 específicos no total). Entrevistas presenciais agora alimentam diligências externas; responsabilidade criminal do investigador e recursos por provas novas fora do prazo ainda precisam de implementação.

Estado e migração, etapa parcial: restauração inicializa justiça e habilidades ausentes em estados antigos, preserva flags votadas e reconstrói contadores sem reutilizar IDs de camadas removidas. A inicialização determinística das novas habilidades é compartilhada com a geração de moradores e mantém valores existentes, dinheiro e seed. Os testes de `justice_state.test.mjs` verificam ciclos entidade/obra, proveniência compartilhada de refeição, posse, corpos, deltas, revisões legais, patrulhas e diligências em andamento com depoimentos. Nesta validação, 137 testes `justice*.test.mjs` e 142 testes incluindo grafo interno e sincronização do condutor passaram. Validação prolongada do worker e inspeção visual ainda estão pendentes.

Transporte funerário terrestre, etapa parcial: corpo aguarda funcionário e bicicleta de carga reais, com reserva exclusiva de ambos. O trabalhador precisa chegar à coleta, recolher o corpo e conduzi-lo ao destino; somente então começam autópsia ou cremação. Salário usa o empregador público; falta de bicicleta, rota ou condições do trabalhador mantém espera visível. Interrupções deixam o corpo no local alcançado e liberam reservas. Os seis testes novos de `justice_funeral_transport.test.mjs` passam; o conjunto de justiça e sincronização do condutor tem 80 testes passando. A coleta em passarelas elevadas continua pendente. A retirada de interiores e andares foi implementada na etapa seguinte, registrada abaixo. Capacidade de armazenamento, consumo do crematório e balanceamento de frota ainda precisam de trabalho.

Retirada de interiores, etapa parcial: posição real e altura da morte são preservadas. O funcionário chega ao acesso do prédio, percorre o grafo interno até o corpo e retorna com ele por cômodos e escadas antes de embarcar na bicicleta. Interrupções preservam a posição interna atual, separada do local original da morte. Corpos são renderizados na altura corrente e o painel informa o andar. Os três testes de `justice_funeral_interior.test.mjs`, os demais de justiça, o grafo interno e a sincronização do condutor passam (87 testes no conjunto). Coleta em passarelas, destruição do prédio durante retirada e inspeção visual completa continuam pendentes.

Recursos funerários, etapa parcial: armazenamento limitado inclui reservas de transporte e corpos presentes. A expansão pode ser solicitada quando instalações ficam lotadas. Autópsia consome sabão e exige 90 minutos distintos de funcionário presente; cremação consome carvão e exige 120 minutos. Um funcionário não processa dois corpos no mesmo minuto, e insumos são debitados uma única vez. Compras usam comércio/logística existentes; IML e crematório participam da aquisição de bicicletas de carga reais. O painel exibe estoque e ocupação. Os seis testes de `justice_funeral_resources.test.mjs` passam: 88 específicos de justiça e 93 no conjunto com rotas internas/sincronização. Frota e estoque iniciais proporcionais, deterioração, custos calibrados e execução longa continuam pendentes.

Deterioração, etapa parcial: corpos envelhecem sem desaparecer; integridade dos vestígios cai com limite mínimo e influencia o laudo. Exposição sanitária usa vizinhança espacial e compartimentos, limitada por morador a cada intervalo, com efeitos graduais em higiene e saúde. Armazenamento funerário contém a exposição exterior; corpos frescos não geram penalidade imediata. Aparência e painel informam deterioração. Os seis testes de `justice_decomposition.test.mjs` cobrem envelhecimento, limites, compartimentos, armazenamento e migração espacial. Balanceamento de mortalidade na seed solicitada, inspeção visual e doenças detalhadas ainda estão pendentes.

Lotação prisional, etapa parcial: vagas limitadas incluem pessoas em condução. Mandados e sentenças aguardam vaga, equipe e rota; outra unidade acessível pode ser escolhida. Soltura e morte liberam a reserva, e custódia existente não pode ser sobrescrita. Revisão para somente multa retira o mandado da fila e mantém a acusação sem prisão. Oito testes de `justice_jail_capacity.test.mjs` e um novo caso de revisão legal passam. A distribuição física em celas foi implementada na etapa registrada abaixo; escolta policial, atendimento hospitalar e logística completa de custódia continuam pendentes.

Cuidado em custódia, etapa parcial: descanso e proteção básica acompanham a permanência na cadeia; equipe presente pode autorizar banheiro e prestar primeiros socorros com remédio real. Higiene exige chegada ao banheiro e consome sabão; o ciclo sanitário existente registra uso e resíduos. Insumos são comprados pela cadeia. Refeições saem do estoque físico da cadeia: a prefeitura encomenda pão por frete com transportadora, e a refeição só é emitida após a entrega. Água também tem estoque físico: um funcionário da cadeia sai pela rota interna, coleta uma carga em margem acessível e a leva de volta; o volume do corpo d’água diminui e a contaminação da fonte acompanha a carga. Sem fonte, equipe ou rota, a necessidade fica sem reposição e o motivo aparece no painel.

Celas físicas, etapa parcial: cada vaga de uma cadeia construída corresponde a uma unidade interna marcada como cela, mobiliada com beliche e reservada desde a condução. A pessoa presa percorre o interior até a cela; rotas internas e deslocamentos ao banheiro permanecem reais. A soltura parte da posição interna e inicia a saída pela porta, sem teletransporte. O painel mostra a cela, ocupação e bloqueios de rota. O teste novo `justice_jail_cells.test.mjs` e os oito testes regressivos de `justice_jail_capacity.test.mjs` passam.

Atendimento hospitalar sob escolta, etapa parcial: ferimento grave ou saúde abaixo do limite dispara busca de hospital acessível com equipe e remédios, além de policial empregado e fisicamente presente na delegacia. O policial recebe salário público durante a missão, percorre a rota até a cadeia e acompanha a pessoa até o hospital. O preso sai da cela por seus próprios caminhos internos; no hospital usa a atividade de saúde existente, que debita medicamentos e trata lesões ao longo do tempo. Após estabilização, policial e paciente retornam à cadeia e a pessoa volta à cela reservada. Sem hospital, suprimentos, rota ou policial, a condição e o motivo de espera ficam visíveis. Os dois testes de `justice_custody_medical.test.mjs` cobrem atendimento completo com retorno físico à cela e espera sem hospital. A simulação de uma missão completa em `CitySimulation`, as consequências de falta de caixa salarial e os bloqueios por rota durante o trajeto ainda requerem auditoria.

## 1. Regras acordadas e decisões propostas

O mundo terá arte urbana física, delitos, ferimentos, polícia, perícia, justiça, prisão e interferência política. São processos executados por moradores com trabalho, deslocamento, custos e conhecimento limitado.

Regras solicitadas:

- Policiais e funcionários das prisões são servidores remunerados pelo governo. IML, crematório e tribunal também serão serviços públicos com pessoal e custeio reais; escritórios de advocacia serão empresas privadas, com defesa pública para quem não puder pagar.
- Mortos permanecem fisicamente no mundo até serem recolhidos. O funcionário do IML usa bicicleta de carga para transportá-los; autópsia precede a destinação ao crematório.
- Investigação pode errar ou ser fraudada; inocentes podem ser presos. Prisão, acusação e condenação são estados distintos.
- A Câmara define por votação quais infrações acarretam cassação do mandato e perda ou suspensão de direitos políticos, e em qual momento esses efeitos são aplicados. A regra inicial proposta mantém a cassação por prisão solicitada originalmente, mas passa a ser uma configuração alterável por tipo de infração; deixa de ser uma consequência universal e imutável de toda prisão. Uma simples denúncia não causa cassação.
- A Câmara pode votar a soltura de alguém, inclusive contra a decisão policial.
- Ficha Limpa e Imunidade Parlamentar começam desativadas e só mudam por votação.
- **Imunidade esclarecida pelo usuário:** sem imunidade, prisão normal; com imunidade, a Câmara precisa autorizar a prisão. A investigação continua possível.

Decisões propostas para fechar lacunas, sujeitas à revisão:

- A imunidade protege vereadores em exercício. O prefeito continua sujeito à investigação e ao procedimento normal; estender a proteção ao Executivo exigirá uma regra explícita.
- Soltura aprovada pela Câmara encerra a custódia, mas não apaga provas, condenação ou cassação já efetivada. Absolvição e revisão judicial são caminhos separados; não há restituição automática do mandato.
- Ficha Limpa considera condenações válidas anteriores, inclusive anteriores à aprovação da lei, somente por infrações classificadas pela Câmara como impeditivas de candidatura. Prisão sem condenação não basta. Condenação anulada deixa de impedir candidatura. A elegibilidade é verificada na inscrição e antes da posse; desativar a lei não ressuscita candidaturas encerradas.
- Multas, reparação, prisão preventiva e pena têm fundamentos registrados. Crimes leves não geram prisão automaticamente; violência, gravidade, reincidência e risco de fuga pesam na decisão. Quando houver prisão ou condenação, consultar separadamente os efeitos políticos previstos para a infração e seu gatilho legal.
- Penas têm duração finita e revisável. Não haverá pena de morte judicial nesta entrega; assassinato por agentes públicos será possível como abuso criminoso do regime.
- Prédios públicos custam construção, salários, materiais e transporte. A geração inicial garante capacidade mínima proporcional à população; expansão depende de demanda e orçamento, sem exigir que centenas de corpos se acumulem antes do primeiro IML.

## 2. Bases existentes e mudanças necessárias

| Base atual | Integração planejada |
| --- | --- |
| `city_publications.js`, sociedade, memórias e crenças | Mensagens artísticas compartilham referências a fatos, fontes, mentiras e alvos; a reação utiliza personalidade e experiência. |
| `city_campaign_materials.js`, propaganda em propriedades e renderizador de campanha | Banners e bandeiras passam a compartilhar um cadastro de obras físicas, sem duplicar objetos ou influência. |
| `city_life.js` | Hoje `die()` marca a entidade como destruída. Separar fim da vida de remoção física do corpo. Preservar herança, luto, encerramento de rotinas e estatísticas. |
| Veículos, bicicletas de carga, inventário e logística | Transporte funerário, bens subtraídos, apreensões, pintura e recuperação de veículos. |
| Iluminação e terreno | Visibilidade percebida depende de luz, distância, paredes e campo de visão, também em interiores. |
| Serviços públicos, emprego e obras | Delegacia, prisão, IML, crematório e tribunal recebem salas, equipes, equipamentos, orçamento e filas. |
| Governo, instituições políticas e Câmara | Encaminhar corrupção para a polícia; separar investigação, julgamento, cassação e autorização legislativa. |
| Grafo de estado, worker, movimento e busca geral | Todos os novos objetos precisam sobreviver à sincronização e ser inspecionáveis. |

O sistema atual de corrupção já possui investigação e condenação legislativa. Ele será migrado para um único processo: preservar esquemas e provas existentes, polícia investiga, tribunal julga, Câmara exerce suas competências políticas. Evitar duas condenações ou dois casos para o mesmo fato.

## 3. Verdade, conhecimento e registros

Separar explicitamente três camadas:

1. **Ocorrência real:** o que aconteceu no motor, com autor, vítima, local, horário e efeitos reais. Acesso interno para simulação e auditoria.
2. **Conhecimento das pessoas:** o que cada um viu, ouviu, reconheceu ou passou a acreditar. Pode ser parcial, falso ou contraditório.
3. **Processo institucional:** BOs, laudos, depoimentos, provas, suspeitos, decisões e recursos. O investigador não consulta o autor real oculto.

Um BO não identifica magicamente um culpado. A autópsia produz uma conclusão e uma estimativa de horário conforme vestígios, conservação e habilidade. O motor guarda causa e hora reais para consistência; um laudo errado ou adulterado é outro registro, sem reescrever a morte real.

Cadastros propostos: obras e intervenções artísticas; ocorrências; depoimentos; vestígios e cadeia de custódia; corpos e laudos; casos; mandados e detenções; processos e sentenças; condenações; custódia e penas; ferimentos e encontros de combate. Todos usam IDs estáveis e eventos encadeados.

## 4. Arte urbana e circulação de mensagens

Tipos iniciais: estátuas, monumentos, pinturas e murais, banners e faixas, bandeiras, bandeirinhas de São João e pichações. Obras podem ser comerciais, políticas, comemorativas, decorativas, difamatórias ou de protesto. Podem homenagear vivos ou mortos, partidos, empresas e acontecimentos.

Cada obra registra autor, patrocinador, proprietário, autorização, suporte físico, posição/andar, materiais, qualidade, condição, mensagem, alvo e histórico de intervenções. Obras em paredes e interiores ficam vinculadas ao imóvel e acompanham sua geometria.

- Produção e instalação consomem materiais, tempo e habilidade artística. Artistas recebem por encomendas; trabalhos espontâneos dependem de recursos próprios ou apoio.
- Mensagem decorativa não precisa afirmar um fato. Acusações podem referenciar fatos verdadeiros, interpretações ou invenções.
- Pichações são camadas sobre parede, banner, estátua ou outra arte, inclusive pichação anterior. Guardar autoria e ordem; a superfície visível determina o que é lido. Limpeza pode remover a camada e revelar a anterior.
- Depredação reduz condição; destruição remove o objeto visível e preserva seu registro, fragmentos e eventual ocorrência. A destruição do suporte também afeta as obras nele instaladas.
- Pessoas observam obras ao passar suficientemente perto, com linha de visão e iluminação. Qualidade, atenção, ceticismo, vínculos, ideologia e vivências determinam interpretação e reação.
- Limitar repetição de leitura e intensidade de influência. Um banner não deve alterar a opinião a cada passo de um morador parado ao lado dele.
- Escândalos, condenações e crenças sobre crimes podem gerar protestos contra homenagens. Não transmitir o crime oculto para todos: a reação depende de conhecimento local.
- A limpeza é paga inicialmente pelo dono do suporte. Havendo responsabilização, o autor pode pagar diretamente ou ressarcir o gasto já realizado. Não cobrar duas vezes nem criar pagamento fictício se ele não tiver recursos.

## 5. Crimes, testemunhas e denúncias

Catálogo inicial: pichação não autorizada, dano a arte/monumento/imóvel, furto de dinheiro, alimento, objetos e veículos; roubo mediante violência; invasão de propriedade, uso clandestino de serviço, agressão, ameaça, tentativa de homicídio e homicídio. Fraude de investigação, abuso policial e corrupção também geram ocorrências.

Motivação combina necessidade, oportunidade, ressentimento, ambição, vínculos, honestidade, tolerância ao risco e percepção de policiamento. Pobreza não torna automaticamente alguém criminoso. Preparação, deslocamento e execução podem falhar ou ser interrompidos. Necessidades urgentes continuam influenciando as decisões.

Escuridão reduz risco percebido de identificação, não torna crimes impossíveis durante o dia. Em locais claros e movimentados, mais observadores devem registrar o fato. Quantidade de testemunhas depende de presença real, não de uma geração abstrata. A vítima pode observar o agressor se estiver consciente e em condições.

Testemunhas podem reconhecer rosto, roupa, voz, veículo ou apenas detalhes parciais. Medo, lealdade, trauma, suborno e confiança na polícia influenciam denunciar ou mentir. Pessoas capazes vão fisicamente à delegacia registrar o BO; hospitalizados ou presos podem prestar depoimento a agente que os visite. Relatos sobre o mesmo fato devem ser agrupados.

### Veículos e bens

Separar proprietário legal, posse física, condutor e suspeita de origem ilícita. Furto não é compra, não muda automaticamente o dono legal e não gera receita comercial.

O dono que encontra a bicicleta estacionada pode recuperá-la quando consegue reconhecê-la. Se o ladrão estiver montado, pode confrontá-lo, desistir, pedir ajuda ou denunciar conforme condição e personalidade. Repintura reduz fortemente o reconhecimento, mas não elimina características do modelo, danos ou outras evidências. Ela custa tinta, tempo e acesso ao serviço; não troca identidade interna do veículo.

Objetos e alimentos saem de um inventário e entram em outro. Valores, quantidades e bens são conservados; apreensão, devolução e deterioração seguem a mesma regra.

## 6. Corpo, perícia e crematório

Fluxo: morte → corpo no local → descoberta/comunicação → recolhimento reservado → transporte de bicicleta de carga → entrada no IML → autópsia → liberação → crematório → destinação concluída.

- O falecido deixa de agir, votar, trabalhar e contar na população viva imediatamente. O corpo é uma entidade própria, vinculada ao falecido, com posição física preservada, incluindo interior, andar, passarela ou veículo.
- Um único funcionário reserva cada coleta. Ele precisa chegar ao corpo, retirá-lo pelo acesso correto, carregar respeitando capacidade e conduzi-lo até o IML. Não usar a posição externa da porta para substituir uma morte ocorrida no andar superior.
- IML tem recepção, armazenamento e sala de autópsia. Crematório tem fila, operador e consumo de insumos. Falta de equipe, transporte, acesso ou capacidade produz espera e diagnóstico visível.
- Corpos podem se deteriorar, afetar higiene e prejudicar vestígios. Decomposição não elimina silenciosamente o corpo nem serve como atalho para zerar fila.
- Laudo suspeito abre ou vincula uma investigação, mesmo sem BO de vítima. Lesões e vestígios podem indicar causa violenta sem revelar automaticamente o autor.
- Evidências necessárias são registradas antes da cremação. Atraso, negligência, ocultação ou destruição indevida podem comprometer o caso e gerar responsabilidades.
- Familiares mantêm luto, memória e direitos patrimoniais; morte, coleta e cremação não disparam herança várias vezes.

## 7. Combate, armas e recuperação

Adicionar habilidades de artes visuais/escultura, combate desarmado, manejo de armas, investigação, perícia e prática jurídica, conectadas ao aprendizado e recrutamento existentes. Precisarão de valores iniciais compatíveis para não criar prédios sem ninguém apto a trabalhar.

Combate é um encontro com participantes, intenção, alcance, iniciativa, cansaço, defesa, fuga, rendição e intervenção. Pode terminar sem ferimento grave. Incluir mãos, pedaços de pau, bastões e armas cortantes ou de fogo como itens com alcance, dano, peso, durabilidade e, quando aplicável, munição. Sua produção e distribuição precisam de fontes e custos definidos; não surgem no inventário quando uma luta começa.

| Região lesionada | Consequência principal |
| --- | --- |
| Pernas/pés | Redução de caminhada e mobilidade, risco de queda e dificuldade para pedalar. |
| Braços/mãos | Menor força, precisão, capacidade de usar ferramentas e conduzir veículo. |
| Costas/tronco | Menor carga e resistência; lesões internas podem exigir cuidado urgente. |
| Cabeça | Desorientação, menor atenção e capacidade de executar tarefas, reconhecer ou depor; possível inconsciência. |

Ferimentos registram região, gravidade, dor, sangramento, causa, tratamento e recuperação. Multiplicadores possuem limites e duração; lesão não corrompe permanentemente valores básicos de habilidade. Incapacitação solta carga e encerra condução de forma consistente.

Homicídio contra pessoa saudável será muito difícil: resistência, defesa, tempo de execução, socorro e intervenção devem importar. Armas elevam a gravidade e ainda exigem balanceamento para não provocar uma espiral de mortes. Atendimento clínico e hospitalar trata ferimentos; saúde e necessidades básicas continuam funcionando.

## 8. Polícia, julgamento e prisão

Polícia terá patrulha, atendimento de BO, preservação de local, coleta de evidências, entrevistas, busca de suspeitos, cumprimento de ordens e transporte de detidos. Escalas, equipes, trajetos, salários e capacidade limitam o atendimento. Uma ordem não teletransporta o alvo para a cadeia.

Fluxo normal: ocorrência/BO → investigação → suspeita fundamentada → eventual medida cautelar → acusação → defesa → julgamento → sentença → cumprimento ou absolvição → eventual revisão/recurso.

Delegacia tem área de atendimento e custódia temporária; prisão tem celas, alimentação, água, banheiro, cuidados e funcionários públicos. Preso mantém identidade, patrimônio, vínculos e necessidades; rotinas externas e emprego ficam suspensos ou encerrados conforme a situação. Fuga, soltura, transferência, morte e fim da pena liberam vagas e reservas uma única vez.

Advogados podem consultar provas disponíveis, entrevistar, contestar reconhecimento e laudos, apontar fraude e pedir revisão. A defesa pública evita que ausência de dinheiro bloqueie todo julgamento. Juízes usam provas do processo e podem ter competência, parcialidade, vínculos ou corrupção; não consultam o autor real oculto.

Fraude precisa de ações e oportunidades concretas: depoimento inventado, prova plantada, laudo adulterado, ocultação ou pressão. Guardar origem e custódia dos vestígios permite descobrir inconsistências mais tarde. Absolvição, falta de provas e erro judiciário são resultados possíveis.

### Polícia e poder político

A polícia integra o Executivo municipal: orçamento, nomeações e ordens podem refletir o prefeito. Autoritarismo, controles institucionais, personalidade e lealdade dos agentes influenciam obediência e resistência; todos os policiais não agem como um único personagem.

Escalada possível: patrulhamento excessivo → remoção seletiva de propaganda → repressão a protestos → perseguição de opositores → agressão, dano, fabricação de acusações e, em extremos, homicídio. Ordens ilegais podem ser recusadas, denunciadas ou executadas. Esses atos geram vítimas, testemunhas, provas, reações e possíveis investigações.

A investigação de corrupção passa para a polícia, inclusive envolvendo prefeito, vereadores e agentes públicos. Com imunidade ativa, uma prisão de vereador exige autorização nominal da Câmara, com votos e motivos registrados. Sem autorização, não há prisão legal. Uma prisão ilegal por regime autoritário permanece possível como abuso e gera consequências, sem fingir que a lei foi respeitada.

Quando a infração prevê cassação e seu gatilho legal é atingido, efetivar cassação e sucessão exatamente uma vez. Prisão por infração sem esse efeito não remove automaticamente o mandato. Não reutilizar uma função de inelegibilidade genérica para apagar o mandato antes da prisão. A Câmara pode votar soltura nominal; isso não equivale automaticamente a absolvição.

### Código penal municipal votável

A Câmara poderá alterar as regras gerais por tipo de conduta, além de votar decisões individuais como autorização de prisão e soltura. As alterações passam pelo processo legislativo, com proposta, debate, votos nominais, resultado e início de vigência registrados.

| Configuração votável | Exemplos e efeito |
| --- | --- |
| Enquadramento da conduta | Permitida, infração administrativa ou crime. A Câmara pode liberar pichação ou voltar a criminalizá-la. |
| Condições do enquadramento | Diferenciar autorização do dono, tipo de suporte, invasão, dano, violência e reincidência. Permitir pichação não legaliza automaticamente agressão, invasão ou destruição cometidas junto dela. |
| Gravidade | Classificação e agravantes/atenuantes utilizados na prioridade policial, cautelares e sentença. |
| Penalidade financeira | Apenas multa/taxa punitiva, valor fixo ou proporcional ao dano, com limites e destinatário definidos. O registro identifica se é sanção administrativa ou criminal; cobrar não equivale a condenar por outro delito. |
| Outras consequências | Reparação/limpeza, indenização, possibilidade de prisão e duração mínima/máxima da pena, com combinações explícitas. |
| Cassação do mandato | Quais infrações cassam, quais não cassam e se o gatilho é prisão efetivada ou condenação. |
| Direitos políticos | Quais infrações suspendem direitos políticos, quais impedem candidatura pela Ficha Limpa, duração e condições de reabilitação. São efeitos distintos da perda de um mandato específico. |

Assim, a Câmara poderá decidir que pichação é permitida, que determinada infração exige apenas pagamento, ou que certo crime não retira direitos políticos. A polícia e o tribunal consultam essas regras; o catálogo de comportamentos simuláveis não é uma lista fixa de crimes. Uma conduta permitida ainda pode provocar desaprovação, protesto, conflito de propriedade ou limpeza por iniciativa do dono, sem gerar punição penal automaticamente.

Multa arrecadada não substitui indenização à vítima nem pagamento do serviço de limpeza: registrar essas obrigações separadamente e impedir cobrança duplicada. Falta de dinheiro não vira prisão automática em uma infração configurada como exclusivamente financeira.

**Versionamento e transição propostos:** cada ocorrência e processo guarda a versão da lei aplicável; nada vira crime retroativamente só porque a Câmara endureceu a regra. Para descriminalização ou redução de pena, abrir revisão dos casos, penas e restrições afetadas, com decisão registrada. Um regime autoritário pode violar essas regras como abuso documentado, sem alterar silenciosamente o histórico. Anulação de condenação e fim de restrição política continuam diferentes de restituição de mandato já cassado.

Ficha Limpa e Imunidade continuam desativadas no início. Aprovar Ficha Limpa ativa o impedimento para as infrações marcadas como relevantes; não torna toda condenação impeditiva. A configuração penal pode prever suspensão de direitos independentemente da Ficha Limpa, deixando a origem de cada impedimento explícita. A autorização de prisão protegida por imunidade continua sendo uma votação própria, não um efeito da classificação de gravidade.

## 9. Interface e observabilidade

Novos diretórios: Arte urbana; Segurança; IML e corpos; Justiça; Prisões. Integrar à busca geral, fichas dos moradores, imóveis e histórico.

- Obra: mensagem visível, autor conhecido, patrocinador, condição, proprietário, camadas e limpeza.
- Ocorrência/caso: relatos, vestígios, diligências, hipóteses, responsáveis, prazos e situação.
- Corpo: localização, coleta, transporte, laudo, liberação e destinação.
- Pessoa: ferimentos, limitações, tratamento, representação jurídica, custódia, sentenças e antecedentes.
- Governo: orçamento, quadro de pessoal, lotação, código penal vigente e suas versões; comparação entre regra atual e proposta, votações das duas leis, autorizações e solturas. Mostrar por infração gravidade, sanções e efeitos sobre mandato, candidatura e direitos políticos.

Distinguir claramente conclusão oficial, crença de uma pessoa e verdade interna. Um modo de auditoria separado permite testar autoria real e erros judiciais sem conceder esse conhecimento aos personagens. Quando algo estiver parado, mostrar a causa: falta de equipe, vaga, recursos, bicicleta, rota, prova ou autorização.

Todos os painéis usam o gerenciador de janelas existente, com arraste, redimensionamento, recorte de campos nativos e proteção de atalhos durante digitação.

## 10. Implementação em etapas verificáveis

| Etapa | Entrega funcional e critério de conclusão |
| --- | --- |
| 1. Contratos e registros | IDs, ocorrências, separação de verdade/conhecimento, versões de estado e configuração, incluindo versões das regras penais e efeitos políticos por infração. Novo estado atravessa inicialização, snapshot completo, deltas e worker sem perder referências. |
| 2. Corpo e serviços funerários | Morte natural mantém corpo; funcionário recolhe de bicicleta; IML produz laudo; crematório conclui o fluxo. Testar falta de acesso, lotação, morte de funcionário e herança única. |
| 3. Ferimentos e combate | Luta, fuga, rendição, armas, efeitos regionais e cuidado médico. Sem IA criminal em massa até validar sobrevivência e gravidade. |
| 4. Arte e percepção | Encomendas, instalação, leitura, reações, camadas e limpeza. Migrar propaganda existente sem duplicar influência ou estoque. |
| 5. Delitos e segurança | Crimes patrimoniais, invasão, vandalismo, agressão e homicídio; testemunhas e BOs; patrulha e investigação. Caso natural e caso criminoso produzem resultados distintos no IML. |
| 6. Justiça e prisão | Defesa, juiz, cautelares, sentença, pena, restituição e revisão. Demonstrar caso resolvido, caso sem provas e inocente preso com possibilidade de revisão. |
| 7. Política e abuso de poder | Código penal votável, descriminalização, gravidade, sanções e efeitos políticos por infração; corrupção na polícia, imunidade, Ficha Limpa, autorização, soltura, cassação, sucessão e repressão. Testar as combinações das duas leis, ambas inicialmente desligadas. |
| 8. Integração e balanceamento | Busca e painéis completos, desenho, auditorias de economia, mortalidade, filas e desempenho. Nenhum tipo de serviço novo depende de teletransporte ou recursos gratuitos. |

As etapas são fatias completas, não apenas classes vazias ou botões. Não declarar o conjunto pronto enquanto transporte, justiça, efeitos políticos e sincronização estiverem pendentes.

## 11. Validação e limites de desempenho

Cenários determinísticos obrigatórios:

- Repetir crime em local claro/escuro com os mesmos observadores; verificar diferença de observação sem testemunhas inventadas.
- Furto e recuperação de bicicleta, montada/estacionada e antes/depois da pintura; conferir dono legal, posse e inventário.
- Pichação sobre banner, nova pichação por cima, limpeza, ressarcimento e destruição de estátua após mudança de reputação.
- Morte no solo, interior, andar superior, passarela e veículo; uma coleta, um laudo, uma cremação, uma herança.
- Homicídio real com autor desconhecido; ausência de evidências não vira identificação automática. Testar inocente incriminado e fraude descoberta.
- Ferimentos por região, carga, mobilidade, condução e recuperação clínica; saudável não morre facilmente em confronto comum.
- Sem imunidade, prisão e eventual cassação conforme a infração; com imunidade, investigação e espera por autorização; soltura legislativa sem apagar condenação.
- Ficha Limpa desligada/ligada, condenação passada, infração impeditiva/não impeditiva e condenação anulada; sucessão do Executivo e reposição de vereadores.
- Votar liberação e recriminalização de pichação; infração somente financeira não gera prisão; cassação e suspensão de direitos variam independentemente por infração. Testar fatos anteriores à mudança da lei, revisão por regra mais branda e obrigações de reparação sem cobrança duplicada.
- Custódia com água, alimento e saúde, superlotação visível, salários pagos pelo tesouro e bloqueios por falta de recursos.
- Crimes e arte não criam dinheiro, veículos, armas ou mercadorias; valores apreendidos e indenizações são transferências registradas.

Auditar a seed 2120920325, Terras altas, 256×256, 512 habitantes, incluindo execução equivalente a 32×, além de outras sementes e perfis de terreno. Fazer comparação com o estado anterior e medições em 15–20 dias; ampliar até 30 dias para efeitos políticos e filas persistentes. Separar mortes naturais, privação, ferimentos, homicídios e falhas de simulação.

Usar índices espaciais para percepção, crimes e patrulhas; agenda de tarefas para autópsias e processos; atualizações regionais para iluminação. Evitar comparar todos contra todos a cada minuto. Casos abertos e antecedentes necessários às leis persistem; mensagens visuais e eventos repetitivos têm retenção limitada sem apagar provas pendentes. Execução em worker e visualização usam os mesmos IDs, horários e sorteio determinístico, sem depender da taxa de quadros.

## 12. Riscos que orientam a implementação

- **Ciclo de vida:** substituir o desaparecimento instantâneo sem manter mortos nas rotinas dos vivos.
- **Mortalidade:** calibrar combate e crime antes de ampliar frequência; medir se falta de serviço ou bugs está sendo confundida com violência.
- **Economia:** novos servidores e insumos competem com abastecimento e moradia; provisionar orçamento e capacidade mínima de forma explícita.
- **Conhecimento:** impedir que polícia, arte ou população recebam autoria e fatos ocultos sem observar ou investigar.
- **Política:** manter separadas prisão, condenação, cassação, soltura, imunidade e inelegibilidade.
- **Desempenho:** corpos, obras e processos não podem virar buscas globais por morador ou crescimento ilimitado de histórico.

Próximos passos: concluir os ciclos físicos restantes de crime, arte, combate, polícia e julgamento; corrigir os pontos de balanceamento e auditar a seed 2120920325 a 32×. O fluxo funerário já está implementado em parte e serve como referência para transporte e cadeia de custódia.

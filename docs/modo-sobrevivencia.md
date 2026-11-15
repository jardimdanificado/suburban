# Sobrevivência no mundo simulado

A simulação gera o mundo e mantém cidadãos, empresas, estoques, famílias e instituições funcionando. O modo de jogo assume uma pessoa desse mesmo mundo, com uma interface própria. Não distribui dinheiro nem cria uma cidade paralela.

## Entrar e controlar

Escolha **Jogar como personagem** no menu principal, ou em **Ferramentas → Jogar como personagem** durante a simulação. A seleção pausa o mundo para manter os personagens disponíveis durante a escolha. Escolha um adulto disponível. Pessoas em cargos públicos, transporte ou serviços reservados precisam terminar suas atividades antes de serem escolhidas.

- **WASD ou setas:** caminhar na direção da tela, respeitando terreno, paredes e obstáculos.
- **Shift:** correr, gastando energia.
- **Clique no chão:** caminhar até o destino acessível.
- **X:** interromper a ação atual.
- **I:** abrir a mochila.
- **E:** interagir com portas, plantas, água e pessoas ao alcance.
- **Q:** alternar entre os alvos próximos.
- **1 / 2:** comer / beber da mochila.
- **R:** descansar no local; ao ar livre, permite escolher dormir no chão.
- **F ou Espaço:** atacar uma pessoa próxima. **Ctrl + clique:** atacar a pessoa apontada.
- **P:** pausar ou continuar o tempo.
- **C / H / V:** personagem, condição física e atividade.
- **T / B:** alvos próximos e interações próximas.
- **I / U / J:** mochila, família e diário.
- **Esc:** fechar a janela ativa; sem janelas abertas, mostrar as opções e a troca de câmera.

A interface de gestão sai de cena enquanto você joga. As informações ficam em janelas: personagem, condição física, atividade, alvos próximos e interações próximas. Essas cinco janelas abrem ao entrar; a mochila começa fechada. Eles usam o mesmo sistema de janelas da administração: é possível arrastar, redimensionar, fixar, recolher e manter vários painéis abertos. **Tab** alterna a janela ativa; **Esc** fecha a janela ativa ou abre as opções quando nenhuma está aberta. Fome, sede, energia, saúde, higiene e banheiro aparecem na janela de condição física. Fechar uma janela mantém essa escolha até você reabri-la pelo atalho ou pela barra de janelas. Ao voltar da simulação, as janelas do personagem que estavam abertas e suas posições são restauradas. Com a rotina automática desligada, o personagem não escolhe sozinho quando comer, beber, procurar emprego ou dormir. Os outros cidadãos continuam autônomos.

## Barra inferior e autonomia

A barra inferior mostra saldo pessoal, dia, horário, saúde, água e energia. Os controles de tempo permitem escolher **0.25×**, **0.5×** e **1.0×**, além de pausar ou continuar.

O switch **Rotina automática** começa desligado, mantendo o controle total existente. Ao ligá-lo, a pessoa volta à rotina da simulação: cuida das necessidades, usa as provisões que carrega e executa suas atividades. Você continua acompanhando a mesma pessoa e pode dar ordens pontuais pelas janelas ou pelo clique no chão. Depois de concluí-las, a rotina continua. Necessidades urgentes podem interromper ordens não essenciais.

Enquanto a rotina automática estiver ligada, WASD fica bloqueado. Desligar o switch cancela a atividade comum e devolve o controle total. Se houver transporte ou atendimento reservado em andamento, a solicitação aguarda sua conclusão para preservar a atividade; clicar no switch novamente cancela essa espera.

## Alvos, interações e fichas

**Alvos próximos [T]** mostra pessoas, construções, plantas e veículos a até 12 metros no mesmo ambiente. **Interações próximas [B]** reúne todas as ações disponíveis ao alcance físico, agrupadas por alvo. As duas listas têm filtro por nome ou tipo e se atualizam conforme você anda.

**Selecionar alvo** define quem recebe a interação com **E**. Se ele sair do alcance, a tecla não escolhe outra pessoa automaticamente. As ações das listas também passam pela validação de proximidade do mundo.

**Ver ficha** abre uma janela de consulta com os dados atuais da pessoa, prédio, planta ou veículo. O botão direito sobre um alvo próximo também abre sua ficha. É possível manter várias fichas abertas, arrastar e redimensionar cada uma. As fichas não oferecem comandos de administração ou troca de controle.

## Sobreviver

Coma as provisões existentes ou compre refeições de estabelecimentos com estoque. Comprar guarda a refeição na mochila; comer é outra decisão. Encha a garrafa na prefeitura, no refeitório popular ou numa distribuidora de água. Beber consome uma porção.

Aproxime-se de plantas silvestres com alimento e use **E** para colher. Chegar e colher leva tempo; a coleta retira estoque real da planta. O alimento pode ser consumido ou vendido a um comprador com caixa e espaço.

Portas oferecem as ações disponíveis naquele estabelecimento: entrar, comprar, buscar água, procurar emprego ou alugar. Dentro de prédios acessíveis, o personagem continua sob seu controle; sair exige uma ação explícita. Água de margem pode contaminar a garrafa e causar danos ao beber. Candidatar-se usa o processo real de seleção e entrevista da cidade. Trabalhar exige uma ocupação e expediente entre 08h e 17h; remuneração e produção dependem do empregador. Dormir usa sua moradia ou o descanso de rua existente. Banheiros e atendimento médico usam os serviços do mundo.

Agredir uma pessoa exige proximidade. O combate usa ferimentos, reação, testemunhas e consequências legais da simulação. Prisão, inconsciência, rendição e fuga limitam o controle.

## Uma pessoa por vez

A aba **Família** permite assumir um familiar adulto disponível. A pessoa anterior volta à IA. Cada familiar mantém patrimônio, necessidades e relações. Se o personagem morrer, escolha um familiar sobrevivente ou retorne à simulação.

**Simulação** devolve a autonomia ao personagem e restaura a interface de gestão. O estado de controle acompanha os snapshots existentes da cidade.

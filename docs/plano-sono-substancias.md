# Plano de implementação: sono, substâncias e política pública

## Premissas

- Simulação ficcional econômica, cultural e educacional do pseudo-Caribe latino-americano.
- Os coeficientes de efeito e dano são regras de jogo, não informações médicas.
- As receitas de refinamento são abstratas: insumos, tempo, habilidade, custo e rendimento, sem processos químicos reais.
- Estoques, dinheiro e trabalho devem passar pelas estruturas existentes. Religião fica fora desta expansão.

## 1. Sono contínuo

- [x] Registrar início, minutos efetivamente dormidos, interrupção e término de cada período de sono.
- [x] Buscar um bloco de 480 minutos, em casa ou no abrigo de rua; energia cheia não encerra antecipadamente.
- [x] Remover o cochilo como ocupação ociosa e impedir que trabalho, reuniões ou lazer interrompam o sono normal.
- [x] Permitir interrupção por emergência real, custódia, combate ou perda do abrigo; retomar a dívida restante.
- [x] Separar energia temporária de estimulantes da necessidade de dormir.

## 2. Catálogo e produção

- [x] Criar café, álcool, tabaco, cannabis, folha de coca, coca refinada e cânhamo como mercadorias distintas.
- [x] Culturas: café, cana, tabaco, cannabis/cânhamo e coca. Tabaco tem ciclo menor e rendimento maior que cannabis.
- [x] Cannabis gera dois produtos com regras próprias: fibra de cânhamo e cannabis; fibra integra a cadeia têxtil.
- [x] Processamento: torrefação/preparo de café, bebidas alcoólicas, beneficiamento/embalagem compartilhado de tabaco e cannabis, laboratório legal de refinamento quando autorizado.
- [x] Produção usa estoques reais, trabalhadores, salários, habilidade, capacidade, logística e demanda.
- [x] Não incluir culturas de substâncias automaticamente nos cardápios alimentares.

## 3. Qualidade e lotes

- [x] Qualidade inicial depende de agricultura; preparo/refinamento depende de habilidade culinária/processamento e dos insumos.
- [x] Rastrear quantidade e qualidade dos lotes nas transferências e no consumo; preservar balanço material.
- [x] Produtos ruins satisfazem menos e causam mais dano; produção clandestina doméstica tem teto de qualidade baixo.

## 4. Consumo, efeitos e dependência

- [x] Preferências individuais e propensão inicial na ordem café > álcool > folha > tabaco > cannabis > coca refinada.
- [x] Dependência crescente: folha < cannabis < café < álcool < tabaco < coca refinada; tolerância, abstinência e recuperação gradual.
- [x] Álcool: felicidade, sociabilidade e comunicação temporárias; agressividade e perda de capacidade cognitiva.
- [x] Tabaco: felicidade breve e dano pulmonar base de 0,001 por uso.
- [x] Café: paladar controla satisfação; energia temporária, sem quitar sono.
- [x] Cannabis: felicidade, lentidão, fome acelerada, agressividade mínima/fuga e dano pulmonar de 0,0005.
- [x] Folha de coca: felicidade e energia leves.
- [x] Coca refinada: energia/euforia/velocidade/agressividade altas, fala prejudicada e dano pulmonar de 0,005.
- [x] Aplicar modificadores transitórios sem alterar permanentemente habilidades e traços naturais.
- [x] Consumo físico respeita idade adulta, dinheiro, estoque, capacidade, deslocamento e intervalo entre usos.

## 5. Leis e licenças

- [x] Três regimes por substância: proibido, regulamentado, livre.
- [x] Início: café/álcool/tabaco livres; folha regulamentada; coca refinada proibida. Cannabis/cânhamo regulamentados inicialmente.
- [x] No regime regulamentado, agricultor apresenta pedido formal por cultivo à prefeitura; aprovação/recusa fica registrada.
- [x] Câmara vota regime e limite pessoal separadamente por produto. Cânhamo nunca recebe teto de porte.
- [x] Porte de folha começa abaixo do insumo abstrato necessário para um lote refinado.
- [x] Regras de porte pessoal distinguem carga comercial licenciada e contrabando; aplicar mudanças futuras sem condenar retroativamente.

## 6. Política, eleitorado e campanhas

- [x] Proibicionismo é eixo próprio, influenciado por liberdade, economia, autoridade, experiências e uso/dependência.
- [x] Coca refinada começa fortemente rejeitada pela maioria; usuários e alguns grupos libertários/extremos podem discordar.
- [x] Vereadores propõem e votam leis por substância; opinião pública reage e candidatos/debates apresentam essas posições.

## 7. Mercado clandestino e fiscalização

- [x] Refinamento doméstico abstrato consome folhas e recursos, demanda tempo e gera pouco produto de qualidade baixa.
- [x] Cultivo indoor caro/lento e de baixo rendimento quando canais agrícolas legais estão bloqueados; pode alimentar dependentes.
- [x] Agricultor pode descartar a fração proibida da cannabis ou ocultá-la para venda clandestina; decisões dependem de traços e risco.
- [x] Negócios ilegais priorizam a noite e encontros presenciais; sem teletransporte de mercadoria ou fiscalização onisciente.
- [x] Polícia precisa encontrar suspeito/estoque/atividade para registrar provas e apreensão; caso segue investigação, julgamento, prisão e pena existentes.
- [x] Tipificar porte irregular, cultivo sem licença, produção clandestina e tráfico; não confundir usuário com traficante automaticamente.

## 8. UI, persistência e integração

- [x] Painel de substâncias com leis, limites, produção, licenças e histórico; propostas na Câmara.
- [x] Ficha individual com sono, preferência, efeitos, dependência, abstinência, pulmões e inventário/qualidade.
- [x] Balões e ícones identificam cada produto durante o uso; o painel mostra efeitos ativos e tempo restante.
- [x] Fumaça de tabaco, cannabis e coca aparece no ponto de consumo com textura dither pontilhada e expira após alguns instantes.
- [x] Edifícios produtivos no catálogo e comércio; diagnóstico claro para produção bloqueada por lei/licença.
- [x] Registrar novos sistemas no transporte de estado/worker e migrar salvamentos sem valores indefinidos.
- [x] Atualizar versões de módulos/import maps e os pontos reais de inicialização.

## 9. Verificação

- [x] Regressões de sono: 480 minutos, interrupção, retomada, fim por duração e ausência de cochilos recorrentes.
- [x] Comparar ordens de propensão/dependência e danos pulmonares; efeitos expiram e habilidades naturais ficam intactas.
- [x] Exercitar cadeia de lotes, licença, limite de folha, cânhamo sem limite e mudanças de regime.
- [x] Exercitar apreensão com evidência, crime atual, comércio noturno, refinamento doméstico e autorização de laboratório.
- [x] Rodar testes pertinentes de economia, rotina, justiça e sincronização, além de verificação de sintaxe e diff.

## Acompanhamento

Implementado. Correção posterior do renderer: a pose de sono agora usa estado ativo e posição no ponto de descanso, em vez de comparar um texto de ação que mudou; isso cobre os modelos 3D e o fallback de sprites, na rua e nos quartos. Verificação atual: `node --test tests/citizen_models.test.mjs tests/substances_sleep.test.mjs tests/homeless_sleep_relocation.test.mjs tests/justice_custody.test.mjs tests/compact_state_sync.test.mjs` (50/50); regressões direcionadas de rotina em `tests/basic_needs_recovery.test.mjs` (7/7); `node --check` e `git diff --check` passaram. O conjunto de testes de animação também cobre deslocamento, trabalho no local, bicicleta, interiores e a pose horizontal. A fumaça foi exercitada com um runtime Three.js simulado; não houve prévia visual em navegador.

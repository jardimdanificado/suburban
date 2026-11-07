import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(f,'utf8');
const ui=read('js/city_ui.js');
const literal=(s,re)=>vm.runInNewContext('('+s.match(re)[1]+')');
const modules=literal(read('js/city_desktop.js'),/CITY_WINDOWS=(\[.*?\]);/s);
const views=literal(ui,/export const VIEWS = (\{.*?\n\});/s);
const politics=literal(read('js/city_ui_sections.js'),/POLITICS_SECTIONS=(\[.*?\]);/s);
const rows=[];
function add(group,id,title,path,note=''){rows.push({id,group,title,path,note});}
function tabs(group,prefix,path,labels,note=''){labels.forEach((label,i)=>add(group,prefix+'/'+i,label,path+' → '+label,note));}
for(const [id,label] of modules){add(label,id,label+' · janela','Barra superior → '+label,'Em telas estreitas, use a lista completa de ferramentas.');for(const [view,title] of views[id]||[])add(label,id+'/'+view,title,'Barra superior → '+label+' → '+title);}
const p='Barra superior → Governo → Política';
for(const [id,label] of politics)add('Política','politics/'+id,label,p+' → '+label,'Use o grupo correspondente: Gestão, Instituições, Regulação, Eleições ou Fiscalização.');
tabs('Política','approval',p+' → Gestão → Avaliação',['Resumo','Desde a posse','Promessa','Condições e penalidades']);
tabs('Política','mandate',p+' → Gestão → Promessas → selecionar gestão',['Meta e resultado','Indicadores','Medições','Acontecimentos']);
tabs('Política','council',p+' → Instituições → Câmara',['Projetos','Vereadores','Ordens diretas']);
tabs('Política','research',p+' → Instituições → Institutos de pesquisa',['Institutos','Pesquisas não eleitorais']);
const person='Cidadãos → clicar em uma pessoa (ou selecionar no mapa / Busca geral)';
add('Ficha de cidadão','person','Ficha de cidadão · janela',person);
tabs('Ficha de cidadão','person',person,['Perfil','Roupas','Identidade','Alimentação','Veículos','Cores','Trabalho','Currículo','Vínculos','Memórias','Política','Conta','Histórico']);
tabs('Ficha de cidadão','memories',person+' → Memórias',['Recordações','Histórias ouvidas','Luto']);
const building='Imóveis ou Empresas → clicar em um registro (ou selecionar prédio no mapa)';
add('Ficha de imóvel / empresa','building','Ficha de imóvel / empresa · janela',building);
tabs('Ficha de imóvel / empresa','building',building,['Operação','Análise','Estoque','Equipe','Finanças','Estrutura','Pintura','Células','Histórico']);
add('Ficha de imóvel / empresa','building/services','Serviços',building+' → Serviços','Disponível para construtoras e serviços de pavimentação/manutenção viária.');
add('Ficha de imóvel / empresa','building/unit','Ficha de célula / cômodo',building+' → Células → selecionar célula');
const special=[
['Terrenos e obras','plot','Ficha do terreno','Terrenos e obras → Terrenos → clicar em um lote'],
['Política','party','Ficha de partido',p+' → Instituições → Partidos → clicar no partido'],
['Política','contract','Ficha de contrato','Governo → Contratos → clicar no contrato'],
['Política','bill','Projeto de lei e votação',p+' → Instituições → Câmara → Projetos → clicar no projeto'],
['Política','study','Coleta / relatório de pesquisa',p+' → Instituições → Institutos de pesquisa → selecionar coleta'],
['Política','response','Resposta individual à pesquisa',p+' → Eleições → Pesquisas → selecionar pesquisa → entrevistado'],
['Política','foundation','Proposta de fundação partidária',p+' → Instituições → Partidos → Registros e fundações → selecionar proposta'],
['Transportes','vehicle','Ficha de veículo','Transportes → Frota → clicar no veículo'],
['Transportes','shipment','Ficha de frete','Transportes → Fretes ou Encerrados → clicar no frete'],
['Cidade','plant','Ficha botânica','Cidade → Vegetação → clicar na planta'],
['Arte urbana','artwork','Ficha da obra de arte','Arte urbana → Obras e mensagens → selecionar obra ou selecionar no mapa'],
['Justiça','case','Detalhe do processo','Justiça → Processos → clicar no processo'],
['Mercado e riquezas','account','Detalhe de patrimônio / conta','Mercado e riquezas → Pessoas ou Empresas → clicar em um titular'],
['Mercado e riquezas','location','Detalhe de localização','Mercado e riquezas → Localizações → clicar em um local'],
['Mercado e riquezas','good','Detalhe de produto','Mercado e riquezas → Mercado → clicar em um produto'],
['Mercado e riquezas','sale','Detalhe de venda','Mercado e riquezas → Vendas → clicar em uma venda'],
['Empresas','employment','Seleção / candidatura','Empresas → Vagas ou Seleções → selecionar empresa e candidato']
];special.forEach(([g,id,t,p])=>add(g,'detail/'+id,t,p,'Exige um registro correspondente na cidade; avalie um exemplar representativo.'));
tabs('Política','organization',p+' → Instituições → Partidos',['Registros e fundações','Campanhas de filiação']);
tabs('Eleições','election','Governo → Política → Eleições → Resultados → abrir eleição',['Campanhas','Apoios / coligações','Todas as pesquisas','Apuração','Resultado'],'Também pode abrir automaticamente durante o ciclo eleitoral. É preciso haver eleição registrada.');
tabs('Eleições','election-detail','Janela da eleição → Apuração ou Resultado',['Contagem','Vereadores','Votos individuais','Comparecimento']);
tabs('Histórico','event','Histórico → clicar em um evento',['Resumo','Detalhes','Linha do tempo']);
tabs('Corrupção','corruption-case','Corrupção → clicar em um caso',['Esquema','Dinheiro','Investigação'],'Exige caso registrado.');
tabs('Jornais e livros','publications','Jornais e livros',['Acervo','Jornal oficial']);
tabs('Jornais e livros','document','Jornais e livros → Acervo → selecionar exemplar',['Conteúdo','Escrever'],'Exige publicação disponível.');
tabs('Produção','demand','Produção → Demandas',['Oportunidades','Preços','Acordos','Cadeias produtivas']);
tabs('Produção','stock','Produção → Estoques',['Todos','Com estoque','Sem estoque']);
tabs('Terrenos e obras','project','Terrenos e obras → Obras',['Em andamento','Bloqueadas','Encerradas']);
add('Governo','identity','Identidade visual municipal','Governo → Prefeitura → expandir Identidade visual municipal');
tabs('Ferramentas e estrutura','options','Ferramentas → Opções',['Gráficos','Efeitos visuais','Tempo']);
tabs('Ferramentas e estrutura','editor','Ferramentas → Editor de mapa',['Terreno','Objetos']);
for(const [id,title,path] of [['menu','Menu principal','Esc ou Ferramentas → Menu principal'],['newgame','Novo Jogo','Menu principal → Novo Jogo'],['search','Busca geral','Lupa da barra superior ou Ctrl+K (⌘K no macOS)'],['toolbar','Barra superior e lista de ferramentas','Durante a partida → barra superior; reduzir largura para ver a lista completa'],['status','Barra inferior','Durante a partida → rodapé'],['windows','Controles e organização de janelas','Abrir uma janela → mover, redimensionar, fixar, recolher, maximizar; menu Janelas'],['map','Mapa, navegação e seleção','Durante a partida → área do mapa → selecionar entidades; testar 2D / 3D (F3)'],['tools-menu','Menu Ferramentas','Barra superior → Ferramentas'],['windows-menu','Menu Janelas','Barra superior → Janelas']])add('Ferramentas e estrutura','shell/'+id,title,path);
fs.writeFileSync('docs/ui-review/catalog.json',JSON.stringify({date:'2026-11-07',rows},null,2)+'\n');
console.log(rows.length+' itens');
const htmlPath='docs/ui-review/index.html';
if(fs.existsSync(htmlPath))fs.writeFileSync(htmlPath,read(htmlPath).replace(/(<script id="catalog" type="application\/json">)[\s\S]*?(<\/script>)/,(_,start,end)=>start+read('docs/ui-review/catalog.json')+end));

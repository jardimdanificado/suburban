// Cores extraídas de bandeiras reais; agrupadas por família cromática.
// Fonte e método documentados em docs/cores-bandeiras-reais.md.
export const CORES_BANDEIRAS_POR_FAMILIA = Object.freeze({
  'Vermelho': Object.freeze([
    '#862633', '#951b1d', '#953220', '#9d2235', '#a50a0a', '#a51931', '#a6192e', '#a70000', '#aa0000', '#aa241e',
    '#ab1e2b', '#ad1519', '#ae1c28', '#b10c0c', '#b22234', '#b50000', '#b7312c', '#ba1f3e', '#bb0000', '#bc715f',
    '#bd0728', '#bd1021', '#be3a34', '#c01500', '#c10000', '#c40308', '#c4111b', '#c52126', '#c60b1e', '#c60c30',
    '#c62139', '#c6262c', '#c81010', '#c8102e', '#ca6b5b', '#cc0000', '#cc092f', '#cd202a', '#cd212a', '#cd2e3a',
    '#ce1021', '#ce1124', '#ce1126', '#ce2939', '#cf1126', '#cf142b', '#cf2027', '#d00c33', '#d01c1f', '#d20014',
    '#d21034', '#d22730', '#d32011', '#d40000', '#d41c30', '#d52b1e', '#d62612', '#d62828', '#d7141a', '#d82126',
    '#d90000', '#d90012', '#d90f19', '#d91023', '#da0000', '#da000c', '#da0e15', '#da121a', '#da2032', '#da251d',
    '#da291c', '#db161b', '#db4446', '#dc143c', '#dc171d', '#dc241f', '#dd0000', '#de2010', '#de2126', '#df112d',
    '#e00025', '#e03c31', '#e1261c', '#e30a17', '#e31b23', '#e32118', '#e4002b', '#e60000', '#e70013', '#e80000',
    '#e8112d', '#e92736', '#ea2839', '#ec1920', '#ed1c24', '#ed1c27', '#ed2939', '#ee1c25', '#ee2737', '#ef2b2d',
    '#ef3340', '#f15770', '#f42a41', '#fa0204', '#fc3d32', '#fe0000', '#ff0000', '#ff0016', '#ff0500', '#ff0b00',
    '#ff1100', '#ff1800', '#ff1e00', '#ff2500', '#ff2a2a', '#ff2d00', '#ff3300', '#ff3a3a',
  ]),
  'Vinho e bordô': Object.freeze([
    '#080101', '#280b0b', '#351710', '#4c0505', '#510000', '#550000', '#630810', '#653024', '#7a2e26', '#842116',
    '#870f00', '#8a0000', '#910000',
  ]),
  'Rosa': Object.freeze([
    '#511124', '#8d153a', '#8d1b3d', '#a60032', '#ba0c2f', '#bc002d', '#bf0a30', '#d0103a', '#d50032', '#e40046',
    '#ed72aa', '#f1b2dc', '#ffa1a1', '#ffc6b8', '#ffd3c9', '#ffd6cc', '#ffded6', '#ffe0d9', '#ffe2dc',
  ]),
  'Salmão e coral': Object.freeze([
    '#d9c0b9', '#dec7b7', '#efc9b2', '#ffb399', '#ffb39c', '#ffb59c', '#ffb59e', '#ffb8a0', '#ffb9a2', '#ffb9a6',
    '#ffbca6', '#ffbca8', '#ffbeab', '#ffbead', '#ffc2ad', '#ffc2af', '#ffc5b3', '#ffc6b5', '#ffc9b8', '#ffc9b9',
    '#ffccbc', '#ffcfbe', '#ffcfc2', '#ffd1c2', '#ffd1c5', '#ffd3c6', '#ffd6c9', '#ffd9cf', '#ffdcd1', '#ffdcd3',
    '#ffded3', '#ffe1cf', '#ffe6d9',
  ]),
  'Laranja': Object.freeze([
    '#96877d', '#a37853', '#aa5323', '#ab612e', '#ab6d29', '#ad7c59', '#ad7d5a', '#ae4c33', '#af7029', '#b27129',
    '#b68a6a', '#b96b29', '#bd8759', '#c16b13', '#c27e50', '#c47645', '#c99472', '#d05f01', '#d0a386', '#d39044',
    '#d67c59', '#d6b39d', '#d7b5a0', '#dba05f', '#dd8b59', '#e05206', '#e57200', '#e6ab87', '#e96a01', '#eb7400',
    '#ef7d00', '#f16e16', '#f4ac64', '#f77f00', '#f9aa51', '#fcad56', '#ff3900', '#ff3e00', '#ff4500', '#ff4b00',
    '#ff4e12', '#ff5500', '#ff5600', '#ff6000', '#ff6600', '#ff6b00', '#ff7000', '#ff7500', '#ff7c00', '#ff8200',
    '#ff8600', '#ff9933',
  ]),
  'Laranja e âmbar': Object.freeze([
    '#999270', '#a48b58', '#bf802d', '#c69024', '#c7b37f', '#c98c26', '#cb8e32', '#cdad56', '#cea849', '#d0a650',
    '#d18219', '#d2a567', '#d3ae3b', '#d4af37', '#d4af3a', '#dba35a', '#dbad6c', '#dca842', '#e2a950', '#e2b269',
    '#e4cb5e', '#e5be01', '#e6ba74', '#e6c74d', '#e8b909', '#e98e01', '#e9b001', '#e9be79', '#eaaa00', '#eac102',
    '#eed3a6', '#f1a720', '#f1b517', '#f1b617', '#f1c400', '#f2a800', '#f2d196', '#f4c53d', '#f6b40e', '#f6e078',
    '#f7d116', '#f8c300', '#f8c83c', '#f9b60f', '#f9c83a', '#f9cf02', '#f9d050', '#fab81c', '#faecbd', '#fbd116',
    '#fbd55f', '#fcca3d', '#fcca3e', '#fcd022', '#fcd116', '#fcd856', '#fcf3d8', '#fdce12', '#fdeaaf', '#fec413',
    '#fec50c', '#fec618', '#fecb00', '#fecc00', '#fecf3e', '#fed100', '#fed65b', '#fedf82', '#ff9100', '#ff9900',
    '#ff9a08', '#ff9c00', '#ff9c10', '#ffa600', '#ffaf00', '#ffb81c', '#ffb900', '#ffbb00', '#ffbe29', '#ffc221',
    '#ffc400', '#ffc500', '#ffc61e', '#ffc639', '#ffc726', '#ffc72c', '#ffc900', '#ffcb00', '#ffcc00', '#ffcd00',
    '#ffce00', '#ffcf00', '#ffd100', '#ffd200', '#ffd300', '#ffd520', '#ffd691', '#ffd83d', '#ffde52', '#ffdf4f',
    '#ffe682',
  ]),
  'Amarelo e dourado': Object.freeze([
    '#404118', '#717732', '#78732e', '#9ca168', '#9eab05', '#a8ac71', '#b2aa00', '#c6c7a6', '#c6cb24', '#c8b100',
    '#c8d700', '#cab313', '#cccc33', '#ccd11e', '#d6ff00', '#d9c753', '#e6e600', '#e7ca00', '#ebc900', '#ebff00',
    '#ede71f', '#f0e53c', '#f4cf0e', '#f5ce00', '#f5f549', '#f7d618', '#f7e017', '#f7e204', '#f8d000', '#f8d80e',
    '#f8e92e', '#f9d90f', '#f9dd16', '#f9e814', '#f9f0aa', '#fad201', '#fae042', '#fbde4a', '#fcd900', '#fcdc04',
    '#fcdd09', '#fce100', '#fcea83', '#fde300', '#fdef42', '#fedb00', '#fedd00', '#fedf00', '#ffd500', '#ffd600',
    '#ffd700', '#ffd900', '#ffdd00', '#ffdf00', '#ffe000', '#ffe500', '#ffe600', '#ffeb00', '#fff500', '#fff700',
    '#ffff00',
  ]),
  'Verde-limão': Object.freeze([
    '#21231e', '#4e5b31', '#62a70f', '#6d8c3e', '#74b500', '#75b52b', '#76bc21', '#789d4a', '#93bc30', '#97c924',
    '#98b432', '#99ff00', '#9ecb34', '#adff00', '#c2ff00',
  ]),
  'Verde': Object.freeze([
    '#003300', '#004b00', '#005000', '#006129', '#006233', '#006300', '#006341', '#006400', '#006600', '#006b00',
    '#006b3f', '#006c35', '#006c3c', '#006d00', '#00702d', '#00713d', '#007229', '#007300', '#007638', '#007749',
    '#007934', '#007935', '#007a33', '#007a36', '#007a3d', '#007c2e', '#007e3a', '#008000', '#008021', '#00843d',
    '#00853f', '#00863d', '#00873f', '#008751', '#008830', '#008c45', '#008f4c', '#009460', '#009543', '#009739',
    '#009900', '#009a3b', '#009a44', '#009b3a', '#009c4f', '#009e49', '#009e60', '#00a551', '#00a651', '#00a854',
    '#00a95c', '#00ab39', '#00ad50', '#00b300', '#00ff00', '#01411c', '#016a16', '#024919', '#034418', '#046a38',
    '#059334', '#075400', '#078930', '#0db02b', '#109421', '#128807', '#12ad2b', '#14b53a', '#16d38f', '#198a00',
    '#1b402f', '#1c8a42', '#1cde6f', '#1eb53a', '#20603d', '#20e653', '#215b33', '#239e46', '#239f40', '#24420e',
    '#289728', '#28ed38', '#294814', '#2c5234', '#2df81c', '#2f3b30', '#2f8f22', '#306947', '#316d3a', '#337321',
    '#338a00', '#339e35', '#33ff00', '#34541f', '#34b233', '#358b03', '#369443', '#39b54a', '#3a7728', '#3d6c1e',
    '#3d8e33', '#3e9a00', '#3ec26d', '#3f9c35', '#406325', '#43b02a', '#448127', '#46ff00', '#477050', '#4a783c',
    '#509164', '#5ac800', '#5cff00', '#66ff66', '#67923d', '#6dbe45', '#6fff00', '#85ff00', '#ddeecc',
  ]),
  'Turquesa': Object.freeze([
    '#00493d', '#00534e', '#006847', '#006a4e', '#007168', '#00785e', '#007a5e', '#00966e', '#00ccb3', '#016848',
    '#04534e', '#058e6e', '#09c5c6', '#0c8489', '#11ccab', '#485654', '#8cbebf',
  ]),
  'Ciano': Object.freeze([
    '#006aa7', '#0075af', '#00778b', '#0077b0', '#0079c7', '#007db5', '#007ea8', '#0081c6', '#0088e8', '#008ce7',
    '#0096ff', '#0099b5', '#0099ff', '#009cde', '#009eff', '#00a0e1', '#00a1de', '#00a2bd', '#00a3dd', '#00a3e0',
    '#00a8ff', '#00afca', '#00b3ff', '#00b9e4', '#00ccff', '#05b9e2', '#0872a7', '#17c0eb', '#1ea8d1', '#2c87bc',
    '#30c2dc', '#395054', '#41748d', '#557176', '#62afe1', '#62b5e5', '#64b4d1', '#66ccff', '#69b3e7', '#6da9d2',
    '#75b2dd', '#89c5e3', '#92dbfc', '#9bcbeb', '#9dc9e2',
  ]),
  'Azul': Object.freeze([
    '#000033', '#00004b', '#00004f', '#000051', '#000053', '#000056', '#000058', '#00005c', '#00005e', '#000060',
    '#000062', '#000066', '#000088', '#000095', '#00009e', '#0000ff', '#000268', '#00056b', '#00066d', '#00096f',
    '#000b73', '#000f75', '#001178', '#001379', '#001489', '#00167c', '#00187e', '#0018a8', '#001c82', '#001e85',
    '#00205b', '#002086', '#00209f', '#0021ad', '#002255', '#002289', '#002395', '#00247d', '#00258b', '#002674',
    '#00267f', '#002776', '#002855', '#002868', '#00288f', '#00297b', '#002a8f', '#002b7f', '#002b91', '#002d62',
    '#002d93', '#002f96', '#003082', '#003087', '#0032a0', '#003399', '#0033a0', '#0033a1', '#003580', '#00359c',
    '#003893', '#00389e', '#0038a8', '#0038b8', '#0039a0', '#0039a6', '#0039f0', '#003ca2', '#003da5', '#003ea6',
    '#003f87', '#0042a8', '#0044aa', '#0045ab', '#0046ad', '#0047a0', '#0047ab', '#0049af', '#004bb3', '#0051ba',
    '#0057b7', '#005bbf', '#005ce5', '#005eb8', '#0064ad', '#0065bd', '#0066b3', '#0066ff', '#0067c6', '#006ac8',
    '#006ec7', '#006fff', '#0072c6', '#0072ce', '#0073ce', '#0079ff', '#007fff', '#0082ff', '#008bff', '#012169',
    '#012a87', '#023f88', '#024fa2', '#025cff', '#032ea1', '#034ea2', '#051440', '#054fff', '#0645ff', '#072b5f',
    '#073163', '#083d9c', '#0938ff', '#0a328c', '#0b4ea2', '#0b50a0', '#0c1c8c', '#0d3b99', '#0d5eaf', '#0f2dff',
    '#0f47af', '#1120ff', '#11457e', '#1316ff', '#1609ff', '#162667', '#171696', '#1800ff', '#183070', '#1a206d',
    '#1c242f', '#1d5e91', '#1e5aa6', '#21468b', '#244aa5', '#2a7fff', '#2b96f6', '#2d2a4a', '#3a75c4', '#3c3b6e',
    '#3d5da7', '#3e5eb9', '#4189dd', '#418fde', '#4997d0', '#4f91c5', '#5998c6', '#6ab2e7', '#74acdf', '#88b0d5',
    '#99afca', '#99ccff', '#c1d3e8', '#d5dfff',
  ]),
  'Violeta': Object.freeze([
    '#010002', '#9461c9',
  ]),
  'Roxo': Object.freeze([
    '#040006', '#800080',
  ]),
  'Magenta': Object.freeze([
    '#5e0043', '#e040af',
  ]),
  'Marrom': Object.freeze([
    '#201b18', '#211915', '#292723', '#2b1100', '#2c1c12', '#2d2926', '#2d2a26', '#2f2311', '#312317', '#442c13',
    '#452c25', '#453717', '#45392d', '#473125', '#4b4139', '#4d2a15', '#512007', '#513625', '#552200', '#5a3719',
    '#5c3818', '#5c3a1d', '#5c5342', '#5e3f17', '#64472d', '#662900', '#6a4c2d', '#6a5e46', '#6c301e', '#6c3f18',
    '#6c4119', '#6f3f1e', '#6f5b24', '#703d29', '#704d25', '#73452b', '#755338', '#784421', '#794d2f', '#7b3100',
    '#7b3c20', '#7b3f00', '#7d5035', '#802000', '#803f1d', '#816c2a', '#825123', '#843511', '#85340a', '#865800',
    '#866d46', '#874f20', '#895f33', '#8b441f', '#8b5122', '#8c4200', '#8f4620', '#8f6a2a', '#904720', '#923f00',
    '#947245', '#977c2e', '#9b7e39', '#9c4a00', '#9c5100', '#9c8431', '#9e540a', '#a08307', '#a0892c', '#a24300',
    '#a2550b', '#a36629', '#a53d08', '#aa8c30', '#ac620e', '#b07229', '#b07e09', '#b76e11', '#b87510', '#c09300',
    '#c75b00', '#c8a400', '#ce9d09', '#d57800',
  ]),
  'Cinza': Object.freeze([
    '#1e2121', '#202020', '#202220', '#231f20', '#272425', '#2b2b2b', '#333333', '#383739', '#474747', '#4d4b4d',
    '#4d4d4d', '#565759', '#574f4c', '#59595b', '#616264', '#656263', '#696161', '#797a7d', '#7e7e7e', '#84848a',
    '#858d8d', '#8a8a8a', '#8a9396', '#8c959d', '#909294', '#939598', '#949699', '#959595', '#999999', '#999b9e',
    '#9ca69c', '#a1a1a1', '#a3a5a8', '#a4a5a8', '#acacac', '#acacad', '#b1b4b3', '#b1babf', '#b2b6ba', '#b3b3b3',
    '#b4b6b9', '#bbbcbc', '#c0cad0', '#c9c9c9', '#cacaca', '#cbcbc9', '#ccb8c8', '#cccccc', '#cccccd', '#cecfcf',
    '#ced0d1', '#d0c9ce', '#d0d0d0', '#d1d0ce', '#d3dce0', '#d4d4d4', '#d5d3ca', '#dcddde', '#e3e4e5', '#e5e5e5',
    '#e8e8e6', '#f9e7d9',
  ]),
  'Branco': Object.freeze([
    '#f1f1f2', '#f4f5f8', '#fdf9ff', '#ffe2de', '#ffe6de', '#ffe6e0', '#ffe8e2', '#ffe8e6', '#ffebe6', '#ffebe8',
    '#ffedeb', '#ffefed', '#ffefef', '#fff3ef', '#fff3f3', '#fffeff', '#ffffff',
  ]),
  'Preto': Object.freeze([
    '#000000', '#171717', '#181818',
  ]),
});

const CORES_BANDEIRAS = Object.freeze(Object.values(CORES_BANDEIRAS_POR_FAMILIA).flat());
const CORES_CONJUNTO = new Set(CORES_BANDEIRAS);
const LUMINANCIAS = new Map(CORES_BANDEIRAS.map(cor => [cor, calcularLuminancia(cor)]));

function limitarUnitario(valor) {
  return Math.max(0, Math.min(0.999999999, Number(valor) || 0));
}

function canalLinear(valor) {
  const canal = valor / 255;
  return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

function calcularLuminancia(hex) {
  const r = canalLinear(parseInt(hex.slice(1, 3), 16));
  const g = canalLinear(parseInt(hex.slice(3, 5), 16));
  const b = canalLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrasteEntreCores(corA, corB) {
  const luminanciaA = LUMINANCIAS.get(corA) ?? calcularLuminancia(corA);
  const luminanciaB = LUMINANCIAS.get(corB) ?? calcularLuminancia(corB);
  const clara = Math.max(luminanciaA, luminanciaB);
  const escura = Math.min(luminanciaA, luminanciaB);
  return (clara + 0.05) / (escura + 0.05);
}

function embaralhar(lista, random) {
  const resultado = [...lista];
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.floor(limitarUnitario(random()) * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }
  return resultado;
}

function gerarBaseComContraste(random, contrasteMinimo, tentativas = 96) {
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    const paleta = [];
    for (const candidata of embaralhar(CORES_BANDEIRAS, random)) {
      if (paleta.every(cor => contrasteEntreCores(cor, candidata) >= contrasteMinimo)) {
        paleta.push(candidata);
        if (paleta.length === 4) return paleta;
      }
    }
  }
  throw new RangeError(`Não foi possível formar uma paleta com contraste mínimo ${contrasteMinimo}.`);
}

function gerarCorAleatoriaExterna(random, outrasCores, contrasteMinimo) {
  for (let tentativa = 0; tentativa < 512; tentativa++) {
    const numero = Math.floor(limitarUnitario(random()) * 0x1000000);
    const cor = `#${numero.toString(16).padStart(6, '0')}`;
    if (CORES_CONJUNTO.has(cor) || outrasCores.includes(cor)) continue;
    if (outrasCores.every(outra => contrasteEntreCores(cor, outra) >= contrasteMinimo)) return cor;
  }
  return null;
}

export function gerarPaletaDeBandeira({
  random = Math.random,
  contrasteMinimo = 2.2,
  chancesDeCorAleatoria = [0.01, 0.02, 0.03, 0.04],
  tentativas = 96,
} = {}) {
  if (typeof random !== 'function') throw new TypeError('random precisa ser uma função.');
  if (!Number.isFinite(contrasteMinimo) || contrasteMinimo < 1) throw new RangeError('contrasteMinimo precisa ser pelo menos 1.');
  if (!Array.isArray(chancesDeCorAleatoria) || chancesDeCorAleatoria.length !== 4 || chancesDeCorAleatoria.some(chance => !Number.isFinite(chance) || chance < 0 || chance > 1)) {
    throw new TypeError('chancesDeCorAleatoria deve conter quatro probabilidades entre 0 e 1.');
  }
  const posicoesAleatorias = chancesDeCorAleatoria.map(chance => limitarUnitario(random()) < chance);
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    const cores = gerarBaseComContraste(random, contrasteMinimo);
    const coresAleatorias = [];
    let falhou = false;
    for (let i = 0; i < 4; i++) {
      if (!posicoesAleatorias[i]) continue;
      const outras = cores.filter((_, indice) => indice !== i);
      const externa = gerarCorAleatoriaExterna(random, outras, contrasteMinimo);
      if (!externa) { falhou = true; break; }
      cores[i] = externa;
      coresAleatorias.push(i);
    }
    if (falhou) continue;
    if (cores.every((cor, i) => cores.slice(i + 1).every(outra => contrasteEntreCores(cor, outra) >= contrasteMinimo))) {
      return { cores, coresAleatorias, contrasteMinimo };
    }
  }
  throw new RangeError('Não foi possível gerar quatro cores com o contraste solicitado.');
}

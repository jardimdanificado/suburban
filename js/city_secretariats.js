export const SECRETARIATS=Object.freeze([
 {id:'finance',name:'Secretaria da Fazenda',short:'Fazenda',skill:'management',duty:'Monitora receitas, despesas e caixa; melhora a recomposição preventiva das reservas municipais a partir dos lucros das estatais.'},
 {id:'foreign_relations',name:'Secretaria das Relações Internacionais',short:'Relações Internacionais',skill:'social',duty:'Coordena acordos, importações, exportações e interlocução com fornecedores externos.'},
 {id:'security',name:'Secretaria de Segurança',short:'Segurança',skill:'investigation',duty:'Coordena efetivo policial, prevenção, investigações e resposta a ocorrências.'},
 {id:'health',name:'Secretaria da Saúde',short:'Saúde',skill:'medicine',duty:'Acompanha hospitais, clínicas, IML, saúde preventiva e necessidades médicas.'},
 {id:'urban_development',name:'Secretaria de Desenvolvimento Urbano',short:'Desenvolvimento Urbano',skill:'construction',duty:'Planeja bairros, pavimentação, terrenos, acessos e expansão urbana.'},
 {id:'social_defense',name:'Secretaria de Defesa Social',short:'Defesa Social',skill:'care',duty:'Coordena benefícios, assistência, moradia e proteção de pessoas vulneráveis.'},
 {id:'education_culture',name:'Secretaria de Educação e Cultura',short:'Educação e Cultura',skill:'social',duty:'Amplia a capacidade das bibliotecas e teatros e incentiva leitura, produção jornalística e criação artística.'},
 {id:'environment',name:'Secretaria da Agricultura e Meio Ambiente',short:'Agricultura e Meio Ambiente',skill:'agriculture',duty:'Apoia a produtividade agrícola, a limpeza urbana, os banheiros públicos, a coleta de resíduos e o controle da poluição.'},
 {id:'transport',name:'Secretaria dos Transportes',short:'Transportes',skill:'logistics',duty:'Propõe regras e incentivos para mobilidade por bicicleta, transporte de cargas e segurança viária.'},
]);
export const SECRETARY_ELECTION_MODES=Object.freeze({appointed:'Nomeação do prefeito',council:'Eleição pela Câmara',direct:'Eleição popular'});
export const SECRETARY_MODE_RANK=Object.freeze({appointed:0,council:1,direct:2});
export const TRANSPORT_POLICIES=Object.freeze({balanced:'Equilíbrio entre os modais',cycling:'Incentivo à bicicleta e à mobilidade leve',freight:'Eficiência do transporte de cargas',safety:'Segurança viária e conservação de vias'});
export function secretarySkillScore(candidate,office){
 const skill=candidate?.skills?.[office?.skill]||0,governance=candidate?.skills?.governance||0,honesty=(candidate?.traits?.honesty??.5)*100;
 return skill*.56+governance*.24+honesty*.20;
}

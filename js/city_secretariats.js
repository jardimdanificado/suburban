export const SECRETARIATS=Object.freeze([
 {id:'finance',name:'Secretaria da Fazenda',short:'Fazenda',skill:'management',duty:'Acompanha receitas, despesas, caixa municipal e continuidade das cadeias produtivas.'},
 {id:'foreign_relations',name:'Secretaria das Relações Internacionais',short:'Relações Internacionais',skill:'social',duty:'Coordena acordos, importações, exportações e interlocução com fornecedores externos.'},
 {id:'security',name:'Secretaria de Segurança',short:'Segurança',skill:'investigation',duty:'Coordena efetivo policial, prevenção, investigações e resposta a ocorrências.'},
 {id:'health',name:'Secretaria da Saúde',short:'Saúde',skill:'medicine',duty:'Acompanha hospitais, clínicas, IML, saúde preventiva e necessidades médicas.'},
 {id:'urban_development',name:'Secretaria de Desenvolvimento Urbano',short:'Desenvolvimento Urbano',skill:'construction',duty:'Planeja bairros, pavimentação, terrenos, acessos e expansão urbana.'},
 {id:'social_defense',name:'Secretaria de Defesa Social',short:'Defesa Social',skill:'care',duty:'Coordena benefícios, assistência, moradia e proteção de pessoas vulneráveis.'},
 {id:'education_culture',name:'Secretaria de Educação e Cultura',short:'Educação e Cultura',skill:'social',duty:'Acompanha educação, bibliotecas, imprensa, pesquisa e vida cultural.'},
 {id:'environment',name:'Secretaria do Meio Ambiente',short:'Meio Ambiente',skill:'agriculture',duty:'Acompanha áreas verdes, água, resíduos, agricultura e impactos ambientais.'},
]);
export const SECRETARY_ELECTION_MODES=Object.freeze({appointed:'Nomeação do prefeito',council:'Eleição pela Câmara',direct:'Eleição popular'});
export const SECRETARY_MODE_RANK=Object.freeze({appointed:0,council:1,direct:2});
export function secretarySkillScore(candidate,office){
 const skill=candidate?.skills?.[office?.skill]||0,governance=candidate?.skills?.governance||0,honesty=(candidate?.traits?.honesty??.5)*100;
 return skill*.56+governance*.24+honesty*.20;
}

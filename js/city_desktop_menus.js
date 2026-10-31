/** Utility menus; management sections are reached through toolbar buttons and tabs. */
export function desktopMenus(d){
  const item=(label,click,extra={})=>({label,click,...extra}),separator={separator:true};
  return [
    {id:'tools',label:'Ferramentas',items:[
      item('Menu principal (Esc)',()=>d.controls.mainMenu?.()),
      separator,
      item('Opções',()=>d.controls.options?.()),
      item('Editor de mapa',()=>d.controls.editor?.()),
      item('Terreno, semente e geração',()=>d.openDestination('government','world')),
      item('Centralizar câmera',()=>d.controls.center?.()),
      separator,
      item('Pausar / continuar',()=>d.controls.pause?.(),{checked:()=>!!d.chromeState?.paused}),
      item('Alterar velocidade',()=>d.controls.speed?.())
    ]},
    {id:'windows',label:'Janelas',items:()=>[
      item('Organizar em cascata',()=>d.manager.cascade()),
      item('Ocultar / mostrar janelas',()=>d.toggle()),
      item('Fechar não fixadas (Del)',()=>d.closeAll()),
      item('Fechar todas (Shift+Del)',()=>d.closeAll(true)),
      separator,
      ...d.manager.windows.map(w=>item(w.title,()=>{d.hidden=false;d.manager.raise(w.id);if(w.shaded)d.manager.shade(w.id);},{checked:()=>d.manager.activeId===w.id}))
    ]}
  ];
}

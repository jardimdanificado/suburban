const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const amounts=new Map();
/** Currency formatters and frequently repeated amounts are shared by every window. */
export function formatMoney(value){
  const amount=Number(value)||0;
  if(amounts.has(amount))return amounts.get(amount);
  const text=currency.format(amount/100);if(amounts.size>=1024)amounts.delete(amounts.keys().next().value);amounts.set(amount,text);return text;
}

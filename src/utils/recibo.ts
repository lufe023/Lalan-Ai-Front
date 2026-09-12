/**
 * Impresión de recibos en térmica / matricial.
 *
 * No usamos ESC/POS ni drivers: armamos el recibo como HTML monoespaciado
 * con el ancho exacto del papel y lo mandamos al diálogo de impresión del
 * navegador. Eso funciona con CUALQUIER impresora instalada en Windows —
 * térmica de 58mm, de 80mm o una matricial vieja — sin pedirle al salón que
 * instale nada ni que el sistema hable con el puerto serie.
 *
 * El iframe es oculto y se destruye al terminar: no abre ventanas emergentes
 * que el navegador pueda bloquear.
 */

export interface ReciboOpts {
  anchoMm?: number;      // 58 u 80
  salon?: string;
  direccion?: string;
  telefono?: string;
  rnc?: string;
  pie?: string;
  simbolo?: string;
  copia?: boolean;       // true = reimpresión
}

const esc = (t: any) =>
  String(t ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

const money = (n: any, sim = '') =>
  `${Number(n ?? 0).toFixed(2)}${sim ? ` ${sim}` : ''}`;

const METODOS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro',
};

export function construirRecibo(venta: any, o: ReciboOpts = {}): string {
  const ancho = o.anchoMm ?? 80;
  const sim = o.simbolo ?? '';
  // 58mm de papel imprime ~32 caracteres; 80mm ~48. Lo usamos para las líneas
  // de guiones, que son lo único que se ve feo si el ancho no cuadra.
  const cols = ancho <= 58 ? 32 : 48;
  const regla = '-'.repeat(cols);

  const fecha = new Date(venta?.closedAt ?? venta?.openedAt ?? Date.now());
  const items: any[] = venta?.items ?? [];
  const pagos: any[] = venta?.payments ?? [];

  const filas = items.map(it => {
    const cant = Number(it.quantity ?? 1);
    const gratis = Number(it.lineTotal) === 0;
    const nota = (it.notes ?? '').toLowerCase().includes('pagado');
    return `<tr>
      <td class="c">${cant > 1 ? cant + 'x' : ''}</td>
      <td class="d">${esc(it.label)}${
        nota ? '<br><span class="mini">pagado en línea</span>'
        : gratis ? '<br><span class="mini">cortesía</span>' : ''
      }${
        it.discountPercent ? `<br><span class="mini">−${Number(it.discountPercent).toFixed(0)}%</span>` : ''
      }</td>
      <td class="m">${Number(it.lineTotal ?? 0).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const filasPago = pagos.map(p => {
    const extra = p.receivedCurrency && Number(p.exchangeRate) !== 1
      ? ` (${Number(p.receivedAmount).toFixed(2)} ${p.receivedCurrency} @ ${Number(p.exchangeRate).toFixed(2)})`
      : '';
    return `<div class="row"><span>${esc(METODOS[p.method] ?? p.method)}${esc(extra)}</span>
      <span>${Number(p.amount ?? 0).toFixed(2)}</span></div>`;
  }).join('');

  const vueltoTotal = pagos.reduce((s, p) => s + Number(p.changeGiven ?? 0), 0);
  const propinaTotal = pagos.reduce((s, p) => s + Number(p.tip ?? 0), 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Recibo</title>
<style>
  @page { size: ${ancho}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 3mm;
    width: ${ancho}mm;
    font-family: "Courier New", ui-monospace, monospace;
    font-size: ${ancho <= 58 ? 10 : 11}px;
    line-height: 1.35; color: #000; background: #fff;
  }
  .ctr { text-align: center; }
  .b { font-weight: bold; }
  .big { font-size: ${ancho <= 58 ? 13 : 15}px; font-weight: bold; }
  .mini { font-size: ${ancho <= 58 ? 8 : 9}px; }
  .regla { white-space: pre; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  td.c { width: 8%; }
  td.m { width: 26%; text-align: right; white-space: nowrap; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .tot { font-size: ${ancho <= 58 ? 12 : 14}px; font-weight: bold; }
</style></head><body>
  <div class="ctr big">${esc(o.salon ?? 'Recibo')}</div>
  ${o.direccion ? `<div class="ctr mini">${esc(o.direccion)}</div>` : ''}
  ${o.telefono ? `<div class="ctr mini">Tel. ${esc(o.telefono)}</div>` : ''}
  ${o.rnc ? `<div class="ctr mini">RNC ${esc(o.rnc)}</div>` : ''}
  ${o.copia ? '<div class="ctr b">** COPIA **</div>' : ''}
  <div class="regla">${regla}</div>
  <div class="row mini"><span>${fecha.toLocaleDateString('es')}</span><span>${fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="mini">Recibo ${esc(String(venta?.id ?? '').slice(-8).toUpperCase())}</div>
  <div class="mini">Cliente: ${esc(venta?.clientName ?? venta?.label ?? 'Mostrador')}</div>
  ${venta?.priceList && !venta.priceList.isDefault ? `<div class="mini">Tarifa: ${esc(venta.priceList.name)}</div>` : ''}
  <div class="regla">${regla}</div>
  <table>${filas}</table>
  <div class="regla">${regla}</div>
  ${Number(venta?.discountTotal) > 0
    ? `<div class="row"><span>Ahorró</span><span>${Number(venta.discountTotal).toFixed(2)}</span></div>` : ''}
  <div class="row tot"><span>TOTAL</span><span>${money(venta?.total, sim)}</span></div>
  ${filasPago}
  ${propinaTotal > 0 ? `<div class="row"><span>Propina</span><span>${propinaTotal.toFixed(2)}</span></div>` : ''}
  ${vueltoTotal > 0 ? `<div class="row b"><span>Devuelta</span><span>${money(vueltoTotal, sim)}</span></div>` : ''}
  <div class="regla">${regla}</div>
  <div class="ctr mini">${esc(o.pie ?? '¡Gracias por tu visita!')}</div>
  <div style="height:8mm"></div>
</body></html>`;
}

/** Arma el recibo y abre el diálogo de impresión, sin ventanas emergentes */
export function imprimirRecibo(venta: any, o: ReciboOpts = {}) {
  const html = construirRecibo(venta, o);

  const marco = document.createElement('iframe');
  marco.style.position = 'fixed';
  marco.style.right = '0';
  marco.style.bottom = '0';
  marco.style.width = '0';
  marco.style.height = '0';
  marco.style.border = '0';
  document.body.appendChild(marco);

  const doc = marco.contentWindow?.document;
  if (!doc) { marco.remove(); return; }

  doc.open();
  doc.write(html);
  doc.close();

  // Damos un respiro al render antes de imprimir: sin esto, Chrome a veces
  // manda la hoja en blanco.
  const lanzar = () => {
    try {
      marco.contentWindow?.focus();
      marco.contentWindow?.print();
    } finally {
      // El diálogo es modal: cuando vuelve el control, ya se puede limpiar
      setTimeout(() => marco.remove(), 1000);
    }
  };

  if (doc.readyState === 'complete') setTimeout(lanzar, 120);
  else marco.onload = () => setTimeout(lanzar, 120);
}

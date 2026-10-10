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

export type BloqueRecibo =
  | 'salon' | 'sede' | 'direccion' | 'telefono' | 'rnc'
  | 'fecha' | 'numero' | 'cliente' | 'tarifa'
  | 'detalle' | 'totales' | 'pie';

/** El diseño del salón: qué partes lleva el recibo, en qué orden y cómo se alinean */
export interface DisenoRecibo {
  anchoMm: 58 | 80;
  pie: string;
  rnc: string;
  bloques: { id: BloqueRecibo; visible: boolean; alinear: 'izq' | 'centro' | 'der'; raya: boolean }[];
}

/** Cómo salía el recibo antes del diseñador */
export const DISENO_BASE: DisenoRecibo = {
  anchoMm: 80,
  pie: '¡Gracias por tu visita!',
  rnc: '',
  bloques: [
    { id: 'salon', visible: true, alinear: 'centro', raya: false },
    { id: 'sede', visible: true, alinear: 'centro', raya: false },
    { id: 'direccion', visible: true, alinear: 'centro', raya: false },
    { id: 'telefono', visible: true, alinear: 'centro', raya: false },
    { id: 'rnc', visible: true, alinear: 'centro', raya: true },
    { id: 'fecha', visible: true, alinear: 'izq', raya: false },
    { id: 'numero', visible: true, alinear: 'izq', raya: false },
    { id: 'cliente', visible: true, alinear: 'izq', raya: false },
    { id: 'tarifa', visible: true, alinear: 'izq', raya: true },
    { id: 'detalle', visible: true, alinear: 'izq', raya: true },
    { id: 'totales', visible: true, alinear: 'izq', raya: true },
    { id: 'pie', visible: true, alinear: 'centro', raya: false },
  ],
};

export const NOMBRE_BLOQUE: Record<BloqueRecibo, string> = {
  salon: 'Nombre del salón', sede: 'Nombre de la sede', direccion: 'Dirección de la sede',
  telefono: 'Teléfono de la sede', rnc: 'RNC', fecha: 'Fecha y hora', numero: 'Número de recibo',
  cliente: 'Cliente', tarifa: 'Tarifa', detalle: 'Lo que se cobró', totales: 'Total y pagos', pie: 'Pie del recibo',
};

export interface ReciboOpts {
  anchoMm?: number;      // 58 u 80
  salon?: string;
  /** La sede donde se cobró; solo se imprime si el salón tiene varias */
  sede?: string;
  diseno?: DisenoRecibo;
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
  const ancho = o.anchoMm ?? o.diseno?.anchoMm ?? 80;
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

  const rayaHtml = `<div class="regla">${regla}</div>`;
  const hora = fecha.toLocaleTimeString('es', { hour: 'numeric', hour12: true, minute: '2-digit' });
  const rnc = o.rnc ?? o.diseno?.rnc ?? '';
  const pie = o.pie ?? o.diseno?.pie ?? '¡Gracias por tu visita!';
  const partes: Record<BloqueRecibo, () => string> = {
    salon: () => `<div class="big">${esc(o.salon ?? 'Recibo')}</div>`,
    sede: () => o.sede ? `<div class="b">${esc(o.sede)}</div>` : '',
    direccion: () => o.direccion ? `<div class="mini">${esc(o.direccion)}</div>` : '',
    telefono: () => o.telefono ? `<div class="mini">Tel. ${esc(o.telefono)}</div>` : '',
    rnc: () => rnc ? `<div class="mini">RNC ${esc(rnc)}</div>` : '',
    fecha: () => `<div class="mini">${fecha.toLocaleDateString('es')} · ${hora}</div>`,
    numero: () => `<div class="mini">Recibo ${esc(String(venta?.id ?? '').slice(-8).toUpperCase())}</div>`,
    cliente: () => `<div class="mini">Cliente: ${esc(venta?.clientName ?? venta?.label ?? 'Mostrador')}</div>`,
    tarifa: () => venta?.priceList && !venta.priceList.isDefault ? `<div class="mini">Tarifa: ${esc(venta.priceList.name)}</div>` : '',
    detalle: () => `<table>${filas}</table>`,
    totales: () => `${Number(venta?.discountTotal) > 0
      ? `<div class="row"><span>Ahorró</span><span>${Number(venta.discountTotal).toFixed(2)}</span></div>` : ''}
  <div class="row tot"><span>TOTAL</span><span>${money(venta?.total, sim)}</span></div>
  ${filasPago}
  ${propinaTotal > 0 ? `<div class="row"><span>Propina</span><span>${propinaTotal.toFixed(2)}</span></div>` : ''}
  ${vueltoTotal > 0 ? `<div class="row b"><span>Devuelta</span><span>${money(vueltoTotal, sim)}</span></div>` : ''}`,
    pie: () => pie ? `<div class="mini">${esc(pie)}</div>` : '',
  };
  const diseno = o.diseno ?? DISENO_BASE;
  const ENCABEZADO: BloqueRecibo[] = ['salon', 'sede', 'direccion', 'telefono', 'rnc'];
  const copia = '<div class="ctr b">** COPIA **</div>';
  let cuerpo = '';
  let copiaPuesta = !o.copia;
  for (const b of diseno.bloques) {
    if (!b.visible || !partes[b.id]) continue;
    const html = partes[b.id]();
    if (html) {
      // La marca de copia va justo después del encabezado, donde se ve primero
      if (!copiaPuesta && !ENCABEZADO.includes(b.id)) { cuerpo += copia; copiaPuesta = true; }
      cuerpo += `<div class="${b.alinear}">${html}</div>`;
    }
    // La raya separa aunque esa parte no tenga nada hoy (una venta sin tarifa), pero nunca dos seguidas
    if (b.raya && cuerpo && !cuerpo.endsWith(rayaHtml)) cuerpo += rayaHtml;
  }
  if (!copiaPuesta) cuerpo += copia;

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
  .ctr, .centro { text-align: center; }
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
  .izq { text-align: left; } .der { text-align: right; }
</style></head><body>
  ${cuerpo}
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

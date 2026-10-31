import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Loader2, Plus, Receipt, Scale, Search, Settings2, ShoppingCart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';
import { PageContent } from '../components/ui/PageContent';
import { SelectorSede } from '../components/ui/SelectorSede';
import { ItemAnimado, ListaAnimada } from '../components/ui/movimiento';
import { useSedes } from '../hooks/useSedes';
import { ABRIR_FACTURA, ABRIR_PEDIDO, AVISO_BORRADORES, AVISO_POR_PEDIR, EVENTO_ABRIR_FACTURA, EVENTO_ABRIR_PEDIDO, VISTA_COMPRAS, colorVence, comprasApi, dinero, textoVence, type FilaPedido, type Proveedor, type Resumen } from '../services/compras';
import { DetallePedido } from '../components/compras/DetallePedido';
import { FacturaALalan } from '../components/compras/FacturaALalan';
import { ComparacionPrecios } from '../components/compras/ComparacionPrecios';
import { ListaProveedores } from '../components/compras/Proveedores';
import { PorPedir } from '../components/compras/PorPedir';
import { AjustesCompras } from '../components/compras/AjustesCompras';
import { NovedadesProveedores } from '../components/compras/NovedadesProveedores';
import { PorPagarVista } from '../components/compras/PorPagar';
import { PastillaEstado, botonPrincipal, botonSuave, campo, etiqueta, fechaCorta } from '../components/compras/piezas';

type Vista = 'pedidos' | 'por-pedir' | 'proveedores' | 'por-pagar';
type Filtro = '' | 'borrador' | 'cotizacion_enviada' | 'atrasadas' | 'sin_recibir' | 'recepcion_atrasada' | 'tu_si' | 'pago_vencido';

/**
 * Compras, como el módulo de Odoo pero guiado: arriba los números que
 * importan (cada uno filtra la lista), los pedidos con su estado, lo que hay
 * que pedir en cada sede y los proveedores. Abrir un pedido muestra su hoja
 * con el historial de todo lo que se habló y se mandó.
 */
export const ComprasScreen: React.FC = () => {
  const { currencies } = useApp();
  const { currentUser, puede } = useAuth();
  const sedes = useSedes();
  const [sede, setSede] = useState('');
  const [vista, setVista] = useState<Vista>(() => {
    try { const v = sessionStorage.getItem(VISTA_COMPRAS); if (v) sessionStorage.removeItem(VISTA_COMPRAS); return (v as Vista) || 'pedidos'; } catch { return 'pedidos'; }
  });
  // Lo que pidió abrir otra pantalla o un aviso: un pedido, o una comparación ("comparacion:<id>")
  const [pendiente] = useState<string | null>(() => {
    try { const id = sessionStorage.getItem(ABRIR_PEDIDO); if (id) sessionStorage.removeItem(ABRIR_PEDIDO); return id; } catch { return null; }
  });
  const [abierto, setAbierto] = useState<string | null>(() => (pendiente && !pendiente.startsWith('comparacion:') ? pendiente : null));
  const [comparando, setComparando] = useState<string | null>(() => (pendiente?.startsWith('comparacion:') ? pendiente.slice('comparacion:'.length) : null));
  // Con Compras ya abierta, la notificación de un pedido (o de una comparación) lo abre
  useEffect(() => {
    const abrir = () => {
      try {
        const id = sessionStorage.getItem(ABRIR_PEDIDO);
        if (!id) return;
        sessionStorage.removeItem(ABRIR_PEDIDO); setVista('pedidos');
        if (id.startsWith('comparacion:')) { setAbierto(null); setComparando(id.slice('comparacion:'.length)); } else { setComparando(null); setAbierto(id); }
      } catch { /* nada */ }
    };
    window.addEventListener(EVENTO_ABRIR_PEDIDO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_PEDIDO, abrir);
  }, []);
  const [filtro, setFiltro] = useState<Filtro>('');
  const [q, setQ] = useState('');
  // Lo que la dueña marca para pedir al llegar desde un aviso (todo lo que falta en esa sede)
  const [marcarSede, setMarcarSede] = useState<string | null>(null);
  // Los avisos de Compras abren donde se resuelve: «Por pagar», «Por pedir» de una sede o sus borradores
  useEffect(() => {
    const revisar = () => {
      try {
        const aviso = sessionStorage.getItem('lalan.abrirAviso');
        if (!aviso) return;
        if (aviso === 'por-pagar') {
          sessionStorage.removeItem('lalan.abrirAviso');
          setAbierto(null); setComparando(null); setVista('por-pagar');
        } else if (aviso.startsWith(AVISO_POR_PEDIR)) {
          sessionStorage.removeItem('lalan.abrirAviso');
          const s = aviso.slice(AVISO_POR_PEDIR.length);
          setAbierto(null); setComparando(null); setSede(s); setMarcarSede(`${s}|${Date.now()}`); setVista('por-pedir');
        } else if (aviso.startsWith(AVISO_BORRADORES)) {
          sessionStorage.removeItem('lalan.abrirAviso');
          setAbierto(null); setComparando(null); setSede(aviso.slice(AVISO_BORRADORES.length)); setFiltro('borrador'); setQ(''); setVista('pedidos');
        }
      } catch { /* nada */ }
    };
    revisar();
    window.addEventListener('lalan:abrir-aviso', revisar);
    return () => window.removeEventListener('lalan:abrir-aviso', revisar);
  }, []);
  const [lista, setLista] = useState<FilaPedido[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [nuevo, setNuevo] = useState(false);
  // La factura de algo que ya compró: Lalan la lee y la registra (también se abre desde la pantalla de Lalan)
  const [factura, setFactura] = useState(false);
  useEffect(() => {
    const revisar = () => {
      try {
        if (!sessionStorage.getItem(ABRIR_FACTURA)) return;
        sessionStorage.removeItem(ABRIR_FACTURA);
        setAbierto(null); setComparando(null); setVista('pedidos'); setFactura(true);
      } catch { /* nada */ }
    };
    revisar();
    window.addEventListener(EVENTO_ABRIR_FACTURA, revisar);
    return () => window.removeEventListener(EVENTO_ABRIR_FACTURA, revisar);
  }, []);
  const [ajustes, setAjustes] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const esDireccion = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const cargar = useCallback(() => {
    const estado = filtro === 'borrador' || filtro === 'cotizacion_enviada' ? filtro : undefined;
    const otro = estado ? undefined : filtro || undefined;
    comprasApi.pedidos({ sede: sede || undefined, estado, filtro: otro, q: q.trim() || undefined }).then(setLista).catch(() => setLista([]));
    comprasApi.resumen(sede || undefined).then(setResumen).catch(() => setResumen(null));
  }, [sede, filtro, q]);
  useEffect(() => { const t = setTimeout(cargar, q ? 250 : 0); return () => clearTimeout(t); }, [cargar, q, vuelta]);

  const simbolo = useCallback((codigo: string) => currencies.find((c) => c.code === codigo)?.symbol ?? `${codigo} `, [currencies]);

  const tarjetas = useMemo(() => resumen ? [
    { id: 'borrador' as Filtro, n: resumen.borradores, texto: 'Borradores' },
    { id: 'cotizacion_enviada' as Filtro, n: resumen.cotizacionesEnviadas, texto: 'Cotización enviada' },
    { id: 'atrasadas' as Filtro, n: resumen.cotizacionesAtrasadas, texto: 'Cotización atrasada', alerta: true },
    { id: 'sin_recibir' as Filtro, n: resumen.sinRecibir, texto: 'Sin recibir' },
    { id: 'recepcion_atrasada' as Filtro, n: resumen.recepcionAtrasada, texto: 'Recepción atrasada', alerta: true },
    ...(resumen.esperanTuSi ? [{ id: 'tu_si' as Filtro, n: resumen.esperanTuSi, texto: 'Esperan tu sí', lalan: true }] : []),
    ...(resumen.pagosVencidos ? [{ id: 'pago_vencido' as Filtro, n: resumen.pagosVencidos, texto: 'Pago vencido', alerta: true }] : []),
  ] : [], [resumen]);

  const abrir = (id: string) => { setAbierto(id); setVista('pedidos'); };
  /** Abrir un pedido desde la comparación vuelve a la comparación con Atrás */
  const [volverAComparar, setVolverAComparar] = useState<string | null>(null);
  const cerrarPedido = () => {
    setAbierto(null); setVuelta((v) => v + 1);
    if (volverAComparar) { setComparando(volverAComparar); setVolverAComparar(null); }
  };

  return (
    <div id="compras-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Compras"
        subtitle="Proveedores, pedidos y lo que llega"
        // Con un pedido abierto, Atrás (botón, deslizar desde el borde o clic derecho) vuelve a la lista
        showBack={!!abierto || !!comparando}
        onBack={() => { if (abierto) cerrarPedido(); else { setComparando(null); setVuelta((v) => v + 1); } }}
        rightAction={
          <div className="flex items-center gap-1.5">
            <SelectorSede sedes={sedes} value={sede} onChange={setSede} todas />
            {esDireccion && (
              <button type="button" onClick={() => setAjustes(true)} aria-label="Cómo compras" title="Cómo compras" className="grid place-items-center size-8 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 cursor-pointer">
                <Settings2 className="w-4 h-4" />
              </button>
            )}
          </div>
        }
      />
      <PageContent className="space-y-3 pb-6 text-slate-900 dark:text-neutral-100">
        {abierto ? (
          <DetallePedido key={abierto} id={abierto} onVolver={cerrarPedido} onCambio={() => setVuelta((v) => v + 1)} onAbrir={setAbierto}
            onComparar={(cid) => { setAbierto(null); setVolverAComparar(null); setComparando(cid); }} />
        ) : comparando ? (
          <ComparacionPrecios key={comparando} id={comparando} onVolver={() => { setComparando(null); setVuelta((v) => v + 1); }} onCambio={() => setVuelta((v) => v + 1)}
            onAbrirPedido={(id) => { setVolverAComparar(comparando); setComparando(null); setAbierto(id); }} />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1">
                <IOSSegmentedControl id="compras-vista" value={vista} onChange={(v) => setVista(v as Vista)} size="sm"
                  options={[{ id: 'pedidos', label: 'Pedidos' }, { id: 'por-pedir', label: 'Por pedir' }, { id: 'por-pagar', label: 'Por pagar' }, { id: 'proveedores', label: 'Proveedores' }]} />
              </div>
              {vista === 'pedidos' && (
                <div className="flex gap-2">
                  {puede('compras.gestionar') && <button type="button" onClick={() => setFactura(true)} className={botonSuave} title="Pásale la factura de lo que compraste a Lalan"><Receipt className="w-4 h-4" /> Registrar factura</button>}
                  <button type="button" onClick={() => setNuevo(true)} className={botonPrincipal}><Plus className="w-4 h-4" /> Nuevo pedido</button>
                </div>
              )}
            </div>

            {vista === 'por-pedir' && <PorPedir sede={sede || undefined} recarga={vuelta} marcarSede={marcarSede} onArmados={(ids) => { setVuelta((v) => v + 1); if (ids.length === 1) abrir(ids[0]); else { setFiltro('borrador'); setVista('pedidos'); } }}
              onComparar={(cid) => { setVuelta((v) => v + 1); setVista('pedidos'); setComparando(cid); }} />}
            {vista === 'por-pagar' && <PorPagarVista sede={sede || undefined} recarga={vuelta} onAbrir={abrir} />}
            {vista === 'proveedores' && <ListaProveedores sede={sede || undefined} recarga={vuelta} onAbrirPedido={abrir} />}

            {vista === 'pedidos' && (
              <>
                {/* Lo que ofrecieron los proveedores o si quieren un servicio: la dueña decide aquí */}
                <NovedadesProveedores recarga={vuelta} />
                {/* Los números de arriba: cada uno filtra */}
                {resumen && (
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 [&>*]:flex-1 [&>*]:min-w-[8.25rem] [&>*]:shrink-0">
                    {tarjetas.map((t) => {
                      const activo = filtro === t.id;
                      return (
                        <button key={t.id} type="button" onClick={() => setFiltro(activo ? '' : t.id)}
                          className={`p-3 rounded-2xl text-left border transition cursor-pointer ${activo ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-[var(--primary)]/40'}`}>
                          <span className={`block text-xl font-extrabold tabular-nums ${t.alerta && t.n ? 'text-rose-600' : t.lalan ? 'text-violet-600' : 'text-slate-900 dark:text-white'}`}>{t.n}</span>
                          <span className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-1">{t.lalan && <Bot className="w-3 h-3" />}{t.alerta && t.n ? <AlertTriangle className="w-3 h-3 text-rose-500" /> : null}{t.texto}</span>
                        </button>
                      );
                    })}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50">
                      <span className="block text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">{resumen.entregasATiempo == null ? '—' : `${resumen.entregasATiempo}%`}</span>
                      <span className="text-[0.6875rem] font-semibold text-slate-500">Entregas a tiempo</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50">
                      <span className="block text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">{resumen.diasDeEntrega == null ? '—' : resumen.diasDeEntrega}</span>
                      <span className="text-[0.6875rem] font-semibold text-slate-500">Días en llegar</span>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${campo} pl-9 bg-white dark:bg-neutral-900`} placeholder="Buscar por proveedor, número o referencia…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>

                {!lista && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Cargando pedidos…</div>}
                {lista && !lista.length && (
                  <div className="py-10 flex flex-col items-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
                    <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{filtro || q ? 'Nada con ese filtro' : 'Todavía no hay pedidos'}</h4>
                    <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">Mira en «Por pedir» lo que falta: Lalan arma los pedidos por proveedor.</p>
                    {!filtro && !q && <button type="button" onClick={() => setVista('por-pedir')} className={`${botonPrincipal} mt-4`}>Ver lo que falta</button>}
                  </div>
                )}

                {lista && lista.length > 0 && (
                  <>
                    {/* Computadora: una tabla, como en Odoo */}
                    <div className="hidden md:block rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 overflow-hidden">
                      <table className="w-full text-[0.8125rem]">
                        <thead className="text-[0.6875rem] text-slate-400 text-left">
                          <tr className="border-b border-slate-100 dark:border-neutral-800">
                            <th className="px-3 py-2 font-bold">Pedido</th><th className="px-3 py-2 font-bold">Proveedor</th>
                            {sedes.length > 1 && <th className="px-3 py-2 font-bold">Sede</th>}
                            <th className="px-3 py-2 font-bold">Lo pidió</th><th className="px-3 py-2 font-bold">Fecha</th>
                            <th className="px-3 py-2 font-bold text-right">Total</th><th className="px-3 py-2 font-bold">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map((o) => (
                            <tr key={o.id} onClick={() => abrir(o.id)} className="border-b border-slate-50 dark:border-neutral-800/60 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer">
                              <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{o.numero}</td>
                              <td className="px-3 py-2.5">{o.proveedor.nombre}</td>
                              {sedes.length > 1 && <td className="px-3 py-2.5 text-slate-500">{o.sede.nombre}</td>}
                              <td className="px-3 py-2.5 text-slate-500">{o.manejaLalan || o.origen === 'lalan' ? <span className="inline-flex items-center gap-1 text-violet-600"><Bot className="w-3.5 h-3.5" /> Lalan</span> : o.creadoPor ?? '—'}</td>
                              <td className={`px-3 py-2.5 ${o.atrasada ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>{fechaDeFila(o)}</td>
                              <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                                {dinero(simbolo(o.currencyCode), o.total)}
                                {o.cuenta && o.cuenta.debe >= 0.005 && <span className={`block text-[0.6875rem] font-semibold ${colorVence(o.cuenta.diasParaVencer)}`}>debes {dinero(simbolo(o.currencyCode), o.cuenta.debe)}</span>}
                              </td>
                              <td className="px-3 py-2.5"><span className="flex items-center gap-1.5"><PastillaEstado estado={o.estado} />{o.esperaDuena && <span title="Espera tu sí" className="text-violet-600"><Bot className="w-3.5 h-3.5" /></span>}
                                {o.comparacionId && <button type="button" title="Ver la comparación de precios" aria-label="Ver la comparación de precios" onClick={(e) => { e.stopPropagation(); setComparando(o.comparacionId); }} className="text-[var(--primary)] cursor-pointer"><Scale className="w-3.5 h-3.5" /></button>}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Teléfono: tarjetas */}
                    <ListaAnimada className="md:hidden space-y-2">
                      {lista.map((o, i) => (
                        <ItemAnimado key={o.id} indice={i} onClick={() => abrir(o.id)} className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 cursor-pointer">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[0.875rem] text-slate-900 dark:text-white">{o.proveedor.nombre}</span>
                            <PastillaEstado estado={o.estado} />
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1 text-[0.75rem] text-slate-500">
                            <span>{o.numero}{sedes.length > 1 ? ` · ${o.sede.nombre}` : ''} · <span className={o.atrasada ? 'text-rose-600 font-semibold' : ''}>{fechaDeFila(o)}</span></span>
                            <span className="font-bold text-[0.8125rem] text-slate-900 dark:text-white tabular-nums">{dinero(simbolo(o.currencyCode), o.total)}</span>
                          </div>
                          {o.esperaDuena && <p className="mt-1 text-[0.75rem] font-semibold text-violet-600 flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> Lalan espera tu sí</p>}
                          {o.comparacionId && <button type="button" onClick={(e) => { e.stopPropagation(); setComparando(o.comparacionId); }} className="mt-1 text-[0.75rem] font-bold text-[var(--primary)] flex items-center gap-1 cursor-pointer"><Scale className="w-3.5 h-3.5" /> Ver comparación de precios</button>}
                          {o.cuenta && o.cuenta.debe >= 0.005 && (
                            <p className={`mt-1 text-[0.75rem] font-semibold ${colorVence(o.cuenta.diasParaVencer)}`}>Debes {dinero(simbolo(o.currencyCode), o.cuenta.debe)} · {textoVence(o.cuenta)}</p>
                          )}
                        </ItemAnimado>
                      ))}
                    </ListaAnimada>
                  </>
                )}
              </>
            )}
          </>
        )}
      </PageContent>

      <NuevoPedido abierto={nuevo} sede={sede} onClose={() => setNuevo(false)} onCreado={(id) => { setNuevo(false); setVuelta((v) => v + 1); abrir(id); }} />
      <AjustesCompras abierto={ajustes} onClose={() => setAjustes(false)} />
      <FacturaALalan abierto={factura} sede={sede} onClose={() => setFactura(false)}
        onRegistrada={(p) => { setFactura(false); setVuelta((v) => v + 1); abrir(p.id); }}
        onAbrirPedido={(id) => { setFactura(false); abrir(id); }} />
    </div>
  );
};

/** La fecha que importa según el estado: hasta cuándo responde, cuándo llega o cuándo se hizo */
function fechaDeFila(o: FilaPedido) {
  if (o.estado === 'cotizacion_enviada' && o.fechaLimite) return `responde ${fechaCorta(o.fechaLimite)}`;
  if ((o.estado === 'confirmada' || o.estado === 'recibida_parcial') && o.entregaEsperada) return `llega ${fechaCorta(o.entregaEsperada)}`;
  return fechaCorta(o.creadoEn);
}

/** Pedido nuevo: a quién y para qué sede. Los productos se agregan en el pedido */
const NuevoPedido: React.FC<{ abierto: boolean; sede: string; onClose: () => void; onCreado: (id: string) => void }> = ({ abierto, sede, onClose, onCreado }) => {
  const { showToast } = useApp();
  const sedes = useSedes();
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [proveedorId, setProveedorId] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [creando, setCreando] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    setSedeId(sede || '');
    comprasApi.proveedores().then((l) => { setProveedores(l); setProveedorId(l[0]?.id ?? ''); }).catch(() => setProveedores([]));
  }, [abierto, sede]);
  const elegido = proveedores?.find((p) => p.id === proveedorId);
  const sedesDelProveedor = sedes.filter((s) => !elegido?.sedes.length || elegido.sedes.includes(s.id));
  const sedeFinal = sedeId || (sedes.length === 1 ? sedes[0].id : '');

  const crear = async () => {
    setCreando(true);
    try { const p = await comprasApi.crear({ proveedorId, locationId: sedeFinal || null, lineas: [] }); onCreado(p.id); }
    catch (e) { showToast('No se pudo crear', (e as Error).message, 'warning'); }
    finally { setCreando(false); }
  };

  return (
    <IOSModal isOpen={abierto} onClose={onClose} title="Nuevo pedido" subtitle="A quién y para qué sede" fixedHeight={false}>
      <div className="space-y-3 p-1">
        {proveedores && !proveedores.length ? (
          <p className="text-[0.8125rem] text-slate-500">Primero agrega un proveedor en la pestaña Proveedores.</p>
        ) : (
          <>
            <label className="block"><span className={etiqueta}>Proveedor</span>
              <select className={campo} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            {sedes.length > 1 && (
              <label className="block"><span className={etiqueta}>Sede que recibe</span>
                <select className={campo} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                  <option value="">Elige la sede</option>
                  {sedesDelProveedor.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <button type="button" disabled={creando || !proveedorId || (sedes.length > 1 && !sedeId)} onClick={() => void crear()} className={`${botonPrincipal} w-full py-3`}>
              {creando && <Loader2 className="w-4 h-4 animate-spin" />} Crear y agregar productos
            </button>
          </>
        )}
      </div>
    </IOSModal>
  );
};

export default ComprasScreen;

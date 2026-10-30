import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bot, Camera, Check, FileUp, Loader2, PackageCheck, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import {
  FORMAS_DE_PAGO, cantidadTexto, comprasApi, dinero, type FormaDePago, type Pedido, type PropuestaFactura, type Proveedor, type RenglonFactura,
} from '../../services/compras';
import { botonPrincipal, botonSuave, campo, etiqueta } from './piezas';

/** Un renglón como lo va dejando la dueña: el producto del salón, o uno nuevo */
interface Fila extends RenglonFactura {
  clave: number;
  cantidadTxt: string;
  precioTxt: string;
  impuestoTxt: string;
  /** Producto nuevo: se crea al registrar con este nombre */
  nuevo: { nombre: string; vende: boolean; precioVenta: string } | null;
}

type Paso = 'elegir' | 'leyendo' | 'revisar';

const n = (t: string) => Number(String(t).replace(',', '.'));
const numeros = (t: string) => t.replace(/[^\d.,]/g, '');

/**
 * «Pásale la factura a Lalan»: la dueña toma la foto (o sube el PDF) de lo que
 * compró en la calle; Lalan la lee, reconoce al proveedor y los productos del
 * salón, y la deja lista. Ella solo revisa y dice que sí: queda la compra,
 * lo que entra al inventario de la sede y lo que se debe o el pago.
 */
export const FacturaALalan: React.FC<{ abierto: boolean; sede?: string; onClose: () => void; onRegistrada: (p: Pedido) => void; onAbrirPedido?: (id: string) => void }> = ({
  abierto, sede, onClose, onRegistrada, onAbrirPedido,
}) => {
  const { showToast, products, currencies, recargarCatalogo } = useApp();
  const sedes = useSedes();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [paso, setPaso] = useState<Paso>('elegir');
  const [sedeId, setSedeId] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [p, setP] = useState<PropuestaFactura | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState<string>('');
  const [nuevoProv, setNuevoProv] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState('');
  const [recibir, setRecibir] = useState(true);
  const [pagada, setPagada] = useState(false);
  const [forma, setForma] = useState<FormaDePago>('efectivo');
  const [condiciones, setCondiciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const foto = useRef<HTMLInputElement>(null);
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setPaso('elegir'); setP(null); setFilas([]); setArchivos([]); setSedeId(sede || '');
    comprasApi.proveedores().then(setProveedores).catch(() => setProveedores([]));
  }, [abierto, sede]);
  // Con una sola sede (o atada a una) no se pregunta
  useEffect(() => { if (sedes.length === 1) setSedeId((s) => s || sedes[0].id); }, [sedes]);

  const simbolo = (codigo: string) => currencies.find((c) => c.code === codigo)?.symbol ?? `${codigo} `;
  const faltaSede = sedes.length > 1 && !sedeId;

  const leer = async (lista: File[]) => {
    if (!lista.length) return;
    setArchivos(lista); setPaso('leyendo');
    try {
      const r = await comprasApi.leerFactura(lista, sedeId || undefined);
      setP(r);
      setProveedorId(r.proveedor.id ?? '');
      setNuevoProv(r.proveedor.nuevo ? r.proveedor.nombre : '');
      setReferencia(r.referencia ?? '');
      setFecha(r.fecha ?? '');
      setRecibir(true);
      setPagada(r.pagada === true);
      setForma((FORMAS_DE_PAGO.find((f) => f.id === r.formaPago)?.id) ?? 'efectivo');
      setCondiciones(r.condiciones ?? r.proveedor.condicionesPago ?? '');
      setFilas(r.renglones.map((x, i) => ({
        ...x, clave: i, cantidadTxt: String(x.cantidad), precioTxt: String(x.precio), impuestoTxt: String(x.impuestoPct),
        // Sin parecidos, Lalan propone crearlo; con parecidos, la dueña elige primero
        nuevo: !x.productId && !x.candidatos.length ? { nombre: x.descripcion, vende: false, precioVenta: '' } : null,
      })));
      setPaso('revisar');
    } catch (e) {
      showToast('No pude leer la factura', (e as Error).message, 'warning');
      setPaso('elegir');
    }
  };

  const cambiar = (clave: number, c: Partial<Fila>) => setFilas((f) => f.map((x) => (x.clave === clave ? { ...x, ...c } : x)));
  const quitar = async (fila: Fila) => {
    if (!(await confirmar({ titulo: '¿Quitar este producto?', mensaje: `«${fila.descripcion}» no entra en la compra.`, textoConfirmar: 'Quitar', tono: 'peligro' }))) return;
    setFilas((f) => f.filter((x) => x.clave !== fila.clave));
  };

  const calculado = useMemo(() => {
    let subtotal = 0; let impuestos = 0;
    for (const f of filas) { const i = n(f.cantidadTxt) * n(f.precioTxt); subtotal += i; impuestos += i * (n(f.impuestoTxt) / 100); }
    return { subtotal, impuestos, total: Math.round((subtotal + impuestos) * 100) / 100 };
  }, [filas]);
  const leido = p?.totales.leido.total ?? null;
  const noCuadra = leido != null && leido > 0 && Math.abs(calculado.total - leido) > Math.max(1, leido * 0.005);
  const sinProducto = filas.filter((f) => !f.productId && !f.nuevo?.nombre.trim());
  const sinProveedor = !proveedorId && !nuevoProv.trim();
  const malos = filas.some((f) => !(n(f.cantidadTxt) > 0) || !(n(f.precioTxt) >= 0));

  const registrar = async () => {
    if (!p) return;
    setGuardando(true);
    try {
      const pedido = await comprasApi.registrarFactura({
        locationId: p.sede.id,
        proveedorId: proveedorId || null,
        proveedorNuevo: proveedorId ? null : {
          nombre: nuevoProv.trim(), rnc: p.proveedor.rnc ?? null, telefono: p.proveedor.telefono ?? null, correo: p.proveedor.correo ?? null,
          direccion: p.proveedor.direccion ?? null, plataformaId: p.proveedor.plataformaId ?? null,
        },
        referencia: referencia.trim() || null, fecha: fecha || null, currencyCode: p.moneda, condicionesPago: pagada ? null : condiciones.trim() || null,
        renglones: filas.map((f) => ({
          productId: f.productId, nuevo: f.productId ? null : { nombre: f.nuevo!.nombre.trim(), vende: f.nuevo!.vende, precioVenta: f.nuevo!.vende && n(f.nuevo!.precioVenta) > 0 ? n(f.nuevo!.precioVenta) : null },
          descripcion: f.descripcion, codigo: f.codigo, unidadCompra: f.unidadCompra, factor: f.factor,
          cantidad: n(f.cantidadTxt), precio: n(f.precioTxt), impuestoPct: n(f.impuestoTxt) || 0,
        })),
        recibir, pagada, formaPago: pagada ? forma : null,
      }, archivos);
      showToast('Compra registrada', `${pedido.numero} · ${recibir ? `entró al inventario de ${p.sede.nombre}` : 'queda por recibir'}${pagada ? '' : ' · en Por pagar'}`, 'success');
      if (recibir) await recargarCatalogo?.();
      onRegistrada(pedido);
    } catch (e) { showToast('No se pudo registrar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  const titulo = paso === 'revisar' ? 'Revisa la factura' : 'Pásale la factura a Lalan';
  const subtitulo = paso === 'revisar' && p ? `Lalan la leyó · entra a ${p.sede.nombre}` : 'Lalan la lee y registra la compra';

  return (
    <IOSModal isOpen={abierto} onClose={onClose} title={titulo} subtitle={subtitulo} fixedHeight={paso === 'revisar'}>
      {modalConfirmar}
      <input ref={foto} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; void leer(l); }} />
      <input ref={archivo} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []).slice(0, 5); e.target.value = ''; void leer(l); }} />

      {paso === 'elegir' && (
        <div className="space-y-3 p-1">
          <div className="flex gap-3 p-3 rounded-2xl bg-violet-50 dark:bg-violet-950/30 text-[0.8125rem] text-violet-900 dark:text-violet-200">
            <Bot className="w-5 h-5 shrink-0 mt-0.5" />
            <p>Tómale una foto a la factura o súbela en PDF. Yo leo el proveedor, los productos y los precios; tú solo revisas y me dices que sí.</p>
          </div>
          {sedes.length > 1 && (
            <label className="block"><span className={etiqueta}>¿En qué sede entra lo que compraste?</span>
              <select className={campo} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                <option value="">Elige la sede</option>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={faltaSede} onClick={() => foto.current?.click()} className={`${botonPrincipal} flex-col py-5`}>
              <Camera className="w-6 h-6" /> Tomar foto
            </button>
            <button type="button" disabled={faltaSede} onClick={() => archivo.current?.click()} className={`${botonSuave} flex-col py-5`}>
              <FileUp className="w-6 h-6" /> Subir PDF o foto
            </button>
          </div>
          <p className="text-[0.6875rem] text-slate-500">Si la factura tiene varias páginas, súbelas juntas (hasta 5 archivos).</p>
        </div>
      )}

      {paso === 'leyendo' && (
        <div className="py-14 flex flex-col items-center text-center gap-3 text-slate-600 dark:text-neutral-300">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          <p className="text-[0.875rem] font-semibold">Lalan está leyendo la factura…</p>
          <p className="text-[0.75rem] text-slate-500">Busco al proveedor y tus productos. Tarda unos segundos.</p>
        </div>
      )}

      {paso === 'revisar' && p && (
        <div className="space-y-3 p-1 pb-4">
          {p.yaRegistrada && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-[0.8125rem] text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <b>Esta factura ya está registrada</b> en {p.yaRegistrada.numero}. Si la registras otra vez, entra dos veces al inventario.
                {onAbrirPedido && <button type="button" onClick={() => onAbrirPedido(p.yaRegistrada!.id)} className="block mt-1 font-bold text-[var(--primary)] cursor-pointer">Abrir {p.yaRegistrada.numero}</button>}
              </div>
            </div>
          )}
          {p.sinLeer.length > 0 && <p className="text-[0.75rem] text-amber-700">No pude abrir: {p.sinLeer.join(', ')}.</p>}

          {/* Quién vendió */}
          <section className="p-3 rounded-2xl border border-slate-200/80 dark:border-neutral-800 space-y-2">
            <span className={etiqueta}>Proveedor</span>
            {p.proveedor.nuevo && !proveedorId ? (
              <>
                <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200 flex items-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <span>No está en tus proveedores. Lo creo con lo que dice la factura{p.proveedor.rnc ? ` (RNC ${p.proveedor.rnc}${p.proveedor.telefono ? ` · tel. ${p.proveedor.telefono}` : ''})` : ''}.</span>
                </p>
                <input className={campo} value={nuevoProv} onChange={(e) => setNuevoProv(e.target.value)} placeholder="Nombre del proveedor" />
                {proveedores.length > 0 && (
                  <select className={campo} value="" onChange={(e) => setProveedorId(e.target.value)} aria-label="Es uno que ya tengo">
                    <option value="">¿Es uno que ya tienes? Elígelo…</option>
                    {proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                )}
              </>
            ) : (
              <>
                <select className={campo} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                  {p.proveedor.nuevo && <option value="">Crear «{nuevoProv || p.proveedor.nombre}»</option>}
                  {proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
                {proveedorId === p.proveedor.id && p.proveedor.por && (
                  <p className="text-[0.6875rem] text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Lo reconocí por {p.proveedor.por === 'rnc' ? 'el RNC' : 'el nombre'}</p>
                )}
                {proveedorId === p.proveedor.id && p.proveedor.noVendeEnSede && <p className="text-[0.6875rem] text-slate-500">Lo anoto también como proveedor de {p.sede.nombre}.</p>}
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label><span className={etiqueta}>Factura / NCF</span><input className={campo} value={referencia} onChange={(e) => setReferencia(e.target.value)} /></label>
              <label><span className={etiqueta}>Fecha</span><input type="date" className={campo} value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            </div>
            {p.monedaEnFactura && <p className="text-[0.6875rem] text-amber-700">La factura está en {p.monedaEnFactura}, que no está activa en el salón: la anoto en {p.moneda}.</p>}
          </section>

          {/* Lo que compró */}
          <section className="space-y-2">
            <span className={etiqueta}>Productos ({filas.length})</span>
            {filas.map((f) => (
              <RenglonEditable key={f.clave} fila={f} productos={products} simbolo={simbolo(p.moneda)}
                onCambio={(c) => cambiar(f.clave, c)} onQuitar={() => void quitar(f)} />
            ))}
            {!filas.length && <p className="text-[0.8125rem] text-slate-500">No quedó ningún producto.</p>}
          </section>

          {/* Totales */}
          <section className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 text-[0.8125rem] space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{dinero(simbolo(p.moneda), calculado.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Impuestos</span><span className="tabular-nums">{dinero(simbolo(p.moneda), calculado.impuestos)}</span></div>
            <div className="flex justify-between font-extrabold text-[0.9375rem]"><span>Total</span><span className="tabular-nums">{dinero(simbolo(p.moneda), calculado.total)}</span></div>
            {noCuadra && (
              <p className="pt-1 text-[0.75rem] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                La factura dice {dinero(simbolo(p.moneda), leido!)}{p.totales.leido.descuento ? ` (con descuento de ${dinero(simbolo(p.moneda), p.totales.leido.descuento)})` : ''}. Revisa cantidades y precios.
              </p>
            )}
            {!noCuadra && leido != null && <p className="pt-1 text-[0.6875rem] text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Cuadra con la factura</p>}
          </section>

          {/* Lo que pasa al registrar */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-neutral-800">
              <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
                <b>Ya lo tengo aquí</b>
                <span className="block text-[0.6875rem] text-slate-500">{recibir ? `Suma al inventario de ${p.sede.nombre}` : 'Queda «sin recibir» hasta que llegue'}</span>
              </span>
              <IOSToggle checked={recibir} onChange={setRecibir} ariaLabel="Ya lo tengo aquí" />
            </div>
            <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
                  <b>Ya la pagué</b>
                  <span className="block text-[0.6875rem] text-slate-500">{pagada ? 'Se anota el pago por el total' : 'Queda en Por pagar'}</span>
                </span>
                <IOSToggle checked={pagada} onChange={setPagada} ariaLabel="Ya la pagué" />
              </div>
              {pagada ? (
                <div className="flex flex-wrap gap-1.5">
                  {FORMAS_DE_PAGO.map((x) => (
                    <button key={x.id} type="button" onClick={() => setForma(x.id)}
                      className={`px-2.5 py-1 rounded-full text-[0.75rem] font-bold border cursor-pointer ${forma === x.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
                      {x.nombre}
                    </button>
                  ))}
                </div>
              ) : (
                <label className="block"><span className={etiqueta}>Cómo le pagas (para saber cuándo vence)</span>
                  <input className={campo} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} placeholder="Crédito 30 días" /></label>
              )}
            </div>
          </section>

          {sinProducto.length > 0 && <p className="text-[0.75rem] text-amber-700">Dime qué producto es: {sinProducto.map((f) => `«${f.descripcion}»`).join(', ')}.</p>}
          <button type="button" disabled={guardando || !filas.length || sinProducto.length > 0 || sinProveedor || malos} onClick={() => void registrar()} className={`${botonPrincipal} w-full py-3`}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Sí, registra la compra
          </button>
          <button type="button" onClick={() => setPaso('elegir')} className="w-full text-[0.75rem] font-bold text-slate-500 cursor-pointer">Leer otra factura</button>
        </div>
      )}
    </IOSModal>
  );
};

/** Un renglón: lo que dice la factura y a qué producto del salón va */
const RenglonEditable: React.FC<{
  fila: Fila; productos: { id: string; name: string }[]; simbolo: string;
  onCambio: (c: Partial<Fila>) => void; onQuitar: () => void;
}> = ({ fila: f, productos, simbolo, onCambio, onQuitar }) => {
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const quita = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = useMemo(() => (q.trim() ? productos.filter((x) => quita(x.name).includes(quita(q.trim()))).slice(0, 6) : []), [productos, q]);
  const elegir = (id: string, nombre: string) => { onCambio({ productId: id, producto: nombre, nuevo: null, reconocidoPor: null }); setBuscando(false); setQ(''); };
  const precio = n(f.precioTxt);

  return (
    <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-neutral-800 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-[0.8125rem] text-slate-900 dark:text-white">{f.descripcion}{f.codigo ? <span className="font-normal text-slate-400"> · {f.codigo}</span> : null}</span>
        <button type="button" onClick={onQuitar} aria-label="Quitar este producto" className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"><Trash2 className="w-4 h-4" /></button>
      </div>

      {/* A qué producto del salón va */}
      {f.productId ? (
        <p className="text-[0.75rem] flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <Check className="w-3.5 h-3.5" /> Es <b>{f.producto}</b>
          <button type="button" onClick={() => onCambio({ productId: null, producto: null })} className="ml-1 font-bold text-[var(--primary)] cursor-pointer">Cambiar</button>
        </p>
      ) : f.nuevo ? (
        <div className="space-y-1.5 p-2 rounded-xl bg-violet-50 dark:bg-violet-950/30">
          <p className="text-[0.75rem] text-violet-900 dark:text-violet-200 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> No lo tienes: lo agrego a tu catálogo como</p>
          <input className={campo} value={f.nuevo.nombre} onChange={(e) => onCambio({ nuevo: { ...f.nuevo!, nombre: e.target.value } })} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.75rem] text-slate-700 dark:text-neutral-200">Lo vendo a clientas</span>
            <IOSToggle checked={f.nuevo.vende} onChange={(v) => onCambio({ nuevo: { ...f.nuevo!, vende: v } })} ariaLabel="Lo vendo a clientas" />
          </div>
          {f.nuevo.vende
            ? <input className={campo} inputMode="decimal" placeholder="Precio de venta" value={f.nuevo.precioVenta} onChange={(e) => onCambio({ nuevo: { ...f.nuevo!, precioVenta: numeros(e.target.value) } })} />
            : <p className="text-[0.6875rem] text-slate-500">Queda como insumo del salón (no sale en la Vitrina ni lo ofrezco).</p>}
          <button type="button" onClick={() => onCambio({ nuevo: null })} className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer">Es uno que ya tengo</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[0.75rem] text-amber-700 dark:text-amber-400">¿Qué producto es?</p>
          <div className="flex flex-wrap gap-1.5">
            {f.candidatos.map((c) => (
              <button key={c.id} type="button" onClick={() => elegir(c.id, c.nombre)} className="px-2.5 py-1 rounded-full text-[0.75rem] font-bold border border-[var(--primary)]/40 text-[var(--primary)] cursor-pointer">{c.nombre}</button>
            ))}
            <button type="button" onClick={() => setBuscando((b) => !b)} className="px-2.5 py-1 rounded-full text-[0.75rem] font-bold border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 cursor-pointer flex items-center gap-1"><Search className="w-3 h-3" /> Buscar</button>
            <button type="button" onClick={() => onCambio({ nuevo: { nombre: f.descripcion, vende: false, precioVenta: '' } })} className="px-2.5 py-1 rounded-full text-[0.75rem] font-bold border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 cursor-pointer flex items-center gap-1"><Plus className="w-3 h-3" /> Es nuevo</button>
          </div>
          {buscando && (
            <div className="space-y-1">
              <input autoFocus className={campo} placeholder="Busca en tu catálogo…" value={q} onChange={(e) => setQ(e.target.value)} />
              {lista.length > 0 && (
                <ul className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-100 dark:divide-neutral-800 overflow-hidden">
                  {lista.map((x) => (
                    <li key={x.id}><button type="button" onClick={() => elegir(x.id, x.name)} className="w-full px-3 py-2 text-left text-[0.8125rem] hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer">{x.name}</button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <label><span className={etiqueta}>Cantidad{f.unidadCompra ? ` (${f.unidadCompra})` : ''}</span>
          <input className={campo} inputMode="decimal" value={f.cantidadTxt} onChange={(e) => onCambio({ cantidadTxt: numeros(e.target.value) })} /></label>
        <label><span className={etiqueta}>Precio c/u</span>
          <input className={campo} inputMode="decimal" value={f.precioTxt} onChange={(e) => onCambio({ precioTxt: numeros(e.target.value) })} /></label>
        <label><span className={etiqueta}>Impuesto %</span>
          <input className={campo} inputMode="decimal" value={f.impuestoTxt} onChange={(e) => onCambio({ impuestoTxt: numeros(e.target.value) })} /></label>
      </div>
      {f.precioAnterior != null && (
        <p className={`text-[0.6875rem] font-semibold ${precio > f.precioAnterior ? 'text-rose-600' : 'text-emerald-600'}`}>
          {precio > f.precioAnterior ? 'Subió' : 'Bajó'}: la última vez te lo vendió a {dinero(simbolo, f.precioAnterior)}
        </p>
      )}
      {f.factor > 1 && n(f.cantidadTxt) > 0 && <p className="text-[0.6875rem] text-slate-500">Suma {cantidadTexto(n(f.cantidadTxt) * f.factor)} unidades al inventario</p>}
    </div>
  );
};

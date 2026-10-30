import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, MessageCircle, Package, Plus, Search, Sparkles, Tag, UserRound, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { comprasApi, dinero, unidadTexto, type NovedadProveedor } from '../../services/compras';
import { botonPrincipal, botonSuave, campo, etiqueta, fechaCorta } from './piezas';

const ICONO = { producto: Package, promocion: Tag, servicio: UserRound } as const;
const NOMBRE = { producto: 'Producto', promocion: 'Promoción', servicio: 'Quiere un servicio' } as const;
const COLOR = {
  producto: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  promocion: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  servicio: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
} as const;
const quita = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Lo que los proveedores ofrecen fuera de un pedido (productos, líneas,
 * promociones) o si quieren un servicio del salón. Lalan lo separó del
 * mensaje; aquí la dueña decide con un toque: ya lo tiene (queda enlazado
 * a ese proveedor con su precio), lo agrega al catálogo, lo atiende como
 * cliente o no le interesa.
 */
export const NovedadesProveedores: React.FC<{ recarga?: number }> = ({ recarga }) => {
  const { showToast, navigateTo } = useApp();
  const [lista, setLista] = useState<NovedadProveedor[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [enlazar, setEnlazar] = useState<NovedadProveedor | null>(null);
  const [agregar, setAgregar] = useState<NovedadProveedor | null>(null);

  const cargar = useCallback(() => { comprasApi.novedades().then(setLista).catch(() => setLista([])); }, []);
  useEffect(() => { cargar(); }, [cargar, recarga]);
  if (!lista.length) return null;

  const quitar = (id: string) => setLista((l) => l.filter((x) => x.id !== id));
  const descartar = async (n: NovedadProveedor) => {
    setOcupado(n.id);
    try { await comprasApi.descartarNovedad(n.id); quitar(n.id); } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };
  const comoCliente = async (n: NovedadProveedor) => {
    setOcupado(n.id);
    try {
      const r = await comprasApi.atenderComoCliente(n.id);
      quitar(n.id);
      showToast(
        `Lalan atiende a ${n.proveedor.nombre} como cliente`,
        r.escrito ? 'Ya le preguntó qué servicio quiere. Lo ves en Chats.' : 'Por 24 horas, cuando escriba, le contesta Lalan en Chats como a cualquier clienta.',
        'success',
      );
      if (r.escrito) navigateTo('chats');
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };

  return (
    <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-violet-200/80 dark:border-violet-900/50 space-y-2">
      <p className="flex items-center gap-1.5 font-bold text-[0.8125rem] text-violet-800 dark:text-violet-300">
        <Sparkles className="w-4 h-4" /> Novedades de tus proveedores
      </p>
      {lista.map((n) => {
        const Icono = ICONO[n.tipo];
        return (
          <div key={n.id} className="py-2 border-t border-slate-100 dark:border-neutral-800 first:border-0 space-y-2">
            <div className="flex items-start gap-2.5">
              <span className={`grid place-items-center size-8 rounded-xl shrink-0 ${COLOR[n.tipo]}`}><Icono className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0 text-[0.8125rem]">
                <p className="font-bold text-slate-900 dark:text-white">{n.titulo}</p>
                <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
                  {NOMBRE[n.tipo]} · {n.proveedor.nombre}
                  {n.precio != null ? ` · ${dinero(n.currencyCode ? `${n.currencyCode} ` : '', n.precio)}` : ''}
                  {n.vence ? ` · hasta el ${fechaCorta(`${n.vence}T12:00:00`)}` : ''}
                  {` · ${n.canal === 'whatsapp' ? 'por WhatsApp' : 'por correo'} el ${fechaCorta(n.creadoEn)}`}
                </p>
                {n.detalle && <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 mt-0.5">{n.detalle}</p>}
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-1.5 sm:pl-[2.625rem]">
              {n.tipo === 'servicio' ? (
                <button type="button" disabled={ocupado === n.id} onClick={() => void comoCliente(n)} className={botonPrincipal}>
                  {ocupado === n.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} Atenderlo como cliente
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setEnlazar(n)} className={botonSuave}><Check className="w-4 h-4" /> Ya lo tengo</button>
                  {n.tipo === 'producto' && <button type="button" onClick={() => setAgregar(n)} className={botonPrincipal}><Plus className="w-4 h-4" /> Agregarlo</button>}
                </>
              )}
              <button type="button" disabled={ocupado === n.id} onClick={() => void descartar(n)} className={botonSuave}>
                <X className="w-4 h-4" /> {n.tipo === 'promocion' ? 'Visto' : 'No'}
              </button>
            </div>
          </div>
        );
      })}
      <EnlazarProducto novedad={enlazar} onClose={() => setEnlazar(null)} onListo={(id) => { quitar(id); setEnlazar(null); }} />
      <AgregarAlCatalogo novedad={agregar} onClose={() => setAgregar(null)} onListo={(id) => { quitar(id); setAgregar(null); }} />
    </div>
  );
};

/** «Ya lo tengo»: se elige el producto del catálogo y queda enlazado a ese proveedor con su precio */
const EnlazarProducto: React.FC<{ novedad: NovedadProveedor | null; onClose: () => void; onListo: (id: string) => void }> = ({ novedad, onClose, onListo }) => {
  const { products, showToast } = useApp();
  const [q, setQ] = useState('');
  const [elegido, setElegido] = useState<string | null>(null);
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!novedad) return;
    // Empieza buscando por la primera palabra de lo que ofreció
    setQ(novedad.titulo.split(/\s+/)[0] ?? ''); setElegido(null); setPrecio(novedad.precio == null ? '' : String(novedad.precio));
  }, [novedad]);
  const lista = useMemo(() => products
    .filter((x) => !(x as any).preparedToOrder && (!q.trim() || quita(x.name).includes(quita(q.trim()))))
    .slice(0, 8), [products, q]);
  if (!novedad) return null;

  const guardar = async () => {
    if (!elegido) return;
    setGuardando(true);
    try {
      await comprasApi.enlazarNovedad(novedad.id, { productId: elegido, precio: precio === '' ? null : Number(precio) });
      showToast('Quedó enlazado', `${products.find((x) => x.id === elegido)?.name ?? 'El producto'} se lo puedes pedir a ${novedad.proveedor.nombre}.`, 'success');
      onListo(novedad.id);
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <IOSModal isOpen={!!novedad} onClose={onClose} title="¿Cuál es en tu catálogo?" subtitle={`${novedad.titulo} · ${novedad.proveedor.nombre}`} fixedHeight={false}>
      <div className="space-y-3 p-1">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus className={`${campo} pl-9`} placeholder="Busca el producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-100 dark:divide-neutral-800 overflow-hidden">
          {lista.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setElegido(x.id)} className={`w-full px-3 py-2 text-left text-[0.8125rem] cursor-pointer flex items-center justify-between gap-2 ${elegido === x.id ? 'bg-[var(--primary)]/10' : 'hover:bg-slate-50 dark:hover:bg-neutral-800'}`}>
                <span className="font-semibold text-slate-900 dark:text-white truncate">{x.name}</span>
                {elegido === x.id ? <Check className="w-4 h-4 text-[var(--primary)] shrink-0" /> : <span className="text-slate-500 shrink-0">{unidadTexto(x.unit)}</span>}
              </button>
            </li>
          ))}
          {!lista.length && <li className="px-3 py-2 text-[0.8125rem] text-slate-500">No hay productos con ese nombre</li>}
        </ul>
        <label className="block"><span className={etiqueta}>Precio de {novedad.proveedor.nombre}{novedad.currencyCode ? ` (${novedad.currencyCode})` : ''}</span>
          <input className={campo} inputMode="decimal" placeholder="Si lo dijo" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ''))} /></label>
        <button type="button" disabled={!elegido || guardando} onClick={() => void guardar()} className={`${botonPrincipal} w-full py-3`}>
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enlazar a {novedad.proveedor.nombre}
        </button>
      </div>
    </IOSModal>
  );
};

/** «Agregarlo al catálogo»: el producto nuevo, ya enlazado a ese proveedor y con lo que cuesta */
const AgregarAlCatalogo: React.FC<{ novedad: NovedadProveedor | null; onClose: () => void; onListo: (id: string) => void }> = ({ novedad, onClose, onListo }) => {
  const { addProduct, categoriasDe, showToast } = useApp();
  const categorias = categoriasDe('product');
  const [f, setF] = useState({ nombre: '', categoria: '', venta: '', costo: '', unidad: 'unit' });
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!novedad) return;
    setF({ nombre: novedad.titulo, categoria: categorias[0]?.key ?? '', venta: '', costo: novedad.precio == null ? '' : String(novedad.precio), unidad: 'unit' });
  }, [novedad]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!novedad) return null;

  const guardar = async () => {
    const cat = categorias.find((c) => c.key === f.categoria);
    if (!f.nombre.trim() || !cat) return;
    setGuardando(true);
    try {
      const p = await addProduct({
        name: f.nombre.trim(), category: cat.key as any, categoryName: cat.name, sku: `PROV-${Date.now().toString(36).toUpperCase()}`,
        basePrice: Number(f.venta) || 0, stock: 0, unit: f.unidad, costPrice: f.costo === '' ? undefined : Number(f.costo),
      } as any);
      await comprasApi.enlazarNovedad(novedad.id, { productId: p.id, precio: f.costo === '' ? null : Number(f.costo), nuevo: true });
      showToast('Producto agregado', `${p.name} ya está en tu catálogo y se lo puedes pedir a ${novedad.proveedor.nombre}.`, 'success');
      onListo(novedad.id);
    } catch (e) { showToast('No se pudo agregar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <IOSModal isOpen={!!novedad} onClose={onClose} title="Agregar al catálogo" subtitle={`Lo ofrece ${novedad.proveedor.nombre}`} fixedHeight={false}>
      <div className="space-y-3 p-1">
        <label className="block"><span className={etiqueta}>Nombre</span>
          <input className={campo} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 sm:col-span-1"><span className={etiqueta}>Categoría</span>
            <select className={campo} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {categorias.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select></label>
          <label className="col-span-2 sm:col-span-1"><span className={etiqueta}>Se mide por</span>
            <select className={campo} value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>
              <option value="unit">Unidad</option><option value="ml">ml</option><option value="g">g</option><option value="oz">oz</option><option value="L">Litro</option>
            </select></label>
          <label><span className={etiqueta}>Te cuesta{novedad.currencyCode ? ` (${novedad.currencyCode})` : ''}</span>
            <input className={campo} inputMode="decimal" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label><span className={etiqueta}>Lo vendes a</span>
            <input className={campo} inputMode="decimal" placeholder="0 si es de uso interno" value={f.venta} onChange={(e) => setF({ ...f, venta: e.target.value.replace(/[^\d.]/g, '') })} /></label>
        </div>
        <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Entra sin existencias. Foto, receta y lo demás lo completas en Catálogo cuando quieras.</p>
        <button type="button" disabled={!f.nombre.trim() || !f.categoria || guardando} onClick={() => void guardar()} className={`${botonPrincipal} w-full py-3`}>
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar y enlazar a {novedad.proveedor.nombre}
        </button>
      </div>
    </IOSModal>
  );
};

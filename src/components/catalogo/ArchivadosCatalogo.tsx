import React, { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Clock, Loader2, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { ChipsFiltro, ItemAnimado, ListaAnimada } from '../ui/movimiento';
import { MiniaturaCatalogo } from './FotoDelCatalogo';

/** Un servicio o producto archivado, como lo manda el servidor */
interface Archivado {
  id: string;
  name: string;
  categoryName?: string | null;
  category?: string;
  fotoId?: string | null;
  color?: string | null;
  durationMinutes?: number;
  sku?: string;
  /** Servicio de la cadena que se quitó solo en la sede activa: vuelve solo aquí */
  soloEnEstaSede?: boolean;
}

type Que = 'todos' | 'servicios' | 'productos';

/**
 * La pestaña «Archivados» del catálogo.
 *
 * Archivar no borra: lo archivado sale del catálogo, la Vitrina, la caja y
 * los chats de Lalan, pero sus ventas, citas, compras y recetas siguen
 * enteras. Aquí se ve todo lo archivado y se devuelve con un toque.
 */
export const ArchivadosCatalogo: React.FC = () => {
  const { recargarCatalogo, showToast, categoriaPorClave } = useApp();
  const { actual: sedeActual, varias } = useSedeActiva();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [servicios, setServicios] = useState<Archivado[] | null>(null);
  const [productos, setProductos] = useState<Archivado[] | null>(null);
  const [error, setError] = useState('');
  const [que, setQue] = useState<Que>('todos');
  const [buscar, setBuscar] = useState('');
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError('');
    const [s, p] = await Promise.allSettled([
      api.get<Archivado[]>('/services/archivados'),
      api.get<Archivado[]>('/products/archivados'),
    ]);
    setServicios(s.status === 'fulfilled' ? s.value : []);
    setProductos(p.status === 'fulfilled' ? p.value : []);
    if (s.status === 'rejected' && p.status === 'rejected') setError('No se pudieron cargar los archivados. Revisa tu conexión.');
  }, []);
  // La sede activa cambia lo que se ve (cada sede archiva lo suyo)
  useEffect(() => { cargar(); }, [cargar, sedeActual?.id]);

  const restaurar = async (tipo: 'servicio' | 'producto', a: Archivado) => {
    const aqui = a.soloEnEstaSede && sedeActual ? ` en ${sedeActual.name}` : '';
    const ok = await confirmar({
      titulo: `¿Restaurar «${a.name}»?`,
      mensaje: tipo === 'servicio'
        ? `Vuelve al catálogo${aqui} como estaba: Lalan lo ofrece otra vez y sale en la Vitrina si lo tenías publicado.`
        : 'Vuelve al catálogo como estaba: se puede vender en caja, Lalan lo ofrece otra vez y sale en la Vitrina si lo tenías publicado.',
      textoConfirmar: 'Restaurar',
      icono: <ArchiveRestore className="w-6 h-6" />,
    });
    if (!ok) return;
    setRestaurando(a.id);
    try {
      await api.post(`/${tipo === 'servicio' ? 'services' : 'products'}/${a.id}/restaurar`, {});
      if (tipo === 'servicio') setServicios(l => (l ?? []).filter(x => x.id !== a.id));
      else setProductos(l => (l ?? []).filter(x => x.id !== a.id));
      await recargarCatalogo();
      showToast('Restaurado', `«${a.name}» volvió al catálogo`, 'success');
    } catch (e: any) {
      showToast('No se pudo restaurar', e?.message || 'Intenta de nuevo.', 'warning');
    } finally {
      setRestaurando(null);
    }
  };

  /** Todo lo que se ve (con el filtro y la búsqueda de ahora) vuelve de una vez */
  const restaurarTodo = async () => {
    const lista = [
      ...verServicios.map(a => ({ tipo: 'servicio' as const, a })),
      ...verProductos.map(a => ({ tipo: 'producto' as const, a })),
    ];
    if (!lista.length) return;
    const ok = await confirmar({
      titulo: `¿Restaurar ${lista.length === 1 ? `«${lista[0].a.name}»` : `los ${lista.length}`}?`,
      mensaje: `Vuelven al catálogo como estaban: ${verServicios.length} servicios y ${verProductos.length} productos. Lalan los ofrece otra vez y salen en la Vitrina los que tenías publicados.`,
      textoConfirmar: 'Restaurar todo',
      icono: <ArchiveRestore className="w-7 h-7" aria-hidden="true" />,
    });
    if (!ok) return;
    setRestaurando('todo');
    let fallaron = 0;
    for (const { tipo, a } of lista) {
      try {
        await api.post(`/${tipo === 'servicio' ? 'services' : 'products'}/${a.id}/restaurar`, {});
        if (tipo === 'servicio') setServicios(l => (l ?? []).filter(x => x.id !== a.id));
        else setProductos(l => (l ?? []).filter(x => x.id !== a.id));
      } catch { fallaron++; }
    }
    await recargarCatalogo();
    setRestaurando(null);
    if (fallaron) showToast('Restaurado a medias', `${lista.length - fallaron} volvieron; ${fallaron} no se pudieron restaurar. Intenta de nuevo.`, 'warning');
    else showToast('Restaurado', `${lista.length} volvieron al catálogo`, 'success');
  };

  const texto = buscar.trim().toLowerCase();
  const filtra = (l: Archivado[] | null) => (l ?? []).filter(x => !texto || x.name.toLowerCase().includes(texto) || (x.sku ?? '').toLowerCase().includes(texto));
  const verServicios = que !== 'productos' ? filtra(servicios) : [];
  const verProductos = que !== 'servicios' ? filtra(productos) : [];
  const cargando = servicios === null || productos === null;
  const nada = !cargando && verServicios.length === 0 && verProductos.length === 0;

  const tarjeta = (tipo: 'servicio' | 'producto', a: Archivado, i: number) => (
    <ItemAnimado
      key={a.id}
      indice={i}
      tocable={false}
      className="flex flex-col gap-2.5 p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0">
      <MiniaturaCatalogo
        fotoId={a.fotoId ?? null}
        encuadre={null}
        esVideo={false}
        nombre={a.name}
        icono={(a.category && categoriaPorClave(tipo === 'servicio' ? 'service' : 'product', a.category)?.icon) || '✨'}
        color={a.color || '#94a3b8'}
        className="w-12 h-12 opacity-70 grayscale"
        pideFoto={false}
      />
      <div className="min-w-0 flex-1">
        <h4 className="font-bold text-[0.8125rem] leading-snug text-slate-900 dark:text-white line-clamp-2">{a.name}</h4>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
          <span className="font-semibold text-slate-600 dark:text-neutral-300">{tipo === 'servicio' ? 'Servicio' : 'Producto'}</span>
          {a.categoryName && <><span aria-hidden>·</span><span>{a.categoryName}</span></>}
          {tipo === 'servicio' && a.durationMinutes ? <><span aria-hidden>·</span><span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{a.durationMinutes} min</span></> : null}
          {a.soloEnEstaSede && sedeActual && (
            <span className="px-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold">
              Quitado solo en {sedeActual.name}
            </span>
          )}
        </div>
      </div>
      </div>
      <button
        type="button"
        onClick={() => restaurar(tipo, a)}
        disabled={restaurando === a.id}
        className="self-end inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold ios-touch cursor-pointer hover:opacity-90 disabled:opacity-60"
      >
        {restaurando === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
        Restaurar
      </button>
    </ItemAnimado>
  );

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex items-start gap-2.5 text-[0.6875rem] text-slate-600 dark:text-neutral-400">
        <Archive className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <p>
          Lo archivado no sale en el catálogo, la Vitrina, la caja ni en los chats de Lalan, pero sus ventas, citas, compras y recetas
          se guardan enteras. Restáuralo cuando quieras y vuelve como estaba.
          {varias && sedeActual && ` Ves lo archivado en ${sedeActual.name} y lo archivado en todas las sedes.`}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar en archivados..."
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
        />
      </div>

      <ChipsFiltro
        valor={que}
        onCambio={v => setQue(v as Que)}
        opciones={[
          { id: 'todos', label: 'Todo' },
          { id: 'servicios', label: `💅 Servicios${servicios ? ` (${servicios.length})` : ''}` },
          { id: 'productos', label: `🛍️ Productos${productos ? ` (${productos.length})` : ''}` },
        ]}
      />

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {!cargando && verServicios.length + verProductos.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void restaurarTodo()}
            disabled={restaurando !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--primary)]/40 text-[var(--primary)] bg-white dark:bg-neutral-900 text-[0.75rem] font-bold ios-touch cursor-pointer hover:bg-[var(--primary)]/5 disabled:opacity-60"
          >
            {restaurando === 'todo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
            Restaurar {texto || que !== 'todos' ? 'lo que ves' : 'todo'} ({verServicios.length + verProductos.length})
          </button>
        </div>
      )}

      {cargando ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : nada ? (
        <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
          <Archive className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{texto ? 'Nada archivado con ese nombre' : 'No hay nada archivado'}</h4>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">
            Cuando archives un servicio o un producto, aparece aquí para restaurarlo.
          </p>
        </div>
      ) : (
        <>
          {verServicios.length > 0 && (
            <section className="space-y-2">
              {que === 'todos' && <h3 className="text-[0.75rem] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">Servicios</h3>}
              <ListaAnimada clave="servicios" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {verServicios.map((a, i) => tarjeta('servicio', a, i))}
              </ListaAnimada>
            </section>
          )}
          {verProductos.length > 0 && (
            <section className="space-y-2">
              {que === 'todos' && <h3 className="text-[0.75rem] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">Productos</h3>}
              <ListaAnimada clave="productos" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {verProductos.map((a, i) => tarjeta('producto', a, i))}
              </ListaAnimada>
            </section>
          )}
        </>
      )}
      {modalConfirmar}
    </div>
  );
};

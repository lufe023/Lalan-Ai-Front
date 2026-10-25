import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FlaskConical, Loader2, Search, X } from 'lucide-react';
import { NOMBRE_PRESENCIA, saberProductosApi, type ComponenteEnProducto, type VinculoProducto } from '../../services/saberProductos';

/** Lo que se guarda después de crear un producto nuevo */
export interface VinculoPendiente { productoConocidoId: string | null; marca: string | null }

const etiqueta = 'block text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide';
const campo = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

const Lleva: React.FC<{ lleva: ComponenteEnProducto[] }> = ({ lleva }) => {
  if (!lleva.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {lleva.map((c) => {
        const fuerte = c.riesgos.some((r) => r.nivel !== 'precaucion');
        return (
          <span key={`${c.componente}-${c.marca ?? ''}`} title={c.riesgos.map((r) => r.texto).join(' ')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold ${fuerte ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
            <FlaskConical className="w-3 h-3" /> {c.componente} · {c.presencia === 'marca' ? c.marca : NOMBRE_PRESENCIA[c.presencia].toLowerCase()}
          </span>
        );
      })}
    </div>
  );
};

/**
 * "Qué producto es": Lalan propone el producto genérico de su base por el
 * nombre ("Acetona Cutex 4oz" → Acetona para uñas) y la dueña lo confirma.
 * Con eso se sabe qué lleva y se avisa al equipo si una clienta con cita es
 * alérgica a algo de ahí. La marca es opcional, nunca obligatoria.
 *
 * Con `productId` guarda al momento; sin él (producto nuevo) deja la elección
 * en `onPendiente` para guardarla después de crear el producto.
 */
export const QueProductoEs: React.FC<{
  productId: string | null;
  nombre: string;
  onPendiente?: (v: VinculoPendiente) => void;
  /** Se guardó el vínculo o la marca (para recargar lo que dependa de eso, como el aviso de la cita) */
  onVinculado?: () => void;
}> = ({ productId, nombre, onPendiente, onVinculado }) => {
  const [v, setV] = useState<VinculoProducto | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<{ id: string; nombre: string; categoria: string | null }[]>([]);
  const [marca, setMarca] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Producto nuevo: lo elegido a mano y lo que lleva
  const [elegido, setElegido] = useState<{ id: string; nombre: string; lleva: ComponenteEnProducto[] } | null>(null);
  const [descartada, setDescartada] = useState(false);

  // Producto guardado: su vínculo
  useEffect(() => {
    if (!productId) return;
    saberProductosApi.vinculo(productId).then((r) => { setV(r); setMarca(r.marca ?? ''); }).catch(() => setV(null));
  }, [productId]);

  // Producto nuevo: la propuesta sale del nombre mientras se escribe
  useEffect(() => {
    if (productId) return;
    const n = nombre.trim();
    if (n.length < 3) { setV(null); return; }
    const t = setTimeout(() => {
      saberProductosApi.sugerencia(n).then((r) => setV({ producto: n, actual: null, marca: null, sugerido: r.sugerido, marcaSugerida: r.marcaSugerida, lleva: r.lleva, enRiesgo: { clientas: 0, citas: 0, avisos: [] } })).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [productId, nombre]);

  useEffect(() => {
    if (!buscando) return;
    const t = setTimeout(() => { saberProductosApi.genericos(q).then(setResultados).catch(() => setResultados([])); }, 250);
    return () => clearTimeout(t);
  }, [buscando, q]);

  const avisar = (productoConocidoId: string | null, m: string | null) => onPendiente?.({ productoConocidoId, marca: m });

  const vincular = async (productoConocidoId: string | null, nombreGenerico?: string) => {
    setBuscando(false);
    if (!productId) {
      if (productoConocidoId) {
        const lleva = await saberProductosApi.lleva(productoConocidoId).catch(() => []);
        setElegido({ id: productoConocidoId, nombre: nombreGenerico ?? '', lleva });
      } else setElegido(null);
      avisar(productoConocidoId, marca.trim() || null);
      return;
    }
    setGuardando(true);
    try { setV(await saberProductosApi.vincular(productId, { productoConocidoId })); onVinculado?.(); } finally { setGuardando(false); }
  };

  const guardarMarca = async (m: string) => {
    setMarca(m);
    if (!productId) { avisar(elegido?.id ?? (v?.sugerido && !descartada ? v.sugerido.id : null), m.trim() || null); return; }
    if ((v?.marca ?? '') === m.trim()) return;
    setV(await saberProductosApi.vincular(productId, { productoConocidoId: v?.actual?.id ?? null, marca: m.trim() || null }));
    onVinculado?.();
  };

  // Lo que hay ahora mismo: confirmado (guardado) o elegido (nuevo)
  const confirmado = useMemo(() => {
    if (productId) return v?.actual?.confirmado ? { nombre: v.actual.nombre, lleva: v.lleva } : null;
    return elegido;
  }, [productId, v, elegido]);
  const propuesta = !confirmado && !descartada && v?.sugerido ? v.sugerido : null;

  if (!productId && nombre.trim().length < 3) return null;

  return (
    <div>
      <label className={etiqueta}>Qué producto es <span className="normal-case font-normal opacity-60">(para los avisos de alergia)</span></label>
      <div className="rounded-xl border border-slate-200 dark:border-neutral-700 p-3 space-y-2.5">
        {confirmado ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" />{confirmado.nombre}</span>
            <button type="button" onClick={() => { setBuscando(true); setQ(''); }} className="text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">Cambiar</button>
          </div>
        ) : propuesta ? (
          <div className="space-y-2">
            <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">Lalan cree que es <b>{propuesta.nombre}</b>.</p>
            {!productId && <Lleva lleva={v?.lleva ?? []} />}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={guardando} onClick={() => void vincular(propuesta.id, propuesta.nombre)}
                className="min-h-[36px] px-3 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Sí, es ese
              </button>
              <button type="button" onClick={() => { setDescartada(true); setBuscando(true); setQ(''); }}
                className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300 cursor-pointer">Es otro</button>
            </div>
          </div>
        ) : !buscando ? (
          <button type="button" onClick={() => { setBuscando(true); setQ(''); }} className="text-[0.8125rem] font-semibold text-[var(--primary)] flex items-center gap-1.5 cursor-pointer">
            <Search className="w-3.5 h-3.5" /> Buscar qué producto es
          </button>
        ) : null}

        {buscando && (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Acetona, tinte, cera…" className={`${campo} pl-8`} />
            </div>
            <ul className="max-h-48 overflow-auto rounded-xl border border-slate-100 dark:border-neutral-800 divide-y divide-slate-100 dark:divide-neutral-800">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => void vincular(r.id, r.nombre)} className="w-full text-left px-3 py-2 text-[0.8125rem] hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer">
                    <span className="font-semibold text-slate-800 dark:text-neutral-100">{r.nombre}</span>
                    {r.categoria && <span className="text-slate-400"> · {r.categoria}</span>}
                  </button>
                </li>
              ))}
              {!resultados.length && <li className="px-3 py-2 text-[0.75rem] text-slate-400">No está en la base.</li>}
            </ul>
            <div className="flex flex-wrap gap-3">
              {confirmado && (
                <button type="button" onClick={() => void vincular(null)} className="text-[0.75rem] font-semibold text-rose-600 flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> No es ninguno</button>
              )}
              <button type="button" onClick={() => setBuscando(false)} className="text-[0.75rem] font-semibold text-slate-500 cursor-pointer">Cerrar</button>
            </div>
            <p className="text-[0.6875rem] text-slate-400">¿No está? Lo vemos nosotros y lo añadimos a la base.</p>
          </div>
        )}

        {confirmado && <Lleva lleva={confirmado.lleva} />}

        {(confirmado || propuesta) && (
          <div>
            <input value={marca} onChange={(e) => setMarca(e.target.value)} onBlur={(e) => void guardarMarca(e.target.value)} maxLength={80}
              placeholder="Marca (opcional)" className={campo} />
            {!marca && v?.marcaSugerida && (
              <button type="button" onClick={() => void guardarMarca(v.marcaSugerida!)} className="mt-1 text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">¿Es {v.marcaSugerida}?</button>
            )}
          </div>
        )}

        {!!v?.enRiesgo.clientas && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[0.75rem] text-slate-800 dark:text-amber-100 space-y-1">
            <p className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {v.enRiesgo.clientas === 1 ? '1 clienta con alergia tiene' : `${v.enRiesgo.clientas} clientas con alergia tienen`} cita pronto con este producto
            </p>
            {v.enRiesgo.avisos.map((t) => <p key={t}>{t}</p>)}
            <p className="text-slate-500 dark:text-neutral-400">Si sabes la marca, ponla y Lalan te dirá si lo lleva.</p>
          </div>
        )}
      </div>
    </div>
  );
};

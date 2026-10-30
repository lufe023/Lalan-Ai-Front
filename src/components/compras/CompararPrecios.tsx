import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, Scale, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePlan } from '../../context/PlanContext';
import { IOSModal } from '../ui/IOSModal';
import { comprasApi, cantidadTexto, unidadTexto, type PorPedir as Fila, type Proveedor } from '../../services/compras';
import { botonPrincipal, campo, etiqueta } from './piezas';

/** Más proveedores por ronda es ruido para la dueña y para ellos (el backend pone el mismo tope) */
const MAXIMO = 5;

/**
 * Antes de comparar: a quiénes se les pide precio de cada producto. Salen
 * marcados los que ya lo venden en esa sede; se puede sumar a otro de la
 * lista para todos. Cada sede es su propia ronda (cada una recibe lo suyo).
 */
export const CompararPrecios: React.FC<{
  abierto: boolean; filas: Fila[]; proveedores: Proveedor[]; onClose: () => void; onCreada: (comparacionIds: string[]) => void;
}> = ({ abierto, filas, proveedores, onClose, onCreada }) => {
  const { showToast } = useApp();
  const clave = (f: Fila) => `${f.sede.id}:${f.productId}`;
  const [aQuien, setAQuien] = useState<Record<string, string[]>>({});
  const automaticas = usePlan().tieneModulo('compras_lalan');
  const [lalanPide, setLalanPide] = useState(true);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setAQuien(Object.fromEntries(filas.map((f) => [clave(f), f.opciones.slice(0, MAXIMO).map((o) => o.id)])));
  }, [abierto, filas]);

  const sedes = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of filas) (m.get(f.sede.id) ?? m.set(f.sede.id, []).get(f.sede.id)!).push(f);
    return [...m.values()];
  }, [filas]);
  const nombre = (id: string) => proveedores.find((p) => p.id === id)?.nombre ?? filas.flatMap((f) => f.opciones).find((o) => o.id === id)?.nombre ?? 'Proveedor';
  const vendeEn = (p: Proveedor, sede: string) => !p.sedes.length || p.sedes.includes(sede);
  const distintos = (grupo: Fila[]) => new Set(grupo.flatMap((f) => aQuien[clave(f)] ?? [])).size;
  const listo = sedes.length > 0 && sedes.every((g) => distintos(g) >= 2 && distintos(g) <= MAXIMO);

  const quitar = (f: Fila, id: string) => setAQuien((a) => ({ ...a, [clave(f)]: (a[clave(f)] ?? []).filter((x) => x !== id) }));
  /** Otro proveedor para todos los productos de esa sede */
  const sumar = (grupo: Fila[], id: string) => setAQuien((a) => {
    const n = { ...a };
    for (const f of grupo) n[clave(f)] = [...new Set([...(n[clave(f)] ?? []), id])];
    return n;
  });

  const crear = async () => {
    setCreando(true);
    try {
      const ids: string[] = [];
      for (const grupo of sedes) {
        const r = await comprasApi.comparar({
          locationId: grupo[0].sede.id, origen: grupo.some((f) => f.motivo === 'citas') ? 'mi_semana' : 'stock_bajo',
          items: grupo.filter((f) => (aQuien[clave(f)] ?? []).length).map((f) => ({ productId: f.productId, faltan: f.faltan, proveedorIds: aQuien[clave(f)] })),
        });
        ids.push(r.comparacionId);
        if (automaticas && lalanPide) await comprasApi.pedirATodos(r.comparacionId).catch((e) => showToast('Lalan no pudo pedir precio', (e as Error).message, 'warning'));
      }
      showToast(automaticas && lalanPide ? 'Lalan está pidiendo precios' : 'Comparación lista', automaticas && lalanPide ? 'Te aviso cuando contesten para que elijas.' : 'Pide precio desde la comparación cuando quieras.', 'success');
      onCreada(ids);
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setCreando(false); }
  };

  return (
    <IOSModal isOpen={abierto} onClose={onClose} title="Comparar precios" subtitle="Lalan le pide lo mismo a varios y tú eliges" fixedHeight={false}>
      <div className="space-y-3 p-1">
        {sedes.map((grupo) => {
          const otros = proveedores.filter((p) => vendeEn(p, grupo[0].sede.id));
          const n = distintos(grupo);
          return (
            <div key={grupo[0].sede.id} className="space-y-2">
              {sedes.length > 1 && <p className="text-[0.75rem] font-bold text-slate-500">Para {grupo[0].sede.nombre}</p>}
              {grupo.map((f) => (
                <div key={clave(f)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-1.5">
                  <p className="text-[0.8125rem] font-semibold text-slate-900 dark:text-white">{f.nombre}<span className="font-normal text-slate-500"> · faltan {cantidadTexto(f.faltan)} {unidadTexto(f.unidad)}</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {(aQuien[clave(f)] ?? []).map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[var(--primary)]/10 text-[0.75rem] font-semibold text-slate-800 dark:text-neutral-100">
                        {nombre(id)}
                        <button type="button" onClick={() => quitar(f, id)} aria-label={`No pedirle ${f.nombre} a ${nombre(id)}`} className="grid place-items-center size-5 rounded-full hover:bg-black/5 cursor-pointer"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    {!(aQuien[clave(f)] ?? []).length && <span className="text-[0.75rem] text-slate-400">A nadie: no entra en la comparación</span>}
                  </div>
                </div>
              ))}
              <label className="block"><span className={etiqueta}>Pedirle también a (todos los productos)</span>
                <select className={campo} value="" disabled={n >= MAXIMO} onChange={(e) => { if (e.target.value) sumar(grupo, e.target.value); }}>
                  <option value="">{n >= MAXIMO ? `Ya son ${MAXIMO}: el máximo` : 'Elige un proveedor…'}</option>
                  {otros.filter((p) => !grupo.every((f) => (aQuien[clave(f)] ?? []).includes(p.id))).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              {n < 2 && <p className="text-[0.75rem] text-rose-600">Para comparar hacen falta al menos dos proveedores{sedes.length > 1 ? ` en ${grupo[0].sede.nombre}` : ''}.</p>}
            </div>
          );
        })}
        {automaticas && <label className="flex items-start gap-2 text-[0.8125rem] text-slate-700 dark:text-neutral-200 cursor-pointer">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={lalanPide} onChange={(e) => setLalanPide(e.target.checked)} />
          <span><Bot className="inline w-3.5 h-3.5 text-violet-600 -mt-0.5" /> Que Lalan les pida precio ahora. Lee lo que contesten (mensaje, PDF o foto) y nunca compra sin tu sí.</span>
        </label>}
        <button type="button" disabled={!listo || creando} onClick={() => void crear()} className={`${botonPrincipal} w-full py-3`}>
          {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />} Comparar con {sedes.length === 1 ? distintos(sedes[0]) : 'varios'} proveedores
        </button>
      </div>
    </IOSModal>
  );
};

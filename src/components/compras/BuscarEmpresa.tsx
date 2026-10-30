import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Building2, Check, Loader2, Sparkles } from 'lucide-react';
import { comprasApi, type EmpresasEncontradas } from '../../services/compras';

/** Lo que se llena al elegir una empresa de la lista */
export interface EmpresaElegida {
  nombre: string; rnc: string | null; direccion?: string | null; plataformaId?: string | null;
  contacto?: string | null; whatsapp?: string | null; correo?: string | null; telefono?: string | null;
}

/** La DGII escribe todo en mayúsculas: «ELIBETH BEAUTY SUPPLY SRL» → «Elibeth Beauty Supply SRL» */
const SIGLAS = /^(s\.?r\.?l\.?|s\.?a\.?s?|e\.?i\.?r\.?l\.?|c\.?x\.?a\.?|r\.?l\.?)$/i;
const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en']);
export function nombreBonito(n: string): string {
  if (n !== n.toUpperCase()) return n;
  return n.toLowerCase().split(/\s+/).map((w, i) => (SIGLAS.test(w) ? w.toUpperCase() : i && MENORES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

/**
 * Mientras se escribe el nombre o el RNC de un proveedor nuevo, busca en la
 * lista de Lalan y en el registro de la DGII. Al tocar uno se llenan nombre,
 * RNC y dirección; los contactos los pone el salón (salvo los proveedores
 * que Lalan ya publicó con los suyos).
 */
export const BuscarEmpresa: React.FC<{ q: string; activo: boolean; onElegir: (e: EmpresaElegida) => void; onCerrar: () => void }> = ({ q, activo, onElegir, onCerrar }) => {
  const [r, setR] = useState<EmpresasEncontradas | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    const texto = q.trim();
    if (!activo || texto.replace(/[\s-]/g, '').length < 3) { setR(null); setBuscando(false); return; }
    const n = ++ultima.current;
    setBuscando(true);
    const t = window.setTimeout(() => {
      comprasApi.empresas(texto)
        .then((x) => { if (n === ultima.current) setR(x); })
        .catch(() => { if (n === ultima.current) setR(null); })
        .finally(() => { if (n === ultima.current) setBuscando(false); });
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, activo]);

  if (!activo || (!buscando && !r)) return null;
  const hay = !!r && (r.plataforma.length > 0 || r.dgii.length > 0);
  if (!buscando && !hay) return null;

  const fila = 'w-full flex items-start gap-2.5 px-3 py-2 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 disabled:cursor-default disabled:opacity-60';
  const titulo = 'px-3 pt-2 pb-1 text-[0.625rem] uppercase font-bold tracking-wider text-slate-400 dark:text-neutral-500 flex items-center gap-1';
  const yaLoTienes = <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[0.6875rem] font-bold text-emerald-600 dark:text-emerald-400"><Check className="w-3 h-3" /> Ya lo tienes</span>;

  return (
    <div role="listbox" aria-label="Empresas encontradas" className="mt-1 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden max-h-72 overflow-y-auto">
      {buscando && !hay && <div className="flex items-center gap-2 px-3 py-2.5 text-[0.75rem] text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…</div>}
      {!!r?.plataforma.length && (
        <>
          <p className={titulo}><Sparkles className="w-3 h-3" /> En la lista de Lalan</p>
          {r.plataforma.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} disabled={p.yaLoTienes}
              onClick={() => { onElegir({ nombre: p.nombre, rnc: p.rnc, direccion: p.direccion, plataformaId: p.id, contacto: p.contacto, whatsapp: p.whatsapp, correo: p.correo, telefono: p.telefono }); onCerrar(); }}
              className={fila}>
              <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-bold text-slate-900 dark:text-white truncate">{p.nombre}</span>
                <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">{[p.rnc && `RNC ${p.rnc}`, p.direccion].filter(Boolean).join(' · ') || 'Sin RNC'}</span>
              </span>
              {p.yaLoTienes && yaLoTienes}
            </button>
          ))}
        </>
      )}
      {!!r?.dgii.length && (
        <>
          <p className={titulo}><Building2 className="w-3 h-3" /> En la DGII</p>
          {r.dgii.map((e) => (
            <button key={e.rnc} type="button" role="option" aria-selected={false} disabled={e.yaLoTienes}
              onClick={() => { onElegir({ nombre: nombreBonito(e.comercial ?? e.nombre), rnc: e.rnc }); onCerrar(); }}
              className={fila}>
              <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-bold text-slate-900 dark:text-white truncate">{nombreBonito(e.comercial ?? e.nombre)}</span>
                <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">RNC {e.rnc}{e.comercial ? ` · ${nombreBonito(e.nombre)}` : ''}{e.actividad ? ` · ${e.actividad.toLowerCase()}` : ''}</span>
              </span>
              {e.yaLoTienes && yaLoTienes}
            </button>
          ))}
        </>
      )}
    </div>
  );
};

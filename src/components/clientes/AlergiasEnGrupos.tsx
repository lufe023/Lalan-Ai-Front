import React, { useCallback, useEffect, useState } from 'react';
import { Check, Plus, ShieldAlert, Sparkles, X } from 'lucide-react';
import { saberProductosApi, type AlergiasClienta } from '../../services/saberProductos';
import { useConfirmar } from '../ui/ModalConfirmar';

/**
 * Las alergias de la clienta en grupos (Amoniaco, Tintes con PPD…): con ellos
 * Lalan cruza la receta de cada servicio y avisa al equipo. Lo que se lee en
 * el texto de alergias sale solo; el equipo lo confirma, añade lo que falte o
 * descarta lo que no es. El texto de la ficha no se toca.
 */
export const AlergiasEnGrupos: React.FC<{ clienteId: string; texto: string | null | undefined }> = ({ clienteId, texto }) => {
  const [datos, setDatos] = useState<AlergiasClienta | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const { confirmar, modalConfirmar } = useConfirmar();

  const cargar = useCallback(() => {
    saberProductosApi.alergias(clienteId).then(setDatos).catch(() => setDatos(null));
  }, [clienteId]);
  // El texto cambia al editar la ficha: se vuelve a leer
  useEffect(() => { cargar(); }, [cargar, texto]);

  if (!datos) return null;
  const nombre = (clave: string) => datos.grupos.find((g) => g.clave === clave)?.nombre ?? clave;
  const estado = (clave: string) => datos.decididos.find((d) => d.grupo === clave)?.estado;
  const marcar = (grupo: string, e: 'confirmada' | 'descartada' | null) => saberProductosApi.marcarAlergia(clienteId, grupo, e).then(setDatos).catch(() => undefined);
  const quitar = async (grupo: string) => {
    const si = await confirmar({
      titulo: `¿Quitar "${nombre(grupo)}" de sus alergias?`,
      mensaje: 'Lalan dejará de avisar al equipo por esta alergia en sus citas. El texto de la ficha no cambia.',
      textoConfirmar: 'Quitar', tono: 'peligro',
    });
    if (si) void marcar(grupo, 'descartada');
  };
  const libres = datos.grupos.filter((g) => !datos.vigentes.includes(g.clave));
  const descartados = datos.decididos.filter((d) => d.estado === 'descartada');

  if (!datos.vigentes.length && !texto && !anadiendo) {
    return (
      <button type="button" onClick={() => setAnadiendo(true)} className="text-[0.75rem] font-semibold text-[var(--primary)] flex items-center gap-1 cursor-pointer">
        <Plus className="w-3.5 h-3.5" /> Anotar una alergia para los avisos de productos
      </button>
    );
  }

  return (
    <div id="alergias-clienta" className="p-3 rounded-xl border border-amber-500/25 space-y-2">
      {modalConfirmar}
      <div className="flex items-center gap-1.5 font-bold text-[0.75rem] text-amber-700 dark:text-amber-300">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
        <span>Alergias que Lalan cruza con los productos</span>
      </div>
      {datos.vigentes.length === 0 && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Lalan no reconoce ninguna sustancia en el texto. Si hay una, añádela.</p>}
      <div className="flex flex-wrap gap-1.5">
        {datos.vigentes.map((g) => {
          const confirmada = estado(g) === 'confirmada';
          const deIa = !confirmada && !!datos.porIa?.includes(g);
          return (
            <span key={g} title={deIa ? 'La leyó la IA de Lalan en la nota' : undefined} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-[0.75rem] font-semibold ${confirmada ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-dashed border-amber-500/40'}`}>
              {deIa && <Sparkles className="w-3 h-3" aria-label="Leída por IA" />}
              {nombre(g)}
              {!confirmada && (
                <button type="button" title="Confirmar" aria-label={`Confirmar ${nombre(g)}`} onClick={() => void marcar(g, 'confirmada')} className="p-1 rounded-full hover:bg-amber-500/20 cursor-pointer"><Check className="w-3 h-3" /></button>
              )}
              <button type="button" title="Quitar" aria-label={`Quitar ${nombre(g)}`} onClick={() => void quitar(g)} className="p-1 rounded-full hover:bg-amber-500/20 cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          );
        })}
        {anadiendo ? (
          <select autoFocus defaultValue="" onBlur={() => setAnadiendo(false)}
            onChange={(e) => { if (e.target.value) void marcar(e.target.value, 'confirmada'); setAnadiendo(false); }}
            className="px-2 py-1 rounded-full text-[0.75rem] bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200">
            <option value="" disabled>Elige la sustancia…</option>
            {libres.map((g) => <option key={g.clave} value={g.clave}>{g.nombre}</option>)}
          </select>
        ) : (
          <button type="button" onClick={() => setAnadiendo(true)} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-[var(--primary)] border border-slate-200 dark:border-neutral-700 cursor-pointer">
            <Plus className="w-3 h-3" /> Añadir
          </button>
        )}
      </div>
      {datos.vigentes.some((g) => estado(g) !== 'confirmada') && (
        <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Las punteadas las leyó Lalan en el texto{datos.porIa?.some((g) => estado(g) !== 'confirmada') ? ' (las de ✦ con IA)' : ''}: confírmalas o quítalas.</p>
      )}
      {descartados.length > 0 && (
        <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
          Quitadas: {descartados.map((d, i) => (
            <React.Fragment key={d.grupo}>{i > 0 && ', '}<button type="button" onClick={() => void marcar(d.grupo, null)} className="underline cursor-pointer">{nombre(d.grupo)}</button></React.Fragment>
          ))} (toca para volver a contarla)
        </p>
      )}
    </div>
  );
};

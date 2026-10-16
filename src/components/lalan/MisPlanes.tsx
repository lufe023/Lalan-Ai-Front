import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ChevronDown, FileDown, FileText, Loader2, MapPin, Trash2, X } from 'lucide-react';
import { api, descargarArchivo } from '../../services/api';
import { useSedes } from '../../hooks/useSedes';
import { SelectorSede } from '../ui/SelectorSede';

/**
 * Mis planes: lo que la dueña planificó con Lalan (redes, ventas,
 * promociones) queda guardado aquí para que no se pierda en la conversación.
 * Cada plan es de una sede y se descarga en PDF.
 */

export interface PlanGuardado {
  id: string;
  tipo: 'redes' | 'ventas' | 'promocion' | 'otro';
  titulo: string;
  sedeId: string;
  sede: string;
  creadoEn: string;
  contenido: {
    objetivo: string;
    resumen: string;
    secciones: { titulo: string; puntos: string[] }[];
    calendario: { cuando: string; que: string }[];
    medir: string[];
    periodo: 'semana' | 'mes';
  };
}

const TIPO: Record<PlanGuardado['tipo'], string> = { redes: 'Redes sociales', ventas: 'Ventas', promocion: 'Promoción', otro: 'Plan' };
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });

/** Descarga el PDF de un plan (la tarjeta de Lalan y esta lista usan lo mismo) */
export async function descargarPlan(id: string, titulo: string) {
  await descargarArchivo(`/asistente/documentos/${id}/pdf`, `${titulo}.pdf`);
}

export const MisPlanes: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const sedes = useSedes();
  const [sede, setSede] = useState('');
  const [planes, setPlanes] = useState<PlanGuardado[] | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const temporizador = useRef<number | undefined>(undefined);

  const cargar = useCallback(async () => {
    setError('');
    try { setPlanes(await api.get<PlanGuardado[]>(`/asistente/documentos${sede ? `?sede=${sede}` : ''}`)); }
    catch { setPlanes([]); setError('No pude traer tus planes. Inténtalo de nuevo.'); }
  }, [sede]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const descargar = async (p: PlanGuardado) => {
    setBajando(p.id);
    try { await descargarPlan(p.id, p.titulo); }
    catch { setError('No se pudo descargar el PDF. Inténtalo de nuevo.'); }
    finally { setBajando(null); }
  };

  // Un "¿Borrar?" que se apaga solo: no debe quedarse armado para un toque accidental
  const borrar = async (p: PlanGuardado) => {
    if (confirmando !== p.id) {
      setConfirmando(p.id);
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => setConfirmando(null), 4000);
      return;
    }
    setConfirmando(null);
    try {
      await api.delete(`/asistente/documentos/${p.id}`);
      setPlanes((ps) => (ps ?? []).filter((x) => x.id !== p.id));
    } catch { setError('No se pudo borrar. Inténtalo de nuevo.'); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center bg-slate-900/30 backdrop-blur-sm" onClick={onCerrar}>
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Mis planes"
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl text-slate-900 dark:text-neutral-100"
      >
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <FileText className="w-5 h-5 text-[var(--primary)]" />
          <h2 className="flex-1 text-[1.0625rem] font-bold tracking-tight">Mis planes</h2>
          <SelectorSede sedes={sedes} value={sede} onChange={setSede} todas />
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-2 -mr-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2.5">
          {error && <p className="text-[0.8125rem] text-red-600 dark:text-red-400">{error}</p>}
          {planes === null && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
          {planes?.length === 0 && !error && (
            <div className="py-8 text-center space-y-1.5">
              <p className="text-[0.9375rem] font-semibold">Todavía no hay planes</p>
              <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 leading-snug">
                Pídele a Lalan algo como «Armemos un plan de Instagram para este mes». Cuando estén de acuerdo, dile «guárdalo».
              </p>
            </div>
          )}
          {planes?.map((p) => {
            const visto = abierto === p.id;
            return (
              <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-neutral-800 p-3.5 space-y-2.5">
                <button type="button" onClick={() => setAbierto(visto ? null : p.id)} aria-expanded={visto} className="w-full flex items-start gap-2 text-left cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.9375rem] font-semibold leading-snug">{p.titulo}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-slate-500 dark:text-neutral-400">
                      <span>{TIPO[p.tipo] ?? 'Plan'}</span>
                      <span>{fecha(p.creadoEn)}</span>
                      {p.sede && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300">
                          <MapPin className="w-3 h-3" /> {p.sede}
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 mt-1 shrink-0 text-slate-400 transition-transform ${visto ? 'rotate-180' : ''}`} />
                </button>
                {visto && (
                  <div className="space-y-2.5 text-[0.8125rem] leading-snug text-slate-700 dark:text-neutral-300">
                    <p className="italic">{p.contenido.objetivo}</p>
                    {p.contenido.secciones.map((s) => (
                      <div key={s.titulo}>
                        <p className="font-semibold text-slate-900 dark:text-neutral-100">{s.titulo}</p>
                        <ul className="mt-1 space-y-1 list-disc pl-4 marker:text-[var(--primary)]">
                          {s.puntos.map((x, k) => <li key={k}>{x}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => descargar(p)} disabled={bajando === p.id}
                    className="flex-1 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">
                    {bajando === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Descargar PDF
                  </button>
                  <button type="button" onClick={() => borrar(p)}
                    aria-label={confirmando === p.id ? `Confirmar: borrar ${p.titulo}` : `Borrar ${p.titulo}`}
                    className={`px-3 py-2 rounded-xl text-[0.8125rem] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${confirmando === p.id
                      ? 'bg-red-600 text-white'
                      : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
                    <Trash2 className="w-4 h-4" /> {confirmando === p.id ? '¿Borrar?' : ''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

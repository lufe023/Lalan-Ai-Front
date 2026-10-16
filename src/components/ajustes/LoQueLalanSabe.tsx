import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Heart, Loader2, Lock, Trash2, Undo2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

/**
 * Mi cuenta → Lo que Lalan sabe de ti: lo que la persona le contó a Lalan de
 * sí misma. Es solo suyo: no lo ve el equipo del salón ni Plataforma. Puede
 * borrar cada cosa, todo, o pedir que Lalan nunca guarde ese tema.
 */

interface Recuerdo { id: string; texto: string; tema: string; temaNombre: string; creadoEn: string }
interface LoQueSabe { recuerdos: Recuerdo[]; vetados: { tema: string; nombre: string }[] }

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });

/** Lo que espera un segundo toque: borrar uno, "nunca", o borrar todo */
type Armado = { id: string; que: 'borrar' | 'nunca' } | { id: 'todo'; que: 'todo' } | null;

export const LoQueLalanSabe: React.FC = () => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<LoQueSabe | null>(null);
  const [error, setError] = useState('');
  const [armado, setArmado] = useState<Armado>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const temporizador = useRef<number | undefined>(undefined);

  const cargar = useCallback(async () => {
    setError('');
    try { setDatos(await api.get<LoQueSabe>('/asistente/recuerdos')); }
    catch { setDatos({ recuerdos: [], vetados: [] }); setError('No pude traer lo que Lalan sabe de ti. Inténtalo de nuevo.'); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  // Un "¿Seguro?" que se apaga solo: no debe quedarse armado para un toque accidental
  const armar = (a: NonNullable<Armado>) => {
    setArmado(a);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setArmado(null), 4000);
  };
  const estaArmado = (id: string, que: NonNullable<Armado>['que']) => armado?.id === id && armado.que === que;

  const borrar = async (r: Recuerdo, nunca: boolean) => {
    const que = nunca ? 'nunca' : 'borrar';
    if (!estaArmado(r.id, que)) { armar({ id: r.id, que }); return; }
    setArmado(null);
    setTrabajando(r.id);
    try {
      await api.delete(`/asistente/recuerdos/${r.id}${nunca ? '?nunca=true' : ''}`);
      showToast(nunca ? 'Lalan no lo guardará más' : 'Borrado', nunca ? `Borró eso y no volverá a guardar nada de «${r.temaNombre}».` : 'Lalan ya no se acuerda de eso.', 'success');
      void cargar();
    } catch { setError('No se pudo borrar. Inténtalo de nuevo.'); }
    finally { setTrabajando(null); }
  };

  const borrarTodo = async () => {
    if (!estaArmado('todo', 'todo')) { armar({ id: 'todo', que: 'todo' }); return; }
    setArmado(null);
    setTrabajando('todo');
    try {
      await api.delete('/asistente/recuerdos');
      showToast('Listo', 'Lalan olvidó todo lo que le contaste.', 'success');
      void cargar();
    } catch { setError('No se pudo borrar. Inténtalo de nuevo.'); }
    finally { setTrabajando(null); }
  };

  const quitarVeto = async (tema: string, nombre: string) => {
    setTrabajando(`veto-${tema}`);
    try {
      await api.delete(`/asistente/recuerdos/vetados/${tema}`);
      showToast('Listo', `Lalan puede volver a acordarse de «${nombre}» si se lo cuentas.`, 'info');
      void cargar();
    } catch { setError('No se pudo cambiar. Inténtalo de nuevo.'); }
    finally { setTrabajando(null); }
  };

  const recuerdos = datos?.recuerdos ?? [];

  return (
    <div data-guia="lo-que-lalan-sabe" className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
      <div className="flex items-center gap-1.5">
        <Heart className="w-4 h-4 text-[var(--primary)]" />
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Lo que Lalan sabe de ti</span>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-neutral-400 leading-snug">
        <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>Lo que le cuentas de ti a Lalan, para acompañarte mejor. Es solo entre ustedes dos: no lo ve tu equipo, ni el equipo de Lalan, ni sale en informes. También puedes decirle «olvida eso».</span>
      </p>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {datos === null && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
      {datos && recuerdos.length === 0 && !error && (
        <div className="py-4 text-center space-y-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Lalan todavía no sabe nada de ti</p>
          <p className="text-xs text-slate-500 dark:text-neutral-400 leading-snug">Cuando le cuentes algo tuyo, como cómo es tu día o lo que quieres lograr, lo verás aquí.</p>
        </div>
      )}

      {recuerdos.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
          {recuerdos.map((r) => (
            <li key={r.id} className="py-2.5 space-y-1.5">
              <p className="text-sm text-slate-800 dark:text-neutral-100 leading-snug">{r.texto}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] text-slate-600 dark:text-neutral-300">{r.temaNombre}</span>
                <span className="text-[0.6875rem] text-slate-400 dark:text-neutral-500">{fecha(r.creadoEn)}</span>
                <span className="flex-1" />
                {trabajando === r.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (
                  <>
                    <button type="button" onClick={() => borrar(r, true)}
                      aria-label={estaArmado(r.id, 'nunca') ? `Confirmar: borrar y nunca guardar nada de ${r.temaNombre}` : `Nunca guardes nada de ${r.temaNombre}`}
                      className={`px-2.5 py-1.5 rounded-lg text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${estaArmado(r.id, 'nunca')
                        ? 'bg-red-600 text-white'
                        : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
                      <Ban className="w-3.5 h-3.5" /> {estaArmado(r.id, 'nunca') ? `¿Nunca nada de «${r.temaNombre}»?` : 'Nunca guardes esto'}
                    </button>
                    <button type="button" onClick={() => borrar(r, false)}
                      aria-label={estaArmado(r.id, 'borrar') ? `Confirmar: borrar ${r.texto}` : `Borrar ${r.texto}`}
                      className={`px-2.5 py-1.5 rounded-lg text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${estaArmado(r.id, 'borrar')
                        ? 'bg-red-600 text-white'
                        : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
                      <Trash2 className="w-3.5 h-3.5" /> {estaArmado(r.id, 'borrar') ? '¿Borrar?' : ''}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {datos && datos.vetados.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Lalan nunca guarda</p>
          <div className="flex flex-wrap gap-1.5">
            {datos.vetados.map((v) => (
              <button key={v.tema} type="button" onClick={() => quitarVeto(v.tema, v.nombre)} disabled={trabajando === `veto-${v.tema}`}
                aria-label={`Dejar que Lalan vuelva a guardar ${v.nombre}`}
                className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-600 dark:text-neutral-300 flex items-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 disabled:opacity-60">
                {v.nombre} <Undo2 className="w-3 h-3" />
              </button>
            ))}
          </div>
          <p className="text-[0.6875rem] text-slate-400 dark:text-neutral-500">Toca un tema para que Lalan pueda volver a acordarse de él.</p>
        </div>
      )}

      {recuerdos.length > 0 && (
        <button type="button" onClick={borrarTodo} disabled={trabajando === 'todo'}
          className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border transition-colors disabled:opacity-60 ${estaArmado('todo', 'todo')
            ? 'bg-red-600 text-white border-red-600'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}>
          {trabajando === 'todo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {estaArmado('todo', 'todo') ? (recuerdos.length === 1 ? '¿Borrarlo? Toca otra vez' : `¿Borrar las ${recuerdos.length} cosas? Toca otra vez`) : 'Borrar todo'}
        </button>
      )}
    </div>
  );
};

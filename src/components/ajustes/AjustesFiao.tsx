import React, { useCallback, useEffect, useState } from 'react';
import { HandCoins, Loader2, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { api } from '../../services/api';
import { IOSToggle } from '../ui/IOSToggle';
import { AvisoSedeActiva } from '../ui/AvisoSedeActiva';

interface Ajustes {
  fiaoActivo: boolean;
  fiaoPideAutorizacion: boolean;
  fiaoSeApruebanSolos: string[];
  fiaoTope: number | null;
  fiaoAbonoOtraSede: boolean;
  fiaoDiasGracia: number;
  fiaoRecargoPct: number;
  fiaoRecargoCada: 'una_vez' | 'mes';
  fiaoDiasVencido: number;
  equipo: { id: string; nombre: string; cargo: string | null }[];
}

const GRACIAS = [0, 5, 15, 30];

/**
 * Ajustes → Caja → Fiao: si la sede fía, quién necesita permiso de la dueña,
 * hasta cuánto, y si cobra recargo. Todo es de cada sede, y cada fiao guarda
 * las condiciones con que se dio: cambiar esto no toca las deudas de hoy.
 */
export const AjustesFiao: React.FC = () => {
  const { showToast, baseCurrency } = useApp();
  const { varias, actual } = useSedeActiva();
  const [a, setA] = useState<Ajustes | null>(null);
  const [tope, setTope] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const enTodas = varias && !actual;
  const sim = baseCurrency?.symbol ?? '';

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<Ajustes>('/fiao/ajustes');
      setA(r);
      setTope(r?.fiaoTope != null ? String(r.fiaoTope) : '');
    } catch { setA(null); }
  }, []);
  // Al cambiar de sede se ve lo de esa sede
  useEffect(() => { if (!enTodas) void cargar(); }, [cargar, enTodas, actual?.id]);

  const poner = <K extends keyof Ajustes>(k: K, v: Ajustes[K]) => setA(p => (p ? { ...p, [k]: v } : p));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!a) return;
    setError('');
    const t = tope.trim();
    if (t && !(Number(t) > 0)) { setError('El tope tiene que ser mayor que cero, o quedar vacío para no tener tope.'); return; }
    setGuardando(true);
    try {
      const r = await api.put<Ajustes>('/fiao/ajustes', {
        fiaoActivo: a.fiaoActivo,
        fiaoPideAutorizacion: a.fiaoPideAutorizacion,
        fiaoSeApruebanSolos: a.fiaoSeApruebanSolos,
        fiaoTope: t ? Number(t) : null,
        fiaoAbonoOtraSede: a.fiaoAbonoOtraSede,
        fiaoDiasGracia: a.fiaoDiasGracia,
        fiaoRecargoPct: a.fiaoRecargoPct,
        fiaoRecargoCada: a.fiaoRecargoCada,
        fiaoDiasVencido: a.fiaoDiasVencido,
      });
      setA(r);
      showToast('Guardado', a.fiaoActivo ? 'Estas reglas valen para los fiaos nuevos de esta sede.' : 'El fiao quedó apagado en esta sede.', 'success');
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar.');
    } finally { setGuardando(false); }
  };

  const campo = 'w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none';
  const ejemplo = 'text-[0.6875rem] text-slate-500 dark:text-neutral-400 leading-relaxed';
  const titulo = 'text-[0.8125rem] font-bold text-slate-800 dark:text-neutral-100';
  const boton = (activo: boolean) => `py-1.5 rounded-lg text-[0.6875rem] font-bold transition ios-touch cursor-pointer ${activo
    ? 'bg-emerald-600 text-white shadow-xs'
    : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300'}`;

  const ejemploRecargo = a && a.fiaoRecargoPct > 0
    ? `Ejemplo: fía ${sim}2,000. ${a.fiaoDiasGracia === 0 ? 'Ese mismo día' : `A los ${a.fiaoDiasGracia} días`} se suman ${sim}${(2000 * a.fiaoRecargoPct / 100).toLocaleString('es')}${a.fiaoRecargoCada === 'mes' ? ', y otro tanto cada 30 días mientras siga debiendo (sobre lo que deba del consumo, no sobre recargos).' : ', una sola vez.'}`
    : 'Sin recargo: debe lo mismo que habría pagado de contado.';

  return (
    <form onSubmit={guardar} className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
      <div className="flex items-center gap-1.5">
        <HandCoins className="w-4 h-4 text-[var(--primary)]" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Fiao</h2>
      </div>
      <p className="text-[0.75rem] text-slate-400 leading-relaxed">
        Dar crédito a una clienta: se lleva el servicio o el producto y paga después, en abonos.
        Lo que se debe se ve y se abona en Caja, Fiao. Lalan nunca le habla a una clienta de lo que debe: cobrar es cosa tuya o de tu equipo.
      </p>

      <AvisoSedeActiva que="Las reglas del fiao de abajo son de esta sede."
        enTodas="Estás viendo todas las sedes. Cada sede decide si fía y con qué reglas: elige cuál quieres configurar." />

      {enTodas ? null : !a ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={titulo}>Fiar en esta sede</p>
              <p className={ejemplo}>Apagado, nadie puede dejar una cuenta fiada; al cobrar hay que cobrar todo.</p>
            </div>
            <IOSToggle checked={a.fiaoActivo} onChange={v => poner('fiaoActivo', v)} ariaLabel="Fiar en esta sede" />
          </div>

          {a.fiaoActivo && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={titulo}>Cada fiao lo autorizo yo</p>
                  <p className={ejemplo}>Cuando alguien del equipo quiera fiar, te llega un aviso al teléfono: "Ana quiere fiarle {sim}1,500 a Laura". La cuenta espera abierta hasta que respondas.</p>
                </div>
                <IOSToggle checked={a.fiaoPideAutorizacion} onChange={v => poner('fiaoPideAutorizacion', v)} ariaLabel="Autorizar cada fiao" />
              </div>

              {a.fiaoPideAutorizacion && a.equipo.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/50 space-y-2">
                  <p className="text-[0.75rem] font-bold text-slate-700 dark:text-slate-300">A quién le apruebo todo solo</p>
                  {a.equipo.map(p => {
                    const solo = a.fiaoSeApruebanSolos.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[0.8125rem] text-slate-800 dark:text-neutral-100 truncate">{p.nombre}</p>
                          {p.cargo && <p className="text-[0.6875rem] text-slate-400">{p.cargo}</p>}
                        </div>
                        <IOSToggle checked={solo} ariaLabel={`Aprobar solos los fiaos de ${p.nombre}`}
                          onChange={v => poner('fiaoSeApruebanSolos', v ? [...a.fiaoSeApruebanSolos, p.id] : a.fiaoSeApruebanSolos.filter(x => x !== p.id))} />
                      </div>
                    );
                  })}
                  <p className={ejemplo}>Sus fiaos se aprueban sin preguntarte, salvo que pasen el tope de la clienta: eso siempre te llega.</p>
                </div>
              )}

              <label className="block">
                <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Tope por clienta {sim && `(${sim})`}</span>
                <input type="number" min="0" step="100" inputMode="decimal" value={tope} onChange={e => setTope(e.target.value)} placeholder="Sin tope" className={`${campo} font-bold`} />
                <span className={ejemplo}>Lo máximo que una clienta puede deber en esta sede. Vacío: sin tope. Pasarse siempre lo autorizas tú.</span>
              </label>

              <div>
                <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Recargo</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className={ejemplo}>Porcentaje</span>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min="0" max="100" step="0.5" value={a.fiaoRecargoPct}
                        onChange={e => poner('fiaoRecargoPct', Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        className={`${campo} font-bold`} />
                      <span className="font-bold text-slate-400 text-sm">%</span>
                    </div>
                  </label>
                  <div>
                    <span className={ejemplo}>Cada cuánto</span>
                    <div className="grid grid-cols-2 gap-1">
                      <button type="button" onClick={() => poner('fiaoRecargoCada', 'una_vez')} className={boton(a.fiaoRecargoCada === 'una_vez')}>Una vez</button>
                      <button type="button" onClick={() => poner('fiaoRecargoCada', 'mes')} className={boton(a.fiaoRecargoCada === 'mes')}>Cada 30 días</button>
                    </div>
                  </div>
                </div>
                {a.fiaoRecargoPct > 0 && (
                  <div className="mt-2">
                    <span className={ejemplo}>Días de gracia (sin recargo)</span>
                    <div className="grid grid-cols-5 gap-1">
                      {GRACIAS.map(d => (
                        <button key={d} type="button" onClick={() => poner('fiaoDiasGracia', d)} className={boton(a.fiaoDiasGracia === d)}>
                          {d === 0 ? 'Desde el día 0' : `${d} días`}
                        </button>
                      ))}
                      <input type="number" min="0" max="365" value={a.fiaoDiasGracia}
                        onChange={e => poner('fiaoDiasGracia', Math.min(365, Math.max(0, Math.trunc(Number(e.target.value) || 0))))}
                        aria-label="Otros días de gracia"
                        className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-bold text-center text-slate-900 dark:text-white" />
                    </div>
                  </div>
                )}
                <p className={`${ejemplo} mt-1`}>{ejemploRecargo}</p>
              </div>

              <label className="block">
                <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Se ve vencido a los</span>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="1" max="365" value={a.fiaoDiasVencido}
                    onChange={e => poner('fiaoDiasVencido', Math.min(365, Math.max(1, Math.trunc(Number(e.target.value) || 1))))}
                    className={`${campo} font-bold`} />
                  <span className="font-bold text-slate-400 text-sm shrink-0">días</span>
                </div>
                <span className={ejemplo}>Cuando no prometió una fecha. Si la prometió, se ve vencido al pasar ese día.</span>
              </label>

              {varias && (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={titulo}>Recibir aquí abonos de otras sedes</p>
                    <p className={ejemplo}>Una clienta que debe en otra sede puede abonar aquí. Cada abono así lo autorizas tú, y el dinero entra en la caja de esta sede.</p>
                  </div>
                  <IOSToggle checked={a.fiaoAbonoOtraSede} onChange={v => poner('fiaoAbonoOtraSede', v)} ariaLabel="Recibir abonos de otras sedes" />
                </div>
              )}
            </>
          )}

          {error && <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}
          <button type="submit" disabled={guardando}
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer hover:opacity-90 shadow-sm disabled:opacity-40">
            <Save className="w-3.5 h-3.5" /> Guardar fiao
          </button>
        </>
      )}
    </form>
  );
};

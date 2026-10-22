import React, { useState } from 'react';
import { FastForward, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { usePlan } from '../../context/PlanContext';
import type { MiPlan } from '../../types/plataforma';
import { useConfirmar } from '../ui/ModalConfirmar';

/** Las cantidades que se ofrecen: de 50 en 50 hasta lo que puede, como mucho 5 botones */
function opciones(maximo: number): number[] {
  const paso = maximo <= 250 ? 50 : Math.ceil(maximo / 5 / 50) * 50;
  const lista: number[] = [];
  for (let n = paso; n < maximo && lista.length < 4; n += paso) lista.push(n);
  return [...lista, maximo];
}

/**
 * Adelantar respuestas del mes que viene: la dueña elige cuántas (hasta lo
 * que deja su plan) y se le descuentan el mes siguiente. Pide confirmación
 * diciendo con cuántas empezará el próximo mes.
 */
export const AdelantarRespuestas: React.FC<{ compacto?: boolean }> = ({ compacto }) => {
  const { miPlan, recargarPlan } = usePlan();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState('');
  const { confirmar, modalConfirmar } = useConfirmar();
  const cupo = miPlan?.cupo;
  if (!cupo || cupo.adelantoMaximo <= 0) return null;

  if (cupo.puedeAdelantar <= 0) {
    if (compacto) return null;
    return (
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
        {cupo.deuda > 0
          ? `Este mes estás devolviendo las ${cupo.deuda.toLocaleString('es-DO')} respuestas que adelantaste. El mes que viene puedes adelantar otra vez.`
          : `Ya adelantaste las ${cupo.adelantoMaximo.toLocaleString('es-DO')} respuestas que permite tu plan este mes.`}
      </p>
    );
  }

  const adelantar = async (n: number) => {
    const proximo = Math.max(0, cupo.plan - cupo.adelanto - n);
    const si = await confirmar({
      titulo: `¿Adelantar ${n.toLocaleString('es-DO')} respuestas?`,
      mensaje: <>Lalan sigue atendiendo y el próximo mes empiezas con <b>{proximo.toLocaleString('es-DO')}</b> en vez de {cupo.plan.toLocaleString('es-DO')}. No se cobran aparte.</>,
      textoConfirmar: 'Sí, adelantar',
      textoCancelar: 'Ahora no',
      icono: <FastForward className="w-7 h-7" aria-hidden="true" />,
    });
    if (!si) return;
    setOcupado(n); setError('');
    try { await api.post<MiPlan>('/mi-plan/adelantar', { respuestas: n }); await recargarPlan(); }
    catch (e) { setError((e as Error).message); }
    finally { setOcupado(null); }
  };

  return (
    <>
      {modalConfirmar}
      <div className={compacto ? 'mt-2 space-y-1.5' : 'p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-900 space-y-2'}>
        {!compacto && (
          <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
            <b>¿Se te acaban las respuestas?</b> Adelanta hasta {cupo.puedeAdelantar.toLocaleString('es-DO')} del mes que viene. Se descuentan del próximo mes y no se cobran aparte.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {compacto && <span className="text-[0.75rem] font-semibold flex items-center gap-1"><FastForward className="w-3.5 h-3.5" aria-hidden="true" /> Adelantar:</span>}
          {opciones(cupo.puedeAdelantar).map((n) => (
            <button key={n} type="button" disabled={ocupado !== null} onClick={() => void adelantar(n)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-orange-300 dark:border-orange-800 text-[0.75rem] font-semibold text-orange-700 dark:text-orange-300 hover:border-orange-500 disabled:opacity-50 cursor-pointer flex items-center gap-1"
              data-medir="Adelantar respuestas">
              {ocupado === n && <Loader2 className="w-3 h-3 animate-spin" />}+{n.toLocaleString('es-DO')}
            </button>
          ))}
        </div>
        {error && <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}
      </div>
    </>
  );
};

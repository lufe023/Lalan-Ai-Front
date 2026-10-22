import React, { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Gift, Lock } from 'lucide-react';
import { api } from '../../services/api';
import { usePlan } from '../../context/PlanContext';
import { UsoDelPlan } from '../plataforma/UsoDelPlan';
import { AdelantarRespuestas } from './AdelantarRespuestas';
import type { CatalogoModulos } from '../../types/plataforma';

const WHATSAPP_LALAN = '18092299444';

/** En Ajustes: qué incluye su plan y cuánto lleva usado */
export const TuPlan: React.FC = () => {
  const { miPlan, recargarPlan } = usePlan();
  const [catalogo, setCatalogo] = useState<CatalogoModulos | null>(null);
  useEffect(() => { void recargarPlan(); }, [recargarPlan]);
  useEffect(() => { api.get<CatalogoModulos>('/mi-plan/modulos').then(setCatalogo).catch(() => setCatalogo(null)); }, []);
  if (!miPlan) return null;
  const pedir = `Hola, quiero saber cómo mejorar el plan de mi salón en Lalan.`;
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><BadgeCheck className="w-4 h-4" /></div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Tu plan · {miPlan.plan?.nombre ?? 'Sin plan'}</h3>
            <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Lo que incluye y cuánto llevas usado este mes</p>
          </div>
        </div>
        <a href={`https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent(pedir)}`} target="_blank" rel="noopener" className="text-[0.75rem] font-bold text-[var(--primary)] hover:underline shrink-0">Mejorar mi plan</a>
      </div>
      {miPlan.promocion && (
        <div className="p-3 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/30 flex items-start gap-2 text-[0.75rem] text-slate-700 dark:text-neutral-200">
          <Gift className="w-4 h-4 text-[var(--primary)] shrink-0 mt-px" />
          <p>
            Tienes el <b>{miPlan.plan?.nombre ?? 'plan completo'}</b> de promoción hasta el <b>{new Date(miPlan.promocion.hasta).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}</b>.
            {' '}Ese día pasas solo al <b>{miPlan.promocion.planDespues?.nombre ?? 'Plan Gratis'}</b>: Lalan sigue en tu WhatsApp con menos respuestas al mes, y lo que ese plan no incluye se apaga sin borrar nada. Si quieres seguir con todo, toca «Mejorar mi plan».
          </p>
        </div>
      )}
      <UsoDelPlan uso={miPlan.uso} limites={miPlan.limites} cupo={miPlan.cupo} />
      <AdelantarRespuestas />
      {miPlan.cupo?.acumula && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Lo que no uses este mes pasa al siguiente (solo un mes, hasta {miPlan.cupo.plan.toLocaleString('es-DO')}).</p>}
      {!!miPlan.cupo?.porCobrar && <p className="text-[0.75rem] text-orange-600">Tienes {miPlan.cupo.porCobrar.toLocaleString('es-DO')} respuestas adelantadas por pagar de tu plan anterior{miPlan.cupo.porCobrarMonto ? ` (${miPlan.cupo.porCobrarMonto.toLocaleString('es-DO')} pesos)` : ''}.</p>}
      {miPlan.alAgotarse === 'menu' && (
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Si se acaban las respuestas del mes, Lalan atiende a tus clientas con un menú (servicios, horario, pedir cita o hablar con el salón) y te pasa los chats que piden una persona.</p>
      )}
      {!!miPlan.mensajesExtra && <p className="text-[0.75rem] text-emerald-600">Este mes tienes {miPlan.mensajesExtra.toLocaleString('es-DO')} respuestas extra de un paquete (ya están sumadas).</p>}
      {!!miPlan.paquetes?.length && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-2">
          <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300">
            <b>¿Se te acaban las respuestas?</b> Pide un paquete y Lalan sigue atendiendo hasta fin de mes. El precio ya lo incluye todo.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {miPlan.paquetes.map((p) => (
              <a key={p.respuestas} target="_blank" rel="noopener"
                href={`https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent(`Hola, quiero el paquete de ${p.respuestas} respuestas extra (${p.precio} pesos) para mi salón en Lalan.`)}`}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 hover:border-[var(--primary)]">
                +{p.respuestas.toLocaleString('es-DO')} respuestas · {p.precio.toLocaleString('es-DO')} pesos
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-1.5">
        {miPlan.siempreIncluido.map((s) => <div key={s} className="flex items-start gap-1.5 text-[0.75rem] text-slate-600 dark:text-neutral-300"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />{s}</div>)}
        {catalogo?.modulos.map((m) => {
          const si = miPlan.modulos.includes(m.id);
          return (
            <div key={m.id} className={`flex items-start gap-1.5 text-[0.75rem] ${si ? 'text-slate-600 dark:text-neutral-300' : 'text-slate-400 dark:text-neutral-600'}`} title={m.descripcion}>
              {si ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" /> : <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />}{m.nombre}
            </div>
          );
        })}
      </div>
    </div>
  );
};

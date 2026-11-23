import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpCircle, Lock, MessageCircle, Play } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { cargarEjemplos, type Ejemplo } from '../../landing/ejemplos';
import type { CatalogoModulos, ClaveModulo } from '../../types/plataforma';

const WHATSAPP_LALAN = '18092299444';
const wa = (texto: string) => `https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent(texto)}`;

/** Los ejemplos se piden una sola vez (son los mismos de la página de planes) */
let ejemplosCargando: Promise<Record<string, Ejemplo[]>> | null = null;
const ejemplosDe = () => (ejemplosCargando ??= cargarEjemplos());

const precio = (p: { monto: number; moneda: string }) =>
  `${p.moneda === 'DOP' ? 'RD$' : `${p.moneda} `}${p.monto.toLocaleString('es-DO')} al mes`;

/**
 * Lo que el plan no trae, enseñado en vez de escondido: qué hace el módulo,
 * cómo se ve (los mismos ejemplos de la página de planes), en qué plan viene
 * y dos salidas: subir a ese plan o pedir solo este módulo aparte.
 */
export const HojaModuloBloqueado: React.FC<{
  modulo: ClaveModulo | null;
  catalogo: CatalogoModulos | null;
  /** Ya lo tiene (se abrió desde «Tu plan» con un módulo incluido): solo se explica */
  incluido: boolean;
  planActual: string | null;
  /** Para no pedir lo que ya tiene (Compras necesita Inventario, que quizá ya viene en su plan) */
  tiene: (m: ClaveModulo) => boolean;
  onClose: () => void;
}> = ({ modulo, catalogo, incluido, planActual, tiene, onClose }) => {
  const [ejemplos, setEjemplos] = useState<Record<string, Ejemplo[]>>({});
  const [cual, setCual] = useState(0);
  useEffect(() => { if (modulo) void ejemplosDe().then(setEjemplos).catch(() => undefined); setCual(0); }, [modulo]);

  const m = catalogo?.modulos.find((x) => x.id === modulo) ?? null;
  const viene = modulo ? catalogo?.dondeViene?.[modulo] ?? null : null;
  const requiere = m?.requiere && !tiene(m.requiere) ? catalogo?.modulos.find((x) => x.id === m.requiere) ?? null : null;
  const lista = modulo ? ejemplos[modulo] ?? [] : [];
  const ejemplo = lista[cual] ?? null;

  return createPortal(
    <IOSModal fijo id="modulo-bloqueado" isOpen={!!modulo && !!m} onClose={onClose} title={m?.nombre ?? ''}
      subtitle={incluido ? 'Viene en tu plan' : `No está en tu plan${planActual ? ` (${planActual})` : ''}`}
      fixedHeight={false} height="88%" forma="angosta">
      {m && (
        <div className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
          <p className="text-sm text-slate-600 dark:text-neutral-300">{m.descripcion}</p>

          {!incluido && (
            <>
              {requiere && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Necesita también {requiere.nombre}.</p>}

              <div className="p-3 rounded-2xl bg-[var(--primary)]/5 border border-[var(--primary)]/25 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
                  {viene
                    ? <>Viene en el <b>{viene.nombre}</b>{viene.precio ? <> ({precio(viene.precio)})</> : null}. También te lo podemos activar aparte, sin cambiar de plan.</>
                    : <>Se activa aparte, sin cambiar de plan. Escríbenos y te decimos el precio.</>}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {viene && (
                  <a href={wa(`Hola, quiero pasar mi salón al ${viene.nombre} en Lalan para tener ${m.nombre}.`)} target="_blank" rel="noopener"
                    data-medir={`Módulo bloqueado: subir de plan (${m.id})`}
                    className="flex-1 py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ios-touch">
                    <ArrowUpCircle className="w-4 h-4" />Quiero el {viene.nombre}
                  </a>
                )}
                <a href={wa(`Hola, quiero activar ${m.nombre} aparte para mi salón en Lalan.`)} target="_blank" rel="noopener"
                  data-medir={`Módulo bloqueado: pedir aparte (${m.id})`}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ios-touch ${viene
                    ? 'border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:border-[var(--primary)]/50'
                    : 'bg-[var(--primary)] text-white'}`}>
                  <MessageCircle className="w-4 h-4" />Solo quiero este módulo
                </a>
              </div>
              <p className="text-[0.6875rem] text-slate-400 dark:text-neutral-500 text-center">Te atendemos por WhatsApp. Al activarlo, sale solo en tu menú.</p>
            </>
          )}

          {ejemplo && (
            <div className="space-y-2">
              <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-neutral-800 aspect-video">
                {ejemplo.video
                  ? <video key={ejemplo.video} src={ejemplo.video} poster={ejemplo.foto} controls playsInline preload="metadata" className="w-full h-full object-contain" />
                  : <img src={ejemplo.foto} alt={ejemplo.leyenda ?? `Ejemplo de ${m.nombre}`} className="w-full h-full object-contain" />}
              </div>
              {ejemplo.leyenda && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{ejemplo.leyenda}</p>}
              {lista.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar" role="tablist" aria-label="Más ejemplos">
                  {lista.map((e, i) => (
                    <button key={e.foto} type="button" role="tab" aria-selected={i === cual} aria-label={`Ejemplo ${i + 1}${e.video ? ' (video)' : ''}`}
                      onClick={() => setCual(i)}
                      className={`relative shrink-0 w-16 h-11 rounded-lg overflow-hidden border-2 cursor-pointer ${i === cual ? 'border-[var(--primary)]' : 'border-transparent'}`}>
                      <img src={e.foto} alt="" className="w-full h-full object-cover" />
                      {e.video && <Play className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </IOSModal>,
    document.body,
  );
};

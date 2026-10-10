import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Check, ChevronDown, Copy, Loader2, MapPin } from 'lucide-react';
import { api } from '../../services/api';

type Canal = 'whatsapp' | 'instagram' | 'messenger';
interface Muestra {
  /** El mensaje de sistema tal cual lo recibe Lalan */
  texto: string;
  conectado: boolean;
  usarListas: boolean;
  /** De quién son las instrucciones propias: la sede, el salón o nadie */
  instruccionesDe: 'sede' | 'salon' | null;
  /** Lo suyo es una copia de la base de antes: la reemplaza en vez de sumarse */
  copiaDeLaBase: boolean;
}

const CANALES: { id: Canal; nombre: string }[] = [
  { id: 'whatsapp', nombre: 'WhatsApp' }, { id: 'instagram', nombre: 'Instagram' }, { id: 'messenger', nombre: 'Messenger' },
];
const chip = (activo: boolean) =>
  `px-2.5 py-1 rounded-lg text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer border ${activo ? 'bg-[var(--primary)] text-white border-transparent' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`;

/**
 * Lo que recibe Lalan en los chats de este cliente, tal cual: el servidor lo
 * arma con el mismo código que un chat de verdad. La base y las reglas de
 * trabajo son de Lalan: el salón no las ve.
 */
export const InstruccionesLalan: React.FC<{ negocioId: string; sedes: { id: string; name: string }[] }> = ({ negocioId, sedes }) => {
  const [abierta, setAbierta] = useState(false);
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? '');
  const [canal, setCanal] = useState<Canal>('whatsapp');
  const [m, setM] = useState<Muestra | null>(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!abierta || !sedeId) return;
    setM(null); setError('');
    // Si cambia de sede o canal antes de que llegue, esa respuesta ya no vale
    let vigente = true;
    api.get<Muestra>(`/plataforma/negocios/${negocioId}/lalan?sede=${sedeId}&canal=${canal}`)
      .then((r) => { if (vigente) setM(r); })
      .catch((e) => { if (vigente) setError((e as Error).message); });
    return () => { vigente = false; };
  }, [abierta, negocioId, sedeId, canal]);

  const copiar = async () => {
    if (!m) return;
    try { await navigator.clipboard.writeText(m.texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sin permiso: se puede seleccionar a mano */ }
  };
  const sede = sedes.find((s) => s.id === sedeId);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer">
        <span className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">
          <Bot className="w-3.5 h-3.5" /> Lo que recibe Lalan en sus chats <span className="normal-case font-normal">(solo tú lo ves)</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {sedes.length > 1 && sedes.map((s) => (
              <button key={s.id} type="button" onClick={() => setSedeId(s.id)} aria-pressed={s.id === sedeId} className={chip(s.id === sedeId)}>
                <MapPin className="w-3 h-3" /> {s.name}
              </button>
            ))}
            {sedes.length > 1 && <span className="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-1" aria-hidden />}
            {CANALES.map((c) => (
              <button key={c.id} type="button" onClick={() => setCanal(c.id)} aria-pressed={c.id === canal} className={chip(c.id === canal)}>
                {c.nombre}
              </button>
            ))}
          </div>
          {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
          {!m && !error && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {m && (
            <>
              <p className="text-[0.75rem] text-slate-500">
                Es el texto exacto con el que Lalan contesta el primer mensaje de una clienta nueva
                {sede ? ` en ${sede.name}` : ''} por {CANALES.find((c) => c.id === canal)?.nombre}.
                {' '}Lo de abajo de <b>AHORA</b> (la fecha, con quién habla y la conversación) cambia en cada chat; aquí sale con una clienta de ejemplo.
                {' '}Instrucciones propias: {m.instruccionesDe === 'sede' ? 'las de esta sede' : m.instruccionesDe === 'salon' ? 'las del salón' : 'ninguna, solo la base'}.
                {' '}Listas con botones: {m.usarListas ? 'encendidas' : 'apagadas'}.
              </p>
              {!m.conectado && (
                <p className="text-[0.75rem] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Este canal no está conectado en esta sede: es lo que recibiría al conectarlo.
                </p>
              )}
              {m.copiaDeLaBase && (
                <p className="text-[0.75rem] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Sus instrucciones son una copia editada de la base (de cuando se podía copiar): se usan en lugar de la base. Si las vacías, recibe la base de siempre.
                </p>
              )}
              <div className="relative">
                <button type="button" onClick={() => void copiar()}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-white/90 dark:bg-neutral-900/90 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-semibold flex items-center gap-1 cursor-pointer">
                  {copiado ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />} {copiado ? 'Copiado' : 'Copiar'}
                </button>
                <pre className="p-2.5 pr-20 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-600 dark:text-neutral-300 whitespace-pre-wrap font-sans max-h-[32rem] overflow-y-auto">{m.texto}</pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, ChevronDown, Loader2, MapPin } from 'lucide-react';
import { api } from '../../services/api';

interface SedeLalan {
  id: string; nombre: string; agente: string;
  /** Lo que escribió esa sede (manda sobre lo del salón) */
  deLaSede: string | null;
  /** Lo suyo es una copia de la base de antes: la reemplaza en vez de sumarse */
  copiaDeLaBase: boolean;
  politicas: string;
}
interface Lalan { base: string; reglas: string; delSalon: string | null; sedes: SedeLalan[] }

const texto = 'p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-600 dark:text-neutral-300 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto';

const Parte: React.FC<{ titulo: string; nota: string; children: React.ReactNode }> = ({ titulo, nota, children }) => {
  const [abierta, setAbierta] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer">
        <span className="text-[0.8125rem]"><b>{titulo}</b> <span className="text-slate-400">· {nota}</span></span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && <div className="mt-1.5">{children}</div>}
    </div>
  );
};

/**
 * Lo que recibe Lalan en los chats de este cliente, en el orden en que lo
 * recibe. La base y las reglas de trabajo son de Lalan: el salón no las ve.
 */
export const InstruccionesLalan: React.FC<{ negocioId: string }> = ({ negocioId }) => {
  const [l, setL] = useState<Lalan | null>(null);
  const [error, setError] = useState('');
  const [sedeId, setSedeId] = useState('');
  useEffect(() => {
    api.get<Lalan>(`/plataforma/negocios/${negocioId}/lalan`)
      .then((r) => { setL(r); setSedeId(r.sedes[0]?.id ?? ''); })
      .catch((e) => setError((e as Error).message));
  }, [negocioId]);

  const sede = l?.sedes.find((s) => s.id === sedeId) ?? l?.sedes[0];
  const propias = sede?.deLaSede ?? l?.delSalon ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">
        <Bot className="w-3.5 h-3.5" /> Lo que recibe Lalan en sus chats <span className="normal-case font-normal">(solo tú lo ves)</span>
      </div>
      {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
      {!l && !error && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      {l && sede && (
        <div className="space-y-2.5">
          {l.sedes.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sede">
              {l.sedes.map((s) => (
                <button key={s.id} type="button" onClick={() => setSedeId(s.id)} aria-pressed={s.id === sede.id}
                  className={`px-2.5 py-1 rounded-lg text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer border ${s.id === sede.id ? 'bg-[var(--primary)] text-white border-transparent' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
                  <MapPin className="w-3 h-3" /> {s.nombre}
                </button>
              ))}
            </div>
          )}
          {sede.copiaDeLaBase && (
            <p className="text-[0.75rem] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Sus instrucciones son una copia editada de la base (de cuando se podía copiar): se usan en lugar de la base. Si las vacías, recibe la base de siempre.
            </p>
          )}
          <Parte titulo="1. Reglas de trabajo" nota="de Lalan, iguales para todos los clientes">
            <pre className={texto}>{l.reglas}</pre>
          </Parte>
          <Parte titulo="2. Instrucciones base" nota={sede.copiaDeLaBase ? 'esta sede no las recibe: usa su copia' : 'de Lalan, iguales para todos'}>
            <pre className={texto}>{l.base}</pre>
          </Parte>
          <Parte titulo="3. Lo que escribió el salón"
            nota={sede.deLaSede ? `de la sede ${sede.nombre}` : l.delSalon ? 'de todo el salón' : 'nada: solo la base'}>
            {propias ? <pre className={texto}>{propias}</pre> : <p className="text-[0.75rem] text-slate-500">No escribieron nada.</p>}
          </Parte>
          <Parte titulo="4. Políticas" nota={`salen de los parámetros de ${sede.nombre}`}>
            <pre className={texto}>{sede.politicas}</pre>
          </Parte>
          <p className="text-[0.75rem] text-slate-400">
            Además recibe las sedes, los servicios con precios, las ofertas, el equipo, la ficha de la clienta y la conversación. Los marcadores entre llaves se llenan con los datos de la sede ({sede.agente} es su asistente).
          </p>
        </div>
      )}
    </div>
  );
};

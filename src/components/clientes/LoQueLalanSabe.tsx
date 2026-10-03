import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../services/api';

interface Senal { id: string; tipo: string; valor: string; fechaEvento: string | null; creadoEn: string }
interface TipoSenal { id: string; descripcion: string; emoji: string }

/**
 * "Lo que Lalan sabe de ella": datos que Lalan anotó de sus conversaciones
 * (la ocasión para la que se arregla, gustos, lo que pidió y no había…).
 * Sirve para atenderla mejor sin tener que leer todo el chat.
 */
export const LoQueLalanSabe: React.FC<{ clienteId: string }> = ({ clienteId }) => {
  const [senales, setSenales] = useState<Senal[] | null>(null);
  const [tipos, setTipos] = useState<TipoSenal[]>([]);
  useEffect(() => {
    setSenales(null);
    Promise.all([api.get<Senal[]>(`/senales/cliente/${clienteId}`), api.get<TipoSenal[]>('/senales/catalogo')])
      .then(([s, t]) => { setSenales(s); setTipos(t); })
      .catch(() => setSenales([]));
  }, [clienteId]);

  if (!senales?.length) return null;
  const tipo = (id: string) => tipos.find(t => t.id === id);
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <div className="p-3 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20">
      <div className="flex items-center gap-1.5 font-bold text-[0.75rem] text-[var(--primary)] mb-2">
        <Sparkles className="w-3.5 h-3.5" /> Lo que Lalan sabe de ella
      </div>
      <ul className="space-y-1.5">
        {senales.slice(0, 12).map(s => {
          const t = tipo(s.tipo);
          const fecha = s.fechaEvento ? new Date(`${s.fechaEvento.slice(0, 10)}T12:00:00`) : null;
          const viene = s.fechaEvento && s.fechaEvento.slice(0, 10) >= hoy;
          return (
            <li key={s.id} className="flex items-start gap-2 text-[0.8125rem]">
              <span className="shrink-0">{t?.emoji ?? '•'}</span>
              <span className="flex-1 min-w-0">
                <span className="text-slate-800 dark:text-neutral-100">{s.valor}</span>
                <span className="block text-[0.6875rem] text-slate-500">
                  {t?.descripcion ?? s.tipo}
                  {fecha && <> · <b className={viene ? 'text-[var(--primary)]' : ''}>{fecha.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}</b></>}
                  {' · '}anotado el {new Date(s.creadoEn).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

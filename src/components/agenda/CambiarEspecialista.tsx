import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, MessageCircle, Phone, UserX } from 'lucide-react';
import { api } from '../../services/api';
import { IOSModal } from '../ui/IOSModal';

export interface CitaParaCambiar {
  id: string;
  clientName: string;
  clientPhone?: string | null;
  serviceName?: string | null;
  startsAt: string;
  staffName?: string | null;
}

interface Reemplazo { id: string; nombre: string; especialidad: string; libre: boolean; motivo: string | null; minutosDelDia: number }
interface Aviso { avisada: boolean; via?: 'whatsapp' | 'instagram' | 'messenger' | 'plantilla'; motivo?: string }
export interface ResultadoCambio { cita: any; aviso: Aviso }

const VIA: Record<string, string> = {
  whatsapp: 'por WhatsApp', instagram: 'por Instagram', messenger: 'por Messenger',
  plantilla: 'por WhatsApp (plantilla: Meta la cobra a la cuenta del salón)',
};

/** Como lo dice el servidor: "3:30 de la tarde", "12 del mediodía" */
function horaHablada(d: Date) {
  const h = d.getHours(), m = d.getMinutes();
  if (h === 12 && m === 0) return '12 del mediodía';
  const reloj = `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
  return `${reloj} de la ${h >= 19 ? 'noche' : h >= 12 ? 'tarde' : 'mañana'}`;
}

const primerNombre = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';

/** Lo mismo que el servidor le escribe (cambio-especialista.service.ts → queCambio) */
function vistaPrevia(cita: CitaParaCambiar, nueva: string | null, motivo: string) {
  const antes = cita.staffName && cita.staffName !== 'Por asignar' ? primerNombre(cita.staffName) : null;
  const porque = motivo.trim() || 'por un imprevisto';
  const d = new Date(cita.startsAt);
  const cuando = `${d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${horaHablada(d)}`;
  const cambio = nueva && antes
    ? `${antes} no podrá atenderte ${porque} y te la pasamos con ${nueva}, a la misma hora. ¿Te parece bien, o prefieres que te busquemos otro día con ${antes}?`
    : nueva ? `Te la pasamos con ${nueva}, a la misma hora. ¿Te parece bien?`
    : antes ? `${antes} no podrá atenderte ${porque}. ¿Quieres que te la pasemos con otra especialista a la misma hora, o prefieres otro día con ${antes}?`
    : '¿Te parece bien que te asignemos a otra especialista a la misma hora, o prefieres otro día?';
  return `Hola ${primerNombre(cita.clientName)}, te escribimos del salón por tu cita de ${cita.serviceName ?? 'tu servicio'} el ${cuando}. ${cambio}`;
}

/**
 * Cuando quien la iba a atender no puede (enferma, una emergencia, ya no
 * trabaja aquí): se elige a otra persona —o se deja sin asignar— y Lalan le
 * escribe a la clienta para preguntarle si sigue. Siempre se le ofrece
 * esperar a la suya otro día: hay clientas que no se atienden con nadie más.
 * Lo que conteste lo maneja Lalan en el chat y queda marcado en la cita.
 */
export const CambiarEspecialista: React.FC<{ cita: CitaParaCambiar; onCerrar: () => void; onListo: (r: ResultadoCambio) => void }> = ({ cita, onCerrar, onListo }) => {
  const [lista, setLista] = useState<Reemplazo[] | null>(null);
  const [error, setError] = useState('');
  const [elegida, setElegida] = useState<string | null | undefined>(undefined);   // undefined = nada; null = sin especialista
  const [avisar, setAvisar] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCambio | null>(null);

  useEffect(() => {
    api.get<{ reemplazos: Reemplazo[] }>(`/appointments/${cita.id}/reemplazos`)
      .then((r) => setLista(r.reemplazos))
      .catch((e) => setError(e?.message ?? 'No se pudo cargar el equipo.'));
  }, [cita.id]);

  const nueva = useMemo(() => (elegida ? lista?.find((r) => r.id === elegida)?.nombre ?? null : null), [elegida, lista]);
  const ocupada = !!elegida && !lista?.find((r) => r.id === elegida)?.libre;

  const guardar = async () => {
    if (elegida === undefined) return;
    setGuardando(true); setError('');
    try {
      const r = await api.post<ResultadoCambio>(`/appointments/${cita.id}/especialista`, {
        staffId: elegida, avisar, motivo: motivo.trim() || undefined, forzar: ocupada || undefined,
      });
      setResultado(r);
      onListo(r);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cambiar.');
    } finally {
      setGuardando(false);
    }
  };

  const opcion = (activa: boolean) =>
    `w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition cursor-pointer ${
      activa ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]' : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'}`;
  const telefono = (cita.clientPhone ?? '').replace(/\D/g, '');

  return (
    <IOSModal id="cambiar-especialista" isOpen onClose={onCerrar} title="Cambiar quién la atiende" subtitle={`${cita.clientName} · ${cita.serviceName ?? ''}`}>
      <div className="max-w-xl mx-auto space-y-4 pb-6 text-slate-900 dark:text-white">
        {resultado ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-[0.875rem]">
              <b>Listo:</b> la cita queda con {resultado.cita.staffName}.
            </div>
            {avisar && (resultado.aviso.avisada ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 text-[0.8125rem] space-y-1">
                <p><b>Le escribimos {VIA[resultado.aviso.via ?? 'whatsapp']}.</b></p>
                <p className="text-slate-500 dark:text-neutral-400">Cuando conteste, Lalan confirma, le busca otro día con su especialista o la cancela. En la cita vas a ver lo que eligió.</p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[0.8125rem] space-y-2">
                <p className="font-bold text-amber-800 dark:text-amber-300">No se le pudo avisar</p>
                <p className="text-amber-700 dark:text-amber-400">{resultado.aviso.motivo}</p>
                {telefono.length >= 7 && (
                  <div className="flex gap-2">
                    <a href={`tel:${telefono}`} className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 font-bold flex items-center gap-1.5"><Phone className="w-4 h-4" /> Llamarla</a>
                    <a href={`https://wa.me/${telefono}?text=${encodeURIComponent(vistaPrevia(cita, nueva, motivo))}`} target="_blank" rel="noopener" className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 font-bold flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Escribirle yo</a>
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={onCerrar} className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold cursor-pointer">Cerrar</button>
          </div>
        ) : (
          <>
            <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400">
              Ahora es con <b className="text-slate-800 dark:text-neutral-100">{cita.staffName || 'nadie'}</b>,{' '}
              {new Date(cita.startsAt).toLocaleString('es-DO', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}.
            </p>

            <div className="space-y-2">
              {!lista && !error && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Buscando quién está libre…</div>}
              {lista?.map((r) => (
                <button key={r.id} type="button" onClick={() => setElegida(r.id)} className={opcion(elegida === r.id)}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.libre ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[0.875rem]">{r.nombre}</span>
                    <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">
                      {r.libre ? `Libre · ${r.especialidad}${r.minutosDelDia ? ` · ${Math.round(r.minutosDelDia / 60 * 10) / 10} h de citas ese día` : ''}` : r.motivo}
                    </span>
                  </span>
                  {elegida === r.id && <Check className="w-4 h-4 text-[var(--primary)]" />}
                </button>
              ))}
              {lista && !lista.length && <p className="text-[0.8125rem] text-slate-400">Nadie más del equipo hace este servicio.</p>}
              <button type="button" onClick={() => setElegida(null)} className={opcion(elegida === null)}>
                <UserX className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[0.875rem]">Dejarla sin especialista</span>
                  <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">Se le pregunta si la quiere con otra persona o prefiere otro día con la suya</span>
                </span>
                {elegida === null && <Check className="w-4 h-4 text-[var(--primary)]" />}
              </button>
            </div>

            {ocupada && <p className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-400">Esa persona ya tiene algo a esa hora: si sigues, le quedan dos citas encima.</p>}

            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 cursor-pointer">
              <span className="text-[0.875rem] font-semibold">Avisarle a {primerNombre(cita.clientName)} y preguntarle si sigue</span>
              <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="w-5 h-5 accent-[var(--primary)]" />
            </label>
            {avisar && elegida !== undefined && (
              <div className="space-y-2">
                <input value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 120))} placeholder="Por qué (opcional): «porque está enferma»"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]" />
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 text-[0.8125rem] leading-relaxed">
                  <span className="block text-[0.6875rem] uppercase font-bold tracking-wider text-emerald-700/70 dark:text-emerald-400/70 mb-1">Lo que le llega</span>
                  {vistaPrevia(cita, nueva, motivo)}
                </div>
                <p className="text-[0.6875rem] text-slate-400">Si escribió en las últimas 24 horas, le llega a ese chat (gratis). Si no, por WhatsApp con una plantilla, que Meta cobra.</p>
              </div>
            )}

            {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
            <button type="button" onClick={() => void guardar()} disabled={elegida === undefined || guardando}
              className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer">
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              {avisar ? 'Cambiar y avisarle' : 'Cambiar sin avisar'}
            </button>
          </>
        )}
      </div>
    </IOSModal>
  );
};

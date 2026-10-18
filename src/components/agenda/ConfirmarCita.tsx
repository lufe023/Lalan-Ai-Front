import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, MessageCircle, Store, UserX } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Appointment } from '../../types';
import { hora12 } from '../../utils/hora';

interface Persona { id: string; nombre: string; especialidad: string; libre: boolean; motivo: string | null }

/** Una cita sin especialista: el servidor la guarda como «Por asignar» */
export const sinEspecialista = (a: Pick<Appointment, 'staffId' | 'staffName'>) => !a.staffId;

const primerNombre = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';

/** De dónde llegó, dicho para quien la confirma */
function deDonde(a: Appointment, agente: string) {
  if (a.channel === 'vitrina') return 'La clienta la reservó sola desde la Vitrina.';
  if (a.bookedByAssistant) return `La agendó ${agente} por el chat y quedó sin confirmar.`;
  return 'Quedó sin confirmar.';
}

/**
 * Confirmar una cita pendiente desde su ficha. Si no tiene especialista, se
 * elige aquí mismo (libres primero, como al cambiarla): así la Vitrina no
 * deja citas «por asignar» que se descubren cuando la clienta ya llegó.
 * Al terminar, un botón para avisarle por WhatsApp con el texto listo: la
 * Vitrina le dijo que el salón le confirmaría por ahí.
 */
export const ConfirmarCita: React.FC<{ cita: Appointment; onConfirmada: (c: Appointment) => void; onCerrar: () => void }> = ({ cita, onConfirmada, onCerrar }) => {
  const { confirmarCita, settings, showToast } = useApp();
  // Lo que pedía al abrirla: al confirmar ya tiene especialista y el panel no debe cambiar de forma
  const [necesita] = useState(() => sinEspecialista(cita));
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [hecha, setHecha] = useState<Appointment | null>(null);

  // Una cita por montaje: quien lo usa le pone key={cita.id}
  useEffect(() => {
    if (!necesita) return;
    api.get<{ reemplazos: Persona[] }>(`/appointments/${cita.id}/reemplazos`)
      .then((r) => setPersonas(r.reemplazos))
      .catch((e) => setError(e?.message ?? 'No se pudo cargar el equipo.'));
  }, [cita.id, necesita]);

  const persona = personas?.find((p) => p.id === elegida) ?? null;

  const confirmar = async (conQuien: string | null) => {
    setGuardando(true); setError('');
    try {
      const c = await confirmarCita(cita.id, conQuien, !!persona && !persona.libre);
      setHecha(c);
      onConfirmada(c);
      showToast?.('Cita confirmada', c.staffId ? `Con ${primerNombre(c.staffName)}.` : 'Queda sin especialista por ahora.', 'success');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo confirmar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (hecha) {
    const telefono = (cita.clientPhone ?? '').replace(/\D/g, '');
    const cuando = new Date(cita.startsAt ?? `${cita.date}T${cita.time}`)
      .toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
    const texto = `Hola ${primerNombre(cita.clientName)}, te confirmamos tu cita de ${cita.serviceName} el ${cuando} a las ${hora12(cita.time)}`
      + `${hecha.staffId ? ` con ${primerNombre(hecha.staffName)}` : ''}${settings.salonName ? ` en ${settings.salonName}` : ''}. ¡Te esperamos!`;
    return (
      <div className="p-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 space-y-3">
        <p className="text-[0.875rem] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Confirmada{hecha.staffId ? ` con ${hecha.staffName}` : ''}
        </p>
        {telefono.length >= 7 && (
          <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300">
            {cita.channel === 'vitrina' ? 'En la Vitrina le dijimos que le confirmarías por WhatsApp.' : 'Si quieres, avísale.'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {telefono.length >= 7 && (
            <a href={`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[0.75rem] font-bold flex items-center gap-1.5 hover:opacity-90">
              <MessageCircle className="w-4 h-4" /> Avisarle por WhatsApp
            </a>
          )}
          <button type="button" onClick={onCerrar}
            className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer">
            Listo
          </button>
        </div>
      </div>
    );
  }

  const chip = (activa: boolean) =>
    `px-3 py-2 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
      activa ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]' : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'}`;

  return (
    <div data-guia="confirmar-cita" className="p-4 rounded-3xl border border-amber-300/70 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          {cita.channel === 'vitrina' ? <Store className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-bold text-amber-900 dark:text-amber-200">Esta cita está por confirmar</p>
          <p className="text-[0.75rem] text-amber-800/80 dark:text-amber-300/80">
            {deDonde(cita, settings.aiAgentName || 'Lalan')}{necesita ? ' Todavía no tiene quién la atienda.' : ''}
          </p>
        </div>
      </div>

      {necesita && (
        <div className="space-y-2">
          <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-amber-800/70 dark:text-amber-300/70 block">¿Quién la atiende?</span>
          {!personas && !error && (
            <div className="flex items-center gap-2 text-[0.75rem] text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Buscando quién está libre…</div>
          )}
          {personas && !personas.length && (
            <p className="text-[0.75rem] text-slate-500 flex items-center gap-1.5"><UserX className="w-4 h-4" /> Nadie del equipo de esta sede hace este servicio.</p>
          )}
          {!!personas?.length && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {personas.map((p) => (
                <button key={p.id} type="button" onClick={() => setElegida(elegida === p.id ? null : p.id)} className={chip(elegida === p.id)}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.libre ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] font-semibold text-slate-900 dark:text-white truncate">{p.nombre}</span>
                    <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">{p.libre ? `Libre · ${p.especialidad}` : p.motivo}</span>
                  </span>
                  {elegida === p.id && <Check className="w-4 h-4 text-[var(--primary)] shrink-0" />}
                </button>
              ))}
            </div>
          )}
          {persona && !persona.libre && (
            <p className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-400">{primerNombre(persona.nombre)} ya tiene algo a esa hora: si confirmas, le quedan dos citas encima.</p>
          )}
        </div>
      )}

      {error && <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={() => void confirmar(necesita ? elegida : null)} disabled={guardando || (necesita && !elegida)}
          className="flex-1 py-2.5 rounded-2xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {necesita ? (persona ? `Confirmar con ${primerNombre(persona.nombre)}` : 'Elige quién la atiende') : 'Confirmar cita'}
        </button>
        {necesita && (
          <button type="button" onClick={() => void confirmar(null)} disabled={guardando}
            className="px-3 py-2.5 rounded-2xl text-[0.75rem] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer disabled:opacity-40">
            Confirmar sin especialista por ahora
          </button>
        )}
      </div>
    </div>
  );
};

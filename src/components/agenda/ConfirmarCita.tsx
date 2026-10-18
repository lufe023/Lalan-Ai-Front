import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Loader2, MessageCircle, Phone, Store, UserX } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Appointment, AvisoCita } from '../../types';

interface Persona { id: string; nombre: string; especialidad: string; libre: boolean; motivo: string | null }

/** Una cita sin especialista: el servidor la guarda como «Por asignar» */
export const sinEspecialista = (a: Pick<Appointment, 'staffId' | 'staffName'>) => !a.staffId;

const primerNombre = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';

const VIA: Record<NonNullable<AvisoCita['via']>, string> = {
  whatsapp: 'por WhatsApp', instagram: 'por Instagram', messenger: 'por Messenger',
  plantilla: 'por WhatsApp (plantilla: Meta la cobra a la cuenta del salón)',
};

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
 * Si se quiere, se le avisa a la clienta (la Vitrina le dijo que el salón le
 * confirmaría por WhatsApp) desde el número de Lalan de la sede, nunca desde
 * el de la dueña o el equipo: gratis si escribió en las últimas 24 horas, o
 * con la plantilla lalan_cita_confirmada, que Meta cobra.
 */
export const ConfirmarCita: React.FC<{ cita: Appointment; onConfirmada: (c: Appointment) => void; onCerrar: () => void }> = ({ cita, onConfirmada, onCerrar }) => {
  const { confirmarCita, settings, showToast } = useApp();
  const telefono = (cita.clientPhone ?? '').replace(/\D/g, '');
  // Lo que pedía al abrirla: al confirmar ya tiene especialista y el panel no debe cambiar de forma
  const [necesita] = useState(() => sinEspecialista(cita));
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [hecha, setHecha] = useState<{ cita: Appointment; aviso: AvisoCita | null } | null>(null);
  const [avisar, setAvisar] = useState(true);

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
      const r = await confirmarCita(cita.id, conQuien, !!persona && !persona.libre, avisar);
      const c = r.cita;
      setHecha(r);
      onConfirmada(c);
      showToast?.('Cita confirmada', c.staffId ? `Con ${primerNombre(c.staffName)}.` : 'Queda sin especialista por ahora.', 'success');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo confirmar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (hecha) {
    const { cita: c, aviso } = hecha;
    return (
      <div className="p-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 space-y-3">
        <p className="text-[0.875rem] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Confirmada{c.staffId ? ` con ${c.staffName}` : ''}
        </p>
        {aviso && (aviso.avisada ? (
          <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 shrink-0" /> Le avisamos {VIA[aviso.via ?? 'whatsapp']}.
          </p>
        ) : (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[0.75rem] space-y-1">
            <p className="font-bold text-amber-800 dark:text-amber-300">No se le pudo avisar</p>
            <p className="text-amber-700 dark:text-amber-400">{aviso.motivo}</p>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {aviso && !aviso.avisada && telefono.length >= 7 && (
            <a href={`tel:${telefono}`}
              className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 text-[0.75rem] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Phone className="w-4 h-4" /> Llamarla
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

      <label className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-white/70 dark:bg-neutral-900/60 cursor-pointer">
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-semibold text-slate-900 dark:text-white">Avisarle a {primerNombre(cita.clientName) || 'la clienta'} que quedó confirmada</span>
          <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400">
            Le llega desde el WhatsApp de {settings.aiAgentName || 'Lalan'} de esta sede, no desde tu número. Si escribió en las últimas 24 horas es gratis; si no, sale con una plantilla que Meta cobra.
          </span>
        </span>
        <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="w-5 h-5 mt-0.5 shrink-0 accent-[var(--primary)]" />
      </label>

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

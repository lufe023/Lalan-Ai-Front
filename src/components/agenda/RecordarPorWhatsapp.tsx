import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Check, ChevronRight, Copy, Loader2, MessageCircle } from 'lucide-react';
import { api } from '../../services/api';
import { IOSModal } from '../ui/IOSModal';
import { EtiquetaSede } from '../ui/CopiarASede';

/** Lo que hará el recordatorio automático (lo decide el servidor: recordar-a-mano.service.ts) */
export type EstadoAutomatico = 'enviado' | 'gratis' | 'pagado' | 'no_sale';

export interface RecordatorioAMano {
  id: string;
  clientId: string | null;
  clientName: string;
  serviceName: string;
  staffName: string | null;
  startsAt: string;
  sede: { id: string; nombre: string };
  telefono: string | null;
  texto: string;
  enlace: string | null;
  aMano: { en: string; por: string | null } | null;
  automatico: { estado: EstadoAutomatico; detalle: string };
}

const recordatoriosApi = {
  lista: () => api.get<RecordatorioAMano[]>('/recordatorios/a-mano'),
  cita: (id: string) => api.get<RecordatorioAMano>(`/recordatorios/cita/${id}`),
  marcar: (id: string) => api.post<RecordatorioAMano>(`/recordatorios/cita/${id}/a-mano`, {}),
};

/** Le toca a alguien del salón: el automático cobra o no va a salir */
export const faltaRecordar = (r: RecordatorioAMano) =>
  !r.aMano && !!r.enlace && (r.automatico.estado === 'pagado' || r.automatico.estado === 'no_sale');

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true });
const dia = (iso: string) => {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return 'Hoy';
  return d.toDateString() === new Date(Date.now() + 86_400_000).toDateString() ? 'Mañana' : d.toLocaleDateString('es-DO', { weekday: 'long' });
};
const cuandoFue = (iso: string) => {
  const d = new Date(iso);
  const hoy = d.toDateString() === new Date().toDateString();
  return hoy ? `hoy a las ${hora(iso)}` : d.toLocaleString('es-DO', { weekday: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

export const CHIP_RECORDATORIO: Record<EstadoAutomatico, [string, string]> = {
  enviado: ['Lalan ya se lo recordó', 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300'],
  gratis: ['Lalan se lo recuerda gratis', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'],
  pagado: ['El automático cobra', 'bg-amber-500/15 text-amber-700 dark:text-amber-400'],
  no_sale: ['No le llega nada', 'bg-rose-500/15 text-rose-700 dark:text-rose-400'],
};

/**
 * El botón verde: abre el WhatsApp de quien lo toca (el suyo, no el del
 * salón) con el chat de la clienta y el recordatorio escrito; solo falta
 * darle a enviar. Al tocarlo queda anotado quién se lo mandó, y el
 * recordatorio pagado de Meta para esa cita ya no sale.
 */
export const BotonWhatsapp: React.FC<{ r: RecordatorioAMano; onMarcado: (r: RecordatorioAMano) => void; compacto?: boolean; suave?: boolean }> = ({ r, onMarcado, compacto, suave }) => {
  if (!r.enlace) return null;
  const marcar = () => { recordatoriosApi.marcar(r.id).then(onMarcado).catch(() => { /* el enlace ya se abrió: lo importante salió */ }); };
  return (
    <a href={r.enlace} target="_blank" rel="noopener" onClick={marcar}
      className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl font-bold hover:opacity-90 active:scale-[0.97] transition ${suave ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10' : 'text-white bg-[#25D366]'} ${compacto ? 'px-3 py-2 text-[0.75rem]' : 'px-4 py-2.5 text-[0.8125rem]'}`}>
      <MessageCircle className="w-4 h-4" />
      {r.aMano ? 'Mandar otra vez' : compacto ? 'Mandar' : 'Mandarlo desde mi WhatsApp'}
    </a>
  );
};

/** En la ficha de la cita: qué hará el automático y el recordatorio listo para mandarlo uno mismo */
export const RecordatorioCita: React.FC<{ citaId: string; onCambio?: (r: RecordatorioAMano) => void }> = ({ citaId, onCambio }) => {
  const [r, setR] = useState<RecordatorioAMano | null>(null);
  const [verTexto, setVerTexto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    let vivo = true;
    recordatoriosApi.cita(citaId).then((x) => { if (vivo) setR(x); }).catch(() => { /* sin recordatorio: no se muestra */ });
    return () => { vivo = false; };
  }, [citaId]);
  if (!r) return null;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(r.texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
  };
  const [chip, color] = CHIP_RECORDATORIO[r.automatico.estado];
  return (
    <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-neutral-800 space-y-3">
      <div className="flex items-start gap-3">
        <BellRing className="w-4 h-4 mt-0.5 text-[var(--primary)] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Recordatorio</span>
            {r.aMano
              ? <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Se lo mandaste</span>
              : <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold ${color}`}>{chip}</span>}
          </div>
          <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 mt-1">
            {r.aMano ? `${r.aMano.por ? `${r.aMano.por.split(' ')[0]} lo abrió` : 'Se abrió'} en su WhatsApp ${cuandoFue(r.aMano.en)}. ` : ''}
            {r.automatico.detalle}
          </p>
        </div>
      </div>
      {r.enlace ? (
        <>
          {verTexto && (
            <p className="px-3 py-2 rounded-2xl bg-[#DCF8C6] dark:bg-emerald-950/40 text-[0.8125rem] text-slate-800 dark:text-emerald-100 leading-relaxed">{r.texto}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <BotonWhatsapp r={r} onMarcado={(x) => { setR(x); onCambio?.(x); }} />
            <button type="button" onClick={() => setVerTexto((v) => !v)} className="px-3 py-2 rounded-xl text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 cursor-pointer">
              {verTexto ? 'Ocultar el mensaje' : 'Ver el mensaje'}
            </button>
            <button type="button" onClick={copiar} className="px-3 py-2 rounded-xl text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 cursor-pointer flex items-center gap-1">
              {copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
            </button>
          </div>
          <p className="text-[0.6875rem] text-slate-400">Sale de tu número, sin costo de Meta. Si ella contesta, te contesta a ti.</p>
        </>
      ) : (
        <p className="text-[0.75rem] text-amber-700 dark:text-amber-400">Esta cita no tiene un teléfono de WhatsApp: agrégaselo en su ficha para poder recordarle.</p>
      )}
    </div>
  );
};

/** Las citas de hoy y mañana con su recordatorio, para la agenda */
export function useRecordatoriosAMano() {
  const [lista, setLista] = useState<RecordatorioAMano[] | null>(null);
  const recargar = useCallback(() => { recordatoriosApi.lista().then(setLista).catch(() => setLista([])); }, []);
  useEffect(() => { recargar(); }, [recargar]);
  const cambiar = useCallback((r: RecordatorioAMano) => setLista((l) => l?.map((x) => (x.id === r.id ? r : x)) ?? l), []);
  const porRecordar = useMemo(() => (lista ?? []).filter(faltaRecordar).length, [lista]);
  return { lista, recargar, cambiar, porRecordar };
}

const Fila: React.FC<{ r: RecordatorioAMano; onMarcado: (r: RecordatorioAMano) => void; onAbrir: (id: string) => void }> = ({ r, onMarcado, onAbrir }) => {
  const [chip, color] = r.aMano ? ['Se lo mandaste', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'] : CHIP_RECORDATORIO[r.automatico.estado];
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-neutral-800">
      <button type="button" onClick={() => onAbrir(r.id)} className="flex-1 min-w-0 text-left cursor-pointer group">
        <div className="text-[0.875rem] font-bold truncate text-slate-900 dark:text-white flex items-center gap-1">
          {r.clientName} <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--primary)]" />
        </div>
        <div className="text-[0.75rem] text-slate-500 truncate">{dia(r.startsAt)}, {hora(r.startsAt)} · {r.serviceName}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold ${color}`} title={r.automatico.detalle}>{chip}</span>
          <EtiquetaSede locationId={r.sede.id} />
          {!r.enlace && <span className="text-[0.6875rem] text-amber-700 dark:text-amber-400">sin teléfono</span>}
        </div>
      </button>
      <BotonWhatsapp r={r} onMarcado={onMarcado} compacto suave={!faltaRecordar(r)} />
    </div>
  );
};

/**
 * Las citas de hoy y mañana, cada una con su recordatorio listo para salir
 * desde el WhatsApp de la dueña o la asistente. Arriba las que lo necesitan
 * (el automático cobra o no va a llegar); abajo las que ya están cubiertas.
 */
export const RecordatoriosAMano: React.FC<{
  abierto: boolean; onCerrar: () => void; lista: RecordatorioAMano[] | null;
  onMarcado: (r: RecordatorioAMano) => void; onAbrir: (id: string) => void; onMiSemana?: () => void;
}> = ({ abierto, onCerrar, lista, onMarcado, onAbrir, onMiSemana }) => {
  const faltan = (lista ?? []).filter(faltaRecordar);
  const cubiertas = (lista ?? []).filter((r) => !faltaRecordar(r));
  return (
    <IOSModal isOpen={abierto} onClose={onCerrar} title="Recordatorios de hoy y mañana" subtitle="Desde tu WhatsApp, sin costo de Meta">
      <div className="max-w-xl mx-auto space-y-4 p-1">
        {!lista && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Buscando las citas…</div>}
        {lista && !lista.length && <p className="text-[0.875rem] text-slate-500 text-center py-8">No hay citas hoy ni mañana por recordar.</p>}
        {faltan.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[0.75rem] font-bold uppercase tracking-wider text-amber-600">Mándaselos tú ({faltan.length})</h4>
            <p className="text-[0.75rem] text-slate-500">Toca «Mandar»: se abre tu WhatsApp con el chat de la clienta y el mensaje escrito. Solo dale a enviar.</p>
            {faltan.map((r) => <Fila key={r.id} r={r} onMarcado={onMarcado} onAbrir={onAbrir} />)}
          </section>
        )}
        {cubiertas.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-400">Ya cubiertas ({cubiertas.length})</h4>
            {cubiertas.map((r) => <Fila key={r.id} r={r} onMarcado={onMarcado} onAbrir={onAbrir} />)}
          </section>
        )}
        {onMiSemana && (
          <button type="button" onClick={onMiSemana} className="w-full py-3 rounded-2xl text-[0.8125rem] font-bold text-[var(--primary)] bg-[var(--primary)]/10 flex items-center justify-center gap-1 cursor-pointer">
            Ver la semana completa, con gustos, alergias y productos <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </IOSModal>
  );
};

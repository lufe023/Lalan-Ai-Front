import React, { useState } from 'react';
import { Banknote, CheckCircle2, Clock, Loader2, ReceiptText, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDinero } from '../../hooks/useDinero';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import type { Appointment, MetodoAdelanto } from '../../types';

const METODOS: { id: MetodoAdelanto; texto: string }[] = [
  { id: 'transfer', texto: 'Transferencia' },
  { id: 'link', texto: 'Link de pago' },
  { id: 'card', texto: 'Tarjeta' },
  { id: 'cash', texto: 'Efectivo' },
  { id: 'other', texto: 'Otro' },
];
const NOMBRE_METODO = Object.fromEntries(METODOS.map(m => [m.id, m.texto.toLowerCase()])) as Record<MetodoAdelanto, string>;

const horaCorta = (iso?: string | null) => iso
  ? new Date(iso).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true })
  : '';

/**
 * El adelanto de una cita, en su ficha. Nadie lo da por pagado: la cita
 * queda apartada hasta que alguien del salón vea el dinero en su banco y lo
 * registre aquí. Lo registrado es lo único que la caja descuenta al cobrar.
 */
export const AdelantoCita: React.FC<{ cita: Appointment; onCambio: (c: Appointment) => void }> = ({ cita, onCambio }) => {
  const { registrarAdelanto, adelantoNoLlego, settings, showToast } = useApp();
  const { dinero } = useDinero();
  const { confirmar, modalConfirmar } = useConfirmar();
  const sugerido = Math.round(Number(cita.price ?? 0) * (settings.depositPercent || 0)) / 100;
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(String(sugerido || ''));
  const [metodo, setMetodo] = useState<MetodoAdelanto>('transfer');
  const [referencia, setReferencia] = useState('');
  const [avisar, setAvisar] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const estado = cita.adelantoEstado ?? null;
  const pagado = estado === 'pagado' && cita.depositPaid > 0;
  const porConfirmar = cita.status === 'pending';
  const cerrada = cita.status === 'cancelled' || cita.status === 'completed';
  // Sin adelanto pedido ni registrado, en una cita cerrada no hay nada que decir
  if (cerrada && !pagado && estado !== 'vencido') return null;
  if (!settings.requireDeposit && !estado) return null;

  const guardar = async (cuanto: number) => {
    setError(''); setGuardando(true);
    try {
      const r = await registrarAdelanto(cita.id, { monto: cuanto, metodo, referencia: referencia.trim() || undefined, avisar: porConfirmar && avisar });
      onCambio(r.cita);
      setAbierto(false);
      if (cuanto > 0) {
        showToast('Adelanto registrado',
          porConfirmar ? (r.aviso?.avisada ? 'La cita quedó confirmada y se le avisó a la clienta.' : 'La cita quedó confirmada.') : 'Se descuenta al cobrar.',
          'success');
      }
    } catch (e) {
      setError((e as Error)?.message ?? 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const noLlego = async () => {
    const si = await confirmar({
      titulo: '¿No llegó el adelanto?',
      mensaje: 'Lalan le escribe a la clienta que todavía no lo ves en tu cuenta y le pregunta el monto y la cuenta a la que lo envió. La hora se le vuelve a guardar por el plazo de la sede.',
      textoConfirmar: 'No llegó, avisarle',
    });
    if (!si) return;
    try {
      await adelantoNoLlego(cita.id);
      onCambio({ ...cita, adelantoEstado: 'esperando' });
      showToast('Listo', 'Se le avisó a la clienta y la cita sigue apartada.', 'info');
    } catch (e) {
      showToast('No se pudo', (e as Error)?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  };

  const quitar = async () => {
    const si = await confirmar({
      titulo: '¿Quitar el adelanto registrado?',
      mensaje: `Se borra el adelanto de ${dinero(cita.depositPaid, cita.currencyCode)}. Al cobrar ya no se descontará.`,
      textoConfirmar: 'Quitar', tono: 'peligro',
    });
    if (si) await guardar(0);
  };

  const aviso = pagado
    ? {
        icono: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40',
        texto: `Adelanto de ${dinero(cita.depositPaid, cita.currencyCode)} por ${NOMBRE_METODO[cita.depositMethod ?? 'transfer'] ?? 'transferencia'}` +
          (cita.depositReference ? ` · ref. ${cita.depositReference}` : '') + (cita.adelantoRegistradoPor ? ` · lo registró ${cita.adelantoRegistradoPor.split(' ')[0]}` : ''),
      }
    : estado === 'comprobante'
      ? { icono: <ReceiptText className="w-4 h-4 text-violet-600" />, color: 'bg-violet-50 dark:bg-violet-950/20 border-violet-200/70 dark:border-violet-900/40',
          texto: 'Mandó el comprobante por el chat. Revisa tu banco: si llegó, regístralo y la cita queda confirmada.' }
      : estado === 'esperando'
        ? { icono: <Clock className="w-4 h-4 text-amber-600" />, color: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40',
            texto: cita.adelantoVenceEn
              ? `Apartada esperando el adelanto. Si no llega, el espacio se suelta a las ${horaCorta(cita.adelantoVenceEn)}`
              : 'Apartada esperando el adelanto.' }
        : estado === 'vencido'
          ? { icono: <XCircle className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40',
              texto: 'No llegó el adelanto a tiempo: se soltó el espacio.' }
          : { icono: <Banknote className="w-4 h-4 text-slate-500" />, color: 'bg-slate-50 dark:bg-neutral-800/40 border-slate-200/80 dark:border-neutral-800',
              texto: 'Sin adelanto registrado.' };

  return (
    <div className={`px-4 py-3 rounded-2xl border space-y-2.5 ${aviso.color}`}>
      {modalConfirmar}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{aviso.icono}</span>
        <p className="flex-1 text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">{aviso.texto}</p>
      </div>

      {!abierto && !cerrada && (
        <div className="flex flex-wrap gap-2">
          {!pagado && (
            <button type="button" onClick={() => setAbierto(true)}
              className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold ios-touch cursor-pointer">
              {estado === 'comprobante' ? 'Llegó: registrar adelanto' : 'Registrar adelanto'}
            </button>
          )}
          {estado === 'comprobante' && porConfirmar && (
            <button type="button" onClick={noLlego}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 ios-touch cursor-pointer">
              No llegó
            </button>
          )}
          {pagado && (
            <button type="button" onClick={quitar} disabled={guardando}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 ios-touch cursor-pointer">
              Quitar
            </button>
          )}
        </div>
      )}

      {abierto && (
        <form onSubmit={(e) => { e.preventDefault(); const n = Number(monto); if (n > 0) void guardar(n); else setError('Escribe el monto que llegó.'); }}
          className="space-y-2.5">
          <label className="block">
            <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 mb-1">¿Cuánto llegó?{cita.currencyCode ? ` (${cita.currencyCode})` : ''}</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} autoFocus
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-bold focus:outline-none" />
            {sugerido > 0 && (
              <span className="block mt-1 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                El {settings.depositPercent} % de esta cita es {dinero(sugerido, cita.currencyCode)}. Escribe lo que viste en tu banco, no lo que se pidió.
              </span>
            )}
          </label>
          <div>
            <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 mb-1">¿Cómo llegó?</span>
            <div className="flex flex-wrap gap-1.5">
              {METODOS.map(m => (
                <button key={m.id} type="button" onClick={() => setMetodo(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-[0.75rem] font-bold ios-touch cursor-pointer ${metodo === m.id
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300'}`}>
                  {m.texto}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 mb-1">Referencia (opcional)</span>
            <input value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={120} placeholder="Ej.: 004512 o el número de la transferencia"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none" />
          </label>
          {porConfirmar && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.75rem] text-slate-700 dark:text-neutral-200">La cita queda confirmada. Avisarle a la clienta</span>
              <IOSToggle checked={avisar} onChange={setAvisar} ariaLabel="Avisarle a la clienta" />
            </div>
          )}
          {error && <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAbierto(false); setError(''); }} disabled={guardando}
              className="flex-1 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold text-slate-700 dark:text-neutral-200 ios-touch cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold ios-touch cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-70">
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar adelanto
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

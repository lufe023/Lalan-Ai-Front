import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, HandCoins, Loader2, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { alRecibir } from '../../services/socket';
import { useConfirmar } from '../ui/ModalConfirmar';

const hoyMas = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const PROMESAS = [{ dias: 7, texto: 'En 1 semana' }, { dias: 15, texto: 'En 15 días' }, { dias: 30, texto: 'En 1 mes' }];

/**
 * El final del cobro cuando falta dinero: "Dejar fiao".
 *
 * Con el fiao apagado en la sede no se pinta nada y queda el botón de
 * siempre ("Cerrar sin cobrar el resto"). Con el fiao prendido, ese botón
 * se cambia por este: pide clienta, fecha en que promete pagar y una nota,
 * y si quien cobra necesita permiso, la comanda espera a la dueña aquí mismo.
 */
export const CobroFiao: React.FC<{
  pendiente: number;
  plata: (n: any) => string;
  /** Se cerró como fiao: el cobro se puede cerrar */
  onFiado: () => void;
  /** El fiao está prendido en la sede (el POS esconde el cierre con saldo) */
  onActivo: (activo: boolean) => void;
}> = ({ pendiente, plata, onFiado, onActivo }) => {
  const { activeSale, saleBusy, dejarFiao, refrescarComanda, showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [activo, setActivo] = useState(false);
  const [debe, setDebe] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [espera, setEspera] = useState<any>(null);

  const saleId = activeSale?.id;
  const clientId = activeSale?.clientId ?? null;

  useEffect(() => {
    let vivo = true;
    api.get<any>('/fiao/ajustes')
      .then(a => { if (vivo) { setActivo(!!a?.fiaoActivo); onActivo(!!a?.fiaoActivo); } })
      .catch(() => { if (vivo) { setActivo(false); onActivo(false); } });
    return () => { vivo = false; };
  }, [onActivo]);

  // Lo que ya debía de otras veces: quien cobra lo ve antes de fiar más
  useEffect(() => {
    if (!clientId) { setDebe(0); return; }
    let vivo = true;
    api.get<{ saldo: number }>(`/fiao/clienta/${clientId}/saldo`)
      .then(r => { if (vivo) setDebe(Number(r?.saldo ?? 0)); })
      .catch(() => { if (vivo) setDebe(0); });
    return () => { vivo = false; };
  }, [clientId]);

  // ¿Esta comanda ya está esperando a la dueña? (se pidió desde otro aparato, o se recargó la página)
  const mirarEspera = useCallback(async () => {
    if (!saleId) return;
    try {
      const lista = await api.get<any[]>(`/fiao/solicitudes?saleId=${saleId}&estado=todas`);
      const ultima = lista?.[0] ?? null;
      if (ultima?.status === 'pending') { setEspera(ultima); return; }
      setEspera((antes: any) => {
        if (antes && ultima?.id === antes.id) {
          if (ultima.status === 'approved') { void refrescarComanda(); onFiado(); }
          if (ultima.status === 'rejected') {
            showToast('No se autorizó el fiao', ultima.rejectReason || 'Cóbrale el resto o habla con la dueña.', 'warning');
          }
        }
        return null;
      });
    } catch { /* sin red: se queda como estaba */ }
  }, [saleId, refrescarComanda, onFiado, showToast]);

  useEffect(() => { void mirarEspera(); }, [mirarEspera]);
  useEffect(() => alRecibir('ventas:cambio', () => { void mirarEspera(); }), [mirarEspera]);

  if (!activo || pendiente <= 0) return null;

  const pedir = async () => {
    const si = await confirmar({
      titulo: `¿Fiarle ${plata(pendiente)}?`,
      mensaje: `${activeSale?.clientName ?? 'La clienta'} se lleva lo consumido y queda debiendo ${plata(pendiente)}. Se descuenta el inventario y la deuda pasa a Caja, Fiao.`,
      textoConfirmar: 'Dejar fiao',
    });
    if (!si) return;
    const r = await dejarFiao({ fechaPromesa: fecha || null, nota: nota.trim() || null });
    if (r?.estado === 'fiado') { setAbierto(false); onFiado(); }
    if (r?.estado === 'esperando') {
      setEspera(r.solicitud);
      showToast('Pedido a la dueña', 'Le llegó el aviso para autorizar. Espera aquí.', 'success');
    }
  };

  const retirar = async () => {
    if (!espera) return;
    try {
      await api.post(`/fiao/solicitudes/${espera.id}/cancelar`, {});
      setEspera(null);
    } catch (e: any) {
      showToast('No se pudo retirar', e?.message ?? '', 'warning');
    }
  };

  return (
    <div className="space-y-2">
      {modalConfirmar}
      {debe > 0.009 && (
        <p className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[0.75rem] text-amber-800 dark:text-amber-200">
          Ya debe <b className="font-mono tabular-nums">{plata(debe)}</b> de otras veces. Se abona en Caja, Fiao.
        </p>
      )}

      {espera ? (
        <div className="p-3 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
            <p className="text-xs font-bold text-slate-900 dark:text-white">Esperando que la dueña autorice</p>
          </div>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
            {espera.motivo === 'tope'
              ? `Con esto pasa su tope de fiao. Le llegó el aviso a la dueña.`
              : espera.motivo === 'bloqueada'
                ? 'A esta clienta se le cerró el fiao. Le llegó el aviso a la dueña.'
                : 'Le llegó el aviso a la dueña. Cuando lo apruebe, la cuenta se cierra sola.'}
          </p>
          <button onClick={retirar}
            className="w-full py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer">
            Ya no hace falta, retirar el pedido
          </button>
        </div>
      ) : !clientId ? (
        <p className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] text-slate-500 dark:text-neutral-400">
          <UserPlus className="w-3.5 h-3.5 shrink-0" /> Para dejar fiao, ponle clienta a la cuenta.
        </p>
      ) : (
        <>
          <button onClick={() => setAbierto(v => !v)} disabled={saleBusy}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer">
            <HandCoins className="w-3.5 h-3.5" /> Dejar fiao {plata(pendiente)}
          </button>
          <AnimatePresence initial={false}>
            {abierto && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 space-y-2">
                  <label className="block">
                    <span className="flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">
                      <Clock className="w-3 h-3" /> Promete pagar (opcional)
                    </span>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      {PROMESAS.map(p => {
                        const valor = hoyMas(p.dias);
                        return (
                          <button key={p.dias} type="button" onClick={() => setFecha(f => (f === valor ? '' : valor))}
                            className={`py-1.5 rounded-lg text-[0.6875rem] font-bold transition cursor-pointer ${fecha === valor
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
                            {p.texto}
                          </button>
                        );
                      })}
                    </div>
                    <input type="date" value={fecha} min={hoyMas(0)} onChange={e => setFecha(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white" />
                  </label>
                  <input value={nota} onChange={e => setNota(e.target.value)} maxLength={300}
                    placeholder="Nota (opcional): paga el viernes, cuando cobre…"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white" />
                  <button onClick={pedir} disabled={saleBusy}
                    className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-extrabold disabled:opacity-40 transition cursor-pointer">
                    Dejar fiao
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

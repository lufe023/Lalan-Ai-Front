import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Lock, Receipt, Settings2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { Borrador, NOMBRE_LINEA, Resumen, moverPeriodo, pagos, rango } from '../../services/pagosEspecialistas';

const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3';
/** La misma clave que lee la Agenda para abrir una cita */
const ABRIR_CITA = 'lalan.abrirCita';

/**
 * Los cortes de pago: cuánto se le debe a cada especialista en el periodo,
 * con su recibo línea por línea. Cerrar lo congela; pagar en efectivo deja
 * la salida en la Caja de la sede.
 */
export const PagosEspecialistas: React.FC<{
  sede: string;
  onConfigurar: (staffId: string) => void;
  onCerrarVentana: () => void;
}> = ({ sede, onConfigurar, onCerrarVentana }) => {
  const { showToast, baseCurrency, navigateTo } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [fecha, setFecha] = useState<string | undefined>(undefined);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<Borrador | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const simbolo = baseCurrency?.symbol ?? '';
  const plata = (n: number | undefined | null) =>
    `${Number(n ?? 0) < 0 ? '−' : ''}${simbolo}${Math.abs(Number(n ?? 0)).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cargar = useCallback(async () => {
    try { setResumen(await pagos.resumen(sede || undefined, fecha)); }
    catch (e: any) { showToast('No se pudo cargar', e?.message ?? '', 'warning'); }
  }, [sede, fecha, showToast]);
  useEffect(() => { void cargar(); }, [cargar]);
  // Un aviso (renta automática) pide abrir el recibo de una especialista
  // Viene como "staffId:YYYY-MM-DD" (el día dice de qué periodo es el corte)
  const [pedida, setPedida] = useState<string | null>(() => {
    try { return sessionStorage.getItem('lalan.abrirPagoDe'); } catch { return null; }
  });
  useEffect(() => {
    if (!pedida) return;
    try { sessionStorage.removeItem('lalan.abrirPagoDe'); } catch { /* nada */ }
    const [id, dia] = pedida.split(':');
    if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) setFecha(dia);
    if (id !== pedida) setPedida(id || null);
  }, [pedida]);
  const abrir = useCallback(async (staffId: string) => {
    if (abierto === staffId) { setAbierto(null); setRecibo(null); return; }
    setAbierto(staffId);
    setRecibo(null);
    try { setRecibo(await pagos.borrador(staffId, sede || undefined, fecha)); }
    catch (e: any) { showToast('No se pudo abrir', e?.message ?? '', 'warning'); }
  }, [abierto, sede, fecha, showToast]);

  useEffect(() => {
    if (!pedida || pedida.includes(':') || !resumen) return;
    const fila = resumen.filas.find(f => f.staff.id === pedida);
    // Espera a que cargue el periodo pedido
    if (fecha && fila?.desde && !(fila.desde <= fecha && fecha <= (fila.hasta ?? fecha))) return;
    if (fila) void abrir(pedida);
    setPedida(null);
  }, [pedida, resumen, abrir, fecha]);

  const refrescar = async (staffId: string) => {
    await cargar();
    setRecibo(await pagos.borrador(staffId, sede || undefined, fecha));
  };

  const cerrar = async (b: Borrador) => {
    const nombre = b.staff.name.split(' ')[0];
    const noTermina = !!b.hasta && b.hasta >= new Date().toISOString().slice(0, 10);
    const si = await confirmar({
      titulo: `¿Cerrar el corte de ${nombre}?`,
      mensaje: `${rango(b.desde, b.hasta)}: le toca ${plata(b.neto)}. Cerrado ya no cambia; lo que se corrija después entra en el próximo corte.${noTermina ? ' El periodo todavía no termina: lo que haga desde ahora entra en el próximo.' : ''}`,
      textoConfirmar: 'Cerrar el corte',
    });
    if (!si) return;
    setOcupado(true);
    try {
      await pagos.cerrar(b.staff.id, sede || undefined, b.desde);
      await refrescar(b.staff.id);
      showToast('Corte cerrado', 'Ahora puedes marcarlo pagado.', 'success');
    } catch (e: any) {
      showToast('No se pudo cerrar', e?.message ?? '', 'warning');
    } finally { setOcupado(false); }
  };

  const pagar = async (b: Borrador, medio: 'efectivo' | 'transferencia') => {
    if (!b.cerrado) return;
    const debeElla = (b.cerrado.neto ?? 0) < 0;
    const si = await confirmar({
      titulo: medio === 'efectivo' ? (debeElla ? '¿Te pagó la renta en efectivo?' : '¿Le pagas en efectivo de la caja?') : '¿Ya le transferiste?',
      mensaje: medio === 'efectivo'
        ? `Se registra ${debeElla ? 'la entrada' : 'la salida'} de ${plata(Math.abs(b.cerrado.neto))} en la caja abierta de esta sede.`
        : 'Se marca pagado. Lalan no mueve dinero: solo lo anota.',
      textoConfirmar: 'Sí, marcar pagado',
    });
    if (!si) return;
    setOcupado(true);
    try {
      await pagos.pagar(b.cerrado.id, medio);
      await refrescar(b.staff.id);
      showToast('Pagado', medio === 'efectivo' ? 'Quedó en la caja de hoy.' : 'Quedó anotado.', 'success');
    } catch (e: any) {
      showToast('No se pudo', e?.message ?? '', 'warning');
    } finally { setOcupado(false); }
  };

  const verCita = (id: string) => {
    try { sessionStorage.setItem(ABRIR_CITA, id); } catch { /* nada */ }
    onCerrarVentana();
    navigateTo('calendar');
  };

  const filas = resumen?.filas ?? [];
  const primera = filas.find(f => f.desde);

  return (
    <div className="space-y-3">
      {modalConfirmar}

      {/* El periodo: cada una tiene el suyo; se mueve con las flechas */}
      <div className={`${TARJETA} !space-y-2`}>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <p className="flex-1 min-w-0 text-[0.8125rem] sm:text-xs font-semibold text-slate-900 dark:text-white">
            {primera ? `Periodo ${rango(primera.desde, primera.hasta)}` : 'Periodo actual'}
          </p>
          <button
            type="button" aria-label="Periodo anterior" disabled={!primera}
            onClick={() => primera?.desde && primera.hasta && setFecha(moverPeriodo(primera.desde, primera.hasta, -1))}
            className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button" aria-label="Periodo siguiente" disabled={!primera}
            onClick={() => primera?.desde && primera.hasta && setFecha(moverPeriodo(primera.desde, primera.hasta, 1))}
            className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {fecha && (
            <button type="button" onClick={() => setFecha(undefined)} className="text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">Hoy</button>
          )}
        </div>
        {!!resumen && (
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
            Por pagar: <span className="font-bold text-slate-900 dark:text-white tabular-nums">{plata(resumen.totales.neto)}</span>
            {resumen.totales.porCerrar > 0 && ` · ${resumen.totales.porCerrar} ${resumen.totales.porCerrar === 1 ? 'corte' : 'cortes'} por cerrar`}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {filas.map(f => {
          const abiertoAqui = abierto === f.staff.id;
          const b = abiertoAqui ? recibo : null;
          return (
            <div key={f.staff.id} className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
              <button
                type="button"
                onClick={() => f.sinAcuerdo ? onConfigurar(f.staff.id) : void abrir(f.staff.id)}
                aria-expanded={abiertoAqui}
                className="w-full p-3 flex items-center gap-2 text-left cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] sm:text-xs font-semibold text-slate-900 dark:text-white truncate">{f.staff.name}</p>
                  <p className="text-[0.6875rem] text-slate-400 truncate">
                    {f.sinAcuerdo ? 'Sin acuerdo de pago: toca para decir cómo se le paga' : `${f.etiqueta} · ${f.servicios} ${f.servicios === 1 ? 'servicio' : 'servicios'} · ${rango(f.desde, f.hasta)}`}
                  </p>
                </div>
                {!f.sinAcuerdo && (
                  <div className="shrink-0 text-right">
                    <p className={`text-[0.875rem] sm:text-xs font-extrabold tabular-nums ${f.neto < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{plata(f.cerrado ? f.cerrado.neto : f.neto)}</p>
                    <p className={`text-[0.625rem] font-bold uppercase ${
                      f.cerrado?.estado === 'pagado' ? 'text-emerald-600' : f.cerrado ? 'text-sky-600' : 'text-slate-400'
                    }`}>
                      {f.cerrado?.estado === 'pagado' ? 'Pagado' : f.cerrado ? 'Cerrado' : 'En curso'}
                    </p>
                  </div>
                )}
                {f.sinAcuerdo && <Settings2 className="w-4 h-4 shrink-0 text-amber-500" />}
              </button>

              {abiertoAqui && (
                <div className="px-3 pb-3 space-y-2">
                  {!b && <p className="py-3 text-center text-[0.75rem] text-slate-400">Calculando…</p>}
                  {b && (
                    <>
                      {b.escalon && <BarraEscalon escalon={b.escalon} plata={plata} />}
                      {(b.avisos ?? []).map(a => (
                        <p key={a} className="flex items-start gap-1.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-[0.75rem] text-amber-800 dark:text-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {a}
                        </p>
                      ))}

                      {/* El recibo: cada línea dice de dónde sale */}
                      <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 divide-y divide-slate-100 dark:divide-neutral-800">
                        {(b.lineas ?? []).filter(l => l.tipo !== 'aporte_salon').map((l, i) => (
                          <div key={i} className="px-2.5 py-2 flex items-center gap-2 text-[0.75rem]">
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-700 dark:text-neutral-200 truncate">
                                <span className="text-slate-400">{NOMBRE_LINEA[l.tipo]} · </span>{l.concepto}
                              </p>
                              {(l.porcentaje != null && l.base != null) && (
                                <p className="text-[0.6875rem] text-slate-400 tabular-nums">{l.porcentaje} % de {plata(l.base)}</p>
                              )}
                            </div>
                            {l.appointmentId && (
                              <button type="button" onClick={() => verCita(l.appointmentId!)} className="shrink-0 text-[0.6875rem] font-semibold text-[var(--primary)] cursor-pointer">Ver cita</button>
                            )}
                            <span className={`shrink-0 font-semibold tabular-nums ${l.monto < 0 ? 'text-rose-500' : 'text-slate-800 dark:text-neutral-100'}`}>{plata(l.monto)}</span>
                          </div>
                        ))}
                        {!(b.lineas ?? []).length && (
                          <p className="px-2.5 py-3 text-center text-[0.75rem] text-slate-400">Nada todavía en este periodo.</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {[
                          ['Ganado', b.bruto],
                          ['Propinas', b.propinas],
                          ['Descuentos', -(b.descuentos ?? 0)],
                          ['Le toca', b.neto],
                        ].map(([l, v]) => (
                          <div key={String(l)} className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/40">
                            <div className="text-[0.6875rem] text-slate-400 font-medium">{String(l)}</div>
                            <div className="text-xs font-bold text-slate-800 dark:text-neutral-200 tabular-nums">{plata(Number(v))}</div>
                          </div>
                        ))}
                      </div>
                      {!!b.aportesSalon && (
                        <p className="text-[0.6875rem] text-slate-400">
                          Aporte del salón a sus seguros: {plata(b.aportesSalon)}. Es costo del salón, no se le descuenta.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {!b.cerrado && (
                          <button type="button" disabled={ocupado} onClick={() => void cerrar(b)} className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] sm:text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" /> Cerrar el corte
                          </button>
                        )}
                        {b.cerrado?.estado === 'cerrado' && (
                          <>
                            <button type="button" disabled={ocupado} onClick={() => void pagar(b, 'efectivo')} className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 rounded-xl bg-emerald-600 text-white text-[0.8125rem] sm:text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
                              <Banknote className="w-3.5 h-3.5" /> {(b.cerrado.neto ?? 0) < 0 ? 'Cobré la renta en efectivo' : 'Pagar de la caja'}
                            </button>
                            <button type="button" disabled={ocupado} onClick={() => void pagar(b, 'transferencia')} className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-[0.8125rem] sm:text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5" /> Fue por transferencia
                            </button>
                          </>
                        )}
                        {b.cerrado?.estado === 'pagado' && (
                          <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" /> Pagado
                          </span>
                        )}
                        <button type="button" onClick={() => onConfigurar(b.staff.id)} className="ml-auto text-[0.75rem] font-semibold text-slate-500 hover:text-[var(--primary)] cursor-pointer flex items-center gap-1">
                          <Settings2 className="w-3.5 h-3.5" /> Cómo se le paga
                        </button>
                        <button type="button" aria-label="Cerrar el recibo" onClick={() => { setAbierto(null); setRecibo(null); }} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!!resumen && !filas.length && (
          <p className="py-6 text-center text-[0.75rem] text-slate-400">No hay especialistas en esta sede.</p>
        )}
      </div>
    </div>
  );
};

/** En qué escalón de comisión va y cuánto le falta para el próximo */
export const BarraEscalon: React.FC<{ escalon: NonNullable<Borrador['escalon']>; plata: (n: number) => string }> = ({ escalon, plata }) => {
  const sig = escalon.siguiente;
  const pct = sig ? Math.max(4, Math.min(100, ((sig.desde - sig.falta) / sig.desde) * 100)) : 100;
  return (
    <div className="p-2.5 rounded-xl bg-[var(--primary)]/5 space-y-1.5">
      <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
        Va en el escalón de <span className="font-bold">{escalon.porcentaje} %</span>
        {sig ? <> · le faltan <span className="font-bold tabular-nums">{plata(sig.falta)}</span> en servicios para el {sig.porcentaje} %</> : ' · el más alto'}
      </p>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-neutral-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Avance al próximo escalón">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

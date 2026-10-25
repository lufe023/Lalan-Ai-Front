import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, HandCoins, Loader2, MapPin, MessageCircle, Search, ShieldCheck, UserPlus, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { api } from '../../services/api';
import { alRecibir } from '../../services/socket';
import { IOSModal } from '../ui/IOSModal';
import { FotoClienta } from '../ui/FotoClienta';
import { useConfirmar } from '../ui/ModalConfirmar';

const METODOS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'transfer', label: 'Transf.' },
  { id: 'other', label: 'Otro' },
] as const;
const NOMBRE_METODO: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transf.', other: 'Otro' };
const TRAMOS: { id: string; texto: string }[] = [
  { id: '0-15', texto: 'Hasta 15 días' },
  { id: '16-30', texto: '16 a 30' },
  { id: '31-60', texto: '31 a 60' },
  { id: '60+', texto: 'Más de 60' },
];

const fechaCorta = (d: any) => (d ? new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '');
/** La fecha prometida es un día entero (viene a medianoche UTC): se lee sin correrla de día */
const diaPrometido = (d: any) => (d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '');
const hace = (dias: number) => (dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`);

/** Color por atraso: verde al día, ámbar cuando se alarga, rojo vencido */
function tonoDe(c: { vencida: boolean; dias: number }) {
  if (c.vencida) return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300';
  if (c.dias > 15) return 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300';
  return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300';
}

/**
 * Caja → Fiao: quién le debe al salón en esta sede, cuánto y desde cuándo.
 * Aquí se abona, la dueña autoriza lo que pidió el equipo, y se perdona lo
 * que ya no se va a cobrar. Cobrar es cosa de personas: Lalan nunca le
 * habla de deudas a una clienta.
 */
export const PanelFiao: React.FC<{ plata: (n: any) => string; onPendientes?: (n: number) => void }> = ({ plata, onPendientes }) => {
  const { showToast, currencies, baseCurrency, clients } = useApp();
  const { currentUser } = useAuth();
  const { varias, actual } = useSedeActiva();
  const { confirmar, modalConfirmar } = useConfirmar();
  const esDireccion = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const enTodas = varias && !actual;

  const [datos, setDatos] = useState<any>(null);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [resumenMes, setResumenMes] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [busca, setBusca] = useState('');
  const [abierta, setAbierta] = useState<{ clientId: string; locationId: string | null; nombre: string } | null>(null);
  const [asignando, setAsignando] = useState<any>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([
        api.get<any>('/fiao'),
        api.get<any[]>('/fiao/solicitudes'),
      ]);
      setDatos(l);
      setPedidos(p ?? []);
      onPendientes?.((p ?? []).length);
    } catch {
      setDatos((d: any) => d ?? { resumen: { total: 0, clientas: 0, vencidas: 0, tramos: {} }, clientas: [], sinDuena: [] });
    } finally { setCargando(false); }
    if (esDireccion) {
      api.get<any>('/fiao/reporte').then(setResumenMes).catch(() => setResumenMes(null));
    }
  }, [esDireccion, onPendientes]);

  useEffect(() => { void cargar(); }, [cargar, actual?.id]);
  // Un fiao nuevo, un abono o un pedido desde otro aparato: la lista se pone al día sola
  useEffect(() => alRecibir('ventas:cambio', () => { void cargar(); }), [cargar]);

  const clientas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = datos?.clientas ?? [];
    return q ? lista.filter((c: any) => c.nombre.toLowerCase().includes(q)) : lista;
  }, [datos, busca]);

  const decidir = async (s: any, aprobar: boolean) => {
    if (!aprobar) {
      const si = await confirmar({
        titulo: '¿No autorizar?',
        mensaje: s.kind === 'fiao'
          ? `${s.requestedByName ?? 'Quien cobra'} tendrá que cobrarle el resto a ${s.clientName ?? 'la clienta'}.`
          : `El abono de ${s.clientName ?? 'la clienta'} no se registrará en esta sede.`,
        textoConfirmar: 'No autorizar', tono: 'peligro',
      });
      if (!si) return;
    }
    setOcupado(s.id);
    try {
      await api.post(`/fiao/solicitudes/${s.id}/${aprobar ? 'aprobar' : 'rechazar'}`, {});
      showToast(aprobar ? 'Autorizado' : 'No autorizado', aprobar ? 'Ya quedó registrado.' : 'Ya le avisamos a quien lo pidió.', aprobar ? 'success' : 'info');
      await cargar();
    } catch (e: any) {
      showToast('No se pudo', e?.message ?? '', 'warning');
    } finally { setOcupado(null); }
  };

  const ponerClienta = async (venta: any, clientId: string) => {
    setOcupado(venta.saleId);
    try {
      await api.post(`/fiao/ventas/${venta.saleId}/asignar`, { clientId });
      setAsignando(null);
      showToast('Listo', 'El saldo pasó a fiao de la clienta.', 'success');
      await cargar();
    } catch (e: any) {
      showToast('No se pudo', e?.message ?? '', 'warning');
    } finally { setOcupado(null); }
  };

  if (cargando && !datos) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  const r = datos?.resumen ?? { total: 0, clientas: 0, vencidas: 0, tramos: {} };

  return (
    <>
      {modalConfirmar}

      {varias && actual && (
        <p className="flex items-center gap-1.5 px-1 text-[0.75rem] text-slate-500 dark:text-neutral-400">
          <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" /> Fiao de <b className="text-slate-700 dark:text-neutral-200">{actual.name}</b>
        </p>
      )}

      {/* Cuánto se debe */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <HandCoins className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Por cobrar</div>
              <div className="text-[0.75rem] text-slate-400">
                {r.clientas === 1 ? '1 clienta debe' : `${r.clientas} clientas deben`}
                {r.vencidas > 0 && <> · <span className="text-red-500 font-bold">{r.vencidas} vencida{r.vencidas === 1 ? '' : 's'}</span></>}
              </div>
            </div>
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">{plata(r.total)}</div>
        </div>
        {r.total > 0 && (
          <div className="grid grid-cols-4 gap-1 text-center">
            {TRAMOS.map(t => (
              <div key={t.id} className="p-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800/40">
                <div className="text-[0.6875rem] text-slate-400 font-medium">{t.texto}</div>
                <div className="text-[0.75rem] font-bold text-slate-800 dark:text-neutral-200 tabular-nums">{Number(r.tramos?.[t.id] ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lo que el equipo le pidió a la dueña */}
      {pedidos.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-[var(--primary)]/40 shadow-2xs space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--primary)]" /> {esDireccion ? 'Por autorizar' : 'Esperando a la dueña'}
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-neutral-800">
            {pedidos.map(s => (
              <div key={s.id} className="py-2 space-y-1.5">
                <p className="text-xs text-slate-700 dark:text-neutral-200">
                  <b>{s.requestedByName ?? 'Alguien del equipo'}</b>{' '}
                  {s.kind === 'fiao' ? 'quiere fiarle' : 'quiere recibir un abono de'}{' '}
                  <b className="font-mono tabular-nums">{plata(s.amount)}</b>{' '}
                  {s.kind === 'fiao' ? 'a' : 'de'} <b>{s.clientName ?? 'una clienta'}</b>
                  {s.kind !== 'fiao' && ' para una deuda de otra sede'}.
                </p>
                {s.motivo === 'tope' && <p className="text-[0.6875rem] text-amber-600">Con esto pasa su tope de fiao.</p>}
                {s.motivo === 'bloqueada' && <p className="text-[0.6875rem] text-amber-600">A esta clienta se le cerró el fiao.</p>}
                {s.detalle?.nota && <p className="text-[0.6875rem] text-slate-400">“{s.detalle.nota}”</p>}
                {esDireccion && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => decidir(s, false)} disabled={ocupado === s.id}
                      className="py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 disabled:opacity-40 cursor-pointer">
                      No autorizar
                    </button>
                    <button onClick={() => decidir(s, true)} disabled={ocupado === s.id}
                      className="py-1.5 rounded-xl bg-emerald-500 text-white text-[0.75rem] font-bold flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer">
                      <Check className="w-3.5 h-3.5" /> Autorizar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quién debe */}
      <div className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
        {(datos?.clientas?.length ?? 0) > 5 && (
          <div className="relative p-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar clienta…"
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white" />
          </div>
        )}
        {clientas.length ? (
          <div className="divide-y divide-slate-100 dark:divide-neutral-800">
            {clientas.map((c: any) => (
              <button key={`${c.clientId}:${c.locationId}`}
                onClick={() => setAbierta({ clientId: c.clientId, locationId: c.locationId, nombre: c.nombre })}
                className="w-full p-2 flex items-center gap-2.5 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/50 rounded-xl transition cursor-pointer">
                <FotoClienta foto={c.avatar} nombre={c.nombre} className="w-10 h-10" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.nombre}</div>
                  <div className="flex flex-wrap items-center gap-1 text-[0.6875rem] text-slate-400">
                    {enTodas && c.sede && (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-300 font-semibold">{c.sede}</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded-md font-bold ${tonoDe(c)}`}>
                      {c.vencida ? 'Vencido' : 'Al día'}
                    </span>
                    <span>{c.cuentas === 1 ? '1 cuenta' : `${c.cuentas} cuentas`} · {hace(c.dias)}</span>
                    {c.promesa && <span>· prometió {diaPrometido(c.promesa)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{plata(c.saldo)}</div>
                  {c.recargos > 0 && <div className="text-[0.6875rem] text-amber-600 tabular-nums">{plata(c.recargos)} recargo</div>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-slate-400">
            {busca ? 'Ninguna clienta con ese nombre debe.' : 'Nadie debe nada. Cuando una clienta quede debiendo, aparece aquí.'}
          </p>
        )}
      </div>

      {/* Saldos de Mostrador: se cerraron con saldo y sin clienta */}
      {esDireccion && (datos?.sinDuena?.length ?? 0) > 0 && (
        <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900/60 shadow-2xs space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Saldos sin clienta</h3>
              <p className="text-[0.75rem] text-slate-400">Cuentas de Mostrador que se cerraron sin cobrar todo. Si sabes de quién son, pónselas para que pasen a su fiao.</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-neutral-800">
            {datos.sinDuena.map((v: any) => (
              <div key={v.saleId} className="py-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 text-[0.75rem]">
                    <span className="font-bold text-slate-800 dark:text-neutral-100">{v.nombre}</span>
                    <span className="text-slate-400"> · {fechaCorta(v.cerrada)}{enTodas && v.sede ? ` · ${v.sede}` : ''}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{plata(v.saldo)}</span>
                </div>
                {asignando?.saleId === v.saleId ? (
                  <select autoFocus defaultValue="" disabled={ocupado === v.saleId}
                    onChange={e => e.target.value && ponerClienta(v, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white">
                    <option value="" disabled>¿De qué clienta es?</option>
                    {(clients ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <button onClick={() => setAsignando(v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer">
                    <UserPlus className="w-3 h-3" /> Ponerle clienta
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lo del último mes, para la dueña */}
      {esDireccion && resumenMes?.periodo && (
        <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-2">
          <h3 className="px-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Últimos 30 días</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              ['Fiado', resumenMes.periodo.fiado],
              ['Abonado', resumenMes.periodo.abonado],
              ['Recargos cobrados', resumenMes.periodo.recargosCobrados],
              ['Perdonado', resumenMes.periodo.perdonado],
            ].map(([l, v]) => (
              <div key={String(l)} className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/40">
                <div className="text-[0.6875rem] text-slate-400 font-medium">{String(l)}</div>
                <div className="text-xs font-bold text-slate-800 dark:text-neutral-200 tabular-nums">{plata(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <IOSModal
        isOpen={!!abierta}
        onClose={() => setAbierta(null)}
        title={abierta?.nombre ?? ''}
        subtitle="Fiao"
      >
        {abierta && (
          <CuentaClienta
            clientId={abierta.clientId}
            locationId={abierta.locationId}
            plata={plata}
            esDireccion={esDireccion}
            monedas={(currencies ?? []).filter(c => c.active !== false)}
            base={baseCurrency}
            onCambio={cargar}
          />
        )}
      </IOSModal>
    </>
  );
};

/** La hoja de una clienta: cuánto debe, de qué, lo que abonó, y abonar */
const CuentaClienta: React.FC<{
  clientId: string;
  locationId: string | null;
  plata: (n: any) => string;
  esDireccion: boolean;
  monedas: any[];
  base: any;
  onCambio: () => void;
}> = ({ clientId, locationId, plata, esDireccion, monedas, base, onCambio }) => {
  const { showToast } = useApp();
  const { actual, varias } = useSedeActiva();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [cuenta, setCuenta] = useState<any>(null);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<string>('cash');
  const [moneda, setMoneda] = useState<string>('');
  const [referencia, setReferencia] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [verSaldadas, setVerSaldadas] = useState(false);
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  // La deuda es de una sede; se lee en esa sede
  const sedeQ = locationId ? `?sede=${locationId}` : '';
  const cargar = useCallback(async () => {
    try { setCuenta(await api.get<any>(`/fiao/clienta/${clientId}${sedeQ}`)); }
    catch { setCuenta(null); }
  }, [clientId, sedeQ]);
  useEffect(() => { void cargar(); }, [cargar]);

  if (!cuenta) return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const saldo = Number(cuenta.saldo ?? 0);
  const monedaSel = monedas.find(m => m.code === moneda) ?? base;
  const tasa = Number(monedaSel?.rateToBase ?? 1) || 1;
  const enBase = (Number(monto) || 0) * tasa;
  const vuelto = Math.max(0, enBase - saldo);
  // Cobrar aquí una deuda de otra sede: lo autoriza la dueña (si la sede lo permite)
  const otraSede = !!(locationId && actual && actual.id !== locationId);
  const abiertasVivas = (cuenta.cuentas ?? []).filter((c: any) => c.estado === 'open');
  const cerradas = (cuenta.cuentas ?? []).filter((c: any) => c.estado !== 'open');

  const abonar = async () => {
    if (!(Number(monto) > 0)) return;
    setOcupado(true);
    try {
      const r = await api.post<any>(`/fiao/clienta/${clientId}/abonos`, {
        monto: Number(monto), metodo, moneda: monedaSel?.code, referencia: referencia.trim() || null, sedeDeuda: locationId,
      });
      if (r?.estado === 'esperando') {
        showToast('Pedido a la dueña', 'Es una deuda de otra sede: cuando lo autorice, el abono queda registrado.', 'success');
      } else {
        showToast('Abono registrado', r?.vuelto > 0 ? `Devuelta: ${plata(r.vuelto)}. Le queda ${plata(r.saldo)}.` : `Le queda ${plata(r?.saldo ?? 0)}.`, 'success');
      }
      setMonto(''); setReferencia('');
      await cargar();
      onCambio();
    } catch (e: any) {
      showToast('No se pudo abonar', e?.message ?? '', 'warning');
    } finally { setOcupado(false); }
  };

  const perdonar = async (c: any) => {
    const nota = (motivos[c.saleId] ?? '').trim();
    if (!nota) { showToast('Escribe el motivo', 'Queda guardado junto a lo perdonado.', 'warning'); return; }
    const si = await confirmar({
      titulo: `¿Perdonar ${plata(c.saldo)}?`,
      mensaje: 'Esta cuenta deja de cobrarse. No se borra: queda en el reporte como perdonado, con tu nombre y el motivo.',
      textoConfirmar: 'Perdonar', tono: 'peligro',
    });
    if (!si) return;
    try {
      await api.post(`/fiao/ventas/${c.saleId}/perdonar`, { motivo: nota });
      showToast('Perdonado', 'La cuenta ya no se cobra.', 'success');
      await cargar();
      onCambio();
    } catch (e: any) {
      showToast('No se pudo', e?.message ?? '', 'warning');
    }
  };

  const telefono = String(cuenta.clienta?.phone ?? '').replace(/\D/g, '');
  const mensaje = `Hola ${String(cuenta.clienta?.name ?? '').split(' ')[0]}, te escribimos del salón. Tu saldo pendiente es ${plata(saldo)}. Cuando puedas pasar, con gusto te atendemos. ¡Gracias!`;

  const tarjeta = (c: any) => {
    const abierta = !!abiertas[c.saleId];
    return (
      <div key={c.saleId} className="rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
        <button onClick={() => setAbiertas(p => ({ ...p, [c.saleId]: !abierta }))}
          className="w-full p-3 flex items-center justify-between gap-2 text-left cursor-pointer">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {fechaCorta(c.fiadaEl)}
              {varias && c.sede && <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] text-slate-500 dark:text-neutral-300 font-semibold">{c.sede}</span>}
            </div>
            <div className="text-[0.6875rem] text-slate-400 truncate">
              {c.lineas.map((l: any) => l.label).join(', ') || 'Consumo'}
              {c.promesa && ` · prometió ${diaPrometido(c.promesa)}`}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {c.estado === 'open' ? (
              <span className="text-xs font-extrabold tabular-nums text-slate-900 dark:text-white">{plata(c.saldo)}</span>
            ) : (
              <span className={`px-1.5 py-0.5 rounded-md text-[0.6875rem] font-bold ${c.estado === 'settled'
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'}`}>
                {c.estado === 'settled' ? 'Saldada' : 'Perdonada'}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition ${abierta ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {abierta && (
          <div className="px-3 pb-3 space-y-2 text-[0.75rem]">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-1">
              {c.lineas.map((l: any, i: number) => (
                <div key={i} className="flex justify-between text-slate-500 dark:text-neutral-400">
                  <span className="truncate">{l.cantidad !== 1 ? `${l.cantidad} × ` : ''}{l.label}</span>
                  <span className="font-mono tabular-nums">{plata(l.total)}</span>
                </div>
              ))}
              {c.pagadoAlCobrar > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Pagó al cobrar</span><span className="font-mono tabular-nums">−{plata(c.pagadoAlCobrar)}</span></div>
              )}
              {c.cargos.map((g: any) => (
                <div key={g.periodo} className="flex justify-between text-amber-600">
                  <span>Recargo {g.pct} % · {fechaCorta(g.fecha)}</span>
                  <span className="font-mono tabular-nums">+{plata(g.monto)}</span>
                </div>
              ))}
              {c.abonos.map((a: any) => (
                <div key={a.id} className="flex justify-between text-emerald-600">
                  <span>Abono {NOMBRE_METODO[a.metodo] ?? a.metodo} · {fechaCorta(a.fecha)}{a.sede && varias ? ` · ${a.sede}` : ''}</span>
                  <span className="font-mono tabular-nums">−{plata(a.monto)}</span>
                </div>
              ))}
              {c.perdonado != null && (
                <div className="flex justify-between text-amber-600"><span>Perdonado · {c.motivoPerdon}</span><span className="font-mono tabular-nums">−{plata(c.perdonado)}</span></div>
              )}
            </div>
            <p className="text-[0.6875rem] text-slate-400">
              Fió {c.fio ?? 'alguien del equipo'}{c.autorizo ? `, autorizó ${c.autorizo}` : ''}.
              {c.condiciones ? ` Recargo de ${c.condiciones.pct} % ${c.condiciones.cada === 'mes' ? 'cada 30 días' : 'una vez'}${c.condiciones.diasGracia ? ` después de ${c.condiciones.diasGracia} días` : ' desde el día cero'}.` : ''}
              {c.nota ? ` “${c.nota}”` : ''}
            </p>
            {esDireccion && c.estado === 'open' && (
              <div className="flex gap-1.5">
                <input value={motivos[c.saleId] ?? ''} onChange={e => setMotivos(p => ({ ...p, [c.saleId]: e.target.value }))}
                  maxLength={300} placeholder="Motivo para perdonar"
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white" />
                <button onClick={() => perdonar(c)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-bold text-red-500 cursor-pointer">
                  Perdonar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-6 text-xs">
      {modalConfirmar}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 flex items-center justify-between gap-2">
        <div>
          <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Debe</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">{plata(saldo)}</div>
        </div>
        {telefono && saldo > 0 && (
          <a href={`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">
            <MessageCircle className="w-4 h-4 text-emerald-500" /> Escribirle yo
          </a>
        )}
      </div>

      {saldo > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Abonar</h3>
          {otraSede && (
            <p className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-[0.75rem] text-amber-800 dark:text-amber-200">
              Esta deuda es de otra sede. El abono entra en la caja de {actual?.name} y lo tiene que autorizar la dueña.
            </p>
          )}
          <div className="grid grid-cols-4 gap-1">
            {METODOS.map(m => (
              <button key={m.id} onClick={() => setMetodo(m.id)}
                className={`py-2 rounded-xl text-[0.75rem] font-bold transition cursor-pointer ${metodo === m.id
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
                {m.label}
              </button>
            ))}
          </div>
          {monedas.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {monedas.map(m => (
                <button key={m.code} onClick={() => setMoneda(m.isBase ? '' : m.code)}
                  className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-bold cursor-pointer ${(monedaSel?.code === m.code)
                    ? 'bg-slate-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
                  {m.symbol} {m.code}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input type="number" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white" />
            <button onClick={() => setMonto((saldo / tasa).toFixed(2))}
              className="px-3 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer">Todo</button>
            <button onClick={() => setMonto((saldo / 2 / tasa).toFixed(2))}
              className="px-3 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer">La mitad</button>
          </div>
          {metodo !== 'cash' && (
            <input value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={120}
              placeholder="Referencia (últimos 4 de la tarjeta, número de transferencia)"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white" />
          )}
          {Number(monto) > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-1 text-[0.75rem]">
              {monedaSel && !monedaSel.isBase && (
                <div className="flex justify-between text-slate-500"><span>Equivale a</span><span className="font-mono tabular-nums">{plata(enBase)}</span></div>
              )}
              <div className="flex justify-between text-slate-500"><span>Le queda</span><span className="font-mono tabular-nums">{plata(Math.max(0, saldo - enBase))}</span></div>
              {vuelto > 0.009 && (
                metodo === 'cash'
                  ? <div className="flex justify-between font-extrabold text-emerald-600"><span>Devuelta</span><span className="font-mono tabular-nums">{plata(vuelto)}</span></div>
                  : <p className="text-red-500 font-semibold">Pasa de lo que debe. Con {NOMBRE_METODO[metodo].toLowerCase()} abona el saldo exacto.</p>
              )}
            </div>
          )}
          <button onClick={abonar} disabled={ocupado || !(Number(monto) > 0) || (vuelto > 0.009 && metodo !== 'cash')}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-extrabold disabled:opacity-40 transition cursor-pointer">
            {ocupado ? 'Registrando…' : otraSede ? 'Pedir autorización del abono' : 'Registrar abono'}
          </button>
          <p className="text-[0.6875rem] text-center text-slate-400">Se abona primero la cuenta más vieja, y en cada una primero el recargo.</p>
        </div>
      )}

      {abiertasVivas.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Lo que debe</h3>
          {abiertasVivas.map(tarjeta)}
        </div>
      )}

      {cerradas.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setVerSaldadas(v => !v)}
            className="w-full px-1 flex items-center justify-between text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 cursor-pointer">
            <span>Saldadas y perdonadas ({cerradas.length})</span>
            {verSaldadas ? <X className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {verSaldadas && cerradas.map(tarjeta)}
        </div>
      )}
    </div>
  );
};

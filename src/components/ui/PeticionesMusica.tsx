import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { Music2, Minus, Plus, RotateCcw, X, Users, ListMusic, QrCode } from 'lucide-react';
import { api, urlDePedirCancion } from '../../services/api';
import { alRecibir } from '../../services/socket';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Ajustes de las canciones que piden las clientas desde el QR.
 *
 * Tres cosas que la dueña necesita y que antes no existían:
 *  - cuántas canciones puede pedir cada persona (y cada cuánto se renueva);
 *  - devolverle la cuota a UNA persona, o a todas a la vez;
 *  - ver y quitar lo que está esperando en la fila.
 *
 * "Persona" es en realidad un aparato: nadie inicia sesión para pedir. Por eso
 * cada fila enseña el nombre que puso y un código de cuatro letras que la
 * clienta también ve en su pantalla ("Tu código: A4F2").
 */

interface Persona {
  deviceId: string;
  codigo: string;
  nombre: string | null;
  usadas: number;
  total: number;
  ultima: string;
  canciones: { title: string; estado: string }[];
}

interface Pendiente {
  id: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  guestName: string | null;
  createdAt: string;
}

interface Resumen {
  locationId: string;
  sede: string;
  token: string;
  config: { limite: number; ventanaHoras: number };
  pendientes: Pendiente[];
  personas: Persona[];
}

const VENTANAS = [1, 2, 3, 4, 6, 8, 12, 24];

const hace = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
};

export const PeticionesMusica: React.FC = () => {
  const { showToast } = useApp();
  const { currentUser } = useAuth();
  const esAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState(false);
  const [limite, setLimite] = useState(3);
  const [ventana, setVentana] = useState(6);
  const [qr, setQr] = useState('');
  const [confirmando, setConfirmando] = useState<null | 'todas' | 'enlace'>(null);
  const temporizador = useRef<number>(0);
  const guardarEn = useRef<number>(0);
  const pendiente = useRef<{ limite?: number; ventanaHoras?: number }>({});

  const cargar = useCallback(async () => {
    try {
      const x = await api.get<Resumen>('/lounge/requests/overview');
      setR(x);
      setLimite(x.config.limite);
      setVentana(x.config.ventanaHoras);
      setError(false);
    } catch { setError(true); }
  }, []);

  useEffect(() => {
    void cargar();
    // Llegó una petición, sonó una, o alguien reinició una cuota
    return alRecibir('musica:peticiones', () => { void cargar(); });
  }, [cargar]);

  const url = r?.token ? urlDePedirCancion(r.token) : '';
  useEffect(() => {
    if (!url) { setQr(''); return; }
    let vivo = true;
    QRCode.toDataURL(url, { margin: 1, width: 256, errorCorrectionLevel: 'M' })
      .then(d => { if (vivo) setQr(d); })
      .catch(() => { if (vivo) setQr(''); });
    return () => { vivo = false; };
  }, [url]);

  // Un "¿seguro?" que se apaga solo: no debe quedarse armado para un toque accidental
  const pedirConfirmacion = (que: 'todas' | 'enlace') => {
    setConfirmando(que);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setConfirmando(null), 4000);
  };
  useEffect(() => () => { window.clearTimeout(temporizador.current); window.clearTimeout(guardarEn.current); }, []);

  /**
   * Guarda con un pequeño retraso: quien pasa de 3 a 6 pulsa "+" tres veces
   * y no merece tres peticiones. Lo que se pinta es lo que el servidor
   * devuelve, no lo que se mandó (recorta a 0-10 y 1-24 h).
   */
  const guardarConfig = (nueva: { limite?: number; ventanaHoras?: number }) => {
    if (nueva.limite !== undefined) setLimite(nueva.limite);
    if (nueva.ventanaHoras !== undefined) setVentana(nueva.ventanaHoras);
    // Se acumula: cambiar las canciones y las horas en el mismo segundo
    // no puede dejar una de las dos por el camino
    pendiente.current = { ...pendiente.current, ...nueva };
    window.clearTimeout(guardarEn.current);
    guardarEn.current = window.setTimeout(async () => {
      const envio = pendiente.current;
      pendiente.current = {};
      try {
        const g = await api.patch<{ limite: number; ventanaHoras: number }>('/lounge/requests/config', envio);
        setLimite(g.limite);
        setVentana(g.ventanaHoras);
      } catch (e: any) {
        showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
        void cargar();
      }
    }, 450);
  };

  const reiniciar = async (persona?: Persona) => {
    try {
      const res = await api.post<{ liberadas: number }>('/lounge/requests/reset', persona ? { deviceId: persona.deviceId } : {});
      setConfirmando(null);
      showToast(
        persona ? 'Cuota devuelta' : 'Cuotas reiniciadas',
        persona
          ? `${persona.nombre ?? `Invitada ${persona.codigo}`} puede volver a pedir ${limite} ${limite === 1 ? 'canción' : 'canciones'}.`
          : res.liberadas
          ? 'Todas las personas pueden volver a pedir canciones.'
          : 'Nadie había gastado cuota todavía.',
        'success',
      );
      await cargar();
    } catch (e: any) {
      showToast('No se pudo reiniciar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  };

  const quitar = async (p: Pendiente) => {
    try {
      await api.delete(`/lounge/requests/${p.id}`);
      await cargar();
    } catch (e: any) {
      showToast('No se pudo quitar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
      void cargar();
    }
  };

  const rotarEnlace = async () => {
    try {
      const x = await api.post<{ token: string }>('/lounge/requests/token/rotate', {});
      setConfirmando(null);
      setR(prev => (prev ? { ...prev, token: x.token } : prev));
      showToast('Enlace nuevo', 'El anterior dejó de funcionar. La pantalla de turnos ya muestra el QR nuevo.', 'info');
    } catch (e: any) {
      showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  };

  if (error && !r) {
    return <p className="text-[0.75rem] text-slate-400">No se pudieron cargar las peticiones de canciones.</p>;
  }
  if (!r) return <p className="text-[0.75rem] text-slate-400">Cargando…</p>;

  const apagado = limite === 0;
  const btnPaso =
    'w-8 h-8 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';

  return (
    <div className="space-y-4">
      {/* ── Cuánto puede pedir cada persona ───────────────────── */}
      <div className="space-y-2">
        <div className="text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">Canciones por persona</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button" aria-label="Menos canciones"
              disabled={!esAdmin || limite <= 0}
              onClick={() => guardarConfig({ limite: limite - 1 })}
              className={btnPaso}
            ><Minus className="w-4 h-4" /></button>
            <div className="w-12 text-center">
              <div className="text-xl font-bold leading-none text-slate-900 dark:text-white tabular-nums">{limite}</div>
            </div>
            <button
              type="button" aria-label="Más canciones"
              disabled={!esAdmin || limite >= 10}
              onClick={() => guardarConfig({ limite: limite + 1 })}
              className={btnPaso}
            ><Plus className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-1.5 text-[0.75rem] text-slate-500 dark:text-neutral-400">
            cada
            <select
              value={ventana}
              disabled={!esAdmin || apagado}
              onChange={e => guardarConfig({ ventanaHoras: Number(e.target.value) })}
              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 outline-none disabled:opacity-40"
            >
              {(VENTANAS.includes(ventana) ? VENTANAS : [...VENTANAS, ventana].sort((a, b) => a - b)).map(h => (
                <option key={h} value={h}>{h} {h === 1 ? 'hora' : 'horas'}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[0.6875rem] text-slate-400 leading-relaxed">
          {apagado
            ? 'Los pedidos están desactivados: las clientas ven el aviso de que hoy elige el salón.'
            : `Cada persona puede pedir ${limite} ${limite === 1 ? 'canción' : 'canciones'} y se le renueva una por una a las ${ventana} ${ventana === 1 ? 'hora' : 'horas'} de haberla pedido. Pon 0 para desactivar los pedidos.`}
          {!esAdmin && ' Solo la dirección puede cambiar esto.'}
        </p>
      </div>

      {/* ── Reinicio general ───────────────────────────────────── */}
      <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!esAdmin}
          onClick={() => (confirmando === 'todas' ? void reiniciar() : pedirConfirmacion('todas'))}
          className={`px-3 py-2 rounded-xl text-[0.75rem] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${
            confirmando === 'todas'
              ? 'bg-rose-500 text-white'
              : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {confirmando === 'todas' ? 'Toca otra vez para confirmar' : 'Reiniciar a todas'}
        </button>
        <span className="text-[0.6875rem] text-slate-400">
          Todas vuelven a tener sus {limite} canciones. Lo que ya está en la fila se queda.
        </span>
      </div>

      {/* ── Quién ha pedido ───────────────────────────────────── */}
      <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 space-y-2">
        <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">
          <Users className="w-3.5 h-3.5 text-slate-400" /> Quién ha pedido
          <span className="font-normal text-slate-400">· últimas {ventana} {ventana === 1 ? 'hora' : 'horas'}</span>
        </div>

        {r.personas.length === 0 ? (
          <p className="text-[0.75rem] text-slate-400">Todavía nadie ha pedido canciones en esta ventana.</p>
        ) : (
          <div className="space-y-1.5">
            {r.personas.map(p => {
              const agotada = !apagado && p.usadas >= limite;
              return (
                <div key={p.deviceId} className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/70 dark:border-neutral-700/60 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 dark:text-neutral-100 truncate">
                        {p.nombre ?? 'Sin nombre'}
                      </span>
                      <span className="text-[0.6875rem] font-mono text-slate-400">#{p.codigo}</span>
                      <span className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full ${
                        agotada ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {p.usadas}/{limite}
                      </span>
                    </div>
                    <div className="text-[0.6875rem] text-slate-400 truncate mt-0.5">
                      {p.canciones.map(c => c.title).join(' · ')} · {hace(p.ultima)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!esAdmin || p.usadas === 0}
                    onClick={() => void reiniciar(p)}
                    title={p.usadas === 0 ? 'Ya tiene toda su cuota' : 'Devolverle sus canciones'}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg text-[0.75rem] font-bold text-[var(--primary)] hover:bg-[var(--primary)]/10 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reiniciar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── La fila que espera ────────────────────────────────── */}
      <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 space-y-2">
        <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">
          <ListMusic className="w-3.5 h-3.5 text-slate-400" /> En la fila del salón
          <span className="font-normal text-slate-400">· {r.pendientes.length}</span>
        </div>
        {r.pendientes.length === 0 ? (
          <p className="text-[0.75rem] text-slate-400">No hay canciones pedidas esperando.</p>
        ) : (
          <div className="space-y-1">
            {r.pendientes.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                <span className="w-4 text-[0.75rem] font-mono text-slate-400 tabular-nums shrink-0">{i + 1}</span>
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt="" loading="lazy" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    <Music2 className="w-4 h-4 text-slate-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate">{p.title}</div>
                  <div className="text-[0.6875rem] text-slate-400 truncate">
                    {p.guestName ?? 'Sin nombre'} · {hace(p.createdAt)}
                  </div>
                </div>
                <button
                  type="button" onClick={() => void quitar(p)} aria-label="Quitar de la fila" title="Quitar de la fila"
                  className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer shrink-0"
                ><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── El enlace de las clientas ─────────────────────────── */}
      <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row gap-3">
        <div className="shrink-0 self-center sm:self-start p-2 rounded-2xl bg-white border border-slate-200">
          {qr ? (
            <img src={qr} alt="QR para pedir canciones" className="w-28 h-28" />
          ) : (
            <div className="w-28 h-28 flex items-center justify-center text-slate-300"><QrCode className="w-8 h-8" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">Enlace para las clientas</div>
          <p className="text-[0.6875rem] text-slate-400 leading-relaxed">
            Es el mismo que muestra el QR de la pantalla de turnos. Puedes imprimirlo para las mesas.
            Solo sirve para pedir canciones y ver qué suena: no da acceso a nada más.
          </p>
          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-mono break-all text-slate-500 dark:text-neutral-400">
            {url}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try { await navigator.clipboard.writeText(url); showToast('Enlace copiado', 'Listo para pegar.', 'success'); }
                catch { showToast('No se pudo copiar', 'Selecciónalo y cópialo a mano.', 'warning'); }
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[0.75rem] font-bold hover:opacity-90 transition cursor-pointer"
            >Copiar enlace</button>
            <button
              type="button" onClick={() => window.open(url, '_blank', 'noopener')}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.75rem] font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
            >Ver como clienta</button>
            <button
              type="button"
              disabled={!esAdmin}
              onClick={() => (confirmando === 'enlace' ? void rotarEnlace() : pedirConfirmacion('enlace'))}
              className={`px-3 py-2 rounded-xl text-[0.75rem] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                confirmando === 'enlace' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'
              }`}
            >
              {confirmando === 'enlace' ? 'Toca otra vez: el QR impreso dejará de servir' : 'Cambiar enlace'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

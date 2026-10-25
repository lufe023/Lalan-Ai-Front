import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarDays, Scissors, UserRound, Loader2, ChevronDown, AlertTriangle, Heart, History, StickyNote,
  Play, CheckCircle2, CalendarClock, XCircle, Megaphone, Check, LogOut, ShieldCheck, RefreshCw, Zap, X, MessageCircle, ShieldAlert,
} from 'lucide-react';
import { quickAuth } from '../services/quickAuth';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { ActivarNotificaciones } from '../components/ui/ActivarNotificaciones';
import { SeguridadCuenta } from '../components/ajustes/SeguridadCuenta';
import { TamanoLetraSelector } from '../components/ui/TamanoLetraSelector';
import { useConfirmar } from '../components/ui/ModalConfirmar';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { miAgendaApi, misChatsApi, type EstadoCita, type FichaClienta, type MiChat, type MiChatResumen, type MiCita, type MiPerfil } from '../services/especialistas';
import { ChatDeEspecialista } from '../components/especialista/ChatDeEspecialista';
import { ListaAvisosAlergia } from '../components/agenda/AvisosAlergia';
import { getChannelBadge, horaDeMensaje } from '../components/chats/VentanaChat';

type Pestana = 'citas' | 'chats' | 'servicios' | 'cuenta';
/** `corto` es lo que cabe en la barra con cuatro pestañas en un teléfono */
const PESTANAS: { id: Pestana; label: string; corto: string; icon: React.ElementType }[] = [
  { id: 'citas', label: 'Mis citas', corto: 'Citas', icon: CalendarDays },
  { id: 'chats', label: 'Mis chats', corto: 'Chats', icon: MessageCircle },
  { id: 'servicios', label: 'Mis servicios', corto: 'Servicios', icon: Scissors },
  { id: 'cuenta', label: 'Mi cuenta', corto: 'Cuenta', icon: UserRound },
];
/** Lo que abre una notificación: los avisos de chats van a sus chats */
const PESTANA_DE_AVISO: Record<string, Pestana> = { 'mis-citas': 'citas', 'mis-chats': 'chats' };
/** Cuántos días de citas se traen de una vez */
const DIAS = 14;
const MS_DIA = 86_400_000;
const REFRESCO_MS = 60_000;

const ESTADO: Record<EstadoCita, { texto: string; clase: string }> = {
  pending: { texto: 'Por confirmar', clase: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  confirmed: { texto: 'Confirmada', clase: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  confirmed_by_ai: { texto: 'Confirmada', clase: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  attending: { texto: 'Atendiendo', clase: 'bg-[var(--primary)]/10 text-[var(--primary)]' },
  completed: { texto: 'Terminada', clase: 'bg-slate-500/10 text-slate-500' },
  cancelled: { texto: 'Cancelada', clase: 'bg-rose-500/10 text-rose-500' },
};
const POR_ATENDER: EstadoCita[] = ['pending', 'confirmed', 'confirmed_by_ai'];

function inicioDelDia(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function claveDia(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dinero(n: number, moneda?: string) {
  try { return new Intl.NumberFormat('es', { style: 'currency', currency: moneda || 'USD', maximumFractionDigits: 0 }).format(n); }
  catch { return `${moneda ?? ''} ${n}`; }
}
/** "2026-10-25T15:00" para el campo de fecha y hora, en la hora del teléfono */
function paraCampo(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const CLAVE_AVISO_TOQUE = 'lalan.especialista.avisoToque';

/** Entrar con 1 toque desde este teléfono, como la dueña */
const AccesoRapido: React.FC<{ comoAviso?: boolean }> = ({ comoAviso }) => {
  const { currentUser } = useAuth();
  const { showToast } = useApp();
  const [reg, setReg] = useState(() => quickAuth.getRegistration());
  const [cerrado, setCerrado] = useState(() => { try { return localStorage.getItem(CLAVE_AVISO_TOQUE) === '1'; } catch { return false; } });
  const [ocupado, setOcupado] = useState(false);
  if (!currentUser) return null;
  if (comoAviso && (reg.isRegistered || cerrado)) return null;

  const vincular = async () => {
    setOcupado(true);
    try {
      await quickAuth.registerDevice({ id: currentUser.id, name: currentUser.name, email: currentUser.correo ?? '', role: currentUser.role, avatar: currentUser.avatar });
      setReg(quickAuth.getRegistration());
      showToast('Listo', 'La próxima vez entras con 1 toque desde este teléfono.', 'success');
    } catch (e) { showToast('No se pudo activar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };
  const desvincular = async () => {
    setOcupado(true);
    try { await quickAuth.revokeDevice(); setReg(quickAuth.getRegistration()); } finally { setOcupado(false); }
  };
  const cerrar = () => { try { localStorage.setItem(CLAVE_AVISO_TOQUE, '1'); } catch { /* sin almacenamiento */ } setCerrado(true); };

  return (
    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0"><Zap className="w-4 h-4 fill-white" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">Entrar con 1 toque</div>
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
          {reg.isRegistered ? `Activo en este ${reg.deviceName || 'teléfono'}.` : 'Guarda tu entrada en este teléfono y no vuelvas a escribir la clave.'}
        </p>
      </div>
      {reg.isRegistered ? (
        <button type="button" disabled={ocupado} onClick={() => void desvincular()} className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[0.75rem] font-bold cursor-pointer disabled:opacity-60">Quitar</button>
      ) : (
        <button type="button" disabled={ocupado} onClick={() => void vincular()} className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold cursor-pointer disabled:opacity-60">
          {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Activar'}
        </button>
      )}
      {comoAviso && !reg.isRegistered && (
        <button type="button" onClick={cerrar} aria-label="Ahora no" className="shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
      )}
    </div>
  );
};

/**
 * La app de una especialista: sus citas, sus servicios y su cuenta. Nada del
 * salón se carga aquí; cada botón aparece solo si la administración le dio
 * ese permiso (y el servidor lo vuelve a comprobar).
 */
export const EspecialistaApp: React.FC = () => {
  const { logout, currentUser } = useAuth();
  const { showToast } = useApp();
  const [pestana, setPestana] = useState<Pestana>(() => {
    try { return PESTANA_DE_AVISO[new URLSearchParams(window.location.search).get('ir') ?? ''] ?? 'citas'; } catch { return 'citas'; }
  });
  const [perfil, setPerfil] = useState<MiPerfil | null>(null);
  const [chats, setChats] = useState<MiChatResumen[]>([]);
  const [chatAbierto, setChatAbierto] = useState<{ id: string; inicial?: MiChat } | null>(null);
  const [citas, setCitas] = useState<MiCita[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const desde = inicioDelDia(new Date());
      const [p, c, ch] = await Promise.all([
        miAgendaApi.perfil(), miAgendaApi.citas(desde, new Date(desde.getTime() + DIAS * MS_DIA)),
        misChatsApi.lista().catch(() => [] as MiChatResumen[]),
      ]);
      setPerfil(p); setCitas(c); setChats(ch); setError(null);
    } catch (e) { setError((e as Error)?.message || 'No se pudo cargar tu agenda.'); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void cargar(); }, REFRESCO_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    // Tocó un aviso con la app abierta: se va a esa pestaña y se vuelve a pedir todo
    const alAviso = (ev: MessageEvent) => {
      if (ev.data?.tipo !== 'ir') return;
      setPestana(PESTANA_DE_AVISO[ev.data?.pantalla] ?? 'citas');
      void cargar();
    };
    navigator.serviceWorker?.addEventListener('message', alAviso);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
      navigator.serviceWorker?.removeEventListener('message', alAviso);
    };
  }, [cargar]);

  const reemplazar = (c: MiCita) => setCitas(l => (l ?? []).map(x => (x.id === c.id ? c : x)));
  const conChats = !!perfil?.permisos.chatearConClientas || chats.length > 0;
  const pestanas = PESTANAS.filter(p => p.id !== 'chats' || conChats);
  const porContestar = chats.filter(c => c.teEspera && !c.pausado).length;

  /** "Escribirle" desde una cita: abre (o retoma) el chat con esa clienta */
  const escribirle = async (citaId: string) => {
    try {
      const chat = await misChatsApi.desdeCita(citaId);
      setChatAbierto({ id: chat.id, inicial: chat });
    } catch (e) { showToast('No se pudo abrir el chat', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };
  const cerrarChat = () => { setChatAbierto(null); void cargar(); };
  const sedes = perfil?.sedes ?? [];
  const subtitulo = perfil
    ? [perfil.especialista.especialidad, sedes.length === 1 ? sedes[0].name : sedes.length > 1 ? `${sedes.length} sedes` : null].filter(Boolean).join(' · ')
    : currentUser?.name;

  return (
    <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
      {chatAbierto && <ChatDeEspecialista key={chatAbierto.id} chatId={chatAbierto.id} inicial={chatAbierto.inicial} onCerrar={cerrarChat} />}
      <IOSHeader
        title={PESTANAS.find(p => p.id === pestana)!.label}
        subtitle={subtitulo}
        rightAction={pestana === 'citas' || pestana === 'chats' ? (
          <button type="button" onClick={() => void cargar()} aria-label="Actualizar"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-neutral-800/80 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] transition cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        ) : undefined}
      />

      {/* Las pestañas, como un control segmentado del iPhone */}
      <div className="px-4 lg:px-8 pb-2 shrink-0">
        <div role="tablist" className="flex p-1 rounded-xl bg-slate-100 dark:bg-neutral-800/80 max-w-md">
          {pestanas.map(p => {
            const activa = pestana === p.id;
            return (
              <button key={p.id} role="tab" aria-selected={activa} aria-label={p.label} type="button" onClick={() => setPestana(p.id)}
                className={`relative flex-1 min-h-[36px] rounded-lg flex items-center justify-center gap-1.5 text-[0.8125rem] font-semibold transition cursor-pointer ${
                  activa ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-neutral-400'
                }`}>
                <p.icon className="w-4 h-4" /> <span className="hidden min-[380px]:inline">{pestanas.length > 3 ? p.corto : p.label}</span>
                {p.id === 'chats' && porContestar > 0 && (
                  <span className="absolute -top-1 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-[0.6875rem] font-extrabold flex items-center justify-center">{porContestar}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <PageContent className="pb-8 space-y-3">
        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[0.8125rem] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {pestana === 'citas' && <AccesoRapido comoAviso />}
        {pestana === 'citas' && (
          citas === null && !error
            ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>
            : perfil && <ListaDeCitas citas={citas ?? []} perfil={perfil} onCambio={reemplazar} onRecargar={cargar} showToast={showToast} onEscribir={escribirle} />
        )}
        {pestana === 'chats' && <MisChats chats={chats} onAbrir={id => setChatAbierto({ id })} />}
        {pestana === 'servicios' && perfil && <MisServicios perfil={perfil} />}
        {pestana === 'cuenta' && (
          <>
            <AccesoRapido />
            <ActivarNotificaciones />
            <SeguridadCuenta />
            <TamanoLetraSelector />
            <button type="button" onClick={logout}
              className="w-full min-h-[44px] rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[0.875rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </>
        )}
      </PageContent>
    </div>
  );
};

/** Sus citas de hoy en adelante, agrupadas por día */
const ListaDeCitas: React.FC<{
  citas: MiCita[]; perfil: MiPerfil;
  onCambio: (c: MiCita) => void; onRecargar: () => Promise<void>;
  showToast: (t: string, m: string, tipo?: 'success' | 'info' | 'warning') => void;
  onEscribir: (citaId: string) => Promise<void>;
}> = ({ citas, perfil, onCambio, onRecargar, showToast, onEscribir }) => {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const visibles = citas.filter(c => verCanceladas || c.estado !== 'cancelled');
  const canceladas = citas.length - citas.filter(c => c.estado !== 'cancelled').length;
  const dias = useMemo(() => {
    const m = new Map<string, { fecha: Date; citas: MiCita[] }>();
    for (const c of visibles) {
      const f = new Date(c.inicio);
      const k = claveDia(f);
      if (!m.has(k)) m.set(k, { fecha: inicioDelDia(f), citas: [] });
      m.get(k)!.citas.push(c);
    }
    return [...m.values()];
  }, [visibles]);
  const hoy = claveDia(new Date());
  const manana = claveDia(new Date(Date.now() + MS_DIA));

  if (!visibles.length) {
    return (
      <div className="py-12 text-center space-y-2">
        <CalendarDays className="w-10 h-10 mx-auto text-slate-300 dark:text-neutral-700" />
        <p className="text-[0.875rem] font-semibold text-slate-600 dark:text-neutral-300">No tienes citas en los próximos {DIAS} días</p>
        <p className="text-[0.75rem] text-slate-400">Cuando te agenden una, te llega un aviso al teléfono.</p>
        {canceladas > 0 && <button type="button" onClick={() => setVerCanceladas(true)} className="text-[0.75rem] text-[var(--primary)] font-semibold cursor-pointer">Ver {canceladas} cancelada{canceladas === 1 ? '' : 's'}</button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dias.map(d => {
        const k = claveDia(d.fecha);
        const titulo = k === hoy ? 'Hoy' : k === manana ? 'Mañana' : d.fecha.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
        return (
          <section key={k} className="space-y-1.5">
            <h2 className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 first-letter:uppercase">
              {titulo} · {d.citas.length} cita{d.citas.length === 1 ? '' : 's'}
            </h2>
            {d.citas.map(c => (
              <TarjetaCita key={c.id} cita={c} perfil={perfil} abierta={abierta === c.id}
                onAbrir={() => setAbierta(abierta === c.id ? null : c.id)} onCambio={onCambio} onRecargar={onRecargar} showToast={showToast} onEscribir={onEscribir} />
            ))}
          </section>
        );
      })}
      {canceladas > 0 && (
        <button type="button" onClick={() => setVerCanceladas(v => !v)} className="w-full text-center text-[0.75rem] text-slate-400 hover:text-[var(--primary)] py-2 cursor-pointer">
          {verCanceladas ? 'Esconder las canceladas' : `Ver ${canceladas} cancelada${canceladas === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  );
};

const TarjetaCita: React.FC<{
  cita: MiCita; perfil: MiPerfil; abierta: boolean; onAbrir: () => void;
  onCambio: (c: MiCita) => void; onRecargar: () => Promise<void>;
  showToast: (t: string, m: string, tipo?: 'success' | 'info' | 'warning') => void;
  onEscribir: (citaId: string) => Promise<void>;
}> = ({ cita, perfil, abierta, onAbrir, onCambio, onRecargar, showToast, onEscribir }) => {
  const p = perfil.permisos;
  const { confirmar, modalConfirmar } = useConfirmar();
  const [ficha, setFicha] = useState<FichaClienta | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nuevaHora, setNuevaHora] = useState<string | null>(null);
  const inicio = new Date(cita.inicio);
  const fin = new Date(inicio.getTime() + cita.minutos * 60_000);
  const hora = (d: Date) => d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true });
  const porAtender = POR_ATENDER.includes(cita.estado);
  const pasada = fin.getTime() < Date.now();
  const varias = perfil.sedes.length > 1;

  useEffect(() => {
    if (!abierta || ficha) return;
    miAgendaApi.clienta(cita.id).then(setFicha).catch(() => setFicha({ nombre: cita.clienta, alergias: null, gustos: [], notas: null, visitas: [] }));
  }, [abierta, ficha, cita.id, cita.clienta]);

  const hacer = async (que: string, accion: () => Promise<MiCita | void>, listo?: string) => {
    setOcupado(que);
    try {
      const r = await accion();
      if (r) onCambio(r);
      if (listo) showToast('Listo', listo, 'success');
    } catch (e) {
      showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning');
      void onRecargar();
    } finally { setOcupado(null); }
  };

  const cancelar = async () => {
    if (!(await confirmar({ titulo: `¿Cancelar la cita de ${cita.clienta}?`, mensaje: `${cita.servicio} · ${inicio.toLocaleDateString('es', { weekday: 'long', day: 'numeric' })} a las ${hora(inicio)}. La administración se entera.`, textoConfirmar: 'Cancelar la cita', textoCancelar: 'No, dejarla', tono: 'peligro' }))) return;
    void hacer('cancelar', () => miAgendaApi.estado(cita.id, 'cancelled'), 'La cita quedó cancelada.');
  };

  const guardarHora = () => {
    if (!nuevaHora) return;
    const d = new Date(nuevaHora);
    if (Number.isNaN(d.getTime())) return;
    void hacer('hora', () => miAgendaApi.reagendar(cita.id, d), `Ahora es el ${d.toLocaleDateString('es', { weekday: 'long', day: 'numeric' })} a las ${hora(d)}.`).then(() => setNuevaHora(null));
  };

  const boton = 'min-h-[40px] px-3 rounded-xl text-[0.8125rem] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60';

  return (
    <div className={`rounded-2xl border bg-white dark:bg-neutral-900 shadow-xs overflow-hidden ${cita.estado === 'attending' ? 'border-[var(--primary)]/50' : 'border-slate-200/80 dark:border-neutral-800'} ${cita.estado === 'cancelled' ? 'opacity-60' : ''}`}>
      {modalConfirmar}
      <button type="button" onClick={onAbrir} aria-expanded={abierta} className="w-full p-3 flex items-center gap-3 text-left cursor-pointer">
        <div className="w-14 shrink-0 text-center">
          <div className="text-[0.9375rem] font-bold text-slate-900 dark:text-white tabular-nums leading-tight">{hora(inicio).replace(/\s?[ap]\.?\s?m\.?/i, '')}</div>
          <div className="text-[0.6875rem] text-slate-400">{inicio.getHours() < 12 ? 'a. m.' : 'p. m.'}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[0.875rem] font-bold text-slate-900 dark:text-white truncate">{cita.clienta}</div>
          <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">
            {cita.servicio} · {cita.minutos} min{varias && cita.sede ? ` · ${cita.sede}` : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${ESTADO[cita.estado].clase}`}>{ESTADO[cita.estado].texto}</span>
          {cita.precio !== undefined && <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300 tabular-nums">{dinero(cita.precio, cita.moneda)}</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition ${abierta ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-3 border-t border-slate-100 dark:border-neutral-800 pt-3">
              <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
                {inicio.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })} · {hora(inicio)} a {hora(fin)}
              </div>

              {!ficha ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (
                <div className="space-y-2">
                  {ficha.alergias && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[0.8125rem] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span><b>Alergias o salud:</b> {ficha.alergias}</span>
                    </div>
                  )}
                  {!!ficha.avisos?.length && (
                    <ListaAvisosAlergia avisos={ficha.avisos} onRevisar={(productId) => miAgendaApi.revisado(cita.id, productId).then(() => miAgendaApi.clienta(cita.id).then(setFicha))} />
                  )}
                  {ficha.gustos.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Heart className="w-3 h-3" /> Sus gustos</div>
                      <div className="flex flex-wrap gap-1">
                        {ficha.gustos.map((g, i) => (
                          <span key={i} title={g.nota ?? g.categoria} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.75rem] text-slate-700 dark:text-neutral-200">
                            {g.icono ? `${g.icono} ` : ''}{g.gusto}{g.nota ? ` · ${g.nota}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(ficha.notas || cita.notas) && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-[0.8125rem] text-slate-700 dark:text-neutral-200 space-y-1">
                      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notas</div>
                      {cita.notas && <p>{cita.notas}</p>}
                      {ficha.notas && <p>{ficha.notas}</p>}
                    </div>
                  )}
                  {ficha.visitas.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><History className="w-3 h-3" /> Sus visitas contigo</div>
                      {ficha.visitas.map((v, i) => (
                        <div key={i} className="text-[0.75rem] text-slate-600 dark:text-neutral-300">
                          {new Date(v.fecha).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })} · {v.servicio}{v.notas ? ` · ${v.notas}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                  {!ficha.alergias && !ficha.avisos?.length && !ficha.gustos.length && !ficha.notas && !cita.notas && !ficha.visitas.length && (
                    <p className="text-[0.75rem] text-slate-400">No hay más datos de la clienta para ti.</p>
                  )}
                </div>
              )}

              {/* Hablar con la clienta (por el número del salón) antes o después de la cita */}
              {p.chatearConClientas && cita.clientaId && cita.estado !== 'cancelled' && (
                <button type="button" disabled={!!ocupado} onClick={() => { setOcupado('chat'); void onEscribir(cita.id).finally(() => setOcupado(null)); }}
                  className={`${boton} w-full justify-center bg-sky-500/10 text-sky-700 dark:text-sky-300`}>
                  {ocupado === 'chat' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} Escribirle a {cita.clienta.split(' ')[0]}
                </button>
              )}

              {/* Lo que puede hacer, según sus permisos y el estado de la cita */}
              {cita.estado !== 'cancelled' && cita.estado !== 'completed' && (
                <div className="flex flex-wrap gap-1.5">
                  {p.confirmarCitas && cita.estado === 'pending' && !pasada && (
                    <button type="button" disabled={!!ocupado} onClick={() => void hacer('confirmar', () => miAgendaApi.confirmar(cita.id), 'Cita confirmada.')}
                      className={`${boton} bg-emerald-500 text-white`}>{ocupado === 'confirmar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar</button>
                  )}
                  {p.llamarEnPizarra && porAtender && (
                    <button type="button" disabled={!!ocupado} onClick={() => void hacer('llamar', async () => { const r = await miAgendaApi.llamar(cita.id); showToast('Llamada', `Turno ${r.codigo} en la pizarra.`, 'success'); })}
                      className={`${boton} bg-[var(--primary)]/10 text-[var(--primary)]`}>{ocupado === 'llamar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Llamar en la pizarra</button>
                  )}
                  {p.marcarEstado && porAtender && (
                    <button type="button" disabled={!!ocupado} onClick={() => void hacer('atender', () => miAgendaApi.estado(cita.id, 'attending'))}
                      className={`${boton} bg-[var(--primary)] text-white`}>{ocupado === 'atender' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Empezar</button>
                  )}
                  {p.marcarEstado && cita.estado === 'attending' && (
                    <button type="button" disabled={!!ocupado} onClick={() => void hacer('terminar', () => miAgendaApi.estado(cita.id, 'completed'), 'Cita terminada.')}
                      className={`${boton} bg-emerald-500 text-white`}>{ocupado === 'terminar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Terminar</button>
                  )}
                  {p.reagendarCitas && porAtender && nuevaHora === null && (
                    <button type="button" disabled={!!ocupado} onClick={() => setNuevaHora(paraCampo(inicio))}
                      className={`${boton} bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200`}><CalendarClock className="w-4 h-4" /> Cambiar hora</button>
                  )}
                  {p.cancelarCitas && porAtender && (
                    <button type="button" disabled={!!ocupado} onClick={() => void cancelar()}
                      className={`${boton} bg-rose-500/10 text-rose-600 dark:text-rose-400`}>{ocupado === 'cancelar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Cancelar</button>
                  )}
                </div>
              )}

              {nuevaHora !== null && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 space-y-2">
                  <label className="block text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300">Nueva fecha y hora</label>
                  <input type="datetime-local" value={nuevaHora} min={paraCampo(new Date())} step={300} onChange={e => setNuevaHora(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                  <p className="text-[0.6875rem] text-slate-400">Tiene que caber en tu horario y no chocar con otra cita tuya.</p>
                  <div className="flex gap-1.5">
                    <button type="button" disabled={!!ocupado} onClick={guardarHora} className={`${boton} bg-[var(--primary)] text-white`}>
                      {ocupado === 'hora' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
                    </button>
                    <button type="button" onClick={() => setNuevaHora(null)} className={`${boton} text-slate-500`}>Dejarla igual</button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Los chats que tiene a su cargo: los que abrió desde una cita o le pasó la administración */
const MisChats: React.FC<{ chats: MiChatResumen[]; onAbrir: (id: string) => void }> = ({ chats, onAbrir }) => {
  if (!chats.length) {
    return (
      <div className="py-12 text-center space-y-2">
        <MessageCircle className="w-10 h-10 mx-auto text-slate-300 dark:text-neutral-700" />
        <p className="text-[0.875rem] font-semibold text-slate-600 dark:text-neutral-300">No tienes chats abiertos</p>
        <p className="text-[0.75rem] text-slate-400 max-w-xs mx-auto">Abre uno con «Escribirle» en una de tus citas, o espera a que la administración te pase uno.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-slate-100 dark:divide-neutral-800 overflow-hidden">
      {chats.map(c => (
        <button key={c.id} type="button" onClick={() => onAbrir(c.id)} className="w-full px-3 py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/60">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.pausado ? 'bg-rose-500/10 text-rose-500' : 'bg-sky-500/10 text-sky-600'}`}>
            {c.pausado ? <ShieldAlert className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-[0.875rem] truncate ${c.teEspera ? 'font-extrabold text-slate-900 dark:text-white' : 'font-bold text-slate-800 dark:text-neutral-100'}`}>{c.clienta}</span>
              {getChannelBadge(c.canal as never)}
            </div>
            <p className={`text-[0.75rem] truncate ${c.teEspera ? 'text-slate-700 dark:text-neutral-200 font-semibold' : 'text-slate-500 dark:text-neutral-400'}`}>
              {c.pausado ? 'Lalan pausó este chat: la administración lo está revisando' : c.ultimo ?? 'Sin mensajes nuevos'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[0.6875rem] text-slate-400">{horaDeMensaje(c.ultimoEn)}</span>
            {c.teEspera && !c.pausado && <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" aria-label="Te toca contestar" />}
          </div>
        </button>
      ))}
    </div>
  );
};

/** Los servicios que hace (los de su zona en sus sedes) */
const MisServicios: React.FC<{ perfil: MiPerfil }> = ({ perfil }) => {
  const grupos = useMemo(() => {
    const m = new Map<string, MiPerfil['servicios']>();
    for (const s of perfil.servicios) m.set(s.categoria, [...(m.get(s.categoria) ?? []), s]);
    return [...m.entries()];
  }, [perfil.servicios]);

  return (
    <div className="space-y-3">
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
        {perfil.especialista.zona ? `Los de tu zona (${perfil.especialista.zona}). ` : ''}Si falta alguno, pídele a la administración que lo revise.
      </p>
      {!grupos.length && <p className="py-8 text-center text-[0.8125rem] text-slate-400">Todavía no tienes servicios asignados.</p>}
      {grupos.map(([cat, lista]) => (
        <section key={cat} className="space-y-1">
          <h2 className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{cat}</h2>
          <div className="rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-slate-100 dark:divide-neutral-800">
            {lista.map(s => (
              <div key={s.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[0.875rem] font-semibold text-slate-900 dark:text-white truncate">{s.nombre}</div>
                  <div className="text-[0.75rem] text-slate-400">{s.minutos} min</div>
                </div>
                {s.precio !== undefined && <div className="text-[0.875rem] font-bold text-slate-700 dark:text-neutral-200 tabular-nums">{dinero(s.precio, s.moneda)}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

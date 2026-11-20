import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2, MessageCircle, ShieldCheck, Unlink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import {
  enlaceWaMe, lalanWhatsapp, miWhatsappLalan, olvidarMiWhatsappLalan, pedirVer, tocaVer, TEXTO_HOLA, ventanaAbierta, VER_MI_WHATSAPP, VER_NUMEROS_CONFIANZA, type MiWhatsappLalan as Estado,
} from '../../services/lalanWhatsapp';

const hora = (iso: string) => new Date(iso).toLocaleString('es-DO', { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Mi cuenta → Lalan en tu WhatsApp: conectar su número de confianza para
 * hablar con la misma Lalan de la app desde su WhatsApp, como su asistente.
 * El número no se escribe: se abre su WhatsApp con un código y solo lo envía.
 */
export const MiWhatsappLalan: React.FC = () => {
  const { showToast, navigateTo } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [datos, setDatos] = useState<Estado | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const { currentUser } = useAuth();
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tocaVer(VER_MI_WHATSAPP)) return;
    const t = window.setTimeout(() => caja.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => window.clearTimeout(t);
  }, []);

  const cargar = useCallback(async () => {
    const d = await miWhatsappLalan(true);
    if (d) { setDatos(d); setError(''); } else setError('No pude ver tu WhatsApp con Lalan. Inténtalo de nuevo.');
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  // Vuelve de WhatsApp después de enviar el código: se ve conectado sin recargar
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargar]);

  const conectar = async () => {
    setTrabajando(true);
    try {
      const r = await lalanWhatsapp.conectarMio();
      window.open(r.enlace, '_blank', 'noopener');
      setDatos(d => (d ? { ...d, esperandoCodigo: true } : d));
    } catch (e) {
      showToast('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo.', 'warning');
    } finally { setTrabajando(false); }
  };

  const desconectar = async () => {
    if (!(await confirmar({ titulo: '¿Desconectar tu WhatsApp?', mensaje: 'Lalan dejará de contestarte por WhatsApp. En la app sigue igual.', tono: 'peligro', textoConfirmar: 'Desconectar' }))) return;
    setTrabajando(true);
    try { setDatos(await lalanWhatsapp.quitarMio()); olvidarMiWhatsappLalan(); }
    catch { setError('No se pudo desconectar. Inténtalo de nuevo.'); }
    finally { setTrabajando(false); }
  };

  const cambiarAvisos = async (avisos: boolean) => {
    setDatos(d => (d ? { ...d, avisos } : d));
    try { setDatos(await lalanWhatsapp.cambiarMio({ avisos })); olvidarMiWhatsappLalan(); }
    catch { setError('No se guardó. Inténtalo de nuevo.'); void cargar(); }
  };

  const abierta = ventanaAbierta(datos?.ventanaHasta);

  return (
    <div ref={caja} data-guia="lalan-whatsapp" className="scroll-mt-24 p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
      {modalConfirmar}
      <div className="flex items-center gap-1.5">
        <MessageCircle className="w-4 h-4 text-emerald-500" />
        <span className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Lalan en tu WhatsApp</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400 leading-snug">
        Háblale desde tu WhatsApp como en la app: tu agenda, quién espera, ventas, recordatorios, escribirle a una clienta.
      </p>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {datos?.choque && <p className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-[0.75rem] text-amber-900 dark:text-amber-100 leading-snug">{datos.choque}</p>}
      {datos === null && !error && <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}

      {datos && !datos.salon && (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">El salón todavía no tiene WhatsApp conectado. Conéctalo primero y vuelve aquí.</p>
          <button type="button" onClick={() => navigateTo('bots')} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.8125rem] font-semibold text-slate-700 dark:text-neutral-200 cursor-pointer">Ir a Lalan en los chats</button>
        </div>
      )}

      {datos?.salon && !datos.conectado && (
        <div className="space-y-2">
          <button type="button" disabled={trabajando} onClick={() => void conectar()}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[0.875rem] font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer disabled:opacity-60">
            {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            Conectar mi WhatsApp
          </button>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-snug">
            {datos.esperandoCodigo
              ? 'Se abrió tu WhatsApp con un mensaje y un código: solo envíalo. Si no se abrió, toca otra vez.'
              : `Se abre tu WhatsApp con un mensaje para ${datos.salon.nombre ?? 'el salón'}. Lo envías y listo: Lalan reconoce tu número.`}
          </p>
        </div>
      )}

      {/* Los números del equipo (de qué sedes le habla Lalan a cada una) se manejan por sede */}
      {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
        <button type="button" data-guia="ir-numeros-confianza" onClick={() => { pedirVer(VER_NUMEROS_CONFIANZA); navigateTo('bots'); }}
          className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 hover:bg-slate-100 dark:hover:bg-neutral-800 text-left flex items-center justify-between gap-2 ios-touch cursor-pointer">
          <span>
            <span className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Números de confianza del equipo</span>
            <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400">Quién más habla con Lalan por WhatsApp y de qué sedes</span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      )}

      {datos?.salon && datos.conectado && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
            <span className="font-mono text-slate-800 dark:text-neutral-100">{datos.numero}</span>
            {(datos.todas ? [{ id: 'todas', nombre: datos.sedes.length > 1 ? 'Todas tus sedes' : datos.sedes[0]?.nombre ?? '' }] : datos.sedes).filter(s => s.nombre).map(s => (
              <span key={s.id} className="px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[0.6875rem] font-semibold">{s.nombre}</span>
            ))}
          </div>
          <div className={`px-3 py-2 rounded-xl text-[0.75rem] leading-snug ${abierta ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100' : 'bg-slate-50 dark:bg-neutral-800/60 text-slate-600 dark:text-neutral-300'}`}>
            {abierta
              ? <>Lalan te puede escribir hasta el <b>{hora(datos.ventanaHasta!)}</b>. Cada mensaje tuyo lo alarga 24 h más.</>
              : <>WhatsApp solo deja que Lalan te escriba si le escribiste en las últimas 24 h. Escríbele y te cuenta lo que tenga.</>}
          </div>
          {!abierta && (
            <a href={enlaceWaMe(datos.salon.numero, TEXTO_HOLA)} target="_blank" rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[0.875rem] font-bold flex items-center justify-center gap-1.5 ios-touch">
              <MessageCircle className="w-4 h-4" /> Escribirle a Lalan
            </a>
          )}
          <label className="flex items-center justify-between gap-3">
            <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
              <b className="block text-xs">Mis avisos también por WhatsApp</b>
              <span className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Mientras la ventana está abierta. Gratis.</span>
            </span>
            <IOSToggle id="toggle-whatsapp-avisos" checked={datos.avisos} onChange={v => void cambiarAvisos(v)} activeColor="#10b981" />
          </label>
          <button type="button" disabled={trabajando} onClick={() => void desconectar()}
            className="text-[0.75rem] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 cursor-pointer disabled:opacity-60">
            <Unlink className="w-3.5 h-3.5" /> Desconectar mi WhatsApp
          </button>
        </div>
      )}
    </div>
  );
};

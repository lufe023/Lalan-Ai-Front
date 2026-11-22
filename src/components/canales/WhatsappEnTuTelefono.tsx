import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookUser, Check, Loader2, MessageCircle, RefreshCw, Smartphone } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { IOSToggle } from '../ui/IOSToggle';

/** Lo que devuelve GET /bots/conexion/whatsapp/coexistencia (backend: conexiones/coexistencia.contrato.ts) */
interface EstadoCoexistencia {
  conectadoEn: string;
  contactos: { pedidoEn?: string; error?: string; recibidos?: number };
  historial: { pedidoEn?: string; error?: string; compartido?: boolean | null; progreso?: number; chats?: number; mensajes?: number; terminadoEn?: string };
  desconexion?: { motivo: string; por: string; en: string } | null;
}
interface VistaCoexistencia {
  coexistencia: boolean;
  estado: EstadoCoexistencia | null;
  soloNuevosConLalan: boolean;
  contactos: number;
  puedeReintentar: boolean;
  venceEn: string | null;
}

/** Mientras Meta manda el historial, se pregunta cada tanto cómo va */
const CADA_MS = 8000;

const fmt = (n: number) => n.toLocaleString('es-DO');

/**
 * El WhatsApp que sigue en la app del teléfono de la dueña (coexistencia):
 * cómo va la copia de sus contactos y de sus chats de 6 meses, quién atiende
 * a sus contactos, y qué hacer si se desconectó. Solo aparece con ese número.
 */
export const WhatsappEnTuTelefono: React.FC<{ sede: string; conectado: boolean }> = ({ sede, conectado }) => {
  const { navigateTo, showToast } = useApp();
  const [v, setV] = useState<VistaCoexistencia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const q = sede ? `?sede=${encodeURIComponent(sede)}` : '';

  const cargar = useCallback(() => {
    if (!conectado) { setV(null); return; }
    api.get<VistaCoexistencia>(`/bots/conexion/whatsapp/coexistencia${q}`).then(setV).catch(() => setV(null));
  }, [q, conectado]);

  useEffect(() => { cargar(); }, [cargar]);

  const h = v?.estado?.historial;
  const copiando = !!v?.coexistencia && !v.estado?.desconexion && (!h?.terminadoEn && h?.compartido !== false);
  useEffect(() => {
    if (!copiando) return;
    const t = setInterval(cargar, CADA_MS);
    return () => clearInterval(t);
  }, [copiando, cargar]);

  if (!v?.coexistencia || !v.estado) return null;
  const e = v.estado;

  const reintentar = async () => {
    setOcupado(true);
    try {
      const r = await api.post<VistaCoexistencia & { avisos: string[] }>(`/bots/conexion/whatsapp/coexistencia/reintentar${q}`, {});
      setV(r);
      showToast(r.avisos.length ? 'Todavía no se pudo' : 'Listo, ya se pidió', r.avisos[0] ?? 'Deja abierta la app WhatsApp Business en tu teléfono mientras se copian.', r.avisos.length ? 'warning' : 'success');
    } catch (err) { showToast('No se pudo', (err as Error).message, 'warning'); } finally { setOcupado(false); }
  };

  const soloNuevos = async (valor: boolean) => {
    setOcupado(true);
    try {
      const r = await api.put<VistaCoexistencia & { pasados: number }>(`/bots/conexion/whatsapp/coexistencia/solo-nuevos${q}`, { valor });
      setV(r);
      showToast(valor ? 'Tus contactos los atiendes tú' : 'Lalan atiende a todas',
        valor ? (r.pasados ? `${fmt(r.pasados)} chats de tus contactos pasaron a ti. Desde Chats puedes devolverle cualquiera a Lalan.` : 'Lalan contesta solo a quien no está en tus contactos.')
          : 'Lalan contesta a todas, también a tus contactos.', 'success');
    } catch (err) { showToast('No se pudo cambiar', (err as Error).message, 'warning'); } finally { setOcupado(false); }
  };

  // Cómo va el historial, dicho en una línea
  const historial = e.historial.compartido === false
    ? { icono: AlertTriangle, color: 'text-amber-600', texto: 'No aceptaste compartir tus chats anteriores, así que no se copiaron. Los nuevos sí llegan a Lalan.' }
    : e.historial.terminadoEn
      ? { icono: Check, color: 'text-emerald-600', texto: `Listo: ${fmt(e.historial.mensajes ?? 0)} mensajes de ${fmt(e.historial.chats ?? 0)} chats de los últimos 6 meses.` }
      : e.historial.error && !e.historial.pedidoEn
        ? { icono: AlertTriangle, color: 'text-rose-600', texto: `No se pudieron pedir tus chats: ${e.historial.error}` }
        : { icono: Loader2, color: 'text-slate-400 animate-spin', texto: `Copiando tus chats de los últimos 6 meses${h?.progreso ? ` · ${h.progreso}%` : ''}. Deja abierta la app WhatsApp Business en tu teléfono.` };
  const contactos = e.contactos.error && !e.contactos.pedidoEn
    ? { icono: AlertTriangle, color: 'text-rose-600', texto: `No se pudieron pedir tus contactos: ${e.contactos.error}` }
    : v.contactos
      ? { icono: Check, color: 'text-emerald-600', texto: `${fmt(v.contactos)} contactos de tu agenda. Los chats se ven con el nombre que les pusiste.` }
      : { icono: Loader2, color: 'text-slate-400 animate-spin', texto: 'Copiando tu agenda de contactos…' };

  return (
    <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2.5" data-guia="whatsapp-en-tu-telefono">
      <div className="flex items-start gap-2">
        <Smartphone className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <b className="text-xs text-slate-900 dark:text-white block">Tu WhatsApp sigue en tu teléfono</b>
          <span className="text-[0.75rem] text-slate-600 dark:text-neutral-400 leading-relaxed block">
            Lalan contesta y tú también puedes, desde la app. Si le escribes a una clienta desde el teléfono, Lalan se aparta de ese chat.
          </span>
        </div>
      </div>

      {e.desconexion && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <span className="text-[0.75rem] text-rose-800 dark:text-rose-300 leading-relaxed">
            Se desconectó de Lalan porque {e.desconexion.motivo}. Lalan ya no contesta por este número. Desconéctalo aquí y vuelve a tocar «Conectar WhatsApp» con «Usar el número que ya tengo en WhatsApp Business».
          </span>
        </div>
      )}

      {!e.desconexion && (
        <ul className="space-y-1.5">
          {[{ ...contactos, Clave: BookUser }, { ...historial, Clave: MessageCircle }].map(({ icono: Icono, color, texto, Clave }) => (
            <li key={texto} className="flex items-start gap-2 text-[0.75rem] text-slate-700 dark:text-neutral-300">
              <Clave className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              <span className="flex-1 leading-relaxed">{texto}</span>
              <Icono className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {v.puedeReintentar && (
          <button type="button" onClick={() => void reintentar()} disabled={ocupado}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer">
            {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Volver a pedir
          </button>
        )}
        {(e.historial.mensajes ?? 0) > 0 && (
          <button type="button" onClick={() => navigateTo('chats')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 cursor-pointer">
            <MessageCircle className="w-3.5 h-3.5" /> Ver los chats
          </button>
        )}
      </div>
      {v.puedeReintentar && v.venceEn && (
        <span className="block text-[0.6875rem] text-slate-500">
          Meta deja pedirlo hasta el {new Date(v.venceEn).toLocaleString('es-DO', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}.
        </span>
      )}

      {!e.desconexion && (
        <label className="flex items-start gap-3 pt-2 border-t border-emerald-200/70 dark:border-emerald-900/60 cursor-pointer">
          <span className="flex-1 min-w-0">
            <b className="text-xs text-slate-900 dark:text-white block">Mis contactos los atiendo yo</b>
            <span className="text-[0.75rem] text-slate-600 dark:text-neutral-400 leading-relaxed block">
              Lalan contesta solo a quien no está en tu agenda{v.contactos ? ` (tienes ${fmt(v.contactos)} contactos)` : ''}. A tus clientas de siempre les escribes tú, como hasta ahora.
            </span>
          </span>
          <IOSToggle checked={v.soloNuevosConLalan} onChange={(x) => void soloNuevos(x)} disabled={ocupado} ariaLabel="Mis contactos los atiendo yo" />
        </label>
      )}

      <span className="block text-[0.6875rem] text-slate-500 leading-relaxed">
        Para dejar de usar Lalan con este número, desconéctalo aquí y también en la app: Ajustes › Cuenta › Plataforma empresarial › Desconectar.
      </span>
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, MessageCircle, UserPlus, UserRound } from 'lucide-react';
import { api } from '../../services/api';
import { irA } from '../../services/avisos';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { IOSSegmentedControl } from '../ui/IOSSegmentedControl';

/** Lo que devuelve GET /bots/conexion/whatsapp/coexistencia/contactos-nuevos (backend: ContactoNuevoVista) */
interface ContactoNuevo {
  id: string;
  nombre: string | null;
  telefono: string | null;
  agregadoEn: string;
  atiende: 'yo' | 'lalan' | null;
  laAtiendeElla: boolean;
  ficha: { id: string; nombre: string } | null;
  chatId: string | null;
}
interface ListaContactos { contactosHasta: string | null; soloNuevosConLalan: boolean; contactos: ContactoNuevo[] }

const QUIEN = [{ id: 'lalan' as const, label: 'Lalan' }, { id: 'yo' as const, label: 'Yo' }];

/** yyyy-mm-dd en la hora de aquí (lo que entiende el campo de fecha) */
const diaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });

/**
 * Los contactos que la dueña guardó en la app de WhatsApp con Lalan ya
 * conectada. Lalan les contesta sin que ella haga nada; aquí, con un toque,
 * dice «a esta le contesto yo», le crea la ficha o abre su chat. Arriba, la
 * fecha de corte: lo guardado hasta ese día es suyo.
 */
export const ContactosNuevosAgenda: React.FC<{ sede: string; abierto: boolean; onCerrar: () => void; onCambio: () => void }> = ({ sede, abierto, onCerrar, onCambio }) => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<ListaContactos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const q = sede ? `?sede=${encodeURIComponent(sede)}` : '';

  const cargar = useCallback(() => {
    setCargando(true);
    api.get<ListaContactos>(`/bots/conexion/whatsapp/coexistencia/contactos-nuevos${q}`)
      .then(setDatos).catch((e) => showToast('No se pudo cargar', (e as Error).message, 'warning'))
      .finally(() => setCargando(false));
  }, [q, showToast]);

  useEffect(() => { if (abierto) cargar(); }, [abierto, cargar]);

  const cambiarQuien = async (c: ContactoNuevo, quien: 'yo' | 'lalan') => {
    setOcupado(c.id);
    try {
      await api.put(`/bots/conexion/whatsapp/coexistencia/contactos/${c.id}/atiende${q}`, { quien });
      setDatos((d) => d && { ...d, contactos: d.contactos.map((x) => x.id === c.id ? { ...x, atiende: quien, laAtiendeElla: quien === 'yo' } : x) });
      showToast(quien === 'yo' ? `A ${c.nombre ?? 'esta persona'} le contestas tú` : `Lalan le contesta a ${c.nombre ?? 'esta persona'}`,
        c.chatId ? 'Su chat ya cambió de manos.' : 'Cuando escriba, ya sabe quién le contesta.', 'success');
    } catch (e) { showToast('No se pudo cambiar', (e as Error).message, 'warning'); } finally { setOcupado(null); }
  };

  const crearFicha = async (c: ContactoNuevo) => {
    setOcupado(c.id);
    try {
      const f = await api.post<{ id: string; name: string; nueva: boolean }>(`/bots/conexion/whatsapp/coexistencia/contactos/${c.id}/ficha${q}`, {});
      setDatos((d) => d && { ...d, contactos: d.contactos.map((x) => x.id === c.id ? { ...x, ficha: { id: f.id, nombre: f.name } } : x) });
      showToast(f.nueva ? `Ficha de ${f.name} creada` : `${f.name} ya tenía ficha`, 'Ya está en Clientas.', 'success');
    } catch (e) { showToast('No se pudo crear la ficha', (e as Error).message, 'warning'); } finally { setOcupado(null); }
  };

  const cambiarCorte = async (dia: string | null) => {
    setOcupado('corte');
    try {
      // Hasta el final de ese día, en la hora de aquí
      const fecha = dia ? new Date(`${dia}T23:59:59`).toISOString() : null;
      const r = await api.put<{ pasados: number }>(`/bots/conexion/whatsapp/coexistencia/contactos-hasta${q}`, { fecha });
      showToast('Fecha guardada', r.pasados ? `${r.pasados} chats de tus contactos pasaron a ti.` : 'Lo guardado después de ese día lo atiende Lalan.', 'success');
      cargar();
      onCambio();
    } catch (e) { showToast('No se pudo cambiar la fecha', (e as Error).message, 'warning'); } finally { setOcupado(null); }
  };

  const ir = (destino: { ir: string; aviso?: string; conversacion?: string }) => {
    onCerrar();
    irA(destino);
  };

  return (
    <IOSModal isOpen={abierto} onClose={onCerrar} title="Contactos nuevos de tu agenda" subtitle="Los que guardaste en WhatsApp con Lalan conectada" forma="angosta">
      <div className="space-y-4 pb-6">
        {datos?.soloNuevosConLalan && datos.contactosHasta && (
          <div className="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2">
            <div className="flex items-start gap-2">
              <CalendarDays className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-300 leading-relaxed">
                Tus contactos son los que guardaste hasta el <b>{fechaLarga(datos.contactosHasta)}</b>. A esos les contestas tú; a los que guardes después, Lalan.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <input type="date" aria-label="Mis contactos son los que guardé hasta" value={diaLocal(datos.contactosHasta)} disabled={ocupado === 'corte'}
                onChange={(e) => { if (e.target.value) void cambiarCorte(e.target.value); }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[0.8125rem] text-slate-800 dark:text-neutral-100" />
              <button type="button" onClick={() => void cambiarCorte(null)} disabled={ocupado === 'corte'}
                className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer disabled:opacity-40">
                Volver al día en que conecté
              </button>
              {ocupado === 'corte' && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </div>
          </div>
        )}

        {cargando && !datos && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {datos && !datos.contactos.length && (
          <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 text-center py-6">
            Todavía no has guardado contactos nuevos en WhatsApp desde que conectaste Lalan.
          </p>
        )}

        <ul className="space-y-2">
          {datos?.contactos.map((c) => (
            <li key={c.id} className="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <UserRound className="w-8 h-8 p-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <b className="block text-[0.875rem] text-slate-900 dark:text-white truncate">{c.nombre ?? c.telefono ?? 'Sin nombre'}</b>
                  <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">
                    {[c.nombre ? c.telefono : null, `guardado el ${fechaCorta(c.agregadoEn)}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400">Le contesta</span>
                  <div className={ocupado === c.id ? 'opacity-50 pointer-events-none' : ''}>
                    <IOSSegmentedControl size="sm" options={QUIEN} value={c.laAtiendeElla ? 'yo' : 'lalan'} onChange={(x) => void cambiarQuien(c, x)} id={`quien-${c.id}`} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-[2.625rem]">
                {c.ficha ? (
                  <button type="button" onClick={() => ir({ ir: 'clients', aviso: `clienta:${c.ficha!.id}` })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 cursor-pointer">
                    <UserRound className="w-3.5 h-3.5" /> Ver ficha
                  </button>
                ) : c.telefono && (
                  <button type="button" onClick={() => void crearFicha(c)} disabled={ocupado === c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold cursor-pointer disabled:opacity-40">
                    {ocupado === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Crear su ficha
                  </button>
                )}
                {c.chatId && (
                  <button type="button" onClick={() => ir({ ir: 'chats', conversacion: c.chatId! })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 cursor-pointer">
                    <MessageCircle className="w-3.5 h-3.5" /> Ver su chat
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </IOSModal>
  );
};

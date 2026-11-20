import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Send, ShieldCheck, Unlink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSedes } from '../../hooks/useSedes';
import { useConfirmar } from '../ui/ModalConfirmar';
import { lalanWhatsapp, olvidarMiWhatsappLalan, type PersonaDeConfianza } from '../../services/lalanWhatsapp';

/**
 * Lalan en los chats → Números de confianza (de la sede elegida arriba).
 * Quién de la administración habla con Lalan por WhatsApp y de qué sedes:
 * una, varias o todas. Una encargada atada a su sede nunca recibe otra.
 */
export const NumerosDeConfianza: React.FC<{ sede: string; agente: string }> = ({ sede, agente }) => {
  const { showToast } = useApp();
  const { currentUser } = useAuth();
  const { confirmar, modalConfirmar } = useConfirmar();
  const todas = useSedes({ todasLasDelSalon: true });
  const [personas, setPersonas] = useState<PersonaDeConfianza[] | null>(null);
  const [sinWhatsapp, setSinWhatsapp] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!sede) return;
    try {
      const r = await lalanWhatsapp.deLaSede(sede);
      setPersonas(r.personas);
      setSinWhatsapp(!r.salon);
    } catch { setPersonas([]); }
  }, [sede]);
  useEffect(() => { setPersonas(null); void cargar(); }, [cargar]);

  const nombreSede = (id: string) => todas.find(s => s.id === id)?.name ?? '';

  const cambiarSedes = async (p: PersonaDeConfianza, id: string | 'todas') => {
    let nuevas: string[];
    if (id === 'todas') nuevas = [];
    else {
      const actuales = p.sedes.length ? p.sedes : [];
      nuevas = !actuales.length ? [id] : actuales.includes(id) ? actuales.filter(s => s !== id) : [...actuales, id];
      if (!nuevas.length) { showToast('Al menos una sede', 'Por WhatsApp tiene que tener alguna sede. Para quitarle Lalan por WhatsApp, toca «Quitar».', 'warning'); return; }
      if (nuevas.length === p.puede.length) nuevas = [];
    }
    setTrabajando(p.userId);
    try {
      await lalanWhatsapp.cambiarSedes(p.userId, nuevas);
      if (p.userId === currentUser?.id) olvidarMiWhatsappLalan();
      void cargar();
    } catch (e) { showToast('No se guardó', e instanceof Error ? e.message : 'Inténtalo de nuevo.', 'warning'); }
    finally { setTrabajando(null); }
  };

  const pasarEnlace = async (p: PersonaDeConfianza) => {
    setTrabajando(p.userId);
    try {
      const r = await lalanWhatsapp.enlaceDe(p.userId);
      if (p.userId === currentUser?.id) { window.open(r.enlace, '_blank', 'noopener'); return; }
      const texto = `${p.nombre.split(' ')[0]}, toca este enlace en tu teléfono y envía el mensaje que se escribe solo. Así hablas con ${agente} por WhatsApp: ${r.enlace}`;
      if (navigator.share) {
        await navigator.share({ text: texto }).catch(() => undefined);
      } else {
        await navigator.clipboard.writeText(texto);
        showToast('Enlace copiado', `Pégaselo a ${p.nombre.split(' ')[0]} por donde quieras. Vale 30 minutos.`, 'success');
      }
      void cargar();
    } catch (e) { showToast('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo.', 'warning'); }
    finally { setTrabajando(null); }
  };

  const quitar = async (p: PersonaDeConfianza) => {
    if (!(await confirmar({ titulo: `¿Quitarle el WhatsApp a ${p.nombre.split(' ')[0]}?`, mensaje: `${agente} dejará de contestarle por WhatsApp. En la app sigue igual.`, tono: 'peligro', textoConfirmar: 'Quitar' }))) return;
    setTrabajando(p.userId);
    try { await lalanWhatsapp.quitarDe(p.userId); if (p.userId === currentUser?.id) olvidarMiWhatsappLalan(); void cargar(); }
    catch { showToast('No se pudo', 'Inténtalo de nuevo.', 'warning'); }
    finally { setTrabajando(null); }
  };

  return (
    <div className="py-1.5 border-b border-slate-100 dark:border-neutral-800/80 space-y-2">
      {modalConfirmar}
      <div>
        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Números de confianza</div>
        <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
          Quien está aquí le escribe al WhatsApp del salón desde su número y le contesta {agente} como su asistente, no como a una clienta.
          Cada número ve solo sus sedes.
        </div>
      </div>
      {sinWhatsapp && <p className="text-[0.75rem] text-amber-700 dark:text-amber-300">Conecta primero el WhatsApp de esta sede (arriba).</p>}
      {personas === null && <div className="py-2 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>}
      {personas?.length === 0 && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Nadie de la administración ve esta sede.</p>}
      <ul className="space-y-2">
        {personas?.map(p => {
          const ocupada = trabajando === p.userId;
          const variasSedes = p.puede.length > 1;
          return (
            <li key={p.userId} className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[0.8125rem] font-semibold text-slate-900 dark:text-white truncate">{p.nombre}{p.userId === currentUser?.id ? ' (tú)' : ''}</div>
                  <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                    {p.conectado
                      ? <span className="font-mono">{p.numero}</span>
                      : p.esperandoCodigo ? 'Esperando que envíe el mensaje' : 'Sin conectar'}
                    {p.conectado && !p.estaSede && ' · por WhatsApp no ve esta sede'}
                  </div>
                </div>
                {ocupada ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                  : p.conectado
                    ? <button type="button" onClick={() => void quitar(p)} className="shrink-0 px-2.5 py-1.5 rounded-lg text-[0.75rem] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-1 cursor-pointer"><Unlink className="w-3.5 h-3.5" /> Quitar</button>
                    : !sinWhatsapp && <button type="button" onClick={() => void pasarEnlace(p)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[0.75rem] font-bold flex items-center gap-1 cursor-pointer"><Send className="w-3.5 h-3.5" /> {p.userId === currentUser?.id ? 'Conectar' : 'Pasarle el enlace'}</button>}
              </div>
              {variasSedes ? (
                <div className="flex flex-wrap gap-1.5" aria-label={`Sedes de ${p.nombre} por WhatsApp`}>
                  <Chip activo={!p.sedes.length} disabled={ocupada} onClick={() => void cambiarSedes(p, 'todas')}>Todas</Chip>
                  {p.puede.map(id => (
                    <Chip key={id} activo={p.sedes.includes(id)} disabled={ocupada} onClick={() => void cambiarSedes(p, id)}>{nombreSede(id)}</Chip>
                  ))}
                </div>
              ) : (
                <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Solo {nombreSede(p.puede[0] ?? sede)}: es la sede que ve en la app.</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const Chip: React.FC<{ activo: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ activo, disabled, onClick, children }) => (
  <button type="button" disabled={disabled} onClick={onClick} aria-pressed={activo}
    className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-60 ${activo ? 'bg-[var(--primary)] text-white' : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
    {activo && <Check className="w-3 h-3" />}{children}
  </button>
);

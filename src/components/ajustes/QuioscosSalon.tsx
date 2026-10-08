import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, MonitorSmartphone, Power } from 'lucide-react';
import { api } from '../../services/api';
import { urlDelQuiosco } from '../../services/quiosco';
import { useApp } from '../../context/AppContext';
import { usePlan } from '../../context/PlanContext';

interface Quiosco { id: string; nombre: string; activo: boolean; usadoEn: string | null; llegadas: number; sede: string | null }

/**
 * Ajustes → Sala: los quioscos de la entrada. Se activa uno con un código de
 * 6 cifras que se escribe en la tablet (o escaneando el QR que la tablet
 * muestra), y se apaga si se pierde o se cambia.
 */
export const QuioscosSalon: React.FC = () => {
  const { showToast } = useApp();
  const { tieneModulo } = usePlan();
  const incluido = tieneModulo('quiosco');
  const [quioscos, setQuioscos] = useState<Quiosco[] | null>(null);
  const [sedes, setSedes] = useState<{ id: string; name: string }[]>([]);
  const [sede, setSede] = useState('');
  const [codigo, setCodigo] = useState<{ codigo: string; expira: string } | null>(null);
  const [quedan, setQuedan] = useState(0);
  const [pidiendo, setPidiendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ quioscos: Quiosco[]; sedes: { id: string; name: string }[] }>('/quiosco');
      setQuioscos(r.quioscos); setSedes(r.sedes); setSede((s) => s || r.sedes[0]?.id || '');
    } catch { setQuioscos([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  // La cuenta atrás del código; al usarse, el quiosco nuevo aparece en la lista
  useEffect(() => {
    if (!codigo) return;
    const t = window.setInterval(() => {
      const s = Math.max(0, Math.round((new Date(codigo.expira).getTime() - Date.now()) / 1000));
      setQuedan(s);
      if (s === 0) setCodigo(null);
    }, 1000);
    const r = window.setInterval(() => void cargar(), 5000);
    return () => { window.clearInterval(t); window.clearInterval(r); };
  }, [codigo, cargar]);

  const pedirCodigo = async () => {
    setPidiendo(true);
    try { setCodigo(await api.post('/quiosco/codigo', { locationId: sede || undefined })); }
    catch (e: any) { showToast('No se pudo generar el código', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
    finally { setPidiendo(false); }
  };

  const apagar = async (q: Quiosco) => {
    try {
      await api.delete(`/quiosco/${q.id}`);
      showToast('Quiosco desactivado', `${q.nombre} ya no puede registrar llegadas.`, 'info');
      void cargar();
    } catch (e: any) { showToast('No se pudo desactivar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(urlDelQuiosco()); showToast('Enlace copiado', 'Ábrelo en la tablet del quiosco.', 'success'); }
    catch { /* sin portapapeles: el enlace está a la vista */ }
  };

  const activos = (quioscos ?? []).filter((q) => q.activo);

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
      <div className="flex items-center gap-1.5">
        <MonitorSmartphone className="w-4 h-4 text-[var(--primary)]" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Quiosco de llegada</h2>
      </div>
      <p className="text-[0.75rem] text-slate-400 leading-relaxed">
        Una tablet o pantalla táctil en la entrada. La clienta que llega sin cita escribe su teléfono, elige sus servicios y sus
        gustos, y pasa sola a la pizarra con su especialista y su comanda. Si ya es clienta, la reconoce.
      </p>

      {!incluido ? (
        <p className="text-[0.75rem] p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
          El quiosco no está incluido en tu plan. Escríbenos para activarlo.
        </p>
      ) : (
        <>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-2 text-[0.75rem] text-slate-600 dark:text-neutral-300">
            <div className="font-bold text-slate-900 dark:text-white">Cómo activarlo</div>
            <div>1. En la tablet abre <span className="font-mono break-all">{urlDelQuiosco()}</span>
              <button type="button" onClick={() => void copiar()} className="ml-1 inline-flex align-middle text-[var(--primary)] cursor-pointer" aria-label="Copiar enlace"><Copy className="w-3.5 h-3.5" /></button></div>
            <div>2. Escanea con este teléfono el QR que aparece en la tablet, <b>o</b> genera un código aquí y escríbelo en la tablet.</div>
          </div>

          {sedes.length > 1 && (
            <select value={sede} onChange={(e) => setSede(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white">
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          {codigo ? (
            <div className="p-4 rounded-xl border-2 border-dashed border-[var(--primary)]/50 text-center space-y-1">
              <div className="text-[0.75rem] text-slate-500">Escribe este código en la tablet</div>
              <div className="text-4xl font-black tracking-[0.3em] font-mono text-slate-900 dark:text-white">{codigo.codigo}</div>
              <div className="text-[0.6875rem] text-slate-400">Vence en {Math.floor(quedan / 60)}:{String(quedan % 60).padStart(2, '0')}</div>
            </div>
          ) : (
            <button type="button" onClick={() => void pedirCodigo()} disabled={pidiendo}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
              {pidiendo && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Activar un quiosco
            </button>
          )}
        </>
      )}

      {activos.length > 0 && (
        <div className="space-y-2">
          {activos.map((q) => (
            <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-neutral-800">
              <MonitorSmartphone className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{q.nombre}{q.sede && sedes.length > 1 ? ` · ${q.sede}` : ''}</div>
                <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                  {q.llegadas} {q.llegadas === 1 ? 'llegada' : 'llegadas'}{q.usadoEn ? ` · usado ${new Date(q.usadoEn).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => void apagar(q)} title="Desactivar"
                className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer">
                <Power className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

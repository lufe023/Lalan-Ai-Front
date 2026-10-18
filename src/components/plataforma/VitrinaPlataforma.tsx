import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Unlink } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface NombreEnUso { nombre: string; salon: string; tenantId: string; hasta: string | null }
interface AjustesVitrina { reservados: string[]; diasDeGuarda: number; nombres: NombreEnUso[] }

/** "Chanel, dior\nzara" → ["chanel", "dior", "zara"] */
const aLista = (texto: string) =>
  [...new Set(texto.split(/[\s,;]+/).map((x) => x.trim().replace(/^@+/, '').toLowerCase()).filter(Boolean))];

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Plataforma → Vitrina: lo que vale para todos los salones. Qué nombres
 * cortos nadie puede tomar, cuántos días un nombre viejo sigue llevando al
 * nuevo, y los nombres en uso, por si una marca reclama el suyo.
 * Qué salones tienen Vitrina se decide en Planes (el módulo «vitrina»).
 */
export const VitrinaPlataforma: React.FC = () => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<AjustesVitrina | null>(null);
  const [reservados, setReservados] = useState('');
  const [dias, setDias] = useState(30);
  const [buscar, setBuscar] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const usar = useCallback((d: AjustesVitrina) => {
    setDatos(d);
    setReservados(d.reservados.join(', '));
    setDias(d.diasDeGuarda);
  }, []);

  useEffect(() => {
    api.get<AjustesVitrina>('/plataforma/vitrina').then(usar)
      .catch((e) => showToast('No se pudo cargar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'));
  }, [usar, showToast]);

  const lista = useMemo(() => aLista(reservados), [reservados]);
  const sucio = !!datos && (JSON.stringify([...lista].sort()) !== JSON.stringify(datos.reservados) || dias !== datos.diasDeGuarda);

  const guardar = async () => {
    setOcupado(true);
    try {
      usar(await api.put<AjustesVitrina>('/plataforma/vitrina', { reservados: lista, diasDeGuarda: dias }));
      showToast('Ajustes de la Vitrina guardados', 'Valen desde ya para todos los salones.', 'success');
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  const liberar = async (n: NombreEnUso) => {
    const aviso = n.hasta
      ? `¿Soltar /${n.nombre}? Ya no llevará a ${n.salon} y cualquier salón podrá tomarlo.`
      : `¿Soltar /${n.nombre}? ${n.salon} se queda sin dirección corta hasta que elija otra; sus enlaces y QR con este nombre dejan de abrir.`;
    if (!window.confirm(aviso)) return;
    try {
      usar(await api.delete<AjustesVitrina>(`/plataforma/vitrina/nombres/${encodeURIComponent(n.nombre)}`));
      showToast('Nombre soltado', `/${n.nombre} quedó libre.`, 'success');
    } catch (e) { showToast('No se pudo soltar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  if (!datos) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;

  const q = buscar.trim().toLowerCase();
  const nombres = q ? datos.nombres.filter((n) => n.nombre.includes(q) || n.salon.toLowerCase().includes(q)) : datos.nombres;
  const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3';

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 leading-relaxed">
        La Vitrina es la página donde las clientas de cada sede reservan solas. Qué salones la tienen se decide en <b>Planes</b>,
        con el módulo «vitrina». Aquí va lo que vale para todos: las direcciones cortas ({window.location.host}/<i>nombre</i>).
      </p>

      <div className={TARJETA}>
        <div>
          <h3 className="text-[0.875rem] font-bold">Nombres reservados</h3>
          <p className="text-[0.75rem] text-slate-500">
            Ningún salón puede tomarlos: marcas, nombres que se confunden con Lalan, palabras feas. Sepáralos con comas o en líneas.
            Las rutas del sitio (app, api, plataforma, privacidad…) ya están reservadas siempre.
          </p>
        </div>
        <textarea value={reservados} onChange={(e) => setReservados(e.target.value)} rows={4} placeholder="chanel, dior, sephora"
          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-mono" />
        <p className="text-[0.6875rem] text-slate-400">{lista.length} {lista.length === 1 ? 'nombre' : 'nombres'}</p>

        <label className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
          <span className="font-bold">Días de guarda</span>
          <input type="number" min={0} max={365} value={dias} onChange={(e) => setDias(Math.min(365, Math.max(0, Math.round(Number(e.target.value) || 0))))}
            className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]" />
          <span className="text-[0.75rem] text-slate-500 basis-full">
            Cuando un salón cambia de nombre, el de antes sigue llevando al nuevo estos días y nadie más lo puede tomar. Con 0 se suelta al momento.
          </span>
        </label>

        <button type="button" disabled={!sucio || ocupado} onClick={() => void guardar()}
          className="min-h-[40px] px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2">
          {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
        </button>
      </div>

      <div className={TARJETA}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[0.875rem] font-bold">Nombres en uso ({datos.nombres.length})</h3>
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar nombre o salón" aria-label="Buscar nombre o salón"
              className="bg-transparent outline-none text-[0.8125rem] w-44" />
          </label>
        </div>
        {nombres.length === 0 ? (
          <p className="text-[0.8125rem] text-slate-400">{q ? 'Nada con eso.' : 'Ningún salón eligió nombre todavía.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
            {nombres.map((n) => (
              <li key={n.nombre} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[0.8125rem] truncate">/{n.nombre}</span>
                  <span className="block text-[0.6875rem] text-slate-500 truncate">
                    {n.salon}{n.hasta ? ` · nombre de antes, lleva al nuevo hasta el ${fecha(n.hasta)}` : ''}
                  </span>
                </span>
                <button type="button" onClick={() => void liberar(n)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[0.75rem] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                  <Unlink className="w-3.5 h-3.5" /> Soltar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

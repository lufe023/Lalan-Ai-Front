import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, FileText, Loader2, XCircle } from 'lucide-react';
import { api } from '../../services/api';

type Estado = 'aprobada' | 'en_revision' | 'rechazada' | 'falta';
interface Plantilla { nombre: string; para: string; estado: Estado; detalle: string | null; texto?: string | null; ejemplo?: string[]; botones?: string[]; categoria?: string | null }

const COMO: Record<Estado, { texto: string; clase: string; Icono: React.FC<{ className?: string }> }> = {
  aprobada: { texto: 'Aprobada', clase: 'text-emerald-600', Icono: CheckCircle2 },
  en_revision: { texto: 'Meta la está revisando', clase: 'text-amber-600', Icono: Clock },
  rechazada: { texto: 'Rechazada', clase: 'text-rose-600', Icono: XCircle },
  falta: { texto: 'Falta', clase: 'text-slate-400', Icono: FileText },
};

/** El texto con los {{1}}, {{2}}… rellenados con el ejemplo, en negrita (como lo vería la clienta) */
function rellenar(texto: string, ejemplo: string[]): React.ReactNode[] {
  return texto.split(/(\{\{\d+\}\})/g).map((parte, i) => {
    const m = /^\{\{(\d+)\}\}$/.exec(parte);
    if (!m) return <React.Fragment key={i}>{parte}</React.Fragment>;
    return <b key={i}>{ejemplo[Number(m[1]) - 1] ?? parte}</b>;
  });
}

/** Cómo le llega en WhatsApp: la burbuja con el texto de ejemplo y sus botones */
const VistaPrevia: React.FC<{ p: Plantilla }> = ({ p }) => (
  <div className="mt-2 p-3 rounded-xl bg-[#e5ddd5] dark:bg-[#0b141a] space-y-1.5">
    <div className="max-w-[90%] rounded-lg rounded-tl-none bg-white dark:bg-[#202c33] px-3 py-2 text-[0.8125rem] leading-snug text-slate-900 dark:text-[#e9edef] shadow-sm whitespace-pre-line">
      {p.texto ? rellenar(p.texto, p.ejemplo ?? []) : <i className="text-slate-400">Meta todavía no tiene el texto de esta plantilla.</i>}
      <div className="text-right text-[0.625rem] text-slate-400 mt-1">10:30 a. m.</div>
    </div>
    {!!p.botones?.length && (
      <div className="max-w-[90%] flex flex-col gap-1">
        {p.botones.map((b) => <div key={b} className="rounded-lg bg-white dark:bg-[#202c33] py-1.5 text-center text-[0.75rem] font-semibold text-[#027eb5] dark:text-[#53bdeb]">{b}</div>)}
      </div>
    )}
    <p className="text-[0.6875rem] text-slate-600 dark:text-neutral-400">
      Lo que va en negrita cambia en cada mensaje (nombre, servicio, hora…).
      {p.categoria === 'UTILITY' && ' Es de tipo «utilidad»: Meta la cobra solo si la persona no ha escrito en las últimas 24 horas.'}
      {p.categoria === 'MARKETING' && ' Es de tipo «marketing»: Meta siempre la cobra.'}
    </p>
  </div>
);

/**
 * Las plantillas de WhatsApp que Lalan usa para escribir primero (recordar
 * una cita, avisarle a la dueña). Son de la cuenta de WhatsApp de cada
 * salón: se crean solas al conectar, y si falta alguna, aquí se crea.
 */
export const PlantillasWhatsapp: React.FC<{ sede?: string }> = ({ sede }) => {
  const [lista, setLista] = useState<Plantilla[] | null>(null);
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState('');
  const q = sede ? `?sede=${sede}` : '';

  const cargar = useCallback(() => {
    api.get<{ plantillas: Plantilla[] }>(`/bots/conexion/plantillas${q}`)
      .then((r) => { setLista(r.plantillas); setError(''); })
      .catch((e) => setError((e as Error).message));
  }, [q]);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    setCreando(true); setError('');
    try { setLista((await api.post<{ plantillas: Plantilla[] }>(`/bots/conexion/plantillas${q}`, {})).plantillas); }
    catch (e) { setError((e as Error).message); }
    finally { setCreando(false); }
  };

  const faltan = lista?.filter((p) => p.estado === 'falta').length ?? 0;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-neutral-800 p-3 space-y-2">
      <div>
        <div className="text-xs font-bold text-slate-900 dark:text-white">Plantillas de WhatsApp</div>
        <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Los mensajes que Lalan puede mandar primero. Meta revisa cada una antes de usarla. Toca una para ver cómo le llega a la persona.</p>
      </div>
      {!lista && !error && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      {lista?.map((p) => {
        const { texto, clase, Icono } = COMO[p.estado];
        return (
          <div key={p.nombre}>
            <button type="button" onClick={() => setAbierta((a) => (a === p.nombre ? null : p.nombre))} aria-expanded={abierta === p.nombre}
              className="w-full flex items-start gap-2 text-[0.75rem] text-left cursor-pointer">
              <Icono className={`w-4 h-4 mt-0.5 shrink-0 ${clase}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-slate-700 dark:text-neutral-200">{p.para}</span>
                <span className="block text-[0.6875rem] text-slate-400 font-mono truncate">{p.nombre}</span>
                {p.detalle && <span className="block text-[0.6875rem] text-rose-600">{p.detalle}</span>}
              </span>
              <span className={`shrink-0 font-semibold ${clase}`}>{texto}</span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${abierta === p.nombre ? 'rotate-180' : ''}`} />
            </button>
            {abierta === p.nombre && <VistaPrevia p={p} />}
          </div>
        );
      })}
      {faltan > 0 && (
        <button type="button" onClick={() => void crear()} disabled={creando}
          className="w-full py-2 rounded-lg bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
          {creando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear {faltan === 1 ? 'la que falta' : `las ${faltan} que faltan`}
        </button>
      )}
      {error && <p className="text-[0.6875rem] text-rose-600">{error}</p>}
    </div>
  );
};

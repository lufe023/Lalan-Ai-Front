import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, KeyRound, Copy, Check, Loader2, ShieldOff, RefreshCw } from 'lucide-react';
import { api, urlApi } from '../../services/api';

interface EstadoClave {
  activa: boolean;
  termina: string | null;
  creadaEn: string | null;
  creadaPor: string | null;
  usadaEn: string | null;
}

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const Copiable: React.FC<{ etiqueta: string; valor: string; mono?: boolean }> = ({ etiqueta, valor, mono }) => {
  const [hecho, setHecho] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(valor); setHecho(true); setTimeout(() => setHecho(false), 2000); } catch { /* sin permiso de portapapeles */ }
  };
  return (
    <div className="space-y-1">
      <div className="text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400">{etiqueta}</div>
      <div className="flex items-center gap-2">
        <code className={`flex-1 min-w-0 break-all select-all rounded-xl px-3 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] ${mono ? 'font-mono' : ''}`}>{valor}</code>
        <button type="button" onClick={() => void copiar()} aria-label={`Copiar ${etiqueta.toLowerCase()}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold cursor-pointer">
          {hecho ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}{hecho ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
};

/**
 * La clave de solo lectura con que el Excel del piloto baja los números
 * (Datos → Actualizar todo). Se ve una sola vez; generar otra o revocarla
 * deja sin acceso a cualquier Excel que tenga la anterior.
 */
export const ReportesExcel: React.FC = () => {
  const [estado, setEstado] = useState<EstadoClave | null>(null);
  const [nueva, setNueva] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = urlApi('');

  useEffect(() => {
    api.get<EstadoClave>('/plataforma/reportes-piloto/clave').then(setEstado).catch((e: Error) => setError(e.message));
  }, []);

  const generar = async () => {
    if (estado?.activa && !window.confirm('Se creará una clave nueva y la anterior dejará de funcionar en cualquier Excel que la tenga. ¿Seguir?')) return;
    setOcupada(true); setError(null);
    try {
      const r = await api.post<{ clave: string; estado: EstadoClave }>('/plataforma/reportes-piloto/clave', {});
      setNueva(r.clave); setEstado(r.estado);
    } catch (e) { setError((e as Error).message); } finally { setOcupada(false); }
  };

  const revocar = async () => {
    if (!window.confirm('El Excel ya no podrá actualizar los números hasta que generes otra clave. ¿Revocarla?')) return;
    setOcupada(true); setError(null);
    try { setEstado(await api.delete<EstadoClave>('/plataforma/reportes-piloto/clave')); setNueva(null); }
    catch (e) { setError((e as Error).message); } finally { setOcupada(false); }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
        <h2 className="text-[1.0625rem] font-extrabold text-slate-900 dark:text-white">Números del piloto en Excel</h2>
      </div>
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
        <p className="text-[0.8125rem] text-slate-600 dark:text-neutral-300 max-w-[65ch]">
          El libro del piloto baja por salón y por día los chats, las citas, el uso de la app, las preguntas a Lalan y los informes.
          Solo números: ningún nombre de clienta, texto de chat ni monto de dinero. Entra con una clave de solo lectura.
        </p>

        {!estado && !error && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>}

        {estado && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[0.8125rem]">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${estado.activa ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-neutral-600'}`} />
              {estado.activa ? <>Clave activa, termina en <b className="font-mono">…{estado.termina}</b></> : 'Sin clave activa'}
            </span>
            {estado.activa && <span className="text-slate-500">Creada: {fecha(estado.creadaEn)}</span>}
            {estado.activa && <span className="text-slate-500">Último uso desde Excel: {estado.usadaEn ? fecha(estado.usadaEn) : 'todavía no'}</span>}
          </div>
        )}

        {nueva && (
          <div className="p-3 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-[0.875rem]"><KeyRound className="w-4 h-4" /> Clave nueva</div>
            <Copiable etiqueta="Clave de reportes" valor={nueva} mono />
            <p className="text-[0.75rem] text-slate-500">Cópiala ahora: por seguridad no se vuelve a mostrar. Si se pierde, genera otra.</p>
          </div>
        )}

        <Copiable etiqueta="Dirección de la API (ya viene escrita en el libro)" valor={base} mono />

        <ol className="list-decimal pl-5 space-y-1 text-[0.8125rem] text-slate-600 dark:text-neutral-300 max-w-[70ch]">
          <li>Abre el libro <b>Lalan · Piloto.xlsx</b> en Excel de escritorio y ve a la hoja <b>Conexión</b>.</li>
          <li>Pega la clave en la celda amarilla. Si quieres, cambia la fecha <b>Desde</b>.</li>
          <li>Datos → <b>Actualizar todo</b>. La primera vez Excel pregunta cómo entrar a la web: elige <b>Anónimo</b> → Conectar. Si pregunta por la privacidad, marca <b>Omitir</b> (o pon las dos fuentes como Organizativo).</li>
        </ol>

        {error && <div className="text-[0.8125rem] text-red-600">{error}</div>}

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupada || !estado} onClick={() => void generar()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 cursor-pointer">
            {ocupada ? <Loader2 className="w-4 h-4 animate-spin" /> : estado?.activa ? <RefreshCw className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            {estado?.activa ? 'Generar otra clave' : 'Generar clave'}
          </button>
          {estado?.activa && (
            <button type="button" disabled={ocupada} onClick={() => void revocar()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold text-red-600 disabled:opacity-50 cursor-pointer">
              <ShieldOff className="w-4 h-4" /> Revocar
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

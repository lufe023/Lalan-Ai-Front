import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, X } from 'lucide-react';
import { api } from '../../services/api';
import type { Dispositivo, Opcion, VisitaFila, VisitasPorFila as Respuesta } from '../../types/plataforma';

const ZONA = 'America/Santo_Domingo';
const POR_PAGINA = 50;
const APARATO: Record<Dispositivo, string> = { movil: 'Móvil', tableta: 'Tableta', pc: 'PC' };

const miles = (n: number) => n.toLocaleString('es-DO');
const duracion = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);
/** Para la pantalla: "mié, 28 oct · 9:15 p. m." en hora dominicana */
const fechaHora = (iso: string) => {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-DO', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short' });
  const hora = d.toLocaleTimeString('es-DO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dia} · ${hora}`;
};
/** Para Excel: "2026-10-28 21:15", que Excel reconoce como fecha y deja ordenar */
const fechaExcel = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};
const diaSemana = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { timeZone: ZONA, weekday: 'long' });

/** Lo que hizo, en palabras cortas (la misma lista va a Excel en columnas de Sí/No) */
const acciones = (f: VisitaFila) => [
  f.vioHistoria && (f.terminoHistoria ? 'Vio la historia completa' : 'Vio la historia'),
  f.envioPiloto ? 'Envió el piloto' : f.abrioPiloto && 'Abrió el piloto',
  f.tocoEntrar && 'Tocó Entrar',
  f.tocoWhatsapp && 'Tocó WhatsApp',
].filter(Boolean) as string[];

/** Un CSV que abre bien en Excel en español (punto y coma, BOM) */
function bajarCsv(nombre: string, filas: VisitaFila[], seccion: (id: string) => string, fuente: (id: string) => string, pais: (c: string) => string) {
  const si = (b: boolean) => (b ? 'Sí' : 'No');
  const cab = [
    'Fecha y hora (RD)', 'Día', 'Persona', 'País', 'Ciudad', 'Aparato', 'Navegador', 'Sistema', 'De dónde vienen', 'Medio (utm_medium)',
    'Campaña (utm_campaign)', 'Sitio de donde vino', 'Página', 'Segundos en la página', 'Bajó (%)', 'Secciones vistas', 'Qué secciones', 'Clics',
    'Vio la historia', 'Terminó la historia', 'Abrió el piloto', 'Envió el piloto', 'Tocó Entrar', 'Tocó WhatsApp', 'Se fue sin mirar',
  ];
  const celda = (x: string | number) => `"${String(x).replace(/"/g, '""')}"`;
  const lineas = filas.map((f) => [
    fechaExcel(f.creadoEn), diaSemana(f.creadoEn), f.persona, f.pais ? pais(f.pais) : '', f.ciudad ?? '', APARATO[f.dispositivo], f.navegador ?? '', f.sistema ?? '',
    fuente(f.fuente), f.medio ?? '', f.campana ?? '', f.referente ?? '', f.ruta, f.duracionSeg, f.scrollMax, f.secciones.length, f.secciones.map(seccion).join(', '), f.clics,
    si(f.vioHistoria), si(f.terminoHistoria), si(f.abrioPiloto), si(f.envioPiloto), si(f.tocoEntrar), si(f.tocoWhatsapp), si(f.seFueSinMirar),
  ].map(celda).join(';'));
  const blob = new Blob(['﻿' + [cab.map(celda).join(';'), ...lineas].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Visita por visita: una fila por cada vez que alguien abrió la landing, con
 * el mismo periodo que el resto de la pestaña. La persona es el código anónimo
 * con que se cuentan las "personas distintas"; tocarlo deja solo sus visitas.
 */
export const VisitasPorFila: React.FC<{
  desde: string;
  secciones: Opcion[];
  fuente: (id: string) => string;
  pais: (codigo: string) => string;
  bandera: (codigo: string) => string;
}> = ({ desde, secciones, fuente, pais, bandera }) => {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState('');
  const [persona, setPersona] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  useEffect(() => {
    let vivo = true;
    setDatos(null); setError(''); setPersona(null); setMostrar(POR_PAGINA);
    api.get<Respuesta>(`/plataforma/landing/visitas?desde=${encodeURIComponent(desde)}`)
      .then((r) => { if (vivo) setDatos(r); })
      .catch((e: Error) => { if (vivo) setError(e.message || 'No se pudieron cargar las visitas'); });
    return () => { vivo = false; };
  }, [desde]);

  const nombreSeccion = useMemo(() => {
    const m = new Map(secciones.map((s) => [s.id, s.descripcion]));
    return (id: string) => m.get(id) ?? id;
  }, [secciones]);

  const filas = useMemo(() => (datos ? (persona ? datos.filas.filter((f) => f.persona === persona) : datos.filas) : []), [datos, persona]);
  const personas = useMemo(() => new Set(datos?.filas.map((f) => f.persona)).size, [datos]);

  const exportar = () => {
    if (!datos) return;
    const dia = (iso: string) => fechaExcel(iso).slice(0, 10);
    bajarCsv(`visitas-${dia(datos.desde)}-a-${dia(datos.hasta)}${persona ? `-persona-${persona}` : ''}.csv`, filas, nombreSeccion, fuente, pais);
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-slate-900 dark:text-neutral-100 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[0.875rem] font-bold text-slate-900 dark:text-white">Visita por visita</h3>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-0.5">
            Hora de República Dominicana. La misma persona lleva el mismo código en todas sus visitas de ese día; tócalo para ver solo las suyas.
          </p>
        </div>
        <button type="button" onClick={exportar} disabled={!filas.length}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" /> Exportar a Excel
        </button>
      </div>

      {error && <p className="text-[0.8125rem] text-red-600 dark:text-red-400">{error}</p>}
      {!datos && !error && <p className="text-[0.8125rem] text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando visitas…</p>}

      {datos && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-slate-500 dark:text-neutral-400">
            {persona ? (
              <button type="button" onClick={() => { setPersona(null); setMostrar(POR_PAGINA); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--primary)] text-white font-semibold cursor-pointer">
                Persona {persona} · {miles(filas.length)} visitas <X className="w-3 h-3" />
              </button>
            ) : (
              <span>{miles(datos.total)} visitas de {miles(personas)} personas</span>
            )}
            {datos.recortado && <span className="text-amber-600">Se muestran las {miles(datos.filas.length)} más recientes.</span>}
          </div>

          {!filas.length ? <p className="text-[0.8125rem] text-slate-500">Todavía no hay visitas en este periodo.</p> : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[0.8125rem] tabular-nums">
                <thead>
                  <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                    {['Cuándo', 'Persona', 'Desde dónde', 'Aparato', 'De dónde vienen', 'Tiempo', 'Bajó', 'Secciones', 'Clics', 'Qué hizo'].map((h) => (
                      <th key={h} className="px-1 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, mostrar).map((f) => {
                    const hizo = acciones(f);
                    return (
                      <tr key={f.id} className="border-t border-slate-100 dark:border-neutral-800 align-top">
                        <td className="px-1 py-1.5 whitespace-nowrap">{fechaHora(f.creadoEn)}</td>
                        <td className="px-1 py-1.5">
                          <button type="button" onClick={() => { setPersona(f.persona); setMostrar(POR_PAGINA); }} title="Ver solo las visitas de esta persona"
                            className="font-mono text-[0.75rem] text-[var(--primary)] hover:underline cursor-pointer">{f.persona}</button>
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">{f.pais ? <>{bandera(f.pais)} {pais(f.pais)}</> : 'Sin ubicar'}{f.ciudad && <span className="text-slate-400"> · {f.ciudad}</span>}</td>
                        <td className="px-1 py-1.5 whitespace-nowrap">{APARATO[f.dispositivo]}<span className="text-slate-400">{[f.navegador, f.sistema].filter(Boolean).map((x) => ` · ${x}`).join('')}</span></td>
                        <td className="px-1 py-1.5 whitespace-nowrap">{fuente(f.fuente)}{f.campana && <span className="text-slate-400"> · {f.campana}</span>}</td>
                        <td className="px-1 py-1.5 whitespace-nowrap">{duracion(f.duracionSeg)}</td>
                        <td className="px-1 py-1.5 whitespace-nowrap">{f.scrollMax} %</td>
                        <td className="px-1 py-1.5 whitespace-nowrap" title={f.secciones.map(nombreSeccion).join(', ')}>{f.secciones.length} de {secciones.length}</td>
                        <td className="px-1 py-1.5">{f.clics}</td>
                        <td className="px-1 py-1.5 min-w-[10rem]">
                          {f.seFueSinMirar ? <span className="text-slate-400">Se fue sin mirar</span> : hizo.length ? hizo.join(' · ') : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filas.length > mostrar && (
            <button type="button" onClick={() => setMostrar((m) => m + POR_PAGINA)} className="text-[0.8125rem] font-bold text-[var(--primary)] hover:underline cursor-pointer">
              Ver {miles(Math.min(POR_PAGINA, filas.length - mostrar))} más (quedan {miles(filas.length - mostrar)}) →
            </button>
          )}
        </>
      )}
    </div>
  );
};

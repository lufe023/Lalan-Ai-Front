import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, HelpCircle, Mic, Users, MessageSquareText, Timer, Send } from 'lucide-react';
import { api } from '../../services/api';

interface UsoLalan {
  dias: number;
  totales: {
    personas: number; salones: number; preguntas: number; porVoz: number; utiles: number; noUtiles: number;
    noSupo: number; fallos: number; msPromedio: number | null; msP90: number | null;
    propuestas: number; hechas: number; descartadas: number; fallidas: number; sinClasificar: number;
  };
  porSalon: {
    negocioId: string; salon: string; personas: number; preguntas: number; diasActivos: number; porVoz: number;
    utiles: number; noUtiles: number; noSupo: number; propuestas: number; hechas: number; temaPrincipal: string | null; ultima: string | null;
  }[];
  temas: { tema: string; nombre: string; preguntas: number; utiles: number; noUtiles: number; noSupo: number }[];
  herramientas: { herramienta: string; veces: number }[];
  porDia: { dia: string; preguntas: number }[];
  necesidades: { necesidad: string; tema: string | null; salon: string; creadoEn: string; util: boolean | null; noSupo: boolean }[];
  resumen: { texto: string; creadoEn: string; dias: number } | null;
}

/** Cómo se dice cada herramienta de Lalan */
const HERRAMIENTA: Record<string, string> = {
  ver_informe: 'Leer un informe (agenda, ventas…)',
  chats_que_esperan: 'Ver quién espera respuesta',
  buscar_chat: 'Buscar una clienta',
  leer_chat: 'Leer un chat',
  proponer_indicacion: 'Proponer una indicación',
  proponer_mensaje: 'Proponer un mensaje',
};

const RANGOS = [7, 30, 90] as const;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const miles = (n: number) => n.toLocaleString('es-DO');
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '—');

const Cifra: React.FC<{ icono: React.FC<{ className?: string }>; titulo: string; valor: string; nota?: string }> = ({ icono: I, titulo, valor, nota }) => (
  <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800">
    <div className="flex items-center gap-1.5 text-[0.75rem] text-slate-500 dark:text-neutral-400"><I className="w-3.5 h-3.5" /> {titulo}</div>
    <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-1">{valor}</div>
    {nota && <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 mt-0.5">{nota}</div>}
  </div>
);

/** Preguntas por día: una sola serie, barras finas con el valor al pasar */
const PorDia: React.FC<{ datos: UsoLalan['porDia']; dias: number }> = ({ datos, dias }) => {
  const hoy = new Date();
  const lista: { dia: string; preguntas: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy.getTime() - i * 86_400_000);
    const clave = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(d);
    lista.push({ dia: clave, preguntas: datos.find((x) => x.dia === clave)?.preguntas ?? 0 });
  }
  const max = Math.max(1, ...lista.map((x) => x.preguntas));
  const [sobre, setSobre] = useState<number | null>(null);
  const activo = sobre !== null ? lista[sobre] : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[0.75rem] text-slate-500 dark:text-neutral-400">
        <span>Preguntas por día</span>
        <span className="tabular-nums">{activo ? `${new Date(`${activo.dia}T12:00:00`).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })}: ${activo.preguntas}` : `máx. ${max}`}</span>
      </div>
      <div className="relative h-24 flex items-end gap-[2px] border-b border-slate-200 dark:border-neutral-800" onMouseLeave={() => setSobre(null)} role="img"
        aria-label={`Preguntas por día en los últimos ${dias} días; máximo ${max}`}>
        {lista.map((x, i) => (
          <div key={x.dia} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setSobre(i)} title={`${x.dia}: ${x.preguntas}`}>
            <div className={`w-full rounded-t-[3px] ${sobre === i ? 'bg-[var(--primary)]' : 'bg-[var(--primary)]/70'}`}
              style={{ height: x.preguntas ? `${Math.max(4, (x.preguntas / max) * 100)}%` : 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
};

/** Lo que dice la IA: títulos y guiones, sin markdown pesado */
const TextoResumen: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="space-y-1.5 text-[0.875rem] text-slate-700 dark:text-neutral-200 max-w-[75ch]">
    {texto.split('\n').filter((l) => l.trim()).map((l, i) => {
      const limpio = l.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
      const esTitulo = /^\d+\.\s/.test(limpio) || /^#/.test(l.trim()) || (/:$/.test(limpio) && limpio.length < 60);
      if (esTitulo) return <p key={i} className="font-bold text-slate-900 dark:text-white pt-2">{limpio.replace(/^\d+\.\s*/, '')}</p>;
      return <p key={i} className="pl-3">{limpio.replace(/^[-•]\s*/, '· ')}</p>;
    })}
  </div>
);

/**
 * Cómo usan las dueñas la pantalla de Lalan: cuánto, para qué, si les sirvió
 * y qué recomienda la IA. Solo el super admin.
 */
export const UsoLalanPlataforma: React.FC = () => {
  const [dias, setDias] = useState<number>(30);
  const [datos, setDatos] = useState<UsoLalan | null>(null);
  const [error, setError] = useState('');
  const [analizando, setAnalizando] = useState(false);

  const cargar = useCallback(() => {
    setError('');
    api.get<UsoLalan>(`/plataforma/uso-lalan?dias=${dias}`).then(setDatos).catch((e: Error) => setError(e.message));
  }, [dias]);
  useEffect(() => { cargar(); }, [cargar]);

  const analizar = async () => {
    setAnalizando(true); setError('');
    try {
      const r = await api.post<{ texto: string; creadoEn: string; dias: number }>('/plataforma/uso-lalan/recomendaciones', { dias });
      setDatos((d) => (d ? { ...d, resumen: r } : d));
    } catch (e) { setError((e as Error).message); } finally { setAnalizando(false); }
  };

  if (error && !datos) return <p className="text-sm text-rose-600">{error}</p>;
  if (!datos) return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando el uso de Lalan…</div>;

  const t = datos.totales;
  const calificadas = t.utiles + t.noUtiles;
  const maxTema = Math.max(1, ...datos.temas.map((x) => x.preguntas));
  const maxHerr = Math.max(1, ...datos.herramientas.map((x) => x.veces));

  return (
    <section className="space-y-5 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">Cómo usan las dueñas a Lalan</h3>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 max-w-[70ch]">
            Lo que le preguntan en su pantalla, si les sirvió (👍 / 👎) y qué temas les preocupan. Los temas los anota la IA cada 20 minutos, sin nombres de clientas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-neutral-700 overflow-hidden" role="group" aria-label="Período">
            {RANGOS.map((r) => (
              <button key={r} type="button" onClick={() => setDias(r)} aria-pressed={dias === r}
                className={`px-3 py-1.5 text-[0.75rem] font-bold cursor-pointer ${dias === r ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-neutral-300'}`}>{r} días</button>
            ))}
          </div>
          <button type="button" onClick={cargar} aria-label="Actualizar" className="p-2 rounded-xl border border-slate-200 dark:border-neutral-700 cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cifra icono={Users} titulo="Quiénes la usan" valor={`${t.personas}`} nota={`en ${t.salones} ${t.salones === 1 ? 'salón' : 'salones'}`} />
        <Cifra icono={MessageSquareText} titulo="Preguntas" valor={miles(t.preguntas)} nota={`${pct(t.porVoz, t.preguntas)} % por voz`} />
        <Cifra icono={ThumbsUp} titulo="Les sirvió" valor={calificadas ? `${pct(t.utiles, calificadas)} %` : '—'}
          nota={calificadas ? `${t.utiles} 👍 · ${t.noUtiles} 👎 (${pct(calificadas, t.preguntas)} % calificó)` : 'Nadie ha calificado todavía'} />
        <Cifra icono={Send} titulo="Propuestas aceptadas" valor={t.propuestas ? `${pct(t.hechas, t.propuestas)} %` : '—'}
          nota={`${t.hechas} de ${t.propuestas}${t.fallidas ? ` · ${t.fallidas} fallaron` : ''}`} />
        <Cifra icono={HelpCircle} titulo="No supo responder" valor={`${t.noSupo}`} nota={`${pct(t.noSupo, t.preguntas)} % de las preguntas`} />
        <Cifra icono={RefreshCw} titulo="Sin respuesta (fallo de IA)" valor={`${t.fallos}`} nota={t.fallos ? 'Mira Plataforma → Salud' : 'Ninguna'} />
        <Cifra icono={Timer} titulo="Tarda en responder" valor={t.msPromedio ? `${(t.msPromedio / 1000).toFixed(1)} s` : '—'} nota={t.msP90 ? `9 de cada 10 en menos de ${(t.msP90 / 1000).toFixed(1)} s` : undefined} />
        <Cifra icono={Mic} titulo="Por voz" valor={`${pct(t.porVoz, t.preguntas)} %`} nota={`${miles(t.porVoz)} preguntas habladas`} />
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800">
        <PorDia datos={datos.porDia} dias={datos.dias} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3">
          <h4 className="text-[0.875rem] font-bold">De qué le hablan</h4>
          {!datos.temas.length && <p className="text-[0.8125rem] text-slate-500">Todavía no hay temas anotados{t.sinClasificar ? ` (${t.sinClasificar} preguntas esperando el próximo barrido)` : ''}.</p>}
          <ul className="space-y-2">
            {datos.temas.map((x) => {
              const cal = x.utiles + x.noUtiles;
              return (
                <li key={x.tema} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                    <span className="font-semibold">{x.nombre}</span>
                    <span className="tabular-nums text-slate-500 dark:text-neutral-400">
                      {x.preguntas}
                      {cal > 0 && <> · <ThumbsUp className="inline w-3 h-3 -mt-0.5 text-emerald-600" /> {pct(x.utiles, cal)} %</>}
                      {x.noSupo > 0 && <> · <span className="text-amber-600">{x.noSupo} sin respuesta</span></>}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800" title={`${x.nombre}: ${x.preguntas} preguntas`}>
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(x.preguntas / maxTema) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3">
          <h4 className="text-[0.875rem] font-bold">Lo que necesitaban <span className="font-normal text-slate-500">(primero lo que no salió bien)</span></h4>
          {!datos.necesidades.length && <p className="text-[0.8125rem] text-slate-500">Aparecen cuando la IA anota los temas.</p>}
          <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {datos.necesidades.map((x, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.8125rem]">
                <span className="mt-0.5 shrink-0" aria-label={x.util === false ? 'No le sirvió' : x.noSupo ? 'Lalan no supo' : x.util ? 'Le sirvió' : 'Sin calificar'}>
                  {x.util === false ? <ThumbsDown className="w-3.5 h-3.5 text-rose-600" /> : x.noSupo ? <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                    : x.util ? <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> : <span className="block w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-neutral-600" />}
                </span>
                <span className="flex-1">{x.necesidad}<span className="text-slate-400"> · {x.salon} · {fecha(x.creadoEn)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3">
        <h4 className="text-[0.875rem] font-bold">Por salón</h4>
        {!datos.porSalon.length ? <p className="text-[0.8125rem] text-slate-500">Nadie ha usado la pantalla de Lalan en este período.</p> : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[0.8125rem] tabular-nums">
              <thead>
                <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                  {['Salón', 'Personas', 'Preguntas', 'Días que la usó', 'Por voz', 'Le sirvió', 'No supo', 'Propuestas aceptadas', 'Lo que más pregunta', 'Última vez'].map((h) => (
                    <th key={h} className="px-1 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.porSalon.map((s) => {
                  const cal = s.utiles + s.noUtiles;
                  return (
                    <tr key={s.negocioId} className="border-t border-slate-100 dark:border-neutral-800">
                      <td className="px-1 py-1.5 font-semibold whitespace-nowrap">{s.salon}</td>
                      <td className="px-1 py-1.5">{s.personas}</td>
                      <td className="px-1 py-1.5">{miles(s.preguntas)}</td>
                      <td className="px-1 py-1.5">{s.diasActivos} de {datos.dias}</td>
                      <td className="px-1 py-1.5">{pct(s.porVoz, s.preguntas)} %</td>
                      <td className="px-1 py-1.5 whitespace-nowrap">{cal ? `${pct(s.utiles, cal)} % (${s.utiles}👍 ${s.noUtiles}👎)` : '—'}</td>
                      <td className={`px-1 py-1.5 ${s.noSupo ? 'text-amber-600 font-semibold' : ''}`}>{s.noSupo}</td>
                      <td className="px-1 py-1.5">{s.propuestas ? `${s.hechas} de ${s.propuestas}` : '—'}</td>
                      <td className="px-1 py-1.5 whitespace-nowrap">{s.temaPrincipal ?? '—'}</td>
                      <td className="px-1 py-1.5 whitespace-nowrap">{fecha(s.ultima)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {datos.herramientas.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-2">
          <h4 className="text-[0.875rem] font-bold">Qué usó Lalan para responder</h4>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {datos.herramientas.map((h) => (
              <li key={h.herramienta} className="space-y-1">
                <div className="flex justify-between text-[0.8125rem]"><span>{HERRAMIENTA[h.herramienta] ?? h.herramienta}</span><span className="tabular-nums text-slate-500">{miles(h.veces)}</span></div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-[var(--primary)]/70" style={{ width: `${(h.veces / maxHerr) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4 rounded-2xl border-2 border-[var(--primary)]/30 bg-white dark:bg-neutral-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[0.875rem] font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[var(--primary)]" /> Qué les preocupa y qué recomienda la IA</h4>
          <button type="button" onClick={() => void analizar()} disabled={analizando || !t.preguntas}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 cursor-pointer">
            {analizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analizando ? 'Analizando…' : datos.resumen ? `Analizar otra vez (${dias} días)` : `Analizar los últimos ${dias} días`}
          </button>
        </div>
        {datos.resumen ? (
          <>
            <TextoResumen texto={datos.resumen.texto} />
            <p className="text-[0.6875rem] text-slate-400">Hecho el {new Date(datos.resumen.creadoEn).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })} con los últimos {datos.resumen.dias} días. Usa solo números y necesidades sin nombres.</p>
          </>
        ) : (
          <p className="text-[0.8125rem] text-slate-500">Cuando haya preguntas, la IA lee los temas, los 👎 y lo que Lalan no supo responder, y propone qué mejorar. Cuesta menos de un centavo de dólar cada vez.</p>
        )}
        {error && <p className="text-[0.8125rem] text-rose-600">{error}</p>}
      </div>
    </section>
  );
};

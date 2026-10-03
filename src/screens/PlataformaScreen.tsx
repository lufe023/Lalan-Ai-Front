import { AjustesLalanPlataforma } from '../components/plataforma/AjustesLalanPlataforma';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe2, RefreshCw, Smartphone, Tablet, Monitor, Clock, MousePointerClick, PlayCircle, Volume2, Maximize2, Repeat,
  CheckCircle2, Users, Eye, ArrowDownToLine, LogOut, ExternalLink, AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react';
import { api } from '../services/api';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';
import { PilotoAplicaciones } from '../components/plataforma/PilotoAplicaciones';
import { OtrosNegocios } from '../components/plataforma/OtrosNegocios';
import { EquipoSoporte } from '../components/plataforma/EquipoSoporte';
import { PortadasPlataforma } from '../components/plataforma/PortadasPlataforma';
import { SaludServicios } from '../components/plataforma/SaludServicios';
import { NegociosPlataforma, type PrellenadoNegocio } from '../components/plataforma/NegociosPlataforma';
import { PlanesPlataforma } from '../components/plataforma/PlanesPlataforma';
import { UsoAppPanel } from '../components/plataforma/UsoAppPanel';
import type { Dispositivo, ResumenLanding } from '../types/plataforma';
import { useAuth } from '../context/AuthContext';

type Pestana = 'negocios' | 'planes' | 'visitas' | 'calor' | 'piloto' | 'soporte' | 'salud' | 'portadas' | 'lalan';
const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'salud', label: 'Salud' },
  { id: 'negocios', label: 'Clientes' },
  { id: 'planes', label: 'Planes' },
  { id: 'visitas', label: 'Visitas' },
  { id: 'calor', label: 'Mapa de calor' },
  { id: 'piloto', label: 'Piloto' },
  { id: 'soporte', label: 'Equipo' },
  { id: 'portadas', label: 'Portadas' },
  { id: 'lalan', label: 'Lalan' },
];

type Rango = '7' | '30' | '90';
const RANGOS: { id: Rango; label: string }[] = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
];

const DISPOSITIVOS: { id: Dispositivo; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'movil', label: 'Móvil', icon: Smartphone },
  { id: 'tableta', label: 'Tableta', icon: Tablet },
  { id: 'pc', label: 'PC', icon: Monitor },
];

/** Ancho con el que se muestra la landing en el mapa de calor */
const ANCHO_CALOR: Record<Dispositivo, number> = { pc: 1280, tableta: 820, movil: 390 };

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const FUENTES: Record<string, string> = {
  directo: 'Directo (escribieron la dirección)', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  whatsapp: 'WhatsApp', google: 'Google', buscadores: 'Otros buscadores', x: 'X (Twitter)', youtube: 'YouTube', linkedin: 'LinkedIn',
};

const nombrePais = (() => {
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames(['es'], { type: 'region' }); } catch { dn = null; }
  return (codigo: string) => {
    if (!codigo || codigo === '—') return 'Sin ubicar';
    try { return dn?.of(codigo) ?? codigo; } catch { return codigo; }
  };
})();
const bandera = (codigo: string) =>
  /^[A-Z]{2}$/.test(codigo) ? String.fromCodePoint(...[...codigo].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🌐';

/** 12 a. m., 1 p. m.… nunca 24 horas */
const hora12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'a. m.' : 'p. m.'}`;
const duracion = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const miles = (n: number) => n.toLocaleString('es-DO');

const Tarjeta: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark] ${className}`}>{children}</div>
);
const Titulo: React.FC<{ children: React.ReactNode; ayuda?: string }> = ({ children, ayuda }) => (
  <div className="mb-3">
    <h3 className="text-[0.875rem] font-bold text-slate-900 dark:text-white">{children}</h3>
    {ayuda && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-0.5">{ayuda}</p>}
  </div>
);

const Cifra: React.FC<{ icon: React.FC<{ className?: string }>; titulo: string; valor: string; antes?: number; ahora?: number; nota?: string }> = ({ icon: I, titulo, valor, antes, ahora, nota }) => {
  const cambio = antes !== undefined && ahora !== undefined && antes > 0 ? Math.round(((ahora - antes) / antes) * 100) : null;
  return (
    <Tarjeta>
      <div className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400"><I className="w-3.5 h-3.5" />{titulo}</div>
      <div className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-1">{valor}</div>
      {cambio !== null ? (
        <div className={`text-[0.75rem] font-bold flex items-center gap-1 mt-0.5 ${cambio >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {cambio >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{cambio >= 0 ? '+' : ''}{cambio} % vs. el periodo anterior
        </div>
      ) : nota ? <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-0.5">{nota}</div> : null}
    </Tarjeta>
  );
};

/** Una lista con barras, la forma más fácil de leer "quién aporta más" */
const Barras: React.FC<{ filas: { etiqueta: React.ReactNode; valor: number }[]; total: number; vacio?: string }> = ({ filas, total, vacio = 'Sin datos todavía' }) => {
  if (!filas.length) return <p className="text-[0.75rem] text-slate-400">{vacio}</p>;
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <div className="space-y-2">
      {filas.map((f, i) => (
        <div key={i}>
          <div className="flex justify-between gap-3 text-[0.8125rem]">
            <span className="text-slate-700 dark:text-neutral-200 truncate">{f.etiqueta}</span>
            <span className="tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">{miles(f.valor)} <span className="text-slate-400 font-normal">· {pct(f.valor, total)} %</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 mt-1 overflow-hidden">
            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Visitas por día: columnas con el valor al pasar el dedo */
const PorDia: React.FC<{ datos: ResumenLanding['porDia'] }> = ({ datos }) => {
  const [marcado, setMarcado] = useState<number | null>(null);
  if (!datos.length) return <p className="text-[0.75rem] text-slate-400">Todavía no hay visitas en este periodo.</p>;
  const max = Math.max(...datos.map((d) => d.visitas), 1);
  const fmt = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
  const sel = marcado !== null ? datos[marcado] : datos[datos.length - 1];
  return (
    <div>
      <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mb-2 h-4">
        <b className="text-slate-900 dark:text-white">{fmt(sel.fecha)}</b> · {miles(sel.visitas)} visitas · {miles(sel.visitantes)} personas
      </div>
      <div className="flex items-end gap-[3px] h-28" onMouseLeave={() => setMarcado(null)}>
        {datos.map((d, i) => (
          <button key={d.fecha} type="button" aria-label={`${fmt(d.fecha)}: ${d.visitas} visitas`}
            onMouseEnter={() => setMarcado(i)} onClick={() => setMarcado(i)}
            className="flex-1 h-full flex items-end cursor-pointer">
            <span className={`w-full rounded-t-[4px] ${marcado === i ? 'bg-[var(--primary)]' : 'bg-[var(--primary)]/45'}`} style={{ height: `${Math.max(3, (d.visitas / max) * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[0.6875rem] text-slate-400 mt-1"><span>{fmt(datos[0].fecha)}</span><span>{fmt(datos[datos.length - 1].fecha)}</span></div>
    </div>
  );
};

/** Días × horas: dónde se concentran las visitas (hora dominicana) */
const CalorHoras: React.FC<{ datos: ResumenLanding['calorHoras'] }> = ({ datos }) => {
  const mapa = new Map(datos.map((d) => [`${d.dia}-${d.hora}`, d.visitas]));
  const max = Math.max(...datos.map((d) => d.visitas), 1);
  const [marcado, setMarcado] = useState<{ dia: number; hora: number } | null>(null);
  const pico = datos.reduce<{ dia: number; hora: number; visitas: number } | null>((m, d) => (!m || d.visitas > m.visitas ? d : m), null);
  return (
    <div>
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mb-2 h-4">
        {marcado
          ? <>{DIAS[marcado.dia]} a las {hora12(marcado.hora)}: <b className="text-slate-900 dark:text-white">{miles(mapa.get(`${marcado.dia}-${marcado.hora}`) ?? 0)} visitas</b></>
          : pico ? <>Momento de más visitas: <b className="text-slate-900 dark:text-white">{DIAS[pico.dia]} a las {hora12(pico.hora)}</b></> : 'Sin visitas todavía'}
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {DIAS.map((nombre, dia) => (
            <div key={dia} className="flex items-center gap-1 mb-[3px]">
              <span className="w-8 text-[0.6875rem] text-slate-400 shrink-0">{nombre}</span>
              {Array.from({ length: 24 }, (_, hora) => {
                const v = mapa.get(`${dia}-${hora}`) ?? 0;
                return (
                  <span key={hora} onMouseEnter={() => setMarcado({ dia, hora })} onMouseLeave={() => setMarcado(null)}
                    className="flex-1 h-4 rounded-[3px]"
                    style={{ background: v ? `color-mix(in srgb, var(--primary) ${15 + (v / max) * 85}%, transparent)` : 'rgba(148,163,184,.12)' }} />
                );
              })}
            </div>
          ))}
          <div className="flex gap-1 pl-9 text-[0.6875rem] text-slate-400">
            {[0, 6, 12, 18].map((h) => <span key={h} className="flex-1">{hora12(h)}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PlataformaScreen: React.FC = () => {
  const { currentUser } = useAuth();
  /** Soporte ve solo a los clientes (para ayudarles), sin estadísticas ni planes */
  const esSoporte = currentUser?.role === 'support';
  const [pestana, setPestana] = useState<Pestana>('negocios');
  const [abrirNegocio, setAbrirNegocio] = useState<string | null>(null);
  const [prellenado, setPrellenado] = useState<PrellenadoNegocio | null>(null);
  const [rango, setRango] = useState<Rango>('30');
  const [datos, setDatos] = useState<ResumenLanding | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispositivoCalor, setDispositivoCalor] = useState<Dispositivo>('pc');
  const [origenCalor, setOrigenCalor] = useState<'landing' | 'app'>('landing');

  const desde = useMemo(() => new Date(Date.now() - Number(rango) * 24 * 60 * 60 * 1000).toISOString(), [rango]);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try { setDatos(await api.get<ResumenLanding>(`/plataforma/landing/resumen?desde=${encodeURIComponent(desde)}`)); }
    catch (e) { setError((e as Error).message || 'No se pudieron cargar las estadísticas'); }
    finally { setCargando(false); }
  }, [desde]);

  useEffect(() => { if (!esSoporte) void cargar(); }, [cargar, esSoporte]);

  const totalDisp = datos ? datos.dispositivos.reduce((s, d) => s + d.visitas, 0) : 0;
  const urlCalor = `/?calor=${dispositivoCalor}&desde=${encodeURIComponent(desde)}`;
  const anchoCalor = ANCHO_CALOR[dispositivoCalor];

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Plataforma"
        subtitle="Clientes, planes, la landing y el piloto · solo super admin"
        rightAction={
          <button onClick={() => void cargar()} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 ios-touch" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        }
      />
      <PageContent className="space-y-4 pt-1 pb-8">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          {!esSoporte && <IOSSegmentedControl id="plataforma-pestanas" options={PESTANAS} value={pestana} onChange={(v) => setPestana(v as Pestana)} size="md" />}
          {(pestana === 'visitas' || pestana === 'calor') && <IOSSegmentedControl id="plataforma-rango" options={RANGOS} value={rango} onChange={(v) => setRango(v as Rango)} size="sm" />}
        </div>

        {error && pestana === 'visitas' && (
          <Tarjeta className="border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400"><AlertTriangle className="w-4 h-4" /> {error}
              <button className="underline ml-auto" onClick={() => void cargar()}>Reintentar</button></div>
          </Tarjeta>
        )}

        {pestana === 'visitas' && datos && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <Cifra icon={Eye} titulo="Visitas" valor={miles(datos.visitas)} antes={datos.anterior.visitas} ahora={datos.visitas} />
              <Cifra icon={Users} titulo="Personas distintas" valor={miles(datos.visitantes)} antes={datos.anterior.visitantes} ahora={datos.visitantes} />
              <Cifra icon={Clock} titulo="Tiempo medio" valor={duracion(datos.duracionMediaSeg)} nota="con la página a la vista" />
              <Cifra icon={ArrowDownToLine} titulo="Bajan en promedio" valor={`${datos.scrollMedio} %`} nota="de la página" />
              <Cifra icon={LogOut} titulo="Se van sin mirar" valor={`${datos.rebote} %`} nota="no bajaron ni tocaron nada" />
              <Cifra icon={CheckCircle2} titulo="Aplicaron al piloto" valor={miles(datos.piloto.aplicaciones)} antes={datos.anterior.aplicaciones} ahora={datos.piloto.aplicaciones} />
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              <Tarjeta><Titulo>Visitas por día</Titulo><PorDia datos={datos.porDia} /></Tarjeta>
              <Tarjeta><Titulo ayuda="Día y hora en República Dominicana">Cuándo entran</Titulo><CalorHoras datos={datos.calorHoras} /></Tarjeta>
            </div>

            <div className="grid lg:grid-cols-3 gap-3">
              <Tarjeta>
                <Titulo>Desde dónde</Titulo>
                <Barras total={datos.visitas} filas={datos.paises.map((p) => ({ etiqueta: <>{bandera(p.id)} {nombrePais(p.id)}</>, valor: p.visitas }))} />
                {datos.ciudades.length > 0 && (
                  <>
                    <div className="text-[0.75rem] font-semibold text-slate-500 mt-4 mb-2">Ciudades</div>
                    <Barras total={datos.visitas} filas={datos.ciudades.map((c) => ({ etiqueta: `${c.id}${c.pais ? ` · ${c.pais}` : ''}`, valor: c.visitas }))} />
                  </>
                )}
              </Tarjeta>
              <Tarjeta>
                <Titulo>Desde qué aparato</Titulo>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {DISPOSITIVOS.map((d) => {
                    const v = datos.dispositivos.find((x) => x.id === d.id)?.visitas ?? 0;
                    return (
                      <div key={d.id} className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-2.5 text-center">
                        <d.icon className="w-4 h-4 mx-auto text-[var(--primary)]" />
                        <div className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">{pct(v, totalDisp)} %</div>
                        <div className="text-[0.6875rem] text-slate-500">{d.label} · {miles(v)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[0.75rem] font-semibold text-slate-500 mb-2">Navegadores</div>
                <Barras total={datos.visitas} filas={datos.navegadores.map((n) => ({ etiqueta: n.id, valor: n.visitas }))} />
                <div className="text-[0.75rem] font-semibold text-slate-500 mt-4 mb-2">Sistemas</div>
                <Barras total={datos.visitas} filas={datos.sistemas.map((n) => ({ etiqueta: n.id, valor: n.visitas }))} />
              </Tarjeta>
              <Tarjeta>
                <Titulo ayuda="Con enlaces ?utm_source=… en tus anuncios se ve la campaña exacta">De dónde vienen</Titulo>
                <Barras total={datos.visitas} filas={datos.fuentes.map((f) => ({ etiqueta: FUENTES[f.id] ?? f.id, valor: f.visitas }))} />
              </Tarjeta>
            </div>

            <div className="grid lg:grid-cols-3 gap-3">
              <Tarjeta className="lg:col-span-2">
                <Titulo ayuda="Cuántas visitas llegaron a ver cada parte de la página">Hasta dónde llegan</Titulo>
                <Barras total={datos.visitas} filas={datos.secciones.map((s) => ({ etiqueta: s.descripcion, valor: s.visitas }))} />
              </Tarjeta>
              <div className="space-y-3">
                <Tarjeta>
                  <Titulo>La historia animada</Titulo>
                  <div className="grid grid-cols-2 gap-2 text-[0.8125rem]">
                    {[
                      { i: PlayCircle, t: 'La reprodujeron', v: datos.historia.inicios },
                      { i: CheckCircle2, t: 'Llegaron al final', v: datos.historia.finales, n: `${pct(datos.historia.finales, datos.historia.inicios)} %` },
                      { i: Volume2, t: 'Con sonido', v: datos.historia.conSonido },
                      { i: Maximize2, t: 'Pantalla completa', v: datos.historia.pantallaCompleta },
                      { i: Repeat, t: 'La repitieron', v: datos.historia.repeticiones },
                      { i: Eye, t: 'Visitas que la vieron', v: datos.historia.visitasQueLaVieron, n: `${pct(datos.historia.visitasQueLaVieron, datos.visitas)} %` },
                    ].map((x) => (
                      <div key={x.t} className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-2.5">
                        <div className="flex items-center gap-1 text-[0.6875rem] text-slate-500"><x.i className="w-3 h-3" />{x.t}</div>
                        <div className="text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{miles(x.v)} {x.n && <span className="text-[0.6875rem] font-semibold text-slate-400">· {x.n}</span>}</div>
                      </div>
                    ))}
                  </div>
                </Tarjeta>
                <Tarjeta>
                  <Titulo>El formulario del piloto</Titulo>
                  <p className="text-[0.8125rem] text-slate-600 dark:text-neutral-300">
                    <b className="text-slate-900 dark:text-white">{miles(datos.piloto.abrieron)}</b> empezaron a llenarlo y <b className="text-slate-900 dark:text-white">{miles(datos.piloto.aplicaciones)}</b> lo enviaron
                    {datos.piloto.abrieron > 0 && <> ({pct(datos.piloto.aplicaciones, datos.piloto.abrieron)} %)</>}.
                  </p>
                  {datos.piloto.nuevas > 0 && (
                    <button onClick={() => setPestana('piloto')} className="mt-2 text-[0.8125rem] font-bold text-[var(--primary)] hover:underline">{datos.piloto.nuevas} sin contactar →</button>
                  )}
                </Tarjeta>
              </div>
            </div>

            <Tarjeta>
              <Titulo ayuda="Botones y enlaces que más tocan">Lo que más tocan</Titulo>
              <Barras total={datos.clicsDestacados.reduce((s, c) => s + c.clics, 0)} filas={datos.clicsDestacados.map((c) => ({ etiqueta: <><MousePointerClick className="w-3 h-3 inline mr-1" />{c.detalle}</>, valor: c.clics }))} />
            </Tarjeta>
          </>
        )}

        {pestana === 'calor' && (
          <div className="flex gap-1.5">
            {([['landing', 'La landing'], ['app', 'La app por dentro']] as const).map(([id, nombre]) => (
              <button key={id} type="button" onClick={() => setOrigenCalor(id)}
                className={`px-4 py-2 rounded-xl text-[0.8125rem] font-bold border cursor-pointer ${origenCalor === id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>{nombre}</button>
            ))}
          </div>
        )}
        {pestana === 'calor' && origenCalor === 'app' && <UsoAppPanel desde={desde} />}
        {pestana === 'calor' && origenCalor === 'landing' && (
          <Tarjeta className="!p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex gap-1.5">
                {DISPOSITIVOS.map((d) => (
                  <button key={d.id} onClick={() => setDispositivoCalor(d.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.8125rem] font-semibold border cursor-pointer ${dispositivoCalor === d.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
                    <d.icon className="w-3.5 h-3.5" />{d.label}
                  </button>
                ))}
              </div>
              <a href={urlCalor} target="_blank" rel="noopener" className="flex items-center gap-1 text-[0.8125rem] font-semibold text-[var(--primary)] hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir en otra pestaña
              </a>
            </div>
            <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mb-3">Cada mancha es donde tocaron o hicieron clic: azul es poco, rojo es mucho. Se dibuja sobre la página tal como la ven en ese aparato.</p>
            <div className="rounded-xl overflow-auto bg-slate-100 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800" style={{ height: 'min(75vh, 900px)' }}>
              <iframe key={urlCalor} src={urlCalor} title="Mapa de calor de la landing" className="block mx-auto bg-white" style={{ width: anchoCalor, height: '100%', border: 0 }} />
            </div>
          </Tarjeta>
        )}

        {pestana === 'negocios' && <NegociosPlataforma soloSoporte={esSoporte} prellenado={prellenado} onPrellenadoUsado={() => setPrellenado(null)} abrirId={abrirNegocio} />}
        {pestana === 'planes' && <PlanesPlataforma />}
        {pestana === 'soporte' && <EquipoSoporte />}
        {pestana === 'portadas' && <PortadasPlataforma />}
        {pestana === 'lalan' && <AjustesLalanPlataforma />}
        {pestana === 'salud' && <SaludServicios onAbrirNegocio={(id) => { setAbrirNegocio(id); setPestana('negocios'); }} />}
        {pestana === 'piloto' && (
          <div className="space-y-10">
            <PilotoAplicaciones onCrearSalon={(p) => { setPrellenado(p); setPestana('negocios'); }} />
            <OtrosNegocios />
          </div>
        )}

        {pestana === 'visitas' && !datos && !error && (
          <div className="flex items-center gap-2 text-xs text-slate-500"><Globe2 className="w-4 h-4 animate-pulse" /> Cargando las estadísticas…</div>
        )}
      </PageContent>
    </div>
  );
};

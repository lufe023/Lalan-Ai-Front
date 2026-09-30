import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, CalendarDays, Coffee, Flame, FileDown, Link2, Loader2, Mail, MessageCircle, Package, Settings2, Sparkles, TrendingUp, Users } from 'lucide-react';
import { api, descargarArchivo } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { IOSModal } from '../ui/IOSModal';
import { SelectorHora } from '../ui/SelectorHora';
import { hora12 } from '../../utils/hora';
import { ActivarNotificaciones } from '../ui/ActivarNotificaciones';

type Tipo = 'resumen' | 'inventario' | 'clientas' | 'rentabilidad' | 'agenda' | 'gustos' | 'tendencias';
type Canal = 'app' | 'correo' | 'whatsapp';
type Frecuencia = 'diaria' | 'semanal' | 'mensual' | 'nunca';
type Periodo = 'day' | 'week' | 'month';
interface Seccion { id: string; emoji: string; titulo: string; lineas: string[]; vacio?: string }
interface Informe { tipo: Tipo; titulo: string; periodo: string; sede: string; negocio: string; secciones: Seccion[]; hayAlgo: boolean; nota?: string | null }
interface Aviso { id: string; tipo: Tipo; titulo: string; resumen: string; informe: Informe; leidoEn: string | null; creadoEn: string }
interface Preferencia {
  id: Tipo; nombre: string; descripcion: string; incluido: boolean; soloSiHayAlgo: boolean;
  frecuencia: Frecuencia; diaSemana: number | null; diaMes: number | null; minuto: number; canales: Canal[]; plantillaSiCerrada: boolean; activo: boolean;
}
interface Sede { id: string; name: string }

const ICONO: Record<Tipo, React.FC<{ className?: string }>> = { resumen: TrendingUp, inventario: Package, clientas: Users, rentabilidad: Sparkles, agenda: CalendarDays, gustos: Coffee, tendencias: Flame };
const PERIODOS: { id: Periodo; texto: string }[] = [{ id: 'day', texto: 'Hoy' }, { id: 'week', texto: 'Esta semana' }, { id: 'month', texto: 'Este mes' }];
/** La agenda se pide por día: "day" = hoy, cualquier otro = mañana (así lo entiende el servidor) */
const DIAS_AGENDA: { id: Periodo; texto: string }[] = [{ id: 'day', texto: 'Hoy' }, { id: 'week', texto: 'Mañana' }];
/** Qué selector de período lleva cada informe */
const PERIODOS_DE: Record<Tipo, { id: Periodo; texto: string }[]> = {
  resumen: PERIODOS, clientas: PERIODOS, rentabilidad: PERIODOS, agenda: DIAS_AGENDA, inventario: [], gustos: [], tendencias: PERIODOS,
};
interface Gusto { id: string; valor: string; categoria: string; clientas: number; activas: number; producto: { id: string; nombre: string } | null; sugerencia: { id: string; name: string } | null }
const FRECUENCIAS: { id: Frecuencia; texto: string }[] = [
  { id: 'diaria', texto: 'Todos los días' }, { id: 'semanal', texto: 'Cada semana' }, { id: 'mensual', texto: 'Cada mes' }, { id: 'nunca', texto: 'No enviar' },
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const CANALES: { id: Canal; texto: string; Icono: React.FC<{ className?: string }> }[] = [
  { id: 'app', texto: 'App y teléfono', Icono: Bell }, { id: 'correo', texto: 'Correo', Icono: Mail }, { id: 'whatsapp', texto: 'WhatsApp', Icono: MessageCircle },
];
const aHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const aMinutos = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const cuando = (p: Preferencia) => p.frecuencia === 'nunca' || !p.activo ? 'No se envía'
  : `${p.frecuencia === 'diaria' ? 'Cada día' : p.frecuencia === 'semanal' ? `Cada ${DIAS[p.diaSemana ?? 1]}` : `El día ${p.diaMes ?? 1} de cada mes`}, ${hora12(aHHMM(p.minuto))}`;

/** Un informe, pintado igual que llega por WhatsApp pero con aire */
const VistaInforme: React.FC<{ informe: Informe; pensando?: boolean }> = ({ informe, pensando }) => (
  <div className="space-y-3">
    <p className="text-[11px] text-slate-500">{informe.periodo}{informe.sede ? ` · ${informe.sede}` : ''}</p>
    {(informe.nota || pensando) && (
      <section className="rounded-2xl bg-[var(--primary)]/10 p-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] mb-1">Lo que Lalan notó</h4>
        {informe.nota
          ? <p className="text-[12px] leading-relaxed text-slate-700 dark:text-neutral-200">{informe.nota}</p>
          : <p className="text-[12px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Pensando…</p>}
      </section>
    )}
    {informe.secciones.filter(s => s.lineas.length || s.vacio).map(s => (
      <section key={s.id} className="rounded-2xl border border-slate-200/80 dark:border-neutral-800 p-3">
        <h4 className="text-xs font-bold mb-1.5">{s.emoji} {s.titulo}</h4>
        {s.lineas.length
          ? <ul className="space-y-1 text-[12px] text-slate-700 dark:text-neutral-300">{s.lineas.map((l, i) => <li key={i} className="tabular-nums">{l}</li>)}</ul>
          : <p className="text-[12px] text-slate-400 italic">{s.vacio}</p>}
      </section>
    ))}
  </div>
);

/**
 * "De Lalan": los informes que Lalan prepara sola. Se ven aquí cuando llegan,
 * se pueden pedir en cualquier momento y se decide cuándo y por dónde llegan.
 */
export const InformesDeLalan: React.FC = () => {
  const { showToast } = useApp();
  const { currentUser } = useAuth();
  const esDireccion = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [prefs, setPrefs] = useState<Preferencia[] | null>(null);
  const [tieneWhatsapp, setTieneWhatsapp] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [abierto, setAbierto] = useState<{ tipo: Tipo; informe?: Informe; desdeAviso?: boolean } | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('week');
  const [sede, setSede] = useState('');
  const [cargando, setCargando] = useState(false);
  const [programando, setProgramando] = useState(false);
  const [enviando, setEnviando] = useState<Canal | null>(null);
  const [bajando, setBajando] = useState(false);
  const [pensando, setPensando] = useState(false);
  /** Excel: una hoja por sección, con el nombre y el detalle en columnas */
  const bajarExcel = async () => {
    const inf = abierto?.informe;
    if (!inf) return;
    const XLSX = await import('xlsx');
    const libro = XLSX.utils.book_new();
    for (const sec of inf.secciones) {
      const filas = sec.lineas.map(l => { const [nombre, ...resto] = l.split(' — '); return { [sec.titulo]: nombre, Detalle: resto.join(' — ') }; });
      if (!filas.length) continue;
      XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), sec.titulo.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Hoja');
    }
    if (!libro.SheetNames.length) { showToast('Nada que exportar', 'Este informe no tiene filas.', 'info'); return; }
    XLSX.writeFile(libro, `${inf.titulo} ${inf.periodo}.xlsx`);
  };
  const [enlazando, setEnlazando] = useState<{ gustos: Gusto[]; productos: { id: string; name: string }[] } | null>(null);
  const abrirEnlaces = async () => {
    try { setEnlazando(await api.get('/informes-lalan/gustos')); }
    catch (e) { showToast('No se pudo cargar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };
  const enlazar = async (g: Gusto, productId: string | null) => {
    try {
      await api.put(`/informes-lalan/gustos/${g.id}`, { productId });
      setEnlazando(await api.get('/informes-lalan/gustos'));
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };
  const bajarPdf = async () => {
    if (!abierto?.informe) return;
    setBajando(true);
    try { await descargarArchivo(`/informes-lalan/pdf/${abierto.tipo}?periodo=${periodo}${sede ? `&sede=${sede}` : ''}`, `${abierto.informe.titulo} ${abierto.informe.periodo}.pdf`); }
    catch (e) { showToast('No se pudo descargar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setBajando(false); }
  };

  const cargar = useCallback(async () => {
    const [p, a] = await Promise.all([
      api.get<{ informes: Preferencia[]; tieneWhatsapp: boolean }>('/informes-lalan/preferencias'),
      api.get<{ avisos: Aviso[]; sinLeer: number }>('/informes-lalan/avisos'),
    ]);
    setPrefs(p.informes); setTieneWhatsapp(p.tieneWhatsapp); setAvisos(a.avisos); setSinLeer(a.sinLeer);
  }, []);
  useEffect(() => {
    if (!esDireccion) return;
    void cargar().catch(() => setPrefs([]));
    api.get<Sede[]>('/users/sedes').then(setSedes).catch(() => undefined);
  }, [cargar, esDireccion]);

  const ver = useCallback(async (tipo: Tipo, p: Periodo = periodo, s: string = sede) => {
    setAbierto({ tipo }); setCargando(true);
    try {
      const q = `?periodo=${p}${s ? `&sede=${s}` : ''}`;
      const r = await api.get<{ informe: Informe }>(`/informes-lalan/ver/${tipo}${q}`);
      setAbierto({ tipo, informe: r.informe });
      // La nota de Lalan llega después, para no hacer esperar el informe
      if (r.informe.hayAlgo) {
        setPensando(true);
        api.get<{ nota: string | null }>(`/informes-lalan/nota/${tipo}${q}`)
          .then(n => setAbierto(a => a && a.tipo === tipo && a.informe ? { ...a, informe: { ...a.informe, nota: n.nota } } : a))
          .catch(() => undefined)
          .finally(() => setPensando(false));
      }
    } catch (e) { showToast('No se pudo preparar el informe', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); setAbierto(null); }
    finally { setCargando(false); }
  }, [periodo, sede, showToast]);

  const abrirAviso = (a: Aviso) => {
    setAbierto({ tipo: a.tipo, informe: a.informe, desdeAviso: true });
    if (!a.leidoEn) {
      void api.post(`/informes-lalan/avisos/${a.id}/leido`, {}).catch(() => undefined);
      setAvisos(l => l.map(x => x.id === a.id ? { ...x, leidoEn: new Date().toISOString() } : x));
      setSinLeer(n => Math.max(0, n - 1));
    }
  };

  const mandar = async (canal: Canal) => {
    if (!abierto) return;
    setEnviando(canal);
    try {
      const r = await api.post<Partial<Record<Canal, string>>>(`/informes-lalan/enviar/${abierto.tipo}${sede ? `?sede=${sede}` : ''}`, { canales: [canal], periodo });
      const res = r[canal];
      if (res === 'enviado') showToast('Enviado', canal === 'correo' ? 'Revisa tu correo.' : canal === 'whatsapp' ? 'Te llegó por WhatsApp.' : 'Guardado en tu bandeja.', 'success');
      else if (res === 'omitido') showToast('No se envió por WhatsApp', 'Para que sea gratis, escríbele primero a Lalan desde tu WhatsApp (por ejemplo "hola"). Luego vuelve a tocar aquí.', 'info');
      else showToast('No se pudo enviar', res || 'Inténtalo de nuevo.', 'warning');
      if (canal === 'app') void cargar();
    } catch (e) { showToast('No se pudo enviar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setEnviando(null); }
  };

  const guardar = async (p: Preferencia, cambio: Partial<Preferencia>) => {
    const n = { ...p, ...cambio };
    setPrefs(l => l?.map(x => x.id === p.id ? n : x) ?? l);
    try {
      const r = await api.put<{ informes: Preferencia[] }>(`/informes-lalan/preferencias/${p.id}`, {
        frecuencia: n.frecuencia, diaSemana: n.diaSemana, diaMes: n.diaMes, minuto: n.minuto, canales: n.canales, plantillaSiCerrada: n.plantillaSiCerrada, activo: n.activo,
      });
      setPrefs(r.informes);
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); void cargar(); }
  };

  if (!esDireccion) return null;
  if (!prefs) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;
  const disponibles = prefs.filter(p => p.incluido);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[var(--primary)]" /> Informes de Lalan</h3>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">Te llegan solos. También puedes verlos cuando quieras.</p>
        </div>
        <button type="button" onClick={() => setProgramando(true)} className="text-[11px] font-bold flex items-center gap-1 text-[var(--primary)] cursor-pointer">
          <Settings2 className="w-3.5 h-3.5" /> Cuándo y por dónde
        </button>
      </div>

      {avisos.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-slate-100 dark:divide-neutral-800">
          <div className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            Te llegaron {sinLeer > 0 && <span className="px-1.5 rounded-full bg-[var(--primary)] text-white text-[10px]">{sinLeer} nuevos</span>}
          </div>
          {avisos.slice(0, 5).map(a => {
            const Icono = ICONO[a.tipo] ?? Sparkles;
            return (
              <button key={a.id} type="button" onClick={() => abrirAviso(a)} className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer">
                <Icono className={`w-4 h-4 mt-0.5 shrink-0 ${a.leidoEn ? 'text-slate-400' : 'text-[var(--primary)]'}`} />
                <span className="flex-1 min-w-0">
                  <span className={`block text-[12px] truncate ${a.leidoEn ? '' : 'font-bold'}`}>{a.titulo}</span>
                  <span className="block text-[11px] text-slate-500 truncate">{a.resumen}</span>
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">{new Date(a.creadoEn).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {disponibles.map(p => {
          const Icono = ICONO[p.id] ?? Sparkles;
          return (
            <button key={p.id} type="button" onClick={() => void ver(p.id)} className="text-left rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-[var(--primary)] transition cursor-pointer flex flex-col gap-2">
              <span className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><Icono className="w-5 h-5" /></span>
              <span className="text-sm font-bold">{p.nombre}</span>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400 flex-1">{p.descripcion}</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {cuando(p)}</span>
            </button>
          );
        })}
      </div>

      {/* Ver un informe */}
      <IOSModal isOpen={!!abierto} onClose={() => setAbierto(null)} title={prefs.find(p => p.id === abierto?.tipo)?.nombre ?? 'Informe'} subtitle={abierto?.desdeAviso ? 'Como te llegó' : 'Al momento'}>
        <div className="space-y-3 p-1">
          {!abierto?.desdeAviso && (
            <div className="flex flex-wrap gap-2">
              {abierto && PERIODOS_DE[abierto.tipo].map(p => (
                <button key={p.id} type="button" onClick={() => { setPeriodo(p.id); if (abierto) void ver(abierto.tipo, p.id); }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer ${periodo === p.id ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 dark:bg-neutral-800'}`}>{p.texto}</button>
              ))}
              {sedes.length > 1 && (
                <select value={sede} onChange={e => { setSede(e.target.value); if (abierto) void ver(abierto.tipo, periodo, e.target.value); }}
                  className="px-2 py-1.5 rounded-full text-[11px] bg-slate-100 dark:bg-neutral-800 border-0">
                  <option value="">Todas las sedes</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>
          )}
          {cargando || !abierto?.informe
            ? <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Preparando…</div>
            : <VistaInforme informe={abierto.informe} pensando={pensando && !abierto.informe.nota} />}
          {abierto?.tipo === 'gustos' && (
            <button type="button" onClick={() => void abrirEnlaces()} className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-[var(--primary)] text-[var(--primary)] text-sm font-bold cursor-pointer">
              <Link2 className="w-4 h-4" /> Enlazar gustos con mis productos
            </button>
          )}
          {abierto?.informe && !abierto.desdeAviso && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" disabled={bajando} onClick={() => void bajarPdf()}
                className="w-full mb-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {bajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Descargar en PDF
              </button>
              <button type="button" onClick={() => void bajarExcel()} className="w-full mb-1 min-h-[40px] flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[12px] font-bold cursor-pointer">
                <FileDown className="w-4 h-4" /> Descargar en Excel
              </button>
              <span className="text-[11px] text-slate-500 w-full">Mándamelo:</span>
              {CANALES.filter(c => c.id !== 'app' && (c.id !== 'whatsapp' || tieneWhatsapp)).map(c => (
                <button key={c.id} type="button" disabled={!!enviando} onClick={() => void mandar(c.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[12px] font-bold disabled:opacity-50 cursor-pointer">
                  {enviando === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <c.Icono className="w-3.5 h-3.5" />} {c.texto}
                </button>
              ))}
            </div>
          )}
        </div>
      </IOSModal>

      {/* Enlazar cada gusto con el producto que lo cumple */}
      <IOSModal isOpen={!!enlazando} onClose={() => { setEnlazando(null); if (abierto?.tipo === 'gustos') void ver('gustos'); }} title="Gustos y productos" subtitle="¿Con qué producto cumples cada gusto?">
        <div className="space-y-2 p-1">
          <p className="text-[11px] text-slate-500 leading-relaxed">Lo que no tenga producto aparece en "Te lo piden y no lo tienes". Si lo empiezas a vender, créalo en el catálogo y enlázalo aquí.</p>
          {enlazando?.gustos.length === 0 && <p className="text-[12px] text-slate-500">Todavía no hay gustos de bebida o comida guardados. Lalan los va anotando en las conversaciones.</p>}
          {enlazando?.gustos.map(g => (
            <div key={g.id} className="rounded-xl border border-slate-200 dark:border-neutral-800 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <b>{g.valor}</b><span className="text-slate-500">{g.clientas} {g.clientas === 1 ? 'clienta' : 'clientas'} · {g.categoria}</span>
              </div>
              <select value={g.producto?.id ?? ''} onChange={e => void enlazar(g, e.target.value || null)} className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px]">
                <option value="">No lo tengo</option>
                {enlazando.productos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {!g.producto && g.sugerencia && (
                <button type="button" onClick={() => void enlazar(g, g.sugerencia!.id)} className="text-[11px] font-bold text-[var(--primary)] cursor-pointer">
                  ¿Es «{g.sugerencia.name}»? Enlazar
                </button>
              )}
            </div>
          ))}
        </div>
      </IOSModal>

      {/* Cuándo y por dónde */}
      <IOSModal isOpen={programando} onClose={() => setProgramando(false)} title="Lo que Lalan te avisa" subtitle="Cuándo y por dónde te llega cada informe">
        <div className="space-y-3 p-1">
          <ActivarNotificaciones />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            En la app y por correo es gratis. Por WhatsApp también lo es si le escribiste a Lalan en las últimas 24 horas; si no, WhatsApp cobra por iniciar la conversación, así que solo se usa si lo activas abajo.
          </p>
          {disponibles.map(p => (
            <section key={p.id} className="rounded-2xl border border-slate-200/80 dark:border-neutral-800 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <b className="text-[13px]">{p.nombre}</b>
                <select value={p.activo ? p.frecuencia : 'nunca'} onChange={e => void guardar(p, { frecuencia: e.target.value as Frecuencia, activo: e.target.value !== 'nunca' })}
                  className="px-2 py-1 rounded-lg text-[11px] bg-slate-100 dark:bg-neutral-800 border-0">
                  {FRECUENCIAS.map(f => <option key={f.id} value={f.id}>{f.texto}</option>)}
                </select>
              </div>
              {p.activo && p.frecuencia !== 'nunca' && (<>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {p.frecuencia === 'semanal' && (
                    <select value={p.diaSemana ?? 1} onChange={e => void guardar(p, { diaSemana: Number(e.target.value) })} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 border-0">
                      {DIAS.map((d, i) => <option key={d} value={i}>Los {d}</option>)}
                    </select>
                  )}
                  {p.frecuencia === 'mensual' && (
                    <select value={p.diaMes ?? 1} onChange={e => void guardar(p, { diaMes: Number(e.target.value) })} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 border-0">
                      {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>El día {i + 1}</option>)}
                    </select>
                  )}
                  <SelectorHora value={aHHMM(p.minuto)} paso={30} onChange={v => void guardar(p, { minuto: aMinutos(v) })} />
                  {p.soloSiHayAlgo && <span className="text-slate-400">Solo si hay algo que atender</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {CANALES.filter(c => c.id !== 'whatsapp' || tieneWhatsapp).map(c => {
                    const on = p.canales.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => void guardar(p, { canales: on ? p.canales.filter(x => x !== c.id) : [...p.canales, c.id] })}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${on ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}>
                        <c.Icono className="w-3.5 h-3.5" /> {c.texto}
                      </button>
                    );
                  })}
                </div>
                {p.canales.includes('whatsapp') && (
                  <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-neutral-300">
                    <input type="checkbox" className="mt-0.5" checked={p.plantillaSiCerrada} onChange={e => void guardar(p, { plantillaSiCerrada: e.target.checked })} />
                    <span>Si no le he escrito a Lalan en 24 horas, mandármelo igual por WhatsApp. <b>Tiene costo de WhatsApp</b> por cada envío.</span>
                  </label>
                )}
              </>)}
            </section>
          ))}
          {!tieneWhatsapp && <p className="text-[11px] text-slate-400">Para recibirlos por WhatsApp, pon tu número en Lalan en los chats → Aviso a la dueña.</p>}
        </div>
      </IOSModal>
    </div>
  );
};

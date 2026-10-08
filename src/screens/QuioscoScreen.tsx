import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowBigUp, Check, ChevronLeft, Clock, Coffee, Delete, Heart, Loader2, Pencil, Plus, Printer, RotateCcw, Sparkles, X } from 'lucide-react';
import QRCode from 'qrcode';
import { ErrorPublico } from '../services/api';
import { Busqueda, InicioQuiosco, ResultadoLlegada, quioscoApi, tokenQuiosco, urlAprobarQuiosco } from '../services/quiosco';
import { recordarPantalla } from '../utils/pantallaRecordada';

/**
 * El quiosco de la entrada: una tablet (o pantalla táctil) donde la clienta
 * que llega sin cita se anota sola. Teléfono → la reconoce (o le pide el
 * nombre) → servicios → con quién → sus gustos → algo de tomar → turno.
 * Al terminar pasa a la pizarra en espera, con su especialista y su comanda.
 *
 * Sin sesión: se vincula con un código que da alguien del salón y guarda un
 * token que solo sirve para esto. Si nadie la toca un minuto, vuelve sola al
 * inicio: lo que escribió una clienta no se queda a la vista de la siguiente.
 */

type Paso = 'inicio' | 'telefono' | 'nombre' | 'cita' | 'servicios' | 'especialista' | 'gustos' | 'menu' | 'enviando' | 'final';

const INACTIVIDAD_MS = 60_000;
/** Los últimos segundos antes de volver al inicio: se avisan con un círculo y "Necesito más tiempo" */
const AVISO_MS = 10_000;
const FINAL_MS = 14_000;
const MAXIMO_SERVICIOS = 4;
const MAXIMO_MENU = 2;
/** El resorte de los pasos: entra con decisión y se asienta sin rebotar */
const RESORTE = { type: 'spring', stiffness: 260, damping: 30 } as const;

const telefonoBonito = (d: string) => {
  const x = d.slice(0, 10);
  if (x.length <= 3) return x;
  if (x.length <= 6) return `(${x.slice(0, 3)}) ${x.slice(3)}`;
  return `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}`;
};

export const QuioscoScreen: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => tokenQuiosco.leer());

  useEffect(() => { recordarPantalla('quiosco', 'tablet'); }, []);

  return (
    <div className="fixed inset-0 overflow-clip print:hidden bg-[#fbf7f8] dark:bg-[#0c0a0b] text-slate-900 dark:text-white select-none">
      <Fondo />
      {token
        ? <Recepcion onDesvincular={() => { tokenQuiosco.borrar(); setToken(null); }} />
        : <Vincular onListo={(t) => { tokenQuiosco.guardar(t); setToken(t); }} />}
    </div>
  );
};

/** Manchas de color que se mueven despacio: el quiosco se ve vivo aunque nadie lo toque */
const Fondo: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none" aria-hidden>
    {[
      { c: 'bg-[var(--primary)]/25', t: 'top-[-10%] left-[-10%] w-[55vw] h-[55vw]', x: [0, 60, 0], y: [0, 40, 0], d: 22 },
      { c: 'bg-rose-300/30 dark:bg-rose-500/15', t: 'bottom-[-15%] right-[-10%] w-[60vw] h-[60vw]', x: [0, -50, 0], y: [0, -30, 0], d: 26 },
      { c: 'bg-amber-200/30 dark:bg-amber-500/10', t: 'top-[30%] right-[20%] w-[35vw] h-[35vw]', x: [0, 30, 0], y: [0, 50, 0], d: 30 },
    ].map((m, i) => (
      <motion.div key={i} className={`absolute rounded-full blur-3xl ${m.c} ${m.t}`}
        animate={{ x: m.x, y: m.y }} transition={{ duration: m.d, repeat: Infinity, ease: 'easeInOut' }} />
    ))}
  </div>
);

// ═════════════════════════════════════════════════════════════════════
//  VINCULAR: la primera vez, alguien del salón activa la tablet
// ═════════════════════════════════════════════════════════════════════

const Vincular: React.FC<{ onListo: (token: string) => void }> = ({ onListo }) => {
  const [solicitud, setSolicitud] = useState<{ codigo: string; secreto: string; expira: string } | null>(null);
  const [qr, setQr] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Pide su código (y lo renueva al vencer)
  useEffect(() => {
    let vivo = true;
    let renovar: number | undefined;
    const pedir = async () => {
      try {
        const s = await quioscoApi.solicitar();
        if (!vivo) return;
        setSolicitud(s);
        setQr(await QRCode.toDataURL(urlAprobarQuiosco(s.codigo), { margin: 1, width: 320, errorCorrectionLevel: 'M' }));
        renovar = window.setTimeout(pedir, Math.max(new Date(s.expira).getTime() - Date.now() - 5_000, 30_000));
      } catch (e) {
        if (vivo) { setError((e as Error).message); renovar = window.setTimeout(pedir, 15_000); }
      }
    };
    void pedir();
    return () => { vivo = false; window.clearTimeout(renovar); };
  }, []);

  // ¿Ya lo aprobaron desde el teléfono?
  useEffect(() => {
    if (!solicitud) return;
    const t = window.setInterval(async () => {
      try {
        const r = await quioscoApi.recoger(solicitud.codigo, solicitud.secreto);
        if (r.listo) { window.clearInterval(t); onListo(r.token); }
      } catch { /* venció: el efecto de arriba pide otro */ }
    }, 3_000);
    return () => window.clearInterval(t);
  }, [solicitud, onListo]);

  const vincular = async (c: string) => {
    setEnviando(true); setError('');
    try { onListo((await quioscoApi.vincular(c)).token); }
    catch (e) { setError((e as Error).message); setCodigo(''); }
    finally { setEnviando(false); }
  };

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center gap-10 p-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-[var(--primary)] text-white flex items-center justify-center shadow-lg"><Sparkles className="w-8 h-8" /></div>
          <h1 className="text-4xl font-extrabold tracking-tight">Activar el quiosco</h1>
          <p className="text-lg text-slate-500 dark:text-neutral-400">Para que tus clientas se anoten solas al llegar.</p>
        </div>
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
          <div className="rounded-[2rem] bg-white/80 dark:bg-neutral-900/80 backdrop-blur p-7 text-center space-y-4 shadow-sm">
            <h2 className="text-xl font-bold">Con el teléfono del salón</h2>
            <p className="text-slate-500 dark:text-neutral-400">Escanea este código con la cámara del teléfono donde tienes Lalan abierta.</p>
            <div className="mx-auto w-56 h-56 rounded-2xl bg-white p-3 flex items-center justify-center">
              {qr ? <img src={qr} alt="Código QR para activar el quiosco" className="w-full h-full" /> : <Loader2 className="w-8 h-8 animate-spin text-slate-300" />}
            </div>
            {solicitud && <p className="text-sm text-slate-500">o en Ajustes → Quiosco escribe <span className="font-mono font-bold text-lg tracking-[0.3em] text-slate-900 dark:text-white">{solicitud.codigo}</span></p>}
          </div>
          <div className="rounded-[2rem] bg-white/80 dark:bg-neutral-900/80 backdrop-blur p-7 text-center space-y-4 shadow-sm">
            <h2 className="text-xl font-bold">Con un código</h2>
            <p className="text-slate-500 dark:text-neutral-400">En Ajustes → Quiosco toca «Activar un quiosco» y escribe aquí el código.</p>
            <div className="flex justify-center gap-2" aria-label="Código de 6 cifras">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold ${codigo[i] ? 'border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700'}`}>{codigo[i] ?? ''}</div>
              ))}
            </div>
            <Teclado chico onTecla={(d) => {
              if (enviando) return;
              const nuevo = (codigo + d).slice(0, 6);
              setCodigo(nuevo);
              if (nuevo.length === 6) void vincular(nuevo);
            }} onBorrar={() => setCodigo((c) => c.slice(0, -1))} />
          </div>
        </div>
        {(error || enviando) && <p className={`text-center ${error ? 'text-rose-600' : 'text-slate-500'}`}>{enviando ? 'Activando…' : error}</p>}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
//  RECEPCIÓN: el quiosco en uso
// ═════════════════════════════════════════════════════════════════════

interface Respuestas {
  telefono: string;
  nombre: string;
  conocida: Busqueda | null;
  conCita: boolean;
  servicios: string[];
  especialista: string | null;
  gustos: string[];
  /** Lo que escribió porque no estaba en la lista */
  gustosNuevos: { tipo: string; valor: string }[];
  menu: string[];
}
const VACIO: Respuestas = { telefono: '', nombre: '', conocida: null, conCita: false, servicios: [], especialista: null, gustos: [], gustosNuevos: [], menu: [] };

const Recepcion: React.FC<{ onDesvincular: () => void }> = ({ onDesvincular }) => {
  const [datos, setDatos] = useState<InicioQuiosco | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [paso, setPaso] = useState<Paso>('inicio');
  const [historial, setHistorial] = useState<Paso[]>([]);
  const [dir, setDir] = useState(1);
  const [r, setR] = useState<Respuestas>(VACIO);
  const [gustoIdx, setGustoIdx] = useState(0);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLlegada | null>(null);
  const [cerrar, setCerrar] = useState(false);

  const cargar = useCallback(async () => {
    try { setDatos(await quioscoApi.inicio()); setErrorCarga(''); }
    catch (e) {
      if (e instanceof ErrorPublico && (e.status === 401 || e.status === 403)) { onDesvincular(); return; }
      setErrorCarga((e as Error).message);
    }
  }, [onDesvincular]);
  // El catálogo y quién atiende cambian durante el día: se refresca cada 5 min
  useEffect(() => { void cargar(); const t = window.setInterval(cargar, 5 * 60_000); return () => window.clearInterval(t); }, [cargar]);

  const reiniciar = useCallback(() => {
    setR(VACIO); setPaso('inicio'); setHistorial([]); setDir(-1); setError(''); setResultado(null); setGustoIdx(0);
  }, []);

  // Si nadie toca la pantalla un rato, vuelve al inicio (y borra lo escrito).
  // Los últimos 10 segundos se avisan con un círculo que cuenta hacia atrás
  const ultimoToque = useRef(Date.now());
  const [ahora, setAhora] = useState(Date.now());
  const conCuenta = paso !== 'inicio' && paso !== 'enviando' && paso !== 'final';
  useEffect(() => {
    const tocar = () => { ultimoToque.current = Date.now(); setAhora(Date.now()); };
    window.addEventListener('pointerdown', tocar);
    window.addEventListener('keydown', tocar);
    const t = window.setInterval(() => setAhora(Date.now()), 250);
    return () => { window.removeEventListener('pointerdown', tocar); window.removeEventListener('keydown', tocar); window.clearInterval(t); };
  }, []);
  // Cada paso nuevo empieza con el minuto completo
  useEffect(() => { ultimoToque.current = Date.now(); }, [paso, gustoIdx]);
  const restante = INACTIVIDAD_MS - (ahora - ultimoToque.current);
  useEffect(() => { if (conCuenta && restante <= 0) reiniciar(); }, [conCuenta, restante, reiniciar]);

  // ── Navegación ──
  const ir = (p: Paso) => { setError(''); setDir(1); setHistorial((h) => [...h, paso]); setPaso(p); };
  const atras = () => {
    setError(''); setDir(-1);
    if (paso === 'gustos' && gustoIdx > 0) { setGustoIdx((i) => i - 1); return; }
    const previo = historial[historial.length - 1];
    if (!previo) return;
    setHistorial((h) => h.slice(0, -1));
    setPaso(previo);
  };

  const categoriaElegida = useMemo(
    () => datos?.servicios.find((s) => s.id === r.servicios[0])?.categoria ?? null,
    [datos, r.servicios],
  );
  const especialistasPosibles = useMemo(
    () => (datos?.especialistas ?? []).filter((e) => !categoriaElegida || !e.categorias || e.categorias.includes(categoriaElegida)),
    [datos, categoriaElegida],
  );

  /** Lo que sigue después de elegir servicios (se saltan los pasos sin nada que elegir) */
  const despuesDeServicios = (): Paso => (especialistasPosibles.length > 1 ? 'especialista' : despuesDeEspecialista());
  const despuesDeEspecialista = (): Paso => ((datos?.gustos.length ?? 0) > 0 ? 'gustos' : despuesDeGustos());
  const despuesDeGustos = (): Paso => ((datos?.menu.length ?? 0) > 0 ? 'menu' : 'enviando');

  // ── Acciones ──
  const buscar = async () => {
    setBuscando(true); setError('');
    try {
      const b = await quioscoApi.buscar(r.telefono);
      setR((x) => ({ ...x, conocida: b, gustos: b.encontrada ? b.gustoIds : x.gustos }));
      if (!b.encontrada) ir('nombre');
      else if (b.turno) { setResultado({ turno: b.turno, nombre: b.nombre, especialista: null, zona: null, antes: 0, nueva: false, yaEstaba: true }); ir('final'); }
      else if (b.cita) ir('cita');
      else ir('servicios');
    } catch (e) { setError((e as Error).message); }
    finally { setBuscando(false); }
  };

  const enviar = useCallback(async (resp: Respuestas) => {
    setError('');
    try {
      const res = await quioscoApi.llegada({
        telefono: resp.telefono, nombre: resp.nombre || undefined, conCita: resp.conCita,
        servicioIds: resp.conCita ? [] : resp.servicios, especialistaId: resp.especialista,
        gustoIds: resp.gustos, productoIds: resp.menu, gustosNuevos: resp.gustosNuevos,
      });
      setResultado(res);
      setDir(1); setPaso('final');
    } catch (e) {
      setError((e as Error).message);
      setDir(-1); setPaso(historial[historial.length - 1] ?? 'inicio');
    }
  }, [historial]);

  useEffect(() => { if (paso === 'enviando') void enviar(r); }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  // El turno se queda a la vista unos segundos y vuelve al inicio
  useEffect(() => {
    if (paso !== 'final') return;
    const t = window.setTimeout(reiniciar, FINAL_MS);
    return () => window.clearTimeout(t);
  }, [paso, reiniciar]);

  const nombrePila = r.conocida?.encontrada ? r.conocida.nombre : r.nombre.split(' ')[0];
  const pasosVisibles: Paso[] = ['telefono', 'servicios', 'gustos', 'final'];
  const progreso = paso === 'nombre' || paso === 'cita' ? 0 : paso === 'especialista' ? 1 : paso === 'menu' || paso === 'enviando' ? 2 : pasosVisibles.indexOf(paso);

  if (!datos) {
    return (
      <div className="relative h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        {errorCarga ? (
          <>
            <p className="text-xl text-slate-500">{errorCarga}</p>
            <button type="button" onClick={() => void cargar()} className="px-6 py-3 rounded-2xl bg-[var(--primary)] text-white font-bold text-lg">Reintentar</button>
          </>
        ) : <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin" />}
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Arriba: volver, avance y el salón (mantener pulsado el nombre para desvincular) */}
      <header className="shrink-0 flex items-center gap-4 px-6 sm:px-10 pt-6 pb-2 h-20">
        <div className="w-28">
          {paso !== 'inicio' && paso !== 'final' && paso !== 'enviando' && historial.length > 0 && (
            <button type="button" onClick={atras} className="flex items-center gap-1 text-lg font-semibold text-slate-500 dark:text-neutral-400 active:scale-95 transition-transform cursor-pointer">
              <ChevronLeft className="w-6 h-6" /> Atrás
            </button>
          )}
        </div>
        <div className="flex-1 flex justify-center">
          {paso !== 'inicio' && paso !== 'final' && (
            <div className="flex gap-2" aria-hidden>
              {pasosVisibles.slice(0, -1).map((_, i) => (
                <motion.div key={i} className="h-2 rounded-full bg-[var(--primary)]" animate={{ width: i === progreso ? 40 : 10, opacity: i <= progreso ? 1 : 0.25 }} transition={RESORTE} />
              ))}
            </div>
          )}
        </div>
        <div className="w-28 sm:w-56 flex justify-end">
          {paso !== 'inicio' && paso !== 'final' && paso !== 'enviando' && (
            <button type="button" onClick={reiniciar}
              className="inline-flex items-center gap-2 px-4 h-11 rounded-full bg-white/80 dark:bg-neutral-800/80 text-slate-600 dark:text-neutral-300 font-semibold shadow-sm active:scale-95 transition-transform cursor-pointer">
              <RotateCcw className="w-5 h-5" /><span className="hidden sm:inline">Empezar de nuevo</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 relative overflow-clip">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={paso === 'gustos' ? `gustos-${gustoIdx}` : paso}
            custom={dir}
            variants={{
              entra: (d: number) => ({ opacity: 0, x: d * 60, scale: 0.98 }),
              quieto: { opacity: 1, x: 0, scale: 1 },
              sale: (d: number) => ({ opacity: 0, x: d * -60, scale: 0.98 }),
            }}
            initial="entra" animate="quieto" exit="sale"
            transition={RESORTE}
            className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          >
            <div className="min-h-full flex flex-col items-center justify-center px-6 sm:px-10 pb-10">
              {paso === 'inicio' && <Inicio datos={datos} onEmpezar={() => { pantallaCompleta(); ir('telefono'); }} onLargo={() => setCerrar(true)} />}

              {paso === 'telefono' && (
                <Pantalla titulo="¿Cuál es tu número de teléfono?" texto="Con él te reconocemos la próxima vez.">
                  <div className="text-5xl sm:text-6xl font-bold tracking-wide tabular-nums h-20 flex items-center justify-center">
                    {r.telefono ? telefonoBonito(r.telefono) : <span className="text-slate-300 dark:text-neutral-600">(809) 000-0000</span>}
                  </div>
                  <Teclado onTecla={(d) => setR((x) => ({ ...x, telefono: (x.telefono + d).slice(0, 10) }))} onBorrar={() => setR((x) => ({ ...x, telefono: x.telefono.slice(0, -1) }))} />
                  <MensajeError texto={error} />
                  <Principal disabled={r.telefono.length < 10} cargando={buscando} onClick={() => void buscar()}>Continuar</Principal>
                </Pantalla>
              )}

              {paso === 'nombre' && (
                <Pantalla titulo="¡Mucho gusto! ¿Cómo te llamas?" texto="Es tu primera vez aquí. Te anotamos en un segundo.">
                  <CampoTexto valor={r.nombre} placeholder="Nombre y apellido" />
                  <TecladoLetras valor={r.nombre} max={60} onCambio={(v) => setR((x) => ({ ...x, nombre: v }))}
                    onListo={() => { if (r.nombre.trim().length >= 2) ir('servicios'); }} />
                  <Principal disabled={r.nombre.trim().length < 2} onClick={() => ir('servicios')}>Continuar</Principal>
                </Pantalla>
              )}

              {paso === 'cita' && r.conocida?.encontrada && r.conocida.cita && (
                <Pantalla titulo={`¡Hola, ${r.conocida.nombre}!`} texto="Tienes una cita hoy:">
                  <div className="w-full max-w-xl rounded-[2rem] bg-white/80 dark:bg-neutral-900/80 backdrop-blur p-7 text-center space-y-1 shadow-sm">
                    <div className="text-5xl font-extrabold text-[var(--primary)]">{r.conocida.cita.hora}</div>
                    <div className="text-2xl font-semibold">{r.conocida.cita.servicio}</div>
                    {r.conocida.cita.especialista && <div className="text-lg text-slate-500">con {r.conocida.cita.especialista}</div>}
                  </div>
                  <div className="w-full max-w-xl grid gap-3">
                    <Principal onClick={() => { const n = { ...r, conCita: true }; setR(n); ir((datos.gustos.length ? 'gustos' : datos.menu.length ? 'menu' : 'enviando')); }}>Sí, vengo a mi cita</Principal>
                    <Secundario onClick={() => { setR((x) => ({ ...x, conCita: false })); ir('servicios'); }}>Vengo por otra cosa</Secundario>
                  </div>
                </Pantalla>
              )}

              {paso === 'servicios' && (
                <Servicios
                  datos={datos} saludo={nombrePila} elegidos={r.servicios}
                  onCambio={(ids) => setR((x) => ({ ...x, servicios: ids, especialista: null }))}
                  onSiguiente={() => ir(despuesDeServicios())}
                />
              )}

              {paso === 'especialista' && (
                <Pantalla titulo="¿Con quién te gustaría?" texto="Si te da igual, te atiende la que esté más libre.">
                  <div className="w-full max-w-4xl flex flex-wrap justify-center gap-4">
                    <Opcion activa={!r.especialista} onClick={() => setR((x) => ({ ...x, especialista: null }))}>
                      <div className="w-20 h-20 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center"><Sparkles className="w-9 h-9" /></div>
                      <div className="text-lg font-bold">La que esté libre</div>
                      <div className="text-sm text-slate-500">Más rápido</div>
                    </Opcion>
                    {especialistasPosibles.map((e) => (
                      <Opcion key={e.id} activa={r.especialista === e.id} onClick={() => setR((x) => ({ ...x, especialista: e.id }))}>
                        <Foto src={e.avatar} nombre={e.nombre} />
                        <div className="text-lg font-bold">{e.nombre.split(' ')[0]}</div>
                        <div className="text-sm text-slate-500">{e.enEspera ? `${e.enEspera} en espera` : 'Disponible'}</div>
                      </Opcion>
                    ))}
                  </div>
                  <Principal onClick={() => ir(despuesDeEspecialista())}>Continuar</Principal>
                </Pantalla>
              )}

              {paso === 'gustos' && datos.gustos[gustoIdx] && (() => {
                const g = datos.gustos[gustoIdx];
                const nuevos = r.gustosNuevos.filter((n) => n.tipo === g.tipo);
                const elegidos = g.opciones.filter((o) => r.gustos.includes(o.id)).length + nuevos.length;
                const seguir = () => {
                  if (gustoIdx < datos.gustos.length - 1) { setDir(1); setGustoIdx((i) => i + 1); }
                  else ir(despuesDeGustos());
                };
                return (
                  <Pantalla titulo={g.titulo} texto={`${gustoIdx === 0 ? 'Para consentirte como te gusta. ' : ''}Toca lo que quieras (puedes elegir varias).`} icono={g.icono}>
                    <div className="w-full max-w-4xl flex flex-wrap justify-center gap-3">
                      {g.opciones.map((o) => {
                        const activa = r.gustos.includes(o.id);
                        return (
                          <motion.button
                            key={o.id} type="button" whileTap={{ scale: 0.94 }}
                            onClick={() => setR((x) => ({ ...x, gustos: activa ? x.gustos.filter((id) => id !== o.id) : [...x.gustos, o.id] }))}
                            className={`px-6 py-4 rounded-full text-xl font-semibold border-2 transition-colors cursor-pointer flex items-center gap-2 ${
                              activa ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-md' : 'bg-white/80 dark:bg-neutral-900/80 border-transparent'
                            }`}
                          >
                            {activa && <Heart className="w-5 h-5 fill-white" />}{o.valor}
                          </motion.button>
                        );
                      })}
                      {nuevos.map((n) => (
                        <motion.button key={`n-${n.valor}`} type="button" whileTap={{ scale: 0.94 }} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          onClick={() => setR((x) => ({ ...x, gustosNuevos: x.gustosNuevos.filter((y) => !(y.tipo === n.tipo && y.valor === n.valor)) }))}
                          className="px-6 py-4 rounded-full text-xl font-semibold border-2 bg-[var(--primary)] border-[var(--primary)] text-white shadow-md flex items-center gap-2 cursor-pointer">
                          <Heart className="w-5 h-5 fill-white" />{n.valor}<X className="w-4 h-4 opacity-70" />
                        </motion.button>
                      ))}
                      <OtraOpcion
                        texto={g.tipo === 'music' ? 'Otra música' : g.tipo === 'drink' ? 'Otra bebida' : 'Otra cosa'}
                        onAgregar={(valor) => setR((x) => ({ ...x, gustosNuevos: [...x.gustosNuevos.filter((y) => !(y.tipo === g.tipo && y.valor.toLowerCase() === valor.toLowerCase())), { tipo: g.tipo, valor }] }))}
                      />
                    </div>
                    <Principal onClick={seguir}>{elegidos ? 'Continuar' : 'Saltar'}</Principal>
                  </Pantalla>
                );
              })()}

              {paso === 'menu' && (
                <Pantalla titulo="¿Te ofrecemos algo mientras esperas?"
                  texto={`Elige hasta ${MAXIMO_MENU}.${datos.menu.some((p) => !p.cortesia) ? ' Lo que no es cortesía se suma a tu cuenta.' : ''}`}>
                  <div className="w-full max-w-4xl flex flex-wrap justify-center gap-4">
                    {datos.menu.map((p) => (
                      <Opcion key={p.id} activa={r.menu.includes(p.id)} onClick={() => setR((x) => ({
                        ...x, menu: x.menu.includes(p.id) ? x.menu.filter((id) => id !== p.id) : [...x.menu, p.id].slice(-MAXIMO_MENU),
                      }))}>
                        <Coffee className="w-9 h-9 text-[var(--primary)]" />
                        <div className="text-lg font-bold leading-tight">{p.nombre}</div>
                        <div className={`text-sm ${p.cortesia ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                          {p.cortesia ? 'Cortesía de la casa' : p.precio ? `${p.precio} · se suma a tu cuenta` : 'Tiene costo · se suma a tu cuenta'}
                        </div>
                      </Opcion>
                    ))}
                  </div>
                  <Principal onClick={() => ir('enviando')}>{r.menu.length ? 'Listo' : 'No, gracias'}</Principal>
                </Pantalla>
              )}

              {paso === 'enviando' && (
                <div className="flex flex-col items-center gap-5 text-center">
                  <Loader2 className="w-14 h-14 text-[var(--primary)] animate-spin" />
                  <p className="text-2xl font-semibold">Te estamos anotando…</p>
                </div>
              )}

              {paso === 'final' && resultado && (
                <Final resultado={resultado} onListo={reiniciar} imprimir={datos.imprimir} salon={datos.salon}
                  servicios={r.conCita && r.conocida?.encontrada && r.conocida.cita ? [r.conocida.cita.servicio] : datos.servicios.filter((x) => r.servicios.includes(x.id)).map((x) => x.nombre)} />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Lo que falló al anotarla (el teléfono tiene su propio aviso) */}
      {paso !== 'telefono' && <div className="absolute bottom-8 inset-x-0 px-6 pointer-events-none"><MensajeError texto={error} /></div>}

      {/* ¿Sigue ahí? Los últimos segundos antes de volver al inicio */}
      <AnimatePresence>
        {conCuenta && restante <= AVISO_MS && restante > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-white/60 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} transition={RESORTE}
              className="w-full max-w-md rounded-[2rem] bg-white dark:bg-neutral-900 p-8 text-center space-y-5 shadow-2xl">
              <Anillo restante={restante} total={AVISO_MS} />
              <div className="space-y-1">
                <h2 className="text-3xl font-extrabold">¿Sigues ahí?</h2>
                <p className="text-lg text-slate-500">Si no, volvemos al inicio para la siguiente persona.</p>
              </div>
              <div className="grid gap-3">
                <Principal onClick={() => { ultimoToque.current = Date.now(); setAhora(Date.now()); }}><Clock className="w-6 h-6" /> Necesito más tiempo</Principal>
                <Secundario onClick={reiniciar}>Empezar de nuevo</Secundario>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desvincular: solo quien sabe que hay que mantener pulsado el nombre del salón */}
      <AnimatePresence>
        {cerrar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 p-7 space-y-4 text-center">
              <h2 className="text-2xl font-bold">¿Desactivar este quiosco?</h2>
              <p className="text-slate-500">Para volver a usarlo habrá que activarlo otra vez con un código del salón.</p>
              <div className="grid grid-cols-2 gap-3">
                <Secundario onClick={() => setCerrar(false)}>Cancelar</Secundario>
                <button type="button" onClick={onDesvincular} className="py-4 rounded-2xl bg-rose-600 text-white text-lg font-bold cursor-pointer">Desactivar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** En una tablet, pantalla completa al primer toque (el navegador solo lo permite tras un toque) */
function pantallaCompleta() {
  try {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  } catch { /* no todos los navegadores lo tienen */ }
}

// ── Pasos ──────────────────────────────────────────────────────────────

const Inicio: React.FC<{ datos: InicioQuiosco; onEmpezar: () => void; onLargo: () => void }> = ({ datos, onEmpezar, onLargo }) => {
  const pulsado = useRef<number | undefined>(undefined);
  return (
    <div className="flex flex-col items-center text-center gap-10">
      <div
        className="space-y-3"
        onPointerDown={() => { pulsado.current = window.setTimeout(onLargo, 3_000); }}
        onPointerUp={() => window.clearTimeout(pulsado.current)}
        onPointerLeave={() => window.clearTimeout(pulsado.current)}
      >
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-xl font-semibold tracking-wide uppercase text-[var(--primary)]">
          {datos.salon}
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ...RESORTE }} className="text-6xl sm:text-7xl font-extrabold tracking-tight leading-[1.05]">
          ¡Bienvenida!
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="text-2xl text-slate-500 dark:text-neutral-400">
          Anótate aquí y te atendemos enseguida.
        </motion.p>
      </div>
      <motion.button
        type="button" onClick={onEmpezar}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: [1, 1.04, 1] }}
        transition={{ opacity: { delay: 0.5 }, scale: { delay: 0.8, duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
        whileTap={{ scale: 0.95 }}
        className="px-14 py-7 rounded-full bg-[var(--primary)] text-white text-3xl font-bold shadow-2xl shadow-[var(--primary)]/30 cursor-pointer"
      >
        Registrar mi llegada
      </motion.button>
      <p className="text-slate-400">¿Tienes cita? También anótate aquí.</p>
    </div>
  );
};

const Servicios: React.FC<{
  datos: InicioQuiosco; saludo: string; elegidos: string[];
  onCambio: (ids: string[]) => void; onSiguiente: () => void;
}> = ({ datos, saludo, elegidos, onCambio, onSiguiente }) => {
  const [cat, setCat] = useState<string | null>(() => datos.servicios.find((s) => s.id === elegidos[0])?.categoria ?? datos.categorias[0]?.id ?? null);
  const lista = datos.servicios.filter((s) => !cat || s.categoria === cat);
  const alternar = (id: string) => onCambio(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id].slice(-MAXIMO_SERVICIOS));
  const seleccion = elegidos.map((id) => datos.servicios.find((s) => s.id === id)).filter(Boolean) as InicioQuiosco['servicios'];
  const conPrecio = seleccion.length > 0 && seleccion.every((s) => s.valor != null);
  const total = seleccion.reduce((a, s) => a + (s.valor ?? 0), 0);
  const minutos = seleccion.reduce((a, s) => a + (s.minutos || 0), 0);
  return (
    <Pantalla titulo={saludo ? `${saludo}, ¿qué te hacemos hoy?` : '¿Qué te hacemos hoy?'} texto="Puedes elegir más de uno.">
      {datos.categorias.length > 1 && (
        <div className="w-full max-w-5xl flex flex-wrap gap-3 justify-center">
          {datos.categorias.map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)}
              className={`relative shrink-0 px-6 py-3 rounded-full text-lg font-semibold cursor-pointer ${cat === c.id ? 'text-white' : 'bg-white/70 dark:bg-neutral-900/70'}`}>
              {cat === c.id && <motion.span layoutId="quiosco-cat" className="absolute inset-0 rounded-full bg-[var(--primary)]" transition={RESORTE} />}
              <span className="relative">{c.icono ? `${c.icono} ` : ''}{c.nombre}</span>
            </button>
          ))}
        </div>
      )}
      <div className={`w-full max-w-6xl grid gap-6 items-start ${seleccion.length ? 'lg:grid-cols-[1fr_21rem]' : ''}`}>
        <div className="flex flex-wrap justify-center gap-4">
          {lista.map((s, i) => {
            const activo = elegidos.includes(s.id);
            return (
              <motion.button
                key={s.id} type="button" onClick={() => alternar(s.id)}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RESORTE, delay: Math.min(i, 8) * 0.03 }}
                whileTap={{ scale: 0.97 }}
                className={`relative w-full sm:w-[20rem] text-left p-5 rounded-3xl border-2 transition-colors cursor-pointer ${
                  activo ? 'bg-[var(--primary)]/10 border-[var(--primary)]' : 'bg-white/80 dark:bg-neutral-900/80 border-transparent'
                }`}
              >
                <div className="pr-10 text-xl font-bold leading-tight">{s.icono ? `${s.icono} ` : ''}{s.nombre}</div>
                <div className="mt-1 text-slate-500 dark:text-neutral-400">{[s.minutos ? `${s.minutos} min` : null, s.precio].filter(Boolean).join(' · ')}</div>
                <AnimatePresence>
                  {activo && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        {/* Lo que va eligiendo, a la vista como una comanda: así no se le olvida qué marcó en otra categoría */}
        <AnimatePresence>
          {seleccion.length > 0 && (
            <motion.aside initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={RESORTE}
              className="lg:sticky lg:top-2 rounded-[2rem] bg-white/90 dark:bg-neutral-900/90 backdrop-blur p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold">Tu selección</h3>
                <span className="w-8 h-8 rounded-full bg-[var(--primary)] text-white text-lg font-bold flex items-center justify-center">{seleccion.length}</span>
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {seleccion.map((s) => (
                    <motion.li key={s.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/70">
                      <div className="flex-1 min-w-0">
                        <div className="text-lg font-bold leading-tight truncate">{s.icono ? `${s.icono} ` : ''}{s.nombre}</div>
                        {(s.precio || s.minutos) && <div className="text-sm text-slate-500">{[s.minutos ? `${s.minutos} min` : null, s.precio].filter(Boolean).join(' · ')}</div>}
                      </div>
                      <button type="button" onClick={() => alternar(s.id)} aria-label={`Quitar ${s.nombre}`}
                        className="w-10 h-10 shrink-0 rounded-full text-slate-400 hover:text-rose-500 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {(conPrecio || minutos > 0) && (
                <div className="pt-2 border-t border-slate-200 dark:border-neutral-700 flex items-center justify-between text-lg">
                  <span className="text-slate-500">{minutos ? `≈ ${minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60 ? `${minutos % 60} min` : ''}` : `${minutos} min`}` : ''}</span>
                  {conPrecio && <span className="font-extrabold">{datos.simbolo}{total.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>}
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      <Principal disabled={!elegidos.length} onClick={onSiguiente}>
        {elegidos.length ? `Continuar (${elegidos.length})` : 'Elige un servicio'}
      </Principal>
    </Pantalla>
  );
};

const Final: React.FC<{
  resultado: ResultadoLlegada; onListo: () => void;
  imprimir: InicioQuiosco['imprimir']; salon: string; servicios: string[];
}> = ({ resultado, onListo, imprimir, salon, servicios }) => {
  // "Siempre": sale solo en cuanto se ve el turno (una vez)
  useEffect(() => {
    if (imprimir !== 'siempre') return;
    const t = window.setTimeout(() => window.print(), 700);
    return () => window.clearTimeout(t);
  }, [imprimir]);
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}
        className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
        <Check className="w-11 h-11" strokeWidth={3} />
      </motion.div>
      <h1 className="text-5xl font-extrabold">
        {resultado.yaEstaba ? `${resultado.nombre}, ya estás en la lista` : `¡Listo, ${resultado.nombre}!`}
      </h1>
      <div className="space-y-1">
        <p className="text-2xl text-slate-500 dark:text-neutral-400">Tu turno es</p>
        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 14 }}
          className="text-[7rem] sm:text-[9rem] leading-none font-black tracking-tight text-[var(--primary)]">
          {resultado.turno}
        </motion.div>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-2xl max-w-2xl">
        {resultado.especialista ? <>Te atiende <b>{resultado.especialista}</b>. </> : null}
        {resultado.antes > 0
          ? `Tienes ${resultado.antes} ${resultado.antes === 1 ? 'persona' : 'personas'} antes. Toma asiento, te llamamos por la pantalla.`
          : 'Toma asiento, te llamamos en un momento por la pantalla.'}
      </motion.p>
      <div className="flex flex-wrap justify-center gap-3">
        {imprimir === 'preguntar' && (
          <Principal onClick={() => window.print()}><Printer className="w-6 h-6" /> Imprimir mi turno</Principal>
        )}
        <Secundario onClick={onListo}>Listo</Secundario>
      </div>
      {imprimir !== 'no' && <TicketImpreso resultado={resultado} salon={salon} servicios={servicios} />}
    </div>
  );
};

/**
 * El ticket que sale por la impresora del quiosco (80 mm, la de los
 * recibos). Va fuera de la pantalla (portal) para que al imprimir solo
 * salga esto. Para que imprima sin preguntar, Chrome se abre con
 * --kiosk-printing y esa impresora como predeterminada.
 */
const TicketImpreso: React.FC<{ resultado: ResultadoLlegada; salon: string; servicios: string[] }> = ({ resultado, salon, servicios }) => {
  const ahora = new Date();
  return createPortal(
    <div className="hidden print:block text-black bg-white" style={{ width: '72mm', margin: '0 auto', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <style>{'@page { size: 80mm auto; margin: 4mm; } @media print { html, body { background: #fff !important; } }'}</style>
      <div style={{ fontSize: '14pt', fontWeight: 800 }}>{salon}</div>
      <div style={{ fontSize: '10pt', marginTop: '2mm' }}>Tu turno es</div>
      <div style={{ fontSize: '46pt', fontWeight: 900, lineHeight: 1 }}>{resultado.turno}</div>
      <div style={{ fontSize: '13pt', fontWeight: 700, marginTop: '2mm' }}>{resultado.nombre}</div>
      {servicios.length > 0 && <div style={{ fontSize: '10pt', marginTop: '2mm' }}>{servicios.join(' + ')}</div>}
      {resultado.especialista && <div style={{ fontSize: '10pt' }}>Te atiende {resultado.especialista}</div>}
      <div style={{ fontSize: '9pt', marginTop: '3mm', borderTop: '1px dashed #000', paddingTop: '2mm' }}>
        {ahora.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · {ahora.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}
        <br />Te llamamos por la pantalla
      </div>
    </div>,
    document.body,
  );
};

// ── Piezas ────────────────────────────────────────────────────────────

const Pantalla: React.FC<{ titulo: string; texto?: string; icono?: string | null; children: React.ReactNode }> = ({ titulo, texto, icono, children }) => (
  <div className="w-full flex flex-col items-center gap-8 py-6">
    <div className="text-center space-y-2 max-w-3xl">
      {icono && <div className="text-5xl">{icono}</div>}
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">{titulo}</h1>
      {texto && <p className="text-xl text-slate-500 dark:text-neutral-400">{texto}</p>}
    </div>
    {children}
  </div>
);

const Principal: React.FC<{ onClick: () => void; disabled?: boolean; cargando?: boolean; children: React.ReactNode }> = ({ onClick, disabled, cargando, children }) => (
  <motion.button
    type="button" onClick={onClick} disabled={disabled || cargando} whileTap={{ scale: 0.96 }}
    className="min-w-[18rem] px-10 py-5 rounded-full bg-[var(--primary)] text-white text-2xl font-bold shadow-xl shadow-[var(--primary)]/25 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-3 cursor-pointer"
  >
    {cargando && <Loader2 className="w-6 h-6 animate-spin" />}{children}
  </motion.button>
);

const Secundario: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.96 }}
    className="min-w-[14rem] px-8 py-4 rounded-full bg-white/80 dark:bg-neutral-800/80 text-xl font-semibold cursor-pointer">
    {children}
  </motion.button>
);

const Opcion: React.FC<{ activa: boolean; onClick: () => void; children: React.ReactNode }> = ({ activa, onClick, children }) => (
  <motion.button
    type="button" onClick={onClick} whileTap={{ scale: 0.96 }}
    className={`relative w-[11.5rem] sm:w-[13rem] p-5 rounded-3xl border-2 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer ${
      activa ? 'bg-[var(--primary)]/10 border-[var(--primary)]' : 'bg-white/80 dark:bg-neutral-900/80 border-transparent'
    }`}
  >
    {children}
    {activa && <span className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--primary)] text-white flex items-center justify-center"><Check className="w-4 h-4" /></span>}
  </motion.button>
);

const MensajeError: React.FC<{ texto: string }> = ({ texto }) => (
  <AnimatePresence>
    {texto && (
      <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-lg text-rose-600 dark:text-rose-400 text-center" role="alert">
        {texto}
      </motion.p>
    )}
  </AnimatePresence>
);

/** El círculo que se vacía en los últimos segundos, con el número en el centro */
const Anillo: React.FC<{ restante: number; total: number }> = ({ restante, total }) => {
  const r = 52, c = 2 * Math.PI * r;
  const fraccion = Math.max(0, Math.min(1, restante / total));
  return (
    <div className="relative mx-auto w-36 h-36">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-neutral-800" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke="var(--primary)"
          strokeDasharray={c} strokeDashoffset={c * (1 - fraccion)} style={{ transition: 'stroke-dashoffset 250ms linear' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-5xl font-black tabular-nums text-[var(--primary)]">{Math.ceil(restante / 1000)}</div>
    </div>
  );
};

/** Donde se ve lo que escribe con el teclado de la pantalla (no abre el teclado del aparato) */
const CampoTexto: React.FC<{ valor: string; placeholder: string }> = ({ valor, placeholder }) => (
  <div className="w-full max-w-xl text-center text-4xl font-bold border-b-4 border-[var(--primary)] py-3 min-h-[4.5rem]" aria-live="polite">
    {valor ? <>{valor}<span className="inline-block w-[3px] h-9 bg-[var(--primary)] ml-1 align-middle animate-pulse" /></>
      : <span className="text-slate-300 dark:text-neutral-600">{placeholder}</span>}
  </div>
);

/** Cada palabra empieza en mayúscula, como se escribe un nombre */
const conMayusculas = (t: string) => t.replace(/(^|\s)(\S)/g, (_, a: string, b: string) => a + b.toLocaleUpperCase('es'));

/**
 * El teclado de letras, dibujado en la pantalla: en una pantalla táctil a
 * pantalla completa no hay teclado del sistema, y en una tablet el suyo
 * taparía media pantalla. Si hay un teclado físico, también se puede usar.
 */
const TecladoLetras: React.FC<{ valor: string; onCambio: (v: string) => void; onListo?: () => void; max?: number; comoNombre?: boolean }> = ({ valor, onCambio, onListo, max = 60, comoNombre = true }) => {
  const [acentos, setAcentos] = useState(false);
  // Lo escrito hasta ahora: varias teclas seguidas (un teclado físico) llegan antes de que React vuelva a pintar
  const actual = useRef(valor);
  actual.current = valor;
  const cambiar = useCallback((v: string) => { actual.current = v; onCambio(v); }, [onCambio]);
  const poner = useCallback((t: string) => {
    const v = (actual.current + t).replace(/\s{2,}/g, ' ').slice(0, max);
    cambiar(comoNombre ? conMayusculas(v) : v.charAt(0).toLocaleUpperCase('es') + v.slice(1));
  }, [cambiar, max, comoNombre]);
  const borrar = useCallback(() => cambiar(actual.current.slice(0, -1)), [cambiar]);
  // Un teclado físico (o el de una computadora) también escribe aquí. Se escucha
  // una sola vez: cada tecla repinta la pantalla (cuenta de inactividad), y un
  // escuchador cambiado a mitad de la tecla se la perdería
  const manos = useRef({ poner, borrar, onListo });
  manos.current = { poner, borrar, onListo };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') { e.preventDefault(); manos.current.borrar(); }
      else if (e.key === 'Enter') { e.preventDefault(); manos.current.onListo?.(); }
      else if (e.key.length === 1 && /[\p{L} '\-.]/u.test(e.key)) { e.preventDefault(); manos.current.poner(e.key.toLocaleLowerCase('es')); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  const filas = acentos
    ? [['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'], ['-', '.', "'"]]
    : [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']];
  const tecla = 'h-14 sm:h-16 rounded-xl bg-white/90 dark:bg-neutral-800/90 text-2xl font-semibold shadow-sm cursor-pointer active:scale-90 transition-transform';
  return (
    <div className="w-full max-w-4xl space-y-2 select-none">
      {filas.map((fila, i) => (
        <div key={i} className="flex justify-center gap-1.5 sm:gap-2">
          {fila.map((l) => (
            <button key={l} type="button" onClick={() => poner(l)} className={`${tecla} flex-1 max-w-[4.5rem]`}>
              {valor.length === 0 || (comoNombre && /\s$/.test(valor)) ? l.toLocaleUpperCase('es') : l}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-1.5 sm:gap-2">
        <button type="button" onClick={() => setAcentos((a) => !a)} className={`${tecla} w-28 text-lg ${acentos ? 'ring-2 ring-[var(--primary)]' : ''}`}>
          {acentos ? 'ABC' : 'á é ñ'}
        </button>
        <button type="button" onClick={() => poner(' ')} className={`${tecla} flex-1 max-w-md text-lg text-slate-500`}>espacio</button>
        <button type="button" onClick={borrar} aria-label="Borrar" className={`${tecla} w-28 flex items-center justify-center text-slate-500`}><Delete className="w-7 h-7" /></button>
      </div>
    </div>
  );
};

/** "Otra bebida": lo que no está en la lista, escrito con el teclado de la pantalla */
const OtraOpcion: React.FC<{ texto: string; onAgregar: (valor: string) => void }> = ({ texto, onAgregar }) => {
  const [abierta, setAbierta] = useState(false);
  const [valor, setValor] = useState('');
  const agregar = () => { const v = valor.trim(); if (v.length >= 2) { onAgregar(v); setValor(''); setAbierta(false); } };
  return (
    <>
      <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => setAbierta(true)}
        className="px-6 py-4 rounded-full text-xl font-semibold border-2 border-dashed border-[var(--primary)]/50 text-[var(--primary)] flex items-center gap-2 cursor-pointer">
        <Pencil className="w-5 h-5" /> {texto}
      </motion.button>
      {createPortal(
        <AnimatePresence>
          {abierta && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-white/70 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-6 print:hidden">
              <motion.div initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30 }} transition={RESORTE}
                className="w-full max-w-4xl rounded-[2rem] bg-white dark:bg-neutral-900 p-6 sm:p-8 space-y-5 shadow-2xl flex flex-col items-center">
                <div className="w-full flex items-center justify-between">
                  <h2 className="text-3xl font-extrabold">{texto}</h2>
                  <button type="button" onClick={() => { setAbierta(false); setValor(''); }} aria-label="Cerrar"
                    className="w-12 h-12 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer"><X className="w-6 h-6" /></button>
                </div>
                <CampoTexto valor={valor} placeholder="Escríbelo aquí" />
                <TecladoLetras valor={valor} onCambio={(v) => setValor(v.slice(0, 40))} onListo={agregar} max={40} comoNombre={false} />
                <Principal disabled={valor.trim().length < 2} onClick={agregar}><Plus className="w-6 h-6" /> Agregar</Principal>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};

/** La foto de la especialista; si no carga (o no tiene), su inicial */
const Foto: React.FC<{ src: string | null; nombre: string }> = ({ src, nombre }) => {
  const [rota, setRota] = useState(false);
  return src && !rota
    ? <img src={src} alt="" onError={() => setRota(true)} className="w-20 h-20 rounded-full object-cover" />
    : <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-3xl font-bold text-slate-500">{nombre.slice(0, 1)}</div>;
};

/** El teclado de números: grande, para el dedo */
const Teclado: React.FC<{ onTecla: (d: string) => void; onBorrar: () => void; chico?: boolean }> = ({ onTecla, onBorrar, chico }) => {
  const tam = chico ? 'h-14 text-2xl' : 'h-16 sm:h-[4.5rem] text-3xl';
  return (
    <div className={`grid grid-cols-3 gap-3 w-full ${chico ? 'max-w-xs mx-auto' : 'max-w-sm'}`}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <motion.button key={d} type="button" whileTap={{ scale: 0.9 }} onClick={() => onTecla(d)}
          className={`${tam} rounded-2xl bg-white/90 dark:bg-neutral-800/90 font-semibold shadow-sm cursor-pointer`}>{d}</motion.button>
      ))}
      <div />
      <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => onTecla('0')} className={`${tam} rounded-2xl bg-white/90 dark:bg-neutral-800/90 font-semibold shadow-sm cursor-pointer`}>0</motion.button>
      <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onBorrar} aria-label="Borrar" className={`${tam} rounded-2xl flex items-center justify-center text-slate-500 cursor-pointer`}>
        <Delete className={chico ? 'w-6 h-6' : 'w-8 h-8'} />
      </motion.button>
    </div>
  );
};


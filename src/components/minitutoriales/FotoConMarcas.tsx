import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Circle, MessageSquare, MoveUpRight, X } from 'lucide-react';
import { LIMITES, type Marca, type TipoMarca } from './tipos';

/** El dibujo va sobre un lienzo de 1000 de ancho; el alto sigue la foto */
const ANCHO = 1000;
const uno = (v: number) => Math.min(1, Math.max(0, v));

interface Dibujo { marcas: Marca[]; animar: boolean; alto: number }

/** Flechas y círculos (SVG). Las burbujas van en HTML para que el texto se lea bien */
const Trazos: React.FC<Dibujo> = ({ marcas, animar, alto }) => (
  <svg viewBox={`0 0 ${ANCHO} ${alto}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
    {marcas.map((m, i) => {
      if (m.tipo === 'circulo') {
        const cx = m.x * ANCHO, cy = m.y * alto, r = (m.r ?? 0.08) * ANCHO;
        return (
          <g key={i}>
            {animar && (
              <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--primary)" strokeWidth={6}
                initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.3, opacity: 0 }}
                style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />
            )}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeWidth={16} strokeOpacity={0.85} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--primary)" strokeWidth={9} />
          </g>
        );
      }
      if (m.tipo === 'flecha') {
        const x0 = (m.x0 ?? m.x) * ANCHO, y0 = (m.y0 ?? m.y) * alto, x = m.x * ANCHO, y = m.y * alto;
        const largo = Math.hypot(x - x0, y - y0) || 1;
        const ux = (x - x0) / largo, uy = (y - y0) / largo;
        const punta = Math.min(46, largo * 0.6), media = punta * 0.62;
        const bx = x - ux * punta, by = y - uy * punta;
        const cabeza = `${x},${y} ${bx - uy * media},${by + ux * media} ${bx + uy * media},${by - ux * media}`;
        const cuerpo = (
          <>
            <line x1={x0} y1={y0} x2={x - ux * punta * 0.5} y2={y - uy * punta * 0.5} stroke="white" strokeWidth={20} strokeLinecap="round" strokeOpacity={0.85} />
            <polygon points={cabeza} fill="white" stroke="white" strokeWidth={10} strokeLinejoin="round" strokeOpacity={0.85} />
            <line x1={x0} y1={y0} x2={x - ux * punta * 0.5} y2={y - uy * punta * 0.5} stroke="var(--primary)" strokeWidth={11} strokeLinecap="round" />
            <polygon points={cabeza} fill="var(--primary)" stroke="var(--primary)" strokeWidth={3} strokeLinejoin="round" />
          </>
        );
        // Late hacia donde apunta, suave
        return animar
          ? <motion.g key={i} animate={{ x: [0, ux * 14, 0], y: [0, uy * 14, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>{cuerpo}</motion.g>
          : <g key={i}>{cuerpo}</g>;
      }
      return null;
    })}
  </svg>
);

/** La burbuja con su piquito apuntando al lugar; si está muy arriba, se pone debajo */
const Burbuja: React.FC<{ m: Marca }> = ({ m }) => {
  const abajo = m.y < 0.14;
  return (
    <div className="absolute pointer-events-none" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
      <div className={`absolute left-0 -translate-x-1/2 ${abajo ? 'top-2' : 'bottom-2'} flex flex-col items-center`}>
        {abajo && <span className="w-0 h-0 border-x-[7px] border-x-transparent border-b-[8px] border-b-[var(--primary)]" />}
        <span className="block w-max max-w-[11rem] px-2.5 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold leading-snug text-center shadow-lg ring-2 ring-white/90">
          {m.texto}
        </span>
        {!abajo && <span className="w-0 h-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-[var(--primary)]" />}
      </div>
    </div>
  );
};

/** Una captura con sus marcas encima. Sin editor, la flecha y el círculo laten suave */
export const FotoConMarcas: React.FC<{ src: string; marcas: Marca[]; alt?: string; className?: string; imgClassName?: string }> = ({
  src, marcas, alt = '', className = '', imgClassName = 'block w-full h-auto',
}) => {
  const [alto, setAlto] = useState(ANCHO * 2);
  return (
    <div className={`relative select-none ${className}`}>
      <img src={src} alt={alt} draggable={false} className={imgClassName}
        onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setAlto((ANCHO * i.naturalHeight) / i.naturalWidth); }} />
      <Trazos marcas={marcas} animar alto={alto} />
      {marcas.filter((m) => m.tipo === 'burbuja').map((m, i) => <Burbuja key={i} m={m} />)}
    </div>
  );
};

const HERRAMIENTAS: { tipo: TipoMarca; nombre: string; ayuda: string; icono: React.ReactNode }[] = [
  { tipo: 'flecha', nombre: 'Flecha', ayuda: 'Toca dónde empieza y luego dónde apunta', icono: <MoveUpRight className="w-4 h-4" /> },
  { tipo: 'circulo', nombre: 'Círculo', ayuda: 'Toca lo que quieres resaltar', icono: <Circle className="w-4 h-4" /> },
  { tipo: 'burbuja', nombre: 'Burbuja', ayuda: 'Toca el lugar y escribe un texto corto', icono: <MessageSquare className="w-4 h-4" /> },
];

type Parte = 'fin' | 'inicio';

/**
 * Plataforma → Guías: la captura de un paso con sus marcas. Se agregan con
 * las tres herramientas, se mueven arrastrando sus puntos y se borran con su
 * ✕ (pide confirmar con un segundo toque).
 */
export const EditorMarcas: React.FC<{ src: string; marcas: Marca[]; onCambiar: (marcas: Marca[]) => void }> = ({ src, marcas, onCambiar }) => {
  const caja = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(ANCHO * 2);
  const [herramienta, setHerramienta] = useState<TipoMarca | null>(null);
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [borrando, setBorrando] = useState<number | null>(null);
  const arrastre = useRef<{ i: number; parte: Parte } | null>(null);
  const lleno = marcas.length >= LIMITES.marcas;

  const punto = (e: React.PointerEvent) => {
    const r = caja.current!.getBoundingClientRect();
    return { x: uno((e.clientX - r.left) / r.width), y: uno((e.clientY - r.top) / r.height) };
  };
  const cambiar = (i: number, m: Marca) => onCambiar(marcas.map((x, j) => (j === i ? m : x)));
  const agregar = (m: Marca) => {
    onCambiar([...marcas, m]);
    setElegida(marcas.length);
    setHerramienta(null);
    setInicio(null);
  };

  const tocarFoto = (e: React.PointerEvent) => {
    if (arrastre.current) return;
    setBorrando(null);
    if (!herramienta) { setElegida(null); return; }
    const p = punto(e);
    if (herramienta === 'flecha') {
      if (!inicio) { setInicio(p); return; }
      agregar({ tipo: 'flecha', x0: inicio.x, y0: inicio.y, x: p.x, y: p.y });
    } else if (herramienta === 'circulo') agregar({ tipo: 'circulo', x: p.x, y: p.y, r: 0.08 });
    else agregar({ tipo: 'burbuja', x: p.x, y: p.y, texto: 'Toca aquí' });
  };
  const agarrar = (e: React.PointerEvent, i: number, parte: Parte) => {
    e.stopPropagation();
    e.preventDefault();
    arrastre.current = { i, parte };
    setElegida(i);
    setBorrando(null);
    caja.current?.setPointerCapture(e.pointerId);
  };
  const mover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    const p = punto(e);
    const m = marcas[a.i];
    cambiar(a.i, a.parte === 'inicio' ? { ...m, x0: p.x, y0: p.y } : { ...m, x: p.x, y: p.y });
  };
  const soltar = () => { arrastre.current = null; };
  const borrar = (i: number) => {
    if (borrando !== i) { setBorrando(i); return; }
    onCambiar(marcas.filter((_, j) => j !== i));
    setBorrando(null);
    setElegida(null);
  };

  const sel = elegida !== null ? marcas[elegida] : undefined;
  const ayuda = herramienta === 'flecha' && inicio ? 'Ahora toca dónde apunta la flecha'
    : herramienta ? HERRAMIENTAS.find((h) => h.tipo === herramienta)!.ayuda
    : lleno ? `Ya tiene ${LIMITES.marcas} marcas, el máximo por paso`
    : 'Elige una marca y toca la foto. Arrastra los puntos para moverlas.';

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {HERRAMIENTAS.map((h) => (
          <button key={h.tipo} type="button" disabled={lleno && herramienta !== h.tipo}
            onClick={() => { setHerramienta(herramienta === h.tipo ? null : h.tipo); setInicio(null); }}
            className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 rounded-xl border text-[0.8125rem] font-bold cursor-pointer disabled:opacity-40 ${herramienta === h.tipo ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700'}`}>
            {h.icono} {h.nombre}
          </button>
        ))}
      </div>
      <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">{ayuda}</p>

      <div ref={caja} className={`relative select-none touch-none rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 ${herramienta ? 'cursor-crosshair' : ''}`}
        onPointerDown={tocarFoto} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <img src={src} alt="" draggable={false} className="block w-full h-auto pointer-events-none"
          onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setAlto((ANCHO * i.naturalHeight) / i.naturalWidth); }} />
        <Trazos marcas={marcas} animar={false} alto={alto} />
        {marcas.map((m, i) => (m.tipo === 'burbuja' ? <Burbuja key={`b${i}`} m={m} /> : null))}

        {inicio && <span className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-[var(--primary)] ring-2 ring-white" style={{ left: `${inicio.x * 100}%`, top: `${inicio.y * 100}%` }} />}

        {marcas.map((m, i) => {
          const puntos: { parte: Parte; x: number; y: number }[] = [{ parte: 'fin', x: m.x, y: m.y }];
          if (m.tipo === 'flecha') puntos.push({ parte: 'inicio', x: m.x0 ?? m.x, y: m.y0 ?? m.y });
          const ex = m.tipo === 'circulo' ? { x: m.x + (m.r ?? 0.08) * 0.75, y: m.y - (m.r ?? 0.08) * 0.75 * (ANCHO / alto) } : m.tipo === 'flecha' ? { x: m.x0 ?? m.x, y: (m.y0 ?? m.y) } : { x: m.x, y: m.y };
          return (
            <React.Fragment key={`m${i}`}>
              {puntos.map((p) => (
                <span key={p.parte} onPointerDown={(e) => agarrar(e, i, p.parte)} title="Arrastra para mover"
                  className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-white border-[3px] cursor-move shadow ${elegida === i ? 'border-[var(--primary)]' : 'border-slate-400'}`}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
              ))}
              {elegida === i && (
                <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => borrar(i)}
                  className={`absolute -translate-y-1/2 ml-3 h-7 rounded-full text-white text-[0.6875rem] font-bold shadow-lg flex items-center justify-center cursor-pointer ${borrando === i ? 'px-2.5 bg-rose-600' : 'w-7 bg-slate-900/80'}`}
                  style={{ left: `${uno(ex.x) * 100}%`, top: `${uno(ex.y) * 100}%` }} title="Borrar esta marca">
                  {borrando === i ? '¿Borrar?' : <X className="w-4 h-4" />}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {sel?.tipo === 'circulo' && elegida !== null && (
        <label className="flex items-center gap-2 text-[0.75rem] text-slate-500">
          Tamaño
          <input type="range" min={0.02} max={0.5} step={0.01} value={sel.r ?? 0.08} onChange={(e) => cambiar(elegida, { ...sel, r: Number(e.target.value) })} className="flex-1 accent-[var(--primary)]" />
        </label>
      )}
      {sel?.tipo === 'burbuja' && elegida !== null && (
        <label className="block"><span className="text-[0.6875rem] text-slate-500">Texto de la burbuja</span>
          <input value={sel.texto ?? ''} maxLength={LIMITES.burbuja} onChange={(e) => cambiar(elegida, { ...sel, texto: e.target.value })}
            className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]" />
        </label>
      )}
    </div>
  );
};

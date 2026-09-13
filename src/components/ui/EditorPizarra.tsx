import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, RotateCcw, Move, Maximize2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import {
  Bloque, TipoBloque, COLS, FILAS, CATALOGO, infoDe,
  LAYOUT_POR_DEFECTO, normalizar, primerHueco,
} from '../../utils/pizarra';

/**
 * Editor de la pizarra.
 *
 * Cuadrícula con huecos, NO arrastre libre. Es más rápido de construir,
 * imposible de dejar en un estado raro, y en una pantalla de pared nadie
 * necesita colocar al píxel. Mover y redimensionar con flechas además
 * funciona igual de bien desde un teléfono, que es donde la dueña va a
 * tocar esto.
 */
export const EditorPizarra: React.FC = () => {
  const { showToast } = useApp();

  const [bloques, setBloques] = useState<Bloque[]>(LAYOUT_POR_DEFECTO);
  const [elegido, setElegido] = useState<string | null>(null);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get<any>('/salon/display/token')
      .then(r => setBloques(normalizar(r?.bloques)))
      .catch(() => setBloques(LAYOUT_POR_DEFECTO));
  }, []);

  const bloque = bloques.find(b => b.id === elegido) ?? null;

  const cambiar = useCallback((id: string, campos: Partial<Bloque>) => {
    setBloques(bs => bs.map(b => (b.id === id ? { ...b, ...campos } : b)));
    setSucio(true);
  }, []);

  /** Mueve o redimensiona sin dejar que el bloque se salga de la cuadrícula */
  const ajustar = useCallback((campo: 'col' | 'fila' | 'ancho' | 'alto', delta: number) => {
    if (!bloque) return;
    const b = bloque;
    if (campo === 'col')  cambiar(b.id, { col: Math.min(Math.max(b.col + delta, 1), COLS - b.ancho + 1) });
    if (campo === 'fila') cambiar(b.id, { fila: Math.min(Math.max(b.fila + delta, 1), FILAS - b.alto + 1) });
    if (campo === 'ancho') cambiar(b.id, { ancho: Math.min(Math.max(b.ancho + delta, 1), COLS - b.col + 1) });
    if (campo === 'alto')  cambiar(b.id, { alto: Math.min(Math.max(b.alto + delta, 1), FILAS - b.fila + 1) });
  }, [bloque, cambiar]);

  const agregar = useCallback((tipo: TipoBloque) => {
    const info = infoDe(tipo);
    const hueco = primerHueco(bloques, info.ancho, info.alto);
    if (!hueco) {
      showToast('No cabe', 'Quita o achica algún bloque para hacerle sitio.', 'warning');
      return;
    }
    const id = `${tipo}-${Date.now().toString(36)}`;
    setBloques(bs => [...bs, { id, tipo, ...hueco, ancho: info.ancho, alto: info.alto, config: {} }]);
    setElegido(id);
    setSucio(true);
  }, [bloques, showToast]);

  const quitar = useCallback((id: string) => {
    setBloques(bs => bs.filter(b => b.id !== id));
    setElegido(null);
    setSucio(true);
  }, []);

  const guardar = useCallback(async () => {
    setGuardando(true);
    try {
      // El servidor devuelve lo que REALMENTE quedó guardado, no lo enviado:
      // si su saneado recortó algo, hay que verlo aquí y no descubrirlo
      // mirando el televisor.
      const r = await api.patch<any>('/salon/display/layout', { bloques });
      setBloques(normalizar(r?.bloques));
      setSucio(false);
      showToast('Pizarra guardada', 'La pared se actualiza sola.', 'success');
    } catch (e: any) {
      showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally { setGuardando(false); }
  }, [bloques, showToast]);

  const Flecha = ({ onClick, children, title }: {
    onClick: () => void; children: React.ReactNode; title: string;
  }) => (
    <button
      type="button" onClick={onClick} title={title}
      className="w-7 h-7 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 text-xs font-bold flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] transition cursor-pointer"
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* ── La pared, a escala ───────────────────────────────────── */}
      <div
        className="relative w-full rounded-2xl bg-neutral-950 p-1.5 overflow-hidden"
        style={{ aspectRatio: '16 / 9' }}
      >
        {/* Cuadrícula de fondo: sin ella no se entiende que las piezas
            encajan en huecos y el editor parece caprichoso */}
        <div
          className="absolute inset-1.5 grid gap-px opacity-[0.07] pointer-events-none"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${FILAS}, 1fr)`,
          }}
        >
          {Array.from({ length: COLS * FILAS }).map((_, i) => (
            <div key={i} className="bg-white rounded-[2px]" />
          ))}
        </div>

        <div
          className="relative w-full h-full grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${FILAS}, 1fr)`,
          }}
        >
          {bloques.map(b => {
            const info = infoDe(b.tipo);
            const activo = b.id === elegido;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setElegido(activo ? null : b.id)}
                style={{
                  gridColumn: `${b.col} / span ${b.ancho}`,
                  gridRow: `${b.fila} / span ${b.alto}`,
                }}
                className={`min-w-0 min-h-0 rounded-lg border text-left px-1.5 py-1 overflow-hidden transition cursor-pointer ${
                  activo
                    ? 'bg-[var(--primary)]/30 border-[var(--primary)] ring-1 ring-[var(--primary)]'
                    : 'bg-white/10 border-white/15 hover:bg-white/20'
                }`}
              >
                <div className="text-[10px] leading-none">{info.icono}</div>
                <div className="text-[9px] text-white/70 leading-tight truncate mt-0.5">
                  {info.nombre}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Controles del bloque elegido ─────────────────────────── */}
      {bloque ? (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-neutral-100">
              {infoDe(bloque.tipo).icono} {infoDe(bloque.tipo).nombre}
            </span>
            <button
              type="button"
              onClick={() => quitar(bloque.id)}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 transition cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Quitar
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {infoDe(bloque.tipo).descripcion}
          </p>

          {bloque.tipo === 'texto' && (
            <input
              value={bloque.config?.texto ?? ''}
              onChange={e => cambiar(bloque.id, { config: { texto: e.target.value } })}
              placeholder="Lo que quieres que diga la pared"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Move className="w-3 h-3" /> Mover
              </div>
              <div className="flex items-center gap-1">
                <Flecha onClick={() => ajustar('col', -1)} title="Izquierda">←</Flecha>
                <Flecha onClick={() => ajustar('col', 1)} title="Derecha">→</Flecha>
                <Flecha onClick={() => ajustar('fila', -1)} title="Arriba">↑</Flecha>
                <Flecha onClick={() => ajustar('fila', 1)} title="Abajo">↓</Flecha>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Maximize2 className="w-3 h-3" /> Tamaño
              </div>
              <div className="flex items-center gap-1">
                <Flecha onClick={() => ajustar('ancho', -1)} title="Más estrecho">−↔</Flecha>
                <Flecha onClick={() => ajustar('ancho', 1)} title="Más ancho">+↔</Flecha>
                <Flecha onClick={() => ajustar('alto', -1)} title="Más bajo">−↕</Flecha>
                <Flecha onClick={() => ajustar('alto', 1)} title="Más alto">+↕</Flecha>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 text-center py-2">
          Toca un bloque para moverlo o cambiarle el tamaño.
        </p>
      )}

      {/* ── Añadir ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {CATALOGO.map(c => (
          <button
            key={c.tipo}
            type="button"
            onClick={() => agregar(c.tipo)}
            title={c.descripcion}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-semibold text-slate-600 dark:text-neutral-300 flex items-center gap-1.5 hover:border-[var(--primary)] hover:text-[var(--primary)] transition cursor-pointer"
          >
            <Plus className="w-3 h-3" /> {c.icono} {c.nombre}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={!sucio || guardando}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
            sucio && !guardando
              ? 'bg-[var(--primary)] text-white hover:opacity-90 cursor-pointer'
              : 'bg-slate-100 dark:bg-neutral-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          {guardando ? 'Guardando…' : sucio ? 'Guardar pizarra' : 'Sin cambios'}
        </button>
        <button
          type="button"
          onClick={() => { setBloques(LAYOUT_POR_DEFECTO); setElegido(null); setSucio(true); }}
          title="Vuelve al diseño de fábrica (todavía hay que guardar)"
          className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Por defecto
        </button>
      </div>
    </div>
  );
};

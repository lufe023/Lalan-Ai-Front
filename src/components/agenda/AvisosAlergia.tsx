import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronRight, FlaskConical, Loader2, MessageCircleQuestion, Tag, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ABRIR_CLIENTA, saberProductosApi, type AvisoAlergia, type AvisosDeCita, type PreguntaAlergia } from '../../services/saberProductos';
import { QueProductoEs } from '../catalogo/QueProductoEs';
import { useConfirmar } from '../ui/ModalConfirmar';

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Los avisos de alergia de una cita: el producto de la receta lleva (o puede
 * llevar) algo que le hace daño a la clienta. Solo los ve el equipo; a la
 * clienta no se le dice nada. "Revisé la etiqueta" queda anotado con quién y
 * cuándo. Nunca frena la cita.
 */
export const ListaAvisosAlergia: React.FC<{
  avisos: AvisoAlergia[];
  onRevisar?: (productId: string) => Promise<unknown>;
  /** La administradora: cada alergia por su nombre, para confirmarla o quitarla aquí mismo */
  alergias?: AvisosDeCita['alergias'];
  onMarcar?: (grupo: string, estado: 'confirmada' | 'descartada') => Promise<unknown>;
  onVerFicha?: () => void;
  /** La administradora puede decir aquí qué producto es el que Lalan no conoce */
  onVinculado?: () => void;
  /** Lo que conviene preguntarle aunque no tenga nada anotado, y dónde anotar lo que conteste */
  preguntas?: PreguntaAlergia[];
  onResponder?: (grupo: string, tiene: boolean) => Promise<unknown>;
}> = ({ avisos, onRevisar, alergias, onMarcar, onVerFicha, onVinculado, preguntas = [], onResponder }) => {
  const [revisando, setRevisando] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<string | null>(null);
  const { confirmar, modalConfirmar } = useConfirmar();
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  if (!avisos.length && !preguntas.length) return null;
  const responder = async (grupo: string, tiene: boolean) => {
    if (!onResponder) return;
    setRespondiendo(grupo);
    try { await onResponder(grupo, tiene); } finally { setRespondiendo(null); }
  };
  const revisar = async (productId: string) => {
    if (!onRevisar) return;
    setRevisando(productId);
    try { await onRevisar(productId); } finally { setRevisando(null); }
  };
  const quitar = async (g: { clave: string; nombre: string }) => {
    if (!onMarcar) return;
    const si = await confirmar({
      titulo: `¿Quitar "${g.nombre}" de sus alergias?`,
      mensaje: 'Lalan dejará de avisar por esta alergia en sus citas. Lo que dice su ficha no cambia.',
      textoConfirmar: 'Quitar', tono: 'peligro',
    });
    if (si) await onMarcar(g.clave, 'descartada');
  };
  return (
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-slate-800 dark:text-amber-100 space-y-2.5">
      {modalConfirmar}
      <div className="flex items-center gap-1.5 font-bold text-[0.75rem] text-amber-700 dark:text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span className="flex-1">{avisos.length ? 'Cuidado con los productos de este servicio' : 'Pregúntale antes de empezar'}</span>
        {onVerFicha && (
          <button type="button" onClick={onVerFicha} className="text-[0.75rem] font-bold text-[var(--primary)] flex items-center gap-0.5 cursor-pointer">
            Ver su ficha <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {!!alergias?.length && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.75rem] text-slate-600 dark:text-neutral-300">Tiene anotado:</span>
          {alergias.map((g) => (
            <span key={g.clave} title={g.confirmada ? 'Confirmada' : 'La leyó Lalan en su ficha: confírmala o quítala'}
              className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-[0.75rem] font-semibold ${g.confirmada ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'bg-white/60 dark:bg-neutral-900/40 text-amber-700 dark:text-amber-300 border border-dashed border-amber-500/40'}`}>
              {g.nombre}
              {onMarcar && !g.confirmada && (
                <button type="button" aria-label={`Confirmar ${g.nombre}`} title="Confirmar" onClick={() => void onMarcar(g.clave, 'confirmada')} className="p-1 rounded-full hover:bg-amber-500/20 cursor-pointer"><Check className="w-3 h-3" /></button>
              )}
              {onMarcar && (
                <button type="button" aria-label={`Quitar ${g.nombre}`} title="No es una alergia" onClick={() => void quitar(g)} className="p-1 rounded-full hover:bg-amber-500/20 cursor-pointer"><X className="w-3 h-3" /></button>
              )}
            </span>
          ))}
        </div>
      )}
      {avisos.map((a) => (
        <div key={`${a.productId}-${a.grupo ?? ''}`} className="space-y-1.5">
          <p className="text-[0.8125rem] leading-relaxed">{a.texto}</p>
          {a.nivel === 'sin_datos' && onVinculado && (
            vinculando === a.productId ? (
              <div className="rounded-xl bg-white dark:bg-neutral-900 p-2">
                <QueProductoEs productId={a.productId} nombre={a.producto} onVinculado={onVinculado} />
              </div>
            ) : (
              <button type="button" onClick={() => setVinculando(a.productId)}
                className="min-h-[36px] px-3 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center gap-1.5 cursor-pointer">
                <FlaskConical className="w-3.5 h-3.5" /> Decir qué producto es
              </button>
            )
          )}
          {a.revisado ? (
            <p className="text-[0.75rem] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {a.revisado.por} revisó la etiqueta · {fechaHora(a.revisado.en)}
            </p>
          ) : onRevisar ? (
            <button type="button" disabled={revisando === a.productId} onClick={() => void revisar(a.productId)}
              className="min-h-[36px] px-3 rounded-xl bg-white dark:bg-neutral-900 border border-amber-500/40 text-[0.75rem] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
              {revisando === a.productId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
              Revisé la etiqueta
            </button>
          ) : null}
        </div>
      ))}
      {preguntas.map((q) => (
        <div key={q.productId} className="space-y-1.5 pt-1 border-t border-amber-500/20 first:border-0 first:pt-0">
          <p className="text-[0.8125rem] leading-relaxed flex gap-1.5"><MessageCircleQuestion className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" /> {q.texto}</p>
          {onResponder && q.componentes.map((c) => (
            <div key={c.grupo} className="flex flex-wrap items-center gap-1.5 pl-5">
              <span className="text-[0.75rem] font-semibold">{c.componente}:</span>
              <button type="button" disabled={respondiendo === c.grupo} onClick={() => void responder(c.grupo, true)}
                className="min-h-[32px] px-2.5 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[0.75rem] font-bold cursor-pointer disabled:opacity-60">Sí tiene alergia</button>
              <button type="button" disabled={respondiendo === c.grupo} onClick={() => void responder(c.grupo, false)}
                className="min-h-[32px] px-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-amber-500/40 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 cursor-pointer disabled:opacity-60">No tiene</button>
            </div>
          ))}
        </div>
      ))}
      {preguntas.length > 0 && onResponder && <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Lo que conteste queda en su ficha: si tiene, Lalan avisa en sus próximas citas; si no, no se vuelve a preguntar.</p>}
      <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Es una guía: no sustituye una prueba de alergia.</p>
    </div>
  );
};

/**
 * Los avisos de una cita en la agenda del salón, conectados: dice qué alergia
 * tiene y deja confirmarla o quitarla, abre su ficha y, si Lalan no sabe qué
 * lleva un producto, deja decir qué producto es sin salir de la cita.
 */
export const AvisosAlergiaCita: React.FC<{ citaId: string }> = ({ citaId }) => {
  const { navigateTo } = useApp();
  const [datos, setDatos] = useState<AvisosDeCita | null>(null);
  const cargar = useCallback(() => {
    saberProductosApi.avisosDeCita(citaId).then(setDatos).catch(() => setDatos(null));
  }, [citaId]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!datos) return null;
  const clientId = datos.clientId;
  return (
    <ListaAvisosAlergia
      avisos={datos.avisos}
      preguntas={datos.preguntas}
      onResponder={clientId ? (g, tiene) => saberProductosApi.marcarAlergia(clientId, g, tiene ? 'confirmada' : 'descartada').then(cargar) : undefined}
      alergias={datos.alergias}
      onRevisar={(p) => saberProductosApi.revisado(citaId, p).then(cargar)}
      onMarcar={clientId ? (g, e) => saberProductosApi.marcarAlergia(clientId, g, e).then(cargar) : undefined}
      onVerFicha={clientId ? () => { try { sessionStorage.setItem(ABRIR_CLIENTA, clientId); } catch { /* nada */ } navigateTo('clients'); } : undefined}
      onVinculado={cargar}
    />
  );
};

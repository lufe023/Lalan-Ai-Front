import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Clock, FileText, Loader2, Mail, MessageCircle, MessagesSquare, Package, Send, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { BotonAtras } from '../ui/BotonAtras';
import { ItemAnimado, ListaAnimada } from '../ui/movimiento';
import { cantidadTexto, comprasApi, unidadTexto, type ChatProveedor, type FilaChatProveedor, type MensajeProveedor, type PanoramaProveedor } from '../../services/compras';
import { horaDe } from '../../services/avisos';
import { PastillaEstado, botonPrincipal, botonWhatsapp, campo, fechaCorta } from './piezas';

const DIA_MS = 86_400_000;
/** Con el chat abierto, se mira si el proveedor escribió algo nuevo */
const REFRESCAR_MS = 20_000;

/**
 * Los chats con los proveedores, en un solo lugar: con pedido o sin él.
 * Si un proveedor escribe para ver si hay algo que pedirle, aquí está su
 * mensaje, lo que Lalan revisó (lo que nos vende y hasta cuándo alcanza, lo
 * que falta) y el botón para que Lalan le pregunte si lo tiene.
 */
export const ListaChatsProveedores: React.FC<{ recarga?: number; onAbrir: (proveedorId: string) => void }> = ({ recarga, onAbrir }) => {
  const [lista, setLista] = useState<FilaChatProveedor[] | null>(null);
  useEffect(() => { comprasApi.chats().then(setLista).catch(() => setLista([])); }, [recarga]);

  if (!lista) return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Cargando chats…</div>;
  if (!lista.length) {
    return (
      <div className="py-10 flex flex-col items-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
        <MessagesSquare className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Todavía no te ha escrito ningún proveedor</h4>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">Cuando uno de tus proveedores escriba a tu WhatsApp o a tu correo, su chat sale aquí, aunque no haya un pedido. Lalan revisa qué nos falta y te pregunta.</p>
      </div>
    );
  }
  return (
    <ListaAnimada className="space-y-2">
      {lista.map((c, i) => {
        const quien = c.ultimo.tipo === 'mensaje_entrante' ? '' : c.ultimo.autorTipo === 'lalan' ? 'Lalan: ' : 'Tú: ';
        return (
          <ItemAnimado key={c.proveedor.id} indice={i} onClick={() => onAbrir(c.proveedor.id)}
            className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 cursor-pointer flex items-start gap-3 hover:border-[var(--primary)]/40">
            <span className="grid place-items-center size-10 rounded-full shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[0.875rem]">
              {c.proveedor.nombre.trim().charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[0.875rem] text-slate-900 dark:text-white truncate">{c.proveedor.nombre}</span>
                <span className={`text-[0.6875rem] shrink-0 ${c.esperaRespuesta ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>{horaDe(c.ultimo.creadoEn)}</span>
              </div>
              <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1">
                {c.ultimo.canal === 'correo' ? <Mail className="w-3 h-3 shrink-0" /> : <MessageCircle className="w-3 h-3 shrink-0" />}
                <span className="truncate">{quien}{c.ultimo.texto || 'Mandó un archivo'}</span>
              </p>
              {c.esperaRespuesta && (
                <p className="mt-1 text-[0.6875rem] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Espera respuesta{c.ventanaAbierta ? ' · WhatsApp abierto' : ''}
                </p>
              )}
            </div>
          </ItemAnimado>
        );
      })}
    </ListaAnimada>
  );
};

/** El chat con un proveedor: lo que Lalan revisó arriba, la conversación y para escribirle */
export const ChatConProveedor: React.FC<{ id: string; sede?: string; onVolver: () => void; onAbrirPedido: (id: string) => void }> = ({ id, sede, onVolver, onAbrirPedido }) => {
  const { showToast } = useApp();
  const { puede } = useAuth();
  const [c, setC] = useState<ChatProveedor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const final = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => comprasApi.chat(id, sede).then((r) => { setC(r); setError(null); }).catch((e) => setError((e as Error).message || 'No se pudo abrir el chat')), [id, sede]);
  useEffect(() => {
    void cargar();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void cargar(); }, REFRESCAR_MS);
    return () => clearInterval(t);
  }, [cargar]);
  // Al abrir se queda arriba (lo que revisó Lalan es lo que se decide); si llega algo nuevo, baja a verlo
  const cuantos = c?.mensajes.length ?? 0;
  const antes = useRef(0);
  useEffect(() => {
    if (antes.current && cuantos > antes.current) final.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    antes.current = cuantos;
  }, [cuantos]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try { setC(await comprasApi.escribirAProveedor(id, texto.trim())); setTexto(''); }
    catch (e) { showToast('No salió', (e as Error).message, 'warning'); }
    finally { setEnviando(false); }
  };

  if (error) {
    return (
      <div className="space-y-3">
        <BotonAtras onVolver={onVolver} texto="Chats" />
        <p className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[0.8125rem]">{error}</p>
      </div>
    );
  }
  if (!c) return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Abriendo el chat…</div>;

  const p = c.proveedor;
  const escribe = puede('compras.gestionar');
  return (
    <div className="space-y-3">
      <BotonAtras onVolver={onVolver} texto="Chats" />
      <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex flex-wrap items-center gap-3">
        <span className="grid place-items-center size-11 rounded-full shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">{p.nombre.trim().charAt(0).toUpperCase()}</span>
        <div className="flex-1 min-w-[10rem]">
          <h3 className="font-extrabold text-[1rem] text-slate-900 dark:text-white">{p.nombre}</h3>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
            {p.contacto ? `${p.contacto} · ` : ''}
            {c.ventanaHasta ? `WhatsApp abierto hasta las ${new Date(c.ventanaHasta).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}`
              : c.escribirPor === 'correo' ? `Se le escribe por correo (${p.correo})` : 'Escríbele desde tu WhatsApp'}
          </p>
        </div>
        {c.waMe && <a href={c.waMe} target="_blank" rel="noreferrer" className={botonWhatsapp}><MessageCircle className="w-4 h-4" /> Abrir en WhatsApp</a>}
      </div>

      <LoQueRevisoLalan proveedorId={p.id} nombre={p.nombre} panorama={c.panorama} lalanPregunta={c.lalanPuedePreguntar} puedePedir={escribe}
        onAbrirPedido={onAbrirPedido} onHecho={() => void cargar()} />

      <div className="p-3 sm:p-4 rounded-3xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/80 dark:border-neutral-800 space-y-2">
        {!c.mensajes.length && <p className="text-center text-[0.8125rem] text-slate-400 py-4">Todavía no hay mensajes con {p.nombre}.</p>}
        {c.mensajes.map((m) => <Burbuja key={m.id} m={m} onAbrirPedido={onAbrirPedido} />)}
        <div ref={final} />
      </div>

      {escribe && (
        c.escribirPor ? (
          <div className="p-3 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-2">
            <textarea className={`${campo} min-h-[64px]`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Escríbele a ${p.nombre}…`}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar(); }} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.6875rem] text-slate-500 flex items-center gap-1">
                {c.escribirPor === 'whatsapp' ? <><MessageCircle className="w-3 h-3" /> Sale por el WhatsApp del salón</> : <><Mail className="w-3 h-3" /> Sale por el correo del salón</>}
              </span>
              <button type="button" disabled={!texto.trim() || enviando} onClick={() => void enviar()} className={botonPrincipal}>
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
              </button>
            </div>
          </div>
        ) : (
          <p className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[0.8125rem]">
            {p.nombre} no ha escrito por WhatsApp en las últimas 24 horas y no tiene correo, así que Meta no deja escribirle desde aquí. Escríbele desde tu WhatsApp con el botón de arriba.
          </p>
        )
      )}
    </div>
  );
};

/**
 * Lo que Lalan revisó: la pregunta lista para la dueña, lo que ya nos vende
 * con hasta cuándo alcanza, lo abierto, lo que se le debe y lo que falta
 * (marcado) con el botón para que Lalan le pregunte si lo tiene.
 */
const LoQueRevisoLalan: React.FC<{
  proveedorId: string; nombre: string; panorama: PanoramaProveedor; lalanPregunta: boolean; puedePedir: boolean;
  onAbrirPedido: (id: string) => void; onHecho: () => void;
}> = ({ proveedorId, nombre, panorama, lalanPregunta, puedePedir, onAbrirPedido, onHecho }) => {
  const { showToast } = useApp();
  const variasSedes = panorama.sedes.length > 1;
  const clave = (f: { sede: { id: string }; productId: string }) => `${f.sede.id}:${f.productId}`;
  // Todo lo que falta viene marcado: la dueña quita lo que no quiera preguntarle
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(panorama.faltan.slice(0, 8).map(clave)));
  const firma = panorama.faltan.map(clave).join(',');
  useEffect(() => { setMarcados(new Set(panorama.faltan.slice(0, 8).map(clave))); }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pidiendo, setPidiendo] = useState<string | null>(null);

  const porSede = useMemo(() => panorama.sedes.map((s) => ({ sede: s, faltan: panorama.faltan.filter((f) => f.sede.id === s.id) })).filter((g) => g.faltan.length), [panorama]);
  const hoy = Date.now();

  const preguntar = async (sedeId: string) => {
    const productIds = panorama.faltan.filter((f) => f.sede.id === sedeId && marcados.has(clave(f))).map((f) => f.productId);
    if (!productIds.length) return;
    setPidiendo(sedeId);
    try {
      const r = await comprasApi.preguntarAProveedor(proveedorId, { sede: sedeId, productIds });
      if (r.canal) {
        showToast(`Lalan le preguntó a ${nombre}`, `Le pidió precio de ${r.productos.length === 1 ? r.productos[0] : `${r.productos.length} productos`} por ${r.canal === 'whatsapp' ? 'WhatsApp' : 'correo'} (${r.numero}). Te aviso cuando conteste.`, 'success');
        onHecho();
      } else {
        showToast(`Pedido ${r.numero} listo`, `Revísalo y mándaselo a ${nombre}.`, 'success');
        onAbrirPedido(r.ordenId);
      }
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setPidiendo(null); }
  };

  return (
    <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-violet-200/80 dark:border-violet-900/50 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="grid place-items-center size-8 rounded-xl shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Sparkles className="w-4 h-4" /></span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Lo que revisó Lalan</p>
          <p className="text-[0.875rem] text-slate-800 dark:text-neutral-100">{panorama.pregunta}</p>
        </div>
      </div>

      {panorama.provee.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Ya nos vende</h4>
          {panorama.provee.map((x) => {
            const dias = x.alcanzaHasta ? Math.round((new Date(`${x.alcanzaHasta}T12:00:00`).getTime() - hoy) / DIA_MS) : null;
            return (
              <div key={`${x.sede.id}:${x.productId}`} className="flex items-start gap-2.5 text-[0.8125rem] py-1.5 border-b border-slate-100 dark:border-neutral-800 last:border-0">
                <Package className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span className="flex-1 min-w-0">
                <b className="text-slate-900 dark:text-white">{x.nombre}</b>{variasSedes ? <span className="text-slate-500"> · {x.sede.nombre}</span> : null}
                <span className={`block text-[0.6875rem] font-semibold ${dias != null && dias <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                  hay {cantidadTexto(x.hay)} {unidadTexto(x.unidad)}{x.alcanzaHasta ? ` · alcanza hasta el ${fechaCorta(`${x.alcanzaHasta}T12:00:00`)}` : x.porDia == null && !x.pedido ? ' · casi no sale' : ''}{x.pedido ? ' · ya pedido' : ''}
                </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(panorama.abiertos.length > 0 || panorama.debemos.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {panorama.abiertos.map((o) => (
            <button key={o.id} type="button" onClick={() => onAbrirPedido(o.id)} className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 flex items-center gap-1.5 cursor-pointer hover:border-[var(--primary)]/50">
              <FileText className="w-3.5 h-3.5" /> {o.numero}{variasSedes ? ` · ${o.sede.nombre}` : ''} <PastillaEstado estado={o.estado} />
            </button>
          ))}
          {panorama.debemos.map((d) => (
            <span key={d.currencyCode} className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[0.75rem] font-bold">
              Le debemos {d.currencyCode} {d.monto.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
            </span>
          ))}
        </div>
      )}

      {porSede.map((g) => {
        const elegidos = g.faltan.filter((f) => marcados.has(clave(f))).length;
        return (
          <div key={g.sede.id} className="space-y-1.5">
            <h4 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Nos falta{variasSedes ? ` en ${g.sede.nombre}` : ''}</h4>
            {g.faltan.map((f) => {
              const k = clave(f);
              const si = marcados.has(k);
              return (
                <button key={k} type="button" disabled={!puedePedir} onClick={() => setMarcados((m) => { const n = new Set(m); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                  className="w-full flex items-center gap-2.5 py-1.5 text-left cursor-pointer disabled:cursor-default">
                  <span className={`grid place-items-center size-5 rounded-md border shrink-0 ${si ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-slate-300 dark:border-neutral-600'}`}>{si && <Check className="w-3.5 h-3.5" />}</span>
                  <span className="flex-1 min-w-0 text-[0.8125rem]">
                    <b className="text-slate-900 dark:text-white">{f.nombre}</b>
                    <span className="block text-[0.6875rem] text-slate-500">
                      faltan {cantidadTexto(f.faltan)} {unidadTexto(f.unidad)} · hay {cantidadTexto(f.hay)}
                      {f.motivo === 'citas' ? ' · lo piden las citas de la semana' : ''}
                      {f.loVende ? ` · ${nombre} lo vende` : f.otroProveedor ? ` · se lo compras a ${f.otroProveedor}` : ' · sin proveedor'}
                    </span>
                  </span>
                </button>
              );
            })}
            {puedePedir && (
              <button type="button" disabled={!elegidos || pidiendo === g.sede.id} onClick={() => void preguntar(g.sede.id)} className={`${botonPrincipal} w-full py-2.5`}>
                {pidiendo === g.sede.id ? <Loader2 className="w-4 h-4 animate-spin" /> : lalanPregunta ? <Bot className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                {lalanPregunta ? `Sí, pregúntale si ${elegidos === 1 ? 'lo' : 'los'} tiene` : `Armar el pedido (${elegidos})`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Burbuja: React.FC<{ m: MensajeProveedor; onAbrirPedido: (id: string) => void }> = ({ m, onAbrirPedido }) => {
  // Lo que Lalan revisó o anotó: en el centro, chico
  if (m.tipo === 'lalan') {
    return (
      <div className="flex justify-center">
        <p className="max-w-[92%] px-3 py-1.5 rounded-2xl bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200 text-[0.75rem] flex items-start gap-1.5">
          <Bot className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span className="whitespace-pre-line break-words">{m.texto}</span>
        </p>
      </div>
    );
  }
  const suyo = m.tipo === 'mensaje_entrante' || (m.tipo === 'adjunto' && m.autorTipo === 'proveedor');
  const quien = suyo ? null : m.autorTipo === 'lalan' ? 'Lalan' : m.autorNombre ?? 'Tú';
  return (
    <div className={`flex ${suyo ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[0.8125rem] ${suyo ? 'bg-white dark:bg-neutral-800 text-slate-800 dark:text-neutral-100 rounded-bl-md border border-slate-200/70 dark:border-neutral-700' : 'bg-[var(--primary)]/10 text-slate-900 dark:text-white rounded-br-md'}`}>
        {quien && <p className="text-[0.6875rem] font-bold text-[var(--primary)] flex items-center gap-1">{m.autorTipo === 'lalan' && <Bot className="w-3 h-3" />}{quien}</p>}
        {m.tipo === 'adjunto' && m.adjuntoId ? (
          <button type="button" onClick={() => void comprasApi.abrirAdjunto(m.adjuntoId!)} className="font-semibold text-[var(--primary)] flex items-center gap-1 cursor-pointer"><FileText className="w-3.5 h-3.5" /> {m.texto || 'Archivo'}</button>
        ) : (
          <p className="whitespace-pre-line break-words">{m.tipo === 'envio' ? (m.texto || 'Le mandamos el pedido') : m.texto}</p>
        )}
        <p className="mt-1 text-[0.625rem] text-slate-400 flex items-center gap-1.5 justify-end">
          {m.pedido && (
            <button type="button" onClick={() => onAbrirPedido(m.pedido!.id)} className="font-bold text-[var(--primary)] cursor-pointer">{m.pedido.numero}</button>
          )}
          {m.canal === 'correo' ? <Mail className="w-3 h-3" /> : m.canal === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {horaDe(m.creadoEn)}
        </p>
      </div>
    </div>
  );
};

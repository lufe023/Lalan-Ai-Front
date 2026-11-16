import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Check, Loader2, Mail, MessageCircle, Plus, Scale, Search, Sparkles, Trash2, UserRound } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { useApp } from '../../context/AppContext';
import { usePlan } from '../../context/PlanContext';
import {
  comprasApi, haceCuanto, type ContactoGuardado, type ContactoProveedor, type OtroProveedor, type Pedido, type Sugerencia, type VentanaAbierta,
} from '../../services/compras';
import { botonPrincipal, botonSuave, campo, etiqueta } from './piezas';

const mismoNumero = (a?: string | null, b?: string | null) => {
  const x = (a ?? '').replace(/\D/g, '').slice(-10);
  return x.length >= 7 && x === (b ?? '').replace(/\D/g, '').slice(-10);
};
/** La ventana abierta de esa persona (por su número) */
const ventanaDe = (ventanas: VentanaAbierta[], c: ContactoProveedor | null) => (c?.whatsapp ? ventanas.find((v) => mismoNumero(v.numero, c.whatsapp)) ?? null : null);

/** Lo que hará Lalan al pedir precio, dicho antes de tocar */
function comoLeEscribe(c: ContactoProveedor | null, ventana: VentanaAbierta | null): { texto: string; listo: boolean } {
  if (ventana) return { texto: `Te escribió ${haceCuanto(ventana.escribio)}: Lalan le escribe por WhatsApp ahora mismo.`, listo: true };
  if (c?.whatsapp) return { texto: 'No te ha escrito en 24 horas: Lalan le escribe con la plantilla de cotización; si no puede, por correo.', listo: true };
  if (c?.correo) return { texto: 'Lalan le escribe por correo.', listo: true };
  return { texto: 'No tiene WhatsApp ni correo: agrégale uno a la persona para que Lalan le escriba.', listo: false };
}

/**
 * «¿A quién se lo pides?»: cambiar el proveedor de un borrador (mismos
 * productos, con sus precios) o pedirle lo mismo a otro para comparar.
 * Primero los que escribieron por WhatsApp en las últimas 24 h (Lalan les
 * escribe ya, gratis); se elige con qué persona de la empresa se habla, y
 * Lalan puede pedir el precio en el mismo toque.
 */
export const CambiarProveedor: React.FC<{
  pedido: Pedido | null;
  /** «cambiar» abre con «Cambiar a este» al frente; «otro» con «Pedirle lo mismo también» */
  modo: 'cambiar' | 'otro';
  onClose: () => void;
  /** El pedido que quedó: el mismo (cambiado) o el nuevo (para comparar) */
  onListo: (p: Pedido, nuevo: boolean) => void;
}> = ({ pedido, modo, onClose, onListo }) => {
  const { showToast } = useApp();
  const automaticas = usePlan().tieneModulo('compras_lalan');
  const [lista, setLista] = useState<OtroProveedor[] | null>(null);
  const [sugeridos, setSugeridos] = useState<Sugerencia[]>([]);
  const [q, setQ] = useState('');
  const [elegido, setElegido] = useState<string | null>(null);
  const [contactoId, setContactoId] = useState<string | null>(null);
  const [lalanPide, setLalanPide] = useState(true);
  const [haciendo, setHaciendo] = useState<'cambiar' | 'otro' | string | null>(null);
  const [nuevaPersona, setNuevaPersona] = useState<{ nombre: string; whatsapp: string; correo: string } | null>(null);

  const cargar = useCallback(async (seleccionar?: string) => {
    if (!pedido) return;
    try {
      const r = await comprasApi.otrosProveedores(pedido.id);
      setLista(r.proveedores);
      if (seleccionar) { setElegido(seleccionar); setContactoId(null); }
    } catch (e) { setLista([]); showToast('No se pudo cargar', (e as Error).message, 'warning'); }
  }, [pedido, showToast]);

  useEffect(() => {
    if (!pedido) return;
    setLista(null); setElegido(null); setQ(''); setNuevaPersona(null); setLalanPide(true);
    void cargar();
    // De la lista de Lalan: solo los que venden algo de este pedido
    const ids = new Set(pedido.lineas.map((l) => l.productId));
    comprasApi.sugerencias()
      .then((r) => setSugeridos((r.sugerencias ?? []).filter((s) => s.productos.some((p) => ids.has(p.id)))))
      .catch(() => setSugeridos([]));
  }, [pedido, cargar]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (lista ?? []).filter((p) => !t || p.nombre.toLowerCase().includes(t) || p.contactos.some((c) => c.nombre?.toLowerCase().includes(t)));
  }, [lista, q]);

  if (!pedido) return null;
  const sel = lista?.find((p) => p.id === elegido) ?? null;
  const contacto = sel ? sel.contactos.find((c) => c.id === contactoId) ?? sel.contactos[0] : null;
  const ventana = sel ? ventanaDe(sel.ventanas, contacto) : null;
  const como = comoLeEscribe(contacto, ventana);
  const puedeCambiar = pedido.estado === 'borrador';
  const lalanPuede = automaticas && !!sel?.lalanHabla;

  const elegir = (p: OtroProveedor) => {
    setElegido(p.id); setNuevaPersona(null);
    // Si alguien de la empresa escribió en 24 h, se habla con esa persona
    const abierta = p.contactos.find((c) => ventanaDe(p.ventanas, c));
    setContactoId(abierta?.id ?? null);
  };

  const agregarPersona = async () => {
    if (!sel || !nuevaPersona?.nombre.trim()) return;
    setHaciendo('persona');
    try {
      const c = await comprasApi.crearContacto(sel.id, { nombre: nuevaPersona.nombre, whatsapp: nuevaPersona.whatsapp || null, correo: nuevaPersona.correo || null });
      await cargar(sel.id);
      setContactoId(c.id); setNuevaPersona(null);
    } catch (e) { showToast('No se pudo agregar', (e as Error).message, 'warning'); }
    finally { setHaciendo(null); }
  };

  const agregarSugerido = async (s: Sugerencia) => {
    setHaciendo(s.id);
    try {
      const r = await comprasApi.adoptar(s.id, s.productos.map((p) => p.id));
      setSugeridos((l) => l.filter((x) => x.id !== s.id));
      await cargar(r.proveedorId);
      showToast('Proveedor agregado', `${s.nombre} quedó en tu lista. Elige qué hacer con él.`, 'success');
    } catch (e) { showToast('No se pudo agregar', (e as Error).message, 'warning'); }
    finally { setHaciendo(null); }
  };

  const hacer = async (que: 'cambiar' | 'otro') => {
    if (!sel) return;
    setHaciendo(que);
    const quien = contacto?.nombre && !contacto.principal ? `${contacto.nombre} (${sel.nombre})` : sel.nombre;
    try {
      let p = que === 'cambiar'
        ? await comprasApi.editar(pedido.id, { proveedorId: sel.id, contactoId: contacto?.id ?? null })
        : await comprasApi.duplicar(pedido.id, { proveedorId: sel.id, contactoId: contacto?.id ?? null });
      let nota = que === 'cambiar' ? `${pedido.numero} ahora es para ${quien}, con los mismos productos.` : `${p.numero} es lo mismo para ${quien}. Los comparas lado a lado.`;
      if (lalanPuede && lalanPide && como.listo) {
        try {
          const r = await comprasApi.lalanPide(p.id);
          p = r.orden;
          nota += ` Lalan ya le pidió el precio por ${r.canal === 'whatsapp' ? 'WhatsApp' : 'correo'}.`;
        } catch (e) { nota += ` Lalan no pudo escribirle: ${(e as Error).message}`; }
      }
      showToast(que === 'cambiar' ? 'Proveedor cambiado' : 'Pedido para comparar', nota, 'success');
      onListo(p, que === 'otro');
      onClose();
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setHaciendo(null); }
  };

  const productos = pedido.lineas.length;
  return (
    <IOSModal isOpen={!!pedido} onClose={onClose} title={modo === 'cambiar' ? 'Cambiar proveedor' : 'Pedírselo a otro proveedor'}
      subtitle={`${pedido.numero} · ${productos} ${productos === 1 ? 'producto' : 'productos'} · ${pedido.sede.nombre}`}>
      <div className="space-y-3 p-1">
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
          Los mismos productos, con el precio y la presentación de cada proveedor. Arriba, los que te escribieron por WhatsApp en las últimas 24 horas: a esos Lalan les escribe ya.
        </p>
        <label className="relative block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${campo} pl-9`} placeholder="Buscar proveedor o persona" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        {!lista && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Buscando proveedores…</div>}
        {lista && !filtrados.length && <p className="text-[0.8125rem] text-slate-500 py-3 text-center">{q ? 'Ninguno se llama así.' : 'No hay más proveedores que le vendan a esta sede.'}</p>}

        <div className="space-y-2">
          {filtrados.map((p) => {
            const abierto = p.id === elegido;
            const vende = p.vende.length;
            const escribio = p.ventanas[0];
            return (
              <div key={p.id} className={`rounded-2xl border transition-colors ${abierto ? 'border-[var(--primary)] bg-[var(--primary)]/5' : escribio ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'}`}>
                <button type="button" onClick={() => (p.esElActual ? undefined : elegir(p))} disabled={p.esElActual} className="w-full p-3 text-left flex items-start gap-2 cursor-pointer disabled:cursor-default">
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${abierto ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-slate-300 dark:border-neutral-600'}`}>{abierto && <Check className="w-2.5 h-2.5 text-white" />}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className="text-[0.875rem] text-slate-900 dark:text-white">{p.nombre}</b>
                      {p.plataformaId && <Sparkles className="w-3.5 h-3.5 text-violet-500" aria-label="De la lista de Lalan" />}
                      {p.esElActual && <span className="px-1.5 py-0.5 rounded-full text-[0.625rem] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-500">Es el de ahora</span>}
                      {p.yaCotiza && <span className="px-1.5 py-0.5 rounded-full text-[0.625rem] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Ya lo está cotizando</span>}
                    </span>
                    {escribio && (
                      <span className="mt-0.5 flex items-center gap-1 text-[0.75rem] font-semibold text-emerald-700 dark:text-emerald-400">
                        <MessageCircle className="w-3.5 h-3.5" /> {escribio.nombre ?? 'Te escribió'} {escribio.nombre ? 'te escribió' : ''} {haceCuanto(escribio.escribio)} · WhatsApp abierto
                      </span>
                    )}
                    <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">
                      {vende ? `Le compras ${vende} de ${productos} ${productos === 1 ? 'producto' : 'productos'} de este pedido` : 'Todavía no le compras nada de esto'}
                      {p.contactos.length > 1 ? ` · ${p.contactos.length} personas` : p.contacto ? ` · ${p.contacto}` : ''}
                    </span>
                  </span>
                </button>

                {abierto && (
                  <div className="px-3 pb-3 space-y-3">
                    <div>
                      <span className={etiqueta}>¿Con quién de {p.nombre} hablas?</span>
                      <div className="flex flex-wrap gap-1.5">
                        {p.contactos.filter((c) => c.nombre || c.whatsapp || c.correo).map((c) => {
                          const v = ventanaDe(p.ventanas, c);
                          const activo = (contacto?.id ?? null) === c.id;
                          return (
                            <button key={c.id ?? 'principal'} type="button" onClick={() => setContactoId(c.id)}
                              className={`px-3 py-1.5 rounded-full text-[0.75rem] font-bold border cursor-pointer flex items-center gap-1 ${activo ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 bg-white dark:bg-neutral-900'}`}>
                              {v ? <span className={`w-2 h-2 rounded-full ${activo ? 'bg-white' : 'bg-emerald-500'}`} aria-label="WhatsApp abierto" /> : <UserRound className="w-3.5 h-3.5" />}
                              {c.nombre ?? (c.principal ? 'El de la ficha' : 'Sin nombre')}
                              {c.cargo && <span className="font-normal opacity-80">· {c.cargo}</span>}
                              {c.whatsapp && <MessageCircle className="w-3 h-3 opacity-80" />}
                              {c.correo && <Mail className="w-3 h-3 opacity-80" />}
                            </button>
                          );
                        })}
                        {!nuevaPersona && (
                          <button type="button" onClick={() => setNuevaPersona({ nombre: '', whatsapp: '', correo: '' })} className="px-3 py-1.5 rounded-full text-[0.75rem] font-bold border border-dashed border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 cursor-pointer flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Otra persona
                          </button>
                        )}
                      </div>
                      {nuevaPersona && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input className={campo} autoFocus placeholder="Nombre" value={nuevaPersona.nombre} onChange={(e) => setNuevaPersona({ ...nuevaPersona, nombre: e.target.value })} />
                          <input className={campo} inputMode="tel" placeholder="WhatsApp" value={nuevaPersona.whatsapp} onChange={(e) => setNuevaPersona({ ...nuevaPersona, whatsapp: e.target.value })} />
                          <input className={campo} type="email" placeholder="Correo (opcional)" value={nuevaPersona.correo} onChange={(e) => setNuevaPersona({ ...nuevaPersona, correo: e.target.value })} />
                          <div className="sm:col-span-3 flex gap-2">
                            <button type="button" disabled={!nuevaPersona.nombre.trim() || haciendo === 'persona'} onClick={() => void agregarPersona()} className={botonPrincipal}>{haciendo === 'persona' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Agregar</button>
                            <button type="button" onClick={() => setNuevaPersona(null)} className={botonSuave}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {lalanPuede && (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-violet-50/70 dark:bg-violet-950/20">
                        <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
                          <b className="flex items-center gap-1"><Bot className="w-4 h-4 text-violet-600" /> Que Lalan le pida el precio ya</b>
                          <span className={`block text-[0.6875rem] ${como.listo ? 'text-slate-500' : 'text-amber-700 dark:text-amber-400'}`}>{como.texto}</span>
                        </span>
                        <IOSToggle checked={lalanPide && como.listo} onChange={setLalanPide} disabled={!como.listo} ariaLabel="Que Lalan le pida el precio ya" />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {puedeCambiar && (
                        <button type="button" disabled={!!haciendo} onClick={() => void hacer('cambiar')} className={modo === 'cambiar' ? botonPrincipal : botonSuave}>
                          {haciendo === 'cambiar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Cambiar a {p.nombre}
                        </button>
                      )}
                      {!p.yaCotiza && (
                        <button type="button" disabled={!!haciendo} onClick={() => void hacer('otro')} className={modo === 'otro' || !puedeCambiar ? botonPrincipal : botonSuave}
                          title={`${pedido.numero} sigue con ${pedido.proveedor.nombre}; se arma otro igual para ${p.nombre} y los comparas`}>
                          {haciendo === 'otro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />} Pedirle lo mismo también
                        </button>
                      )}
                    </div>
                    {!puedeCambiar && <p className="text-[0.6875rem] text-slate-500">A {pedido.proveedor.nombre} ya se le pidió precio: se queda, y este otro va a la comparación.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {sugeridos.length > 0 && (
          <div className="p-3 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/60 dark:bg-violet-950/20 space-y-2">
            <p className="text-[0.75rem] font-bold text-violet-800 dark:text-violet-300 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> De la lista de Lalan: también lo venden</p>
            {sugeridos.slice(0, 4).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[12rem] text-[0.8125rem]">
                  <b className="text-slate-900 dark:text-white">{s.nombre}</b>
                  <span className="text-slate-600 dark:text-neutral-300"> · {s.productos.filter((x) => pedido.lineas.some((l) => l.productId === x.id)).map((x) => x.nombre).slice(0, 3).join(', ')}</span>
                </div>
                <button type="button" disabled={haciendo === s.id} onClick={() => void agregarSugerido(s)} className={botonSuave}>{haciendo === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregarlo y elegirlo</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </IOSModal>
  );
};

/**
 * Las demás personas del proveedor (la de la ficha es la principal): un
 * vendedor por zona, el de cobros. En cada pedido se elige con quién se habla.
 */
export const PersonasDelProveedor: React.FC<{ proveedorId: string; nombre: string; contactos: ContactoGuardado[]; onCambio: (c: ContactoGuardado[]) => void }> = ({ proveedorId, nombre, contactos, onCambio }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [nueva, setNueva] = useState<{ nombre: string; cargo: string; whatsapp: string; correo: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const agregar = async () => {
    if (!nueva?.nombre.trim()) return;
    setGuardando(true);
    try {
      const c = await comprasApi.crearContacto(proveedorId, { nombre: nueva.nombre, cargo: nueva.cargo || null, whatsapp: nueva.whatsapp || null, correo: nueva.correo || null });
      onCambio([...contactos, c]); setNueva(null);
    } catch (e) { showToast('No se pudo agregar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };
  const quitar = async (c: ContactoGuardado) => {
    if (!(await confirmar({ titulo: `¿Quitar a ${c.nombre}?`, mensaje: 'Los pedidos en que hablabas con esta persona vuelven al contacto de la ficha.', tono: 'peligro', textoConfirmar: 'Quitar' }))) return;
    try { await comprasApi.borrarContacto(c.id); onCambio(contactos.filter((x) => x.id !== c.id)); }
    catch (e) { showToast('No se pudo quitar', (e as Error).message, 'warning'); }
  };

  return (
    <div className="space-y-1.5">
      {modalConfirmar}
      <h4 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Otras personas de {nombre}</h4>
      {!contactos.length && !nueva && <p className="text-[0.75rem] text-slate-500">Si en {nombre} te atiende más de una persona (un vendedor por zona, el de cobros), agrégalas y elige con quién hablas en cada pedido.</p>}
      {contactos.map((c) => (
        <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-neutral-800">
          <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="flex-1 min-w-0 text-[0.8125rem]">
            <b className="text-slate-900 dark:text-white">{c.nombre}</b>{c.cargo && <span className="text-slate-500"> · {c.cargo}</span>}
            <span className="block text-[0.75rem] text-slate-500 truncate">{[c.whatsapp, c.correo].filter(Boolean).join(' · ') || 'Sin WhatsApp ni correo'}</span>
          </span>
          <button type="button" onClick={() => void quitar(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer" aria-label={`Quitar a ${c.nombre}`}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {nueva ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <input className={campo} autoFocus placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          <input className={campo} placeholder="Qué hace (opcional): vendedora zona este" value={nueva.cargo} onChange={(e) => setNueva({ ...nueva, cargo: e.target.value })} />
          <input className={campo} inputMode="tel" placeholder="WhatsApp" value={nueva.whatsapp} onChange={(e) => setNueva({ ...nueva, whatsapp: e.target.value })} />
          <input className={campo} type="email" placeholder="Correo" value={nueva.correo} onChange={(e) => setNueva({ ...nueva, correo: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2">
            <button type="button" disabled={!nueva.nombre.trim() || guardando} onClick={() => void agregar()} className={botonPrincipal}>{guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Agregar</button>
            <button type="button" onClick={() => setNueva(null)} className={botonSuave}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setNueva({ nombre: '', cargo: '', whatsapp: '', correo: '' })} className={`${botonSuave} w-full`}><Plus className="w-4 h-4" /> Agregar otra persona</button>
      )}
    </div>
  );
};

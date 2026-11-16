import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Globe, Link2, Loader2, MapPin, Share2, Sparkles, TriangleAlert } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../context/PlanContext';
import { IOSModal } from '../ui/IOSModal';
import { pedirSeccionAjustes } from '../ajustes/MenuAjustes';
import { BotonDeTarjeta } from './TarjetaCatalogo';

type Tipo = 'servicio' | 'producto';

interface EnlaceDeSede {
  sede: { id: string; nombre: string };
  url: string | null;
  motivo: string | null;
  arreglo: 'plan' | 'vitrina' | 'item' | 'bloque' | null;
}

interface Enlaces {
  tipo: Tipo;
  nombre: string;
  nombreCorto: string | null;
  /** Sin sede: la clienta elige a cuál va (solo con varias sedes que lo tienen) */
  sinSede?: string | null;
  sedes: EnlaceDeSede[];
}

/** Qué servicio o producto pide su link, y cómo marcarlo «sale en la Vitrina» si es lo que falta */
export interface PedidoDeEnlace {
  tipo: Tipo;
  id: string;
  publicar: () => Promise<unknown> | void;
}

/**
 * El botón de la tarjeta del catálogo que da el enlace directo a ese
 * servicio o producto en la Vitrina: para pegarlo en una historia de
 * Instagram, en el estado de WhatsApp o en un chat. Quien lo abre cae en su
 * ficha con «Reservar ahora» (o «Pedirlo por WhatsApp», si es un producto).
 * Sin la Vitrina en el plan no aparece. La hoja va aparte, en la pantalla
 * (HojaEnlaceDirecto): dentro de la tarjeta quedaba encerrada en la lista.
 */
export const BotonEnlaceDirecto: React.FC<{ tipo: Tipo; abrir: () => void }> = ({ tipo, abrir }) => {
  const { tieneModulo } = usePlan();
  if (!tieneModulo('vitrina')) return null;
  return (
    <BotonDeTarjeta titulo={`Link de este ${tipo} para compartir`} onClick={abrir}>
      <Link2 className="w-3.5 h-3.5" />
    </BotonDeTarjeta>
  );
};

/** La hoja «Link para compartir». Va en la raíz de la pantalla, como las demás hojas */
export const HojaEnlaceDirecto: React.FC<{ pedido: PedidoDeEnlace | null; cerrar: () => void }> = ({ pedido, cerrar }) => (
  <IOSModal
    isOpen={!!pedido} onClose={cerrar} id="enlace-directo"
    title="Link para compartir" subtitle="Pégalo en tu historia de Instagram, tu estado o un chat"
    fixedHeight={false} height="auto" forma="angosta"
  >
    {pedido && <HojaDeEnlaces key={pedido.id} tipo={pedido.tipo} id={pedido.id} publicar={pedido.publicar} cerrar={cerrar} />}
  </IOSModal>
);

function HojaDeEnlaces({ tipo, id, publicar, cerrar }: { tipo: Tipo; id: string; publicar: () => Promise<unknown> | void; cerrar: () => void }) {
  const { navigateTo } = useApp();
  const { currentUser } = useAuth();
  const [datos, setDatos] = useState<Enlaces | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    api.get<Enlaces>(`/vitrina/enlace?tipo=${tipo}&id=${encodeURIComponent(id)}`)
      .then(setDatos)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudo sacar el link'));
  }, [tipo, id]);
  useEffect(cargar, [cargar]);

  const esAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const irAVitrina = () => { cerrar(); pedirSeccionAjustes('vitrina'); navigateTo('settings'); };
  const marcar = async () => {
    setPublicando(true);
    try { await publicar(); cargar(); } finally { setPublicando(false); }
  };

  if (error) return <p className="py-6 text-center text-sm text-rose-600">{error}</p>;
  if (!datos) return <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" aria-label="Cargando" /></div>;

  const varias = datos.sedes.length > 1;
  return (
    <div className="space-y-3 pb-2">
      <p className="text-[0.8125rem] text-slate-600 dark:text-neutral-300">
        Quien lo toque cae directo en <b className="text-slate-900 dark:text-white">{datos.nombre}</b>
        {tipo === 'servicio' ? ', con las fotos, el precio y el botón «Reservar ahora».' : ', con las fotos, el precio y «Pedirlo por WhatsApp».'}
      </p>

      {!datos.sedes.length && (
        <p className="p-3 rounded-xl bg-amber-500/10 text-[0.8125rem] text-amber-800 dark:text-amber-300">
          Ninguna sede tuya {tipo === 'servicio' ? 'ofrece este servicio' : 'vende este producto'} todavía.
        </p>
      )}

      {datos.sinSede && (
        <div className="p-3 rounded-2xl border-2 border-[var(--primary)]/40 bg-[var(--primary)]/5 space-y-2">
          <div className="text-[0.75rem] font-bold text-slate-800 dark:text-neutral-100">Para todas las sedes</div>
          <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">La clienta elige a qué sede va y después se abre {tipo === 'servicio' ? 'el servicio' : 'el producto'}.</p>
          <EnlaceListo url={datos.sinSede} titulo={datos.nombre} />
        </div>
      )}
      {datos.sinSede && <div className="pt-1 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-400">O el de una sede</div>}

      {datos.sedes.map((s) => (
        <div key={s.sede.id} className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
          {varias && (
            <div className="flex items-center gap-1 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">
              <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" /> {s.sede.nombre}
            </div>
          )}
          {s.url ? (
            <EnlaceListo url={s.url} titulo={`${datos.nombre}${varias ? ` · ${s.sede.nombre}` : ''}`} />
          ) : (
            <div className="flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">{s.motivo}</p>
                {s.arreglo === 'item' && (
                  <button type="button" onClick={marcar} disabled={publicando}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fuchsia-500 text-white text-[0.75rem] font-bold cursor-pointer disabled:opacity-50">
                    {publicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />} Mostrarlo en la Vitrina
                  </button>
                )}
                {(s.arreglo === 'vitrina' || s.arreglo === 'bloque') && esAdmin && (
                  <button type="button" onClick={irAVitrina}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--primary)] text-white text-[0.75rem] font-bold cursor-pointer">
                    <Globe className="w-3.5 h-3.5" /> {s.arreglo === 'vitrina' ? 'Publicar la Vitrina' : 'Mostrar los productos'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {!datos.nombreCorto && datos.sedes.some((s) => s.url) && esAdmin && (
        <button type="button" onClick={irAVitrina}
          className="w-full flex items-center gap-2 p-3 rounded-2xl bg-[var(--primary)]/8 text-left cursor-pointer">
          <Sparkles className="w-4 h-4 shrink-0 text-[var(--primary)]" />
          <span className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
            <b>¿Un link más corto y bonito?</b> Elige el nombre de tu salón en Ajustes → Vitrina (como tu usuario de Instagram).
          </span>
        </button>
      )}
    </div>
  );
}

/** El link a la vista, con «Copiar» y, en el teléfono, «Compartir» (abre Instagram, WhatsApp…) */
function EnlaceListo({ url, titulo }: { url: string; titulo: string }) {
  const { showToast } = useApp();
  const [copiado, setCopiado] = useState(false);
  const visible = url.replace(/^https?:\/\//, '');
  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
      showToast('Link copiado', 'Pégalo en tu historia, tu estado o un chat.', 'success');
    } catch {
      showToast('No se pudo copiar', 'Mantén el dedo sobre el link para copiarlo.', 'warning');
    }
  };
  const compartir = async () => {
    try { await navigator.share({ title: titulo, url }); } catch { /* la cerró */ }
  };

  return (
    <div className="space-y-2">
      <a href={url} target="_blank" rel="noreferrer"
        className="block px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 text-[0.8125rem] font-semibold text-[var(--primary)] break-all select-all">
        {visible}
      </a>
      <div className={`grid gap-2 ${puedeCompartir ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button type="button" onClick={copiar}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-[var(--primary)] text-white text-[0.8125rem] font-bold cursor-pointer ios-touch">
          {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiado ? 'Copiado' : 'Copiar link'}
        </button>
        {puedeCompartir && (
          <button type="button" onClick={compartir}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold text-slate-800 dark:text-neutral-100 cursor-pointer ios-touch">
            <Share2 className="w-4 h-4" /> Compartir
          </button>
        )}
      </div>
    </div>
  );
}

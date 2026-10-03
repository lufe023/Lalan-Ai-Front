import React, { useState } from 'react';
import { Copy, MessageCircle, Check, KeyRound } from 'lucide-react';

/**
 * La clave temporal recién creada: se ve UNA vez. Se puede copiar o mandar
 * por WhatsApp con el mensaje ya escrito.
 */
export const ClaveParaCompartir: React.FC<{
  nombre: string;
  /** Con qué puede entrar: usuario, teléfono y/o correo */
  entraCon?: string[];
  /** Versión vieja: solo el correo */
  email?: string | null;
  clave: string; telefono?: string | null; salon?: string; onListo: () => void;
}> = ({ nombre, entraCon, email, clave, telefono, salon, onListo }) => {
  const [copiado, setCopiado] = useState(false);
  const enlace = `${window.location.origin}/app/`;
  const llaves = (entraCon?.length ? entraCon : [email]).filter((x): x is string => !!x);
  const entra = llaves.join(' o ');
  const mensaje = `Hola ${nombre.split(' ')[0]}, ya está listo tu acceso a Lalan${salon ? ` para ${salon}` : ''} 🎉\n\nEntra aquí: ${enlace}\nEntra con: ${entra}\nClave temporal: ${clave}\n\nAl entrar te pedirá poner tu propia clave.`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(mensaje); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin permiso de portapapeles */ }
  };
  return (
    <div className="p-4 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 space-y-3 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-[0.875rem]"><KeyRound className="w-4 h-4" /> Acceso listo para {nombre}</div>
      <div className="text-[0.8125rem] text-slate-700 dark:text-neutral-200 space-y-1">
        <div>Entra con: <b className="break-all">{entra}</b></div>
        <div>Clave temporal: <b className="font-mono text-[1rem] tracking-wide select-all">{clave}</b></div>
        <p className="text-[0.75rem] text-slate-500">Guárdala ahora: por seguridad no se vuelve a mostrar. Si se pierde, genera otra.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {telefono && (
          <a href={`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[0.8125rem] font-bold hover:bg-emerald-700">
            <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
          </a>
        )}
        <button type="button" onClick={() => void copiar()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold cursor-pointer">
          {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}{copiado ? 'Copiado' : 'Copiar mensaje'}
        </button>
        <button type="button" onClick={onListo} className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-slate-500 cursor-pointer">Listo</button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Check, Loader2, Truck } from 'lucide-react';
import { publicRequest } from '../services/api';
import { campo, etiqueta } from '../components/compras/piezas';

/**
 * Página pública (#/proveedores) donde un distribuidor se anota en la lista
 * de Lalan. Queda como solicitud: el super admin la revisa en Plataforma →
 * Proveedores y, al publicarla, se sugiere a los salones de su ciudad.
 */
export const RegistroProveedorScreen: React.FC = () => {
  const [f, setF] = useState({ nombre: '', contacto: '', whatsapp: '', correo: '', telefono: '', web: '', pais: 'DO', ciudades: '', marcas: '', descripcion: '', sitio: '' });
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }) });
  const lista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      await publicRequest('/proveedores/registro', { method: 'POST', body: { ...f, ciudades: lista(f.ciudades), marcas: lista(f.marcas), pais: f.pais.toUpperCase() } });
      setListo(true);
    } catch (err) { setError((err as Error).message || 'No se pudo enviar'); }
    finally { setEnviando(false); }
  };

  return (
    <div className="min-h-screen bg-[#fbf7f4] dark:bg-neutral-950 text-slate-900 dark:text-white flex justify-center px-4 py-10 overflow-y-auto">
      <div className="w-full max-w-lg space-y-5">
        <div className="space-y-2 text-center">
          <span className="inline-grid place-items-center size-12 rounded-2xl bg-[#a34d6d] text-white"><Truck className="w-6 h-6" /></span>
          <h1 className="text-2xl font-extrabold">Vende a los salones de Lalan</h1>
          <p className="text-[0.875rem] text-slate-600 dark:text-neutral-300">Anota tu empresa, lo que distribuyes y dónde entregas. Cuando un salón de tu zona compre algo que vendes, Lalan le sugiere tu nombre.</p>
        </div>
        {listo ? (
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 text-center space-y-2">
            <Check className="w-10 h-10 text-emerald-500 mx-auto" />
            <h2 className="font-bold text-lg">¡Gracias! Te anotamos.</h2>
            <p className="text-[0.875rem] text-slate-600 dark:text-neutral-300">Revisamos tus datos y te escribimos cuando estés en la lista.</p>
          </div>
        ) : (
          <form onSubmit={(e) => void enviar(e)} className="p-5 rounded-3xl bg-white dark:bg-neutral-900 space-y-3 shadow-sm">
            <label className="block"><span className={etiqueta}>Nombre de la empresa</span><input required className={campo} {...t('nombre')} /></label>
            <label className="block"><span className={etiqueta}>Persona de contacto</span><input className={campo} {...t('contacto')} /></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block"><span className={etiqueta}>WhatsApp</span><input className={campo} inputMode="tel" placeholder="18095551234" {...t('whatsapp')} /></label>
              <label className="block"><span className={etiqueta}>Correo</span><input className={campo} type="email" {...t('correo')} /></label>
              <label className="block"><span className={etiqueta}>Teléfono</span><input className={campo} inputMode="tel" {...t('telefono')} /></label>
              <label className="block"><span className={etiqueta}>Página web</span><input className={campo} {...t('web')} /></label>
              <label className="block"><span className={etiqueta}>País (dos letras)</span><input className={campo} maxLength={2} {...t('pais')} /></label>
              <label className="block"><span className={etiqueta}>Ciudades donde entregas</span><input className={campo} placeholder="Santo Domingo, Santiago" {...t('ciudades')} /></label>
            </div>
            <label className="block"><span className={etiqueta}>Marcas que distribuyes</span><input className={campo} placeholder="OPI, L'Oréal, Wella" {...t('marcas')} /></label>
            <label className="block"><span className={etiqueta}>Qué vendes</span><textarea className={`${campo} min-h-[80px]`} placeholder="Tintes, esmaltes, acetona, insumos de spa…" {...t('descripcion')} /></label>
            {/* Campo trampa: las personas no lo ven */}
            <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" {...t('sitio')} />
            {error && <p className="text-[0.8125rem] text-rose-600">{error}</p>}
            <button type="submit" disabled={enviando || !f.nombre.trim() || (!f.whatsapp.trim() && !f.correo.trim())} className="w-full py-3 rounded-xl bg-[#a34d6d] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Anotarme
            </button>
            <p className="text-[0.6875rem] text-slate-500 text-center">Déjanos un WhatsApp o un correo para escribirte.</p>
          </form>
        )}
      </div>
    </div>
  );
};

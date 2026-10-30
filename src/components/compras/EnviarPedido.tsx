import React, { useEffect, useState } from 'react';
import { Loader2, Mail, MessageCircle, Printer } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { useApp } from '../../context/AppContext';
import { comprasApi, type Pedido } from '../../services/compras';
import { botonPrincipal, botonSuave, botonWhatsapp, campo, etiqueta } from './piezas';
import { EnlaceCorreoSalon } from './CorreoDeCompras';

/**
 * Mandar el pedido: se ve el mensaje tal como le llega al proveedor y se
 * puede cambiar. WhatsApp sale desde el teléfono de quien lo manda (gratis),
 * el correo sale desde Lalan con la hoja en PDF, e imprimir abre la hoja.
 * Si al proveedor le falta el número o el correo, se pone ahí mismo.
 */
export const EnviarPedido: React.FC<{
  pedido: Pedido | null;
  como: 'cotizacion' | 'orden';
  onClose: () => void;
  onEnviado: (p: Pedido) => void;
}> = ({ pedido, como, onClose, onEnviado }) => {
  const { showToast } = useApp();
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [correo, setCorreo] = useState('');

  useEffect(() => {
    if (!pedido) return;
    setCargando(true);
    setWhatsapp(pedido.proveedor.whatsapp ?? '');
    setCorreo(pedido.proveedor.correo ?? '');
    comprasApi.mensaje(pedido.id, como).then((m) => setTexto(m.texto)).catch(() => setTexto('')).finally(() => setCargando(false));
  }, [pedido, como]);

  if (!pedido) return null;
  const faltaWhatsapp = !pedido.proveedor.whatsapp;
  const faltaCorreo = !pedido.proveedor.correo;

  /** Guarda en la ficha del proveedor lo que faltaba, antes de mandar */
  const completarFicha = async (que: 'whatsapp' | 'correo') => {
    const valor = que === 'whatsapp' ? whatsapp.trim() : correo.trim();
    if (!valor) throw new Error(que === 'whatsapp' ? 'Escribe el WhatsApp del proveedor' : 'Escribe el correo del proveedor');
    await comprasApi.editarProveedor(pedido.proveedor.id, { [que]: valor });
  };

  const mandar = async (canal: 'whatsapp' | 'correo' | 'impreso') => {
    // La ventana se abre en el mismo toque: si se abre después de esperar al servidor, el navegador la bloquea
    const ventana = canal === 'whatsapp' ? window.open('', '_blank') : null;
    setEnviando(canal);
    try {
      if (canal === 'whatsapp' && faltaWhatsapp) await completarFicha('whatsapp');
      if (canal === 'correo' && faltaCorreo) await completarFicha('correo');
      if (canal === 'impreso') await comprasApi.abrirPdf(pedido.id, como);
      const r = await comprasApi.enviar(pedido.id, { canal, como, mensaje: texto });
      if (canal === 'whatsapp' && r.enlace) {
        if (ventana) ventana.location.href = r.enlace; else window.location.href = r.enlace;
      }
      showToast(
        canal === 'correo' ? 'Correo enviado' : canal === 'whatsapp' ? 'Listo para mandar' : 'Hoja abierta',
        canal === 'correo' ? `Le llegó a ${r.orden.proveedor.correo} con la hoja en PDF.` : canal === 'whatsapp' ? 'Toca enviar en WhatsApp. Quedó anotado en el historial.' : 'Imprímela desde ahí. Quedó anotado en el historial.',
        'success',
      );
      onEnviado(r.orden);
      onClose();
    } catch (e) {
      ventana?.close();
      showToast('No se pudo mandar', (e as Error).message || 'Intenta otra vez.', 'warning');
    } finally { setEnviando(null); }
  };

  const titulo = como === 'cotizacion' ? 'Pedir precio' : 'Mandar la orden';
  return (
    <IOSModal isOpen={!!pedido} onClose={onClose} title={titulo} subtitle={`${pedido.numero} · ${pedido.proveedor.nombre}`} fixedHeight={false}>
      <div className="space-y-3 p-1">
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
          {como === 'cotizacion'
            ? 'Así le llega al proveedor. No lleva precios: se los pides. Cuando te conteste, anota lo que dijo en el historial.'
            : 'Así le llega al proveedor, con precios y total. Al mandarla, el pedido pasa a orden de compra.'}
        </p>
        <label className="block">
          <span className={etiqueta}>Mensaje</span>
          {cargando
            ? <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Escribiendo el pedido…</div>
            : <textarea className={`${campo} min-h-[180px] font-[inherit] leading-relaxed`} value={texto} onChange={(e) => setTexto(e.target.value)} />}
        </label>

        {faltaWhatsapp && (
          <label className="block">
            <span className={etiqueta}>WhatsApp de {pedido.proveedor.nombre} (se guarda en su ficha)</span>
            <input className={campo} inputMode="tel" placeholder="18095551234" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </label>
        )}
        {faltaCorreo && (
          <label className="block">
            <span className={etiqueta}>Correo de {pedido.proveedor.nombre} (se guarda en su ficha)</span>
            <input className={campo} type="email" placeholder="ventas@proveedor.com" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </label>
        )}

        {/* El correo sale con el nombre del salón; la respuesta llega al correo que se conectó en Ajustes */}
        <EnlaceCorreoSalon onIr={onClose} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button type="button" disabled={!!enviando || cargando || (faltaWhatsapp && !whatsapp.trim())} onClick={() => void mandar('whatsapp')} className={botonWhatsapp}>
            {enviando === 'whatsapp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} Por WhatsApp
          </button>
          <button type="button" disabled={!!enviando || cargando || (faltaCorreo && !correo.trim())} onClick={() => void mandar('correo')} className={botonPrincipal}>
            {enviando === 'correo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Por correo
          </button>
          <button type="button" disabled={!!enviando || cargando} onClick={() => void mandar('impreso')} className={botonSuave}>
            {enviando === 'impreso' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Imprimir
          </button>
        </div>
      </div>
    </IOSModal>
  );
};

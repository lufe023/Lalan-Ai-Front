import React, { useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { vinoDeUnEnlace } from '../../services/enlaceEntrada';
import { esTelefono, instalarDirecto } from '../../services/instalarApp';
import { GuiaInstalar, useComoInstalar } from './InstalarApp';

/** Cerrado con la X: no vuelve a salir en un mes (antes salía cada vez que se entraba) */
const CLAVE_CERRADO = 'lalan_instalar_cerrado_hasta';
const DIAS_CERRADO = 30;
function cerradoVigente(): boolean {
  try { return Number(localStorage.getItem(CLAVE_CERRADO) ?? 0) > Date.now(); } catch { return false; }
}
function cerrarPorUnMes() {
  try { localStorage.setItem(CLAVE_CERRADO, String(Date.now() + DIAS_CERRADO * 24 * 60 * 60 * 1000)); } catch { /* sin almacenamiento: solo por ahora */ }
}

/**
 * La cinta de arriba «Instala Lalan». El aviso del navegador se guarda en
 * services/instalarApp (se da una sola vez al cargar), así que el mismo
 * botón de un toque sirve aquí, en la Bienvenida y al pedir los avisos.
 */
export const PWAInstallBanner: React.FC = () => {
  const como = useComoInstalar();
  const [guia, setGuia] = useState(false);
  const [dismissed, setDismissed] = useState(() => cerradoVigente());

  // Si ya está instalada o fue descartada, no mostrar nada. Tampoco si llegó por
  // el enlace de un aviso: ya usa Lalan (en iPhone el enlace abre Safari aunque tenga la app)
  if (como === 'instalada' || dismissed || vinoDeUnEnlace()) return null;
  // En la computadora sin botón de un toque no se insiste con la cinta (está en Ajustes y en la Bienvenida)
  if (como !== 'directo' && como !== 'iphone' && !(esTelefono() && como === 'dentro-de-app')) return null;

  const iphone = como === 'iphone';
  return (
    <>
      <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary)]/90 text-white px-3 py-2 text-xs flex items-center justify-between shadow-sm shrink-0 z-40 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <span className="truncate font-medium">
            {iphone ? 'Instala Lalan en tu iPhone para abrir a pantalla completa'
              : como === 'dentro-de-app' ? 'Abre Lalan en tu navegador para instalarla'
              : esTelefono() ? 'Instala la app en tu teléfono' : 'Instala Lalan en esta computadora'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={() => { if (como === 'directo') void instalarDirecto(); else setGuia(true); }}
            className="px-2.5 py-1 rounded-md bg-white text-[var(--primary)] font-bold text-[0.75rem] shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            {como === 'directo' ? 'Instalar' : 'Cómo hacerlo'}
          </button>
          <button
            onClick={() => { cerrarPorUnMes(); setDismissed(true); }}
            className="p-1 text-white/80 hover:text-white transition cursor-pointer"
            title="Cerrar por un mes"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <GuiaInstalar abierta={guia} onCerrar={() => setGuia(false)} />
    </>
  );
};

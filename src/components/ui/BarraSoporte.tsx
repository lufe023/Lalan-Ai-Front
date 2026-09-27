import React from 'react';
import { LifeBuoy, LogOut } from 'lucide-react';
import { salirDeSoporte } from '../../services/soporte';

/** Siempre a la vista mientras se está dentro del salón de un cliente */
export const BarraSoporte: React.FC<{ negocio: string }> = ({ negocio }) => (
  <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-amber-500 text-white shadow-lg text-[12px] font-bold max-w-[92vw]">
    <LifeBuoy className="w-4 h-4 shrink-0" />
    <span className="truncate">Soporte · estás dentro de {negocio}</span>
    <button type="button" onClick={salirDeSoporte} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer shrink-0">
      <LogOut className="w-3.5 h-3.5" /> Salir
    </button>
  </div>
);

import React, { useEffect, useState } from 'react';
import { Cake } from 'lucide-react';

/**
 * Cumpleaños: día y mes (el año es opcional, mucha gente no lo dice).
 * El valor viaja como el servidor lo entiende: "MM-DD" o "AAAA-MM-DD";
 * "" lo quita. Lalan lo usa para recordarlo en «Tu día».
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Lo que guarda el servidor (cumpleMesDia + cumpleAnio) al valor del campo */
export function cumpleDeApi(mesDia?: string | null, anio?: number | null): string {
  if (!mesDia) return '';
  return anio ? `${anio}-${mesDia}` : mesDia;
}

function partes(valor: string): { mes: number; dia: number; anio: string } {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (iso) return { anio: iso[1], mes: Number(iso[2]), dia: Number(iso[3]) };
  const md = /^(\d{2})-(\d{2})$/.exec(valor);
  if (md) return { anio: '', mes: Number(md[1]), dia: Number(md[2]) };
  return { anio: '', mes: 0, dia: 0 };
}

const dos = (n: number) => String(n).padStart(2, '0');

/** "12 de noviembre" o "12 de noviembre de 1990" */
export function cumpleTexto(valor?: string | null): string {
  const p = partes(valor ?? '');
  if (!p.mes || !p.dia) return '';
  return `${p.dia} de ${MESES[p.mes - 1]}${p.anio ? ` de ${p.anio}` : ''}`;
}

interface Props {
  valor: string;
  onCambio: (valor: string) => void;
  etiqueta?: string;
}

const claseCampo = 'px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition text-[0.875rem]';

export const CampoCumple: React.FC<Props> = ({ valor, onCambio, etiqueta = 'Cumpleaños' }) => {
  const p = partes(valor);
  const [anio, setAnio] = useState(p.anio);
  useEffect(() => { setAnio(partes(valor).anio); }, [valor]);

  const armar = (mes: number, dia: number, anio: string) => {
    if (!mes || !dia) { onCambio(''); return; }
    const diaOk = Math.min(dia, DIAS_MES[mes - 1]);
    const a = /^\d{4}$/.test(anio) ? anio : '';
    onCambio(a ? `${a}-${dos(mes)}-${dos(diaOk)}` : `${dos(mes)}-${dos(diaOk)}`);
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
        <Cake className="w-3.5 h-3.5 text-[var(--primary)]" />
        {etiqueta}
        <span className="font-normal text-slate-400">(opcional, Lalan te lo recuerda)</span>
      </label>
      <div className="grid grid-cols-[4.5rem_1fr_5.5rem] gap-1.5">
        <select aria-label="Día" value={p.dia || ''} onChange={e => armar(p.mes || 1, Number(e.target.value), p.anio)} className={claseCampo}>
          <option value="">Día</option>
          {Array.from({ length: p.mes ? DIAS_MES[p.mes - 1] : 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select aria-label="Mes" value={p.mes || ''} onChange={e => armar(Number(e.target.value), p.dia || 1, p.anio)} className={claseCampo}>
          <option value="">Mes</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input
          aria-label="Año (opcional)"
          inputMode="numeric"
          maxLength={4}
          placeholder="Año"
          value={anio}
          disabled={!p.mes || !p.dia}
          onChange={e => {
            const a = e.target.value.replace(/\D/g, '').slice(0, 4);
            setAnio(a);
            if (a.length === 4 || a === '') armar(p.mes, p.dia, a);
          }}
          className={`${claseCampo} disabled:opacity-50`}
        />
      </div>
      {valor && (
        <button type="button" onClick={() => onCambio('')} className="mt-1 text-[0.6875rem] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">
          Quitar cumpleaños
        </button>
      )}
    </div>
  );
};

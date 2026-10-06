import React, { useEffect, useState } from 'react';
import { ExternalLink, Wallet } from 'lucide-react';
import { api } from '../../services/api';

interface Costos {
  quienPaga: 'salon' | 'lalan';
  desde: string;
  moneda: string | null;
  total: number | null;
  porTipo: { tipo: string; mensajes: number; gratis: number; costo: number }[];
  detalle: string | null;
}

/** Cómo se llama cada tipo de mensaje de Meta, en palabras de la dueña */
const TIPO: Record<string, string> = {
  utility: 'Recordatorios y avisos',
  marketing: 'Promociones',
  authentication: 'Códigos',
  service: 'Respuestas a tus clientas',
};
/** Donde la dueña ve su tarjeta y sus facturas de Meta */
const FACTURACION_META = 'https://business.facebook.com/billing_hub/payment_settings';

/**
 * Lo que cobra Meta por WhatsApp. Responder a una clienta que escribió es
 * gratis; lo que Lalan manda primero (un recordatorio, un aviso a la dueña
 * cuando nadie ha escrito en 24 h) es una plantilla y Meta la cobra a la
 * cuenta de WhatsApp del salón. Meta no da el saldo de la tarjeta: aquí va
 * lo gastado este mes y el enlace a su facturación.
 */
export const CostosWhatsapp: React.FC<{ sede?: string }> = ({ sede }) => {
  const [c, setC] = useState<Costos | null>(null);
  useEffect(() => {
    api.get<Costos>(`/bots/conexion/costos${sede ? `?sede=${encodeURIComponent(sede)}` : ''}`).then(setC).catch(() => setC(null));
  }, [sede]);

  const dinero = (n: number) => `${c?.moneda === 'USD' || !c?.moneda ? 'US$' : `${c.moneda} `}${n.toFixed(2)}`;
  const cobrados = c?.porTipo.reduce((n, t) => n + t.mensajes - t.gratis, 0) ?? 0;
  const gratis = c?.porTipo.reduce((n, t) => n + t.gratis, 0) ?? 0;

  return (
    <div className="p-3 rounded-xl border border-amber-200/80 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 space-y-2 text-[0.75rem] text-amber-950 dark:text-amber-100">
      <div className="flex items-center gap-2 font-bold text-[0.8125rem]">
        <Wallet className="w-4 h-4 shrink-0" /> Lo que cobra Meta por WhatsApp
      </div>
      <p className="leading-relaxed">
        Contestarle a una clienta que te escribió es <b>gratis</b>. Lo que Lalan manda primero —un recordatorio de cita o un aviso
        para ti cuando nadie ha escrito en 24 horas— es una plantilla, y <b>Meta la cobra</b>
        {c?.quienPaga === 'lalan'
          ? <>. Ahora usas la cuenta de WhatsApp de Lalan: <b>esos los paga Lalan</b>.</>
          : <> a tu cuenta de WhatsApp Business, con la tarjeta que pusiste en Meta. Puedes apagarlos en Ajustes de Lalan («Aunque Meta lo cobre») y solo saldrán dentro de las 24 horas.</>}
      </p>
      {c && c.total !== null && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-black">{dinero(c.total)}</span>
          <span>este mes · {cobrados} cobrados · {gratis} gratis</span>
        </div>
      )}
      {c && c.porTipo.some((t) => t.mensajes) && (
        <ul className="space-y-0.5">
          {c.porTipo.filter((t) => t.mensajes).map((t) => (
            <li key={t.tipo} className="flex justify-between gap-2">
              <span>{TIPO[t.tipo] ?? t.tipo}</span>
              <span className="font-semibold">{t.mensajes} · {dinero(t.costo)}</span>
            </li>
          ))}
        </ul>
      )}
      {c?.detalle && <p className="opacity-70">Todavía no se puede ver el gasto: {c.detalle}</p>}
      {c?.quienPaga !== 'lalan' && (
        <a href={FACTURACION_META} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold underline">
          Ver tu tarjeta y tus facturas en Meta <ExternalLink className="w-3 h-3" />
        </a>
      )}
      <p className="opacity-70">Meta no comparte el saldo de tu tarjeta; el gasto se actualiza unas horas después de cada envío.</p>
    </div>
  );
};

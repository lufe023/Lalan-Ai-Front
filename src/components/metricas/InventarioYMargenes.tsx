import React from 'react';
import { AlertTriangle, PackageOpen, TrendingDown } from 'lucide-react';

/**
 * Inventario (alertas de stock) y rentabilidad por servicio (precio contra
 * costo de productos). Salió de la pantalla de Métricas tal cual; solo se
 * cambió el "$" fijo por la moneda del salón.
 */
export const InventarioYMargenes: React.FC<{
  stockAlerts: any[];
  serviceMargins: any[];
  navigateToCatalog: (o: { serviceId?: string; tab?: 'config' | 'recipe' }) => void;
  dinero: (v: number) => string;
}> = ({ stockAlerts, serviceMargins, navigateToCatalog, dinero }) => (
  <>
        {/* ── Alertas de Inventario ──────────────────────────────────────── */}
        {stockAlerts.length > 0 && (
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Alertas de Inventario</span>
              <span className="ml-auto text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full">
                {stockAlerts.length} {stockAlerts.length === 1 ? 'alerta' : 'alertas'}
              </span>
            </div>
            <div className="space-y-2">
              {stockAlerts.map((alert, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <PackageOpen className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-700 dark:text-neutral-300">{alert.message}</p>
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">
                      Stock: {alert.currentStock} {alert.unit} · Consumo proyectado: {alert.projectedConsumption.toFixed(2)} {alert.unit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rentabilidad por Servicio ───────────────────────────────────── */}
        {serviceMargins.length > 0 && (
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Rentabilidad por Servicio</span>
              <div className="ml-auto flex items-center gap-1 group relative">
                <span className="text-[10px] text-slate-400 cursor-default">Costo vs Precio</span>
                <span className="text-[10px] text-slate-400 cursor-help">ⓘ</span>
                <div className="absolute bottom-5 right-0 w-56 bg-slate-800 text-white text-[10px] rounded-lg p-2.5 hidden group-hover:block z-50 leading-relaxed shadow-xl">
                  <strong>Costo de Producción (COGS)</strong> es cuánto te cuesta hacer el servicio en productos: esmaltes, aceites, tintes, etc. La ganancia es lo que queda después de restarle eso al precio que cobras.
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {serviceMargins.map((svc, idx) => {
                const isLoss = svc.marginPercent < 0;
                // Semáforo: rojo <20%, naranja 20-49%, verde 50%+
                const ratingColor = isLoss
                  ? '#ef4444'
                  : svc.marginPercent >= 50 ? '#10b981'
                  : svc.marginPercent >= 20 ? '#f59e0b'
                  : '#ef4444';
                const ratingLabel = isLoss ? 'Pérdida'
                  : svc.marginPercent >= 50 ? 'Excelente'
                  : svc.marginPercent >= 20 ? 'Ajustado'
                  : 'Bajo';
                const barBg = isLoss ? '#fee2e2' : svc.marginPercent >= 50 ? '#d1fae5' : svc.marginPercent >= 20 ? '#fef3c7' : '#fee2e2';
                const barWidth = isLoss ? 0 : Math.min(100, svc.marginPercent);
                // Tooltip texto
                const tooltipText = isLoss
                  ? `Por cada servicio de ${svc.serviceName} estás perdiendo ${dinero(Math.abs(svc.grossMargin))} porque el costo de los productos (${dinero(svc.totalCogs)}) supera el precio que cobras (${dinero(svc.basePrice)}).`
                  : svc.totalCogs === 0
                  ? `Aún no tiene receta o costo de productos configurado. Agrega los insumos en el Catálogo para ver la ganancia real.`
                  : `De cada ${dinero(svc.basePrice)} que cobras, ${dinero(svc.totalCogs)} se van en productos y te quedan ${dinero(svc.grossMargin)} de ganancia — el ${svc.marginPercent}% del precio.`;
                return (
                  <div key={idx} className="cursor-pointer group/row" onClick={() => navigateToCatalog({ serviceId: svc.serviceId, tab: 'recipe' })}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate flex-1 group-hover/row:underline group-hover/row:text-[var(--primary)]">{svc.serviceName}</span>
                      <div className="flex items-center gap-1.5 shrink-0 relative group/pct">
                        <span className="text-[10px] font-bold" style={{ color: ratingColor }}>{ratingLabel}</span>
                        <span className="text-xs font-extrabold cursor-help" style={{ color: ratingColor }}>
                          {isLoss ? `-${Math.abs(svc.marginPercent).toFixed(1)}%` : `${svc.marginPercent}%`}
                        </span>
                        {/* Tooltip del porcentaje */}
                        <div className="absolute bottom-5 right-0 w-60 bg-slate-800 text-white text-[10px] rounded-lg p-2.5 hidden group-hover/pct:block z-50 leading-relaxed shadow-xl">
                          {tooltipText}
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: barBg }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: ratingColor }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-slate-400">Precio: {dinero(svc.basePrice)}</span>
                      {isLoss ? (
                        <span className="text-[10px] font-semibold text-red-500">
                          ⚠ Costo ({dinero(svc.totalCogs)}) supera el precio · Pierdes {dinero(Math.abs(svc.grossMargin))} por servicio
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Costo: {dinero(svc.totalCogs)} · Ganancia: {dinero(svc.grossMargin)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {serviceMargins.some(s => s.totalCogs === 0) && (
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-3 text-center">
                * Servicios sin costo calculado: configura la receta y el precio de compra de cada producto en el Catálogo.
              </p>
            )}
          </div>
        )}

  </>
);

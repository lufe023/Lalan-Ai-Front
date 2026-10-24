import React, { useEffect, useState } from 'react';
import { Banknote, Link2, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';

/** Lo que recomienda Lalan para el adelanto. Restablecer no toca las cuentas ni el link: son de la dueña */
const RECOMENDADO = { depositPercent: 30, adelantoPlazoMinutos: 120 };
const PLAZOS = [30, 60, 120, 240, 1440];
const textoPlazo = (m: number) => (m < 60 ? `${m} min` : m === 1440 ? '1 día' : `${m / 60} h`);
const EJEMPLO_DATOS = 'Banco Popular · Cuenta de ahorros 800-123456-7\nA nombre de: Salón Bella SRL · RNC 1-31-00000-0\nTambién por Zelle: pagos@salonbella.com';

/**
 * Ajustes → Adelanto: si se pide, cuánto, a dónde se paga y cuánto se le
 * guarda la hora a quien todavía no pagó. Es de cada sede (cada sede puede
 * tener sus cuentas). Lalan copia las cuentas y el link tal cual: no inventa.
 */
export const AjustesAdelanto: React.FC = () => {
  const { settings, updateSettings, showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [pide, setPide] = useState(settings.requireDeposit);
  const [porcentaje, setPorcentaje] = useState(settings.depositPercent);
  const [datos, setDatos] = useState(settings.datosDePago ?? '');
  const [link, setLink] = useState(settings.linkDePago ?? '');
  const [plazo, setPlazo] = useState(settings.adelantoPlazoMinutos ?? RECOMENDADO.adelantoPlazoMinutos);
  const [error, setError] = useState('');

  // Al cambiar de sede (o al llegar lo guardado) se ve lo de esa sede
  useEffect(() => {
    setPide(settings.requireDeposit); setPorcentaje(settings.depositPercent);
    setDatos(settings.datosDePago ?? ''); setLink(settings.linkDePago ?? '');
    setPlazo(settings.adelantoPlazoMinutos ?? RECOMENDADO.adelantoPlazoMinutos);
  }, [settings.requireDeposit, settings.depositPercent, settings.datosDePago, settings.linkDePago, settings.adelantoPlazoMinutos]);

  const sinDondePagar = !datos.trim() && !link.trim();
  const ejemploMonto = Math.round(2000 * porcentaje) / 100;

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const limpio = link.trim();
    if (limpio && !/^https:\/\/\S{4,}$/i.test(limpio)) { setError('El link tiene que empezar con https:// y no llevar espacios.'); return; }
    if (pide && sinDondePagar) { setError('Para pedir adelanto, escribe tus cuentas o un link de pago: si no, Lalan no sabe a dónde mandar a pagar.'); return; }
    updateSettings({ requireDeposit: pide, depositPercent: porcentaje, datosDePago: datos.trim(), linkDePago: limpio, adelantoPlazoMinutos: plazo });
    showToast('Guardado', 'Lalan ya usa estas reglas del adelanto en esta sede.', 'success');
  };

  const restablecer = async () => {
    const si = await confirmar({
      titulo: '¿Volver a lo que recomienda Lalan?',
      mensaje: `Solo el adelanto: ${RECOMENDADO.depositPercent} % y guardar la hora ${textoPlazo(RECOMENDADO.adelantoPlazoMinutos)} a quien no ha pagado. Tus cuentas y tu link no se tocan.`,
      textoConfirmar: 'Restablecer',
    });
    if (!si) return;
    setPorcentaje(RECOMENDADO.depositPercent);
    setPlazo(RECOMENDADO.adelantoPlazoMinutos);
    updateSettings(RECOMENDADO);
  };

  const campo = 'w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none';
  const ejemplo = 'text-[0.6875rem] text-slate-500 dark:text-neutral-400 leading-relaxed';

  return (
    <form onSubmit={guardar} className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
      {modalConfirmar}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Banknote className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Adelanto para reservar</h3>
        </div>
        <button type="button" onClick={restablecer}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6875rem] font-bold text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 ios-touch cursor-pointer">
          <RotateCcw className="w-3 h-3" /> Restablecer
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.8125rem] font-bold text-slate-800 dark:text-neutral-100">Pedir adelanto al agendar por chat</p>
          <p className={ejemplo}>La cita queda apartada, no confirmada, hasta que tú veas el dinero en tu banco y lo registres en la cita.</p>
        </div>
        <IOSToggle checked={pide} onChange={setPide} ariaLabel="Pedir adelanto" />
      </div>

      {pide && (
        <>
          <label className="block">
            <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Cuánto (%)</span>
            <div className="flex items-center gap-1.5">
              <input type="number" min="1" max="100" step="5" value={porcentaje} onChange={e => setPorcentaje(Math.min(100, Math.max(0, Number(e.target.value))))}
                className={`${campo} font-bold`} />
              <span className="font-bold text-slate-400 text-sm">%</span>
            </div>
            <span className={ejemplo}>Ejemplo: con {porcentaje} %, una cita de 2,000 pide {ejemploMonto.toLocaleString('es')} de adelanto.</span>
          </label>

          <label className="block">
            <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Tus cuentas para el adelanto</span>
            <textarea rows={4} value={datos} onChange={e => setDatos(e.target.value)} maxLength={1500} placeholder={EJEMPLO_DATOS} className={campo} />
            <span className={ejemplo}>Lalan se las copia tal cual a la clienta. Pon el banco, el tipo de cuenta, el número y a nombre de quién. Puedes poner varias.</span>
          </label>

          <label className="block">
            <span className="flex items-center gap-1 text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1"><Link2 className="w-3.5 h-3.5" /> Link de pago (opcional)</span>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://paypal.me/salonbella" inputMode="url" className={campo} />
            <span className={ejemplo}>Un link fijo donde la clienta escribe el monto (PayPal.me, un link de tu banco o de tu pasarela). Lalan se lo manda junto con el monto.</span>
          </label>

          <div>
            <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Cuánto le guardas la hora si no ha pagado</span>
            <div className="grid grid-cols-5 gap-1">
              {PLAZOS.map(m => (
                <button key={m} type="button" onClick={() => setPlazo(m)}
                  className={`py-1 rounded-lg text-[0.6875rem] font-bold transition ios-touch cursor-pointer ${plazo === m
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300'}`}>
                  {textoPlazo(m)}
                </button>
              ))}
            </div>
            <span className={ejemplo}>
              Ejemplo: agenda a las 10:00 a. m. y no paga. A la mitad del plazo Lalan le recuerda; si a las {textoPlazo(plazo) === '1 día' ? '10:00 a. m. del día siguiente' : new Date(2026, 0, 1, 10, plazo).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true })} no
              ha llegado nada, la hora se suelta para otra clienta. Si agenda de noche, el plazo empieza a las 7:00 a. m., y siempre se suelta al menos una hora antes de la cita.
              Si manda el comprobante, la hora no se suelta mientras tú lo revisas.
            </span>
          </div>
        </>
      )}

      {error && <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}
      <button type="submit"
        className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer hover:opacity-90 shadow-sm">
        <Save className="w-3.5 h-3.5" /> Guardar adelanto
      </button>
    </form>
  );
};

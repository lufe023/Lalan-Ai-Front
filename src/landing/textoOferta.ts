/**
 * Cómo se dice una oferta en la tarjeta del plan. Lo usan la página y la
 * vista previa de Plataforma → Planes → Ofertas, para que lo que Luis ve
 * al armarla sea lo mismo que sale en la página.
 */
export interface OfertaTexto {
  planPrueba: string;
  meses: number;
  soloDesdeInicio: boolean;
  /** El plan al que pasa al terminar */
  despues: string;
}

export const meses = (n: number) => `${n} ${n === 1 ? 'mes' : 'meses'}`;

/** "Pruébalo con Plan Lounge 2 meses gratis" */
export const botonOferta = (o: OfertaTexto) => `Pruébalo con ${o.planPrueba} ${meses(o.meses)} gratis`;

/** La letra chica debajo del botón: cuándo vale y qué pasa después */
export const detalleOferta = (o: OfertaTexto) =>
  `${o.soloDesdeInicio ? 'Si lo contratas desde el inicio. ' : ''}Después sigues con el ${o.despues}.`;

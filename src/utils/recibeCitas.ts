/**
 * ¿A esta persona se le pueden poner citas? Lo que dijo la dueña; si no dijo
 * nada, según su especialidad. La misma regla que usa Lalan en el servidor
 * (chat/herramientas/especialistas.ts): bartender, recepción, caja,
 * limpieza… trabajan en el salón pero no atienden citas.
 */
const NO_ATIENDEN = /\b(bar ?tender|barman|barista|bar|meser[oa]s?|camarer[oa]|recepci[oó]n|recepcionista|cajer[oa]|caja|seguridad|vigilante|limpieza|conserje|chofer|mensajer[oa]|delivery|contador[a]?|contabilidad|community manager|redes sociales)\b/i;

export function recibeCitas(atiendeCitas: boolean | null | undefined, especialidad: string): boolean {
  if (typeof atiendeCitas === 'boolean') return atiendeCitas;
  return !NO_ATIENDEN.test(especialidad ?? '');
}

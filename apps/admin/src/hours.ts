export interface Slot {
  open: string;
  close: string;
}

/**
 * Conversion entre les créneaux du fichier client et la saisie texte du
 * formulaire : « 09:30-18:30, 19:00-21:00 ». Un jour vide est un jour fermé.
 *
 * Une ligne par jour plutôt que quatorze champs horaires : c'est la
 * modification la plus fréquente d'un salon, elle doit se faire en dix
 * secondes depuis un téléphone.
 */
export function parseSlots(value: string): Slot[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [open, close] = part.split("-").map((s) => s.trim());
      return { open: open ?? "", close: close ?? "" };
    });
}

export function formatSlots(slots: Slot[]): string {
  return slots.map((s) => `${s.open}-${s.close}`).join(", ");
}

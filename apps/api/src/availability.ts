/**
 * Calcul des créneaux disponibles.
 *
 * Fonction pure : aucune base, aucune horloge implicite, aucune configuration.
 * C'est la pièce la plus délicate de l'agenda et celle dont une erreur se voit
 * immédiatement chez le client — un créneau proposé puis refusé, ou pire, deux
 * clients au même fauteuil. Elle doit donc être testable exhaustivement.
 *
 * Elle ne garantit rien à elle seule : c'est la contrainte d'exclusion en base
 * qui empêche réellement le double, au moment de l'écriture. Ici on calcule ce
 * qu'on ose proposer.
 */

export interface TimeRange {
  /** « 09:30 » */
  opens: string;
  closes: string;
}

export interface Busy {
  start: Date;
  end: Date;
}

export interface Slot {
  /** Début du créneau. */
  start: Date;
  end: Date;
}

export interface AvailabilityInput {
  /** Jour demandé, au format YYYY-MM-DD. */
  day: string;
  /** Plages d'ouverture de ce jour de la semaine. Vide = fermé. */
  hours: TimeRange[];
  /** Rendez-vous déjà pris, toutes ressources confondues. */
  busy: Busy[];
  /** Nombre de personnes pouvant recevoir en parallèle. */
  resources: number;
  /** Durée de la prestation demandée, en minutes. */
  durationMin: number;
  /** Pas entre deux débuts proposés, en minutes. */
  stepMin?: number;
  /** Délai minimum avant le premier créneau proposable, en minutes. */
  leadMin?: number;
  /** Instant présent, injecté pour rester testable. */
  now: Date;
  /** Décalage du fuseau, en minutes (Bruxelles : 60 ou 120). */
  offsetMin: number;
}

function atLocal(day: string, time: string, offsetMin: number): Date {
  const [h, m] = time.split(":").map(Number);
  // On construit l'instant UTC correspondant à l'heure locale demandée.
  return new Date(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`
    .replace("Z", offsetString(offsetMin)));
}

function offsetString(offsetMin: number): string {
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function overlaps(a: Busy, b: Busy): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Créneaux proposables pour une journée.
 *
 * Un créneau n'est proposé que si la prestation tient **entièrement** avant la
 * fermeture : proposer 17 h 45 pour une coupe d'une heure quand le salon ferme
 * à 18 h, c'est promettre ce qu'on ne peut pas tenir.
 */
export function availableSlots(input: AvailabilityInput): Slot[] {
  const {
    day,
    hours,
    busy,
    resources,
    durationMin,
    stepMin = 15,
    leadMin = 120,
    now,
    offsetMin,
  } = input;

  if (resources < 1 || durationMin <= 0 || hours.length === 0) return [];

  // Délai de prévenance : un salon ne peut pas recevoir quelqu'un qui réserve
  // pour dans dix minutes.
  const earliest = new Date(now.getTime() + leadMin * 60_000);

  const slots: Slot[] = [];

  for (const range of hours) {
    const opens = atLocal(day, range.opens, offsetMin);
    const closes = atLocal(day, range.closes, offsetMin);

    for (
      let start = new Date(opens);
      start.getTime() + durationMin * 60_000 <= closes.getTime();
      start = new Date(start.getTime() + stepMin * 60_000)
    ) {
      if (start < earliest) continue;

      const candidate = {
        start,
        end: new Date(start.getTime() + durationMin * 60_000),
      };

      // Un créneau reste ouvert tant qu'au moins une personne est libre.
      const taken = busy.filter((b) => overlaps(b, candidate)).length;
      if (taken >= resources) continue;

      slots.push(candidate);
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Le jour tombe-t-il dans une fermeture exceptionnelle ? */
export function isClosed(
  day: string,
  closures: Array<{ from: string; to: string }>,
): boolean {
  return closures.some((c) => day >= c.from && day <= c.to);
}

/** Numéro de jour de la semaine d'une date ISO, 0 = dimanche. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** Décalage horaire de Bruxelles ce jour-là, en minutes. */
export function brusselsOffset(day: string): number {
  const probe = new Date(`${day}T12:00:00Z`);
  const local = new Date(
    probe.toLocaleString("en-US", { timeZone: "Europe/Brussels" }),
  );
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 60_000);
}

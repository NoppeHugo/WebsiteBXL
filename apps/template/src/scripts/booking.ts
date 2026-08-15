/**
 * Parcours de réservation.
 *
 * Une étape à la fois : celle en cours est dépliée, les précédentes se replient
 * en une ligne de résumé cliquable, les suivantes restent fermées. C'est ce qui
 * transforme un formulaire de six champs et vingt-six créneaux en une suite de
 * décisions simples — et c'est sur téléphone que la plupart des rendez-vous se
 * prennent.
 */

const root = document.querySelector<HTMLElement>("[data-live-booking]");

interface DayAvailability {
  day: string;
  closed: boolean;
  slots: string[];
}

if (root) {
  const form = root.querySelector("form")!;
  const done = root.querySelector<HTMLElement>("[data-done]")!;
  const fieldService = form.querySelector<HTMLInputElement>("[data-field-service]")!;
  const fieldSlot = form.querySelector<HTMLInputElement>("[data-field-slot]")!;
  const daysBox = root.querySelector<HTMLElement>("[data-days]")!;
  const slotsBox = root.querySelector<HTMLElement>("[data-slots]")!;
  const recap = root.querySelector<HTMLElement>("[data-recap]")!;
  const submit = root.querySelector<HTMLButtonElement>("[data-submit]")!;

  const lang = root.dataset.lang ?? "fr";
  const locale = `${lang}-BE`;
  const DAYS_AHEAD = 15;

  const fmt = {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "Europe/Brussels" }),
    dayNum: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "Europe/Brussels" }),
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "Europe/Brussels" }),
    long: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Brussels" }),
    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }),
    full: new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Brussels" }),
  };

  const chosen = {
    serviceName: "",
    duration: 0,
    price: "",
    day: "",
    slot: "",
  };

  let availability: DayAvailability[] = [];
  let ticket = 0;

  /* ---------------------------------------------------------------- étapes */

  const steps = [...root.querySelectorAll<HTMLElement>(".rdv__step")];

  function openStep(name: string, moveFocus = true): void {
    for (const step of steps) {
      const isTarget = step.dataset.step === name;
      step.dataset.open = isTarget ? "true" : "false";
      step.dataset.done = step.dataset.done === "true" ? "true" : "false";
    }

    if (!moveFocus) return;

    const opened = steps.find((s) => s.dataset.step === name);
    if (!opened) return;

    /*
     * L'étape ouverte est amenée à l'écran et reçoit le focus. Au clavier, on
     * se retrouverait sinon à naviguer dans une section repliée ; sur
     * téléphone, la nouvelle étape apparaîtrait sous le pli, invisible.
     */
    opened.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });

    window.setTimeout(() => {
      const focusable = opened.querySelector<HTMLElement>(
        "button:not(:disabled), input:not([type=hidden]), select, textarea, a[href]",
      );
      focusable?.focus({ preventScroll: true });
    }, 260);
  }

  function markDone(name: string, summary: string): void {
    const step = steps.find((s) => s.dataset.step === name);
    if (!step) return;
    step.dataset.done = "true";
    const target = step.querySelector<HTMLElement>(`[data-summary="${name}"]`);
    if (target) target.textContent = summary;
  }

  // Une étape déjà remplie se rouvre d'un clic sur son en-tête : revenir en
  // arrière ne doit jamais obliger à tout recommencer.
  for (const step of steps) {
    const head = step.querySelector<HTMLElement>(".rdv__head");
    head?.addEventListener("click", () => {
      if (step.dataset.done === "true") openStep(step.dataset.step!);
    });
  }

  /* ------------------------------------------------------------ prestation */

  for (const button of root.querySelectorAll<HTMLButtonElement>(".rdv__service")) {
    button.addEventListener("click", async () => {
      for (const other of root.querySelectorAll(".rdv__service")) {
        other.removeAttribute("aria-pressed");
      }
      button.setAttribute("aria-pressed", "true");

      fieldService.value = button.dataset.serviceId!;
      chosen.serviceName = button.dataset.serviceName!;
      chosen.duration = Number(button.dataset.serviceDuration);
      chosen.price = button.dataset.servicePrice!;

      // Changer de prestation invalide l'heure retenue : une coupe et un
      // rituel complet n'ont pas les mêmes créneaux.
      chosen.day = "";
      chosen.slot = "";
      fieldSlot.value = "";
      slotsBox.textContent = "";
      markDone("day", "");
      markDone("time", "");
      updateRecap();

      markDone("service", `${chosen.serviceName} · ${chosen.duration} min · ${chosen.price}`);
      openStep("day");
      await loadAvailability();
    });
  }

  /* ---------------------------------------------------------------- jours */

  async function loadAvailability(): Promise<void> {
    const mine = ++ticket;
    daysBox.dataset.state = "loading";
    daysBox.textContent = root!.dataset.labelLoading ?? "";

    try {
      const url = new URL(root!.dataset.availability!);
      url.searchParams.set("tenantId", root!.dataset.tenant!);
      url.searchParams.set("serviceId", fieldService.value);
      url.searchParams.set("day", root!.dataset.today!);
      url.searchParams.set("days", String(DAYS_AHEAD));

      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const data = (await response.json()) as { days?: DayAvailability[] };

      // Une réponse plus lente ne doit pas écraser une plus récente : le
      // visiteur verrait les créneaux d'une autre prestation.
      if (mine !== ticket) return;

      availability = data.days ?? [];
      renderDays();
    } catch {
      if (mine !== ticket) return;
      daysBox.dataset.state = "empty";
      daysBox.textContent = root!.dataset.labelEmpty ?? "";
    }
  }

  function renderDays(): void {
    daysBox.textContent = "";
    daysBox.dataset.state = "";

    for (const entry of availability) {
      const date = new Date(`${entry.day}T12:00:00Z`);
      const free = !entry.closed && entry.slots.length > 0;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "rdv__day";
      button.disabled = !free;

      const weekday = document.createElement("span");
      weekday.className = "rdv__day-name";
      weekday.textContent = fmt.weekday.format(date).replace(".", "");

      const number = document.createElement("span");
      number.className = "rdv__day-num";
      number.textContent = fmt.dayNum.format(date);

      const note = document.createElement("span");
      note.className = "rdv__day-note";
      note.textContent = free
        ? fmt.month.format(date).replace(".", "")
        : entry.closed
          ? root!.dataset.labelClosed ?? ""
          : root!.dataset.labelFull ?? "";

      button.append(weekday, number, note);

      if (free) {
        button.addEventListener("click", () => {
          for (const other of daysBox.querySelectorAll(".rdv__day")) {
            other.removeAttribute("aria-pressed");
          }
          button.setAttribute("aria-pressed", "true");

          chosen.day = entry.day;
          chosen.slot = "";
          fieldSlot.value = "";
          markDone("time", "");
          updateRecap();

          button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          markDone("day", fmt.long.format(date));
          renderSlots(entry);
          openStep("time");
        });
      }

      daysBox.append(button);
    }
  }

  /* -------------------------------------------------------------- créneaux */

  /** Matin, après-midi, soirée : trois colonnes courtes valent mieux qu'une
   *  liste de vingt-six boutons. */
  function groupOf(date: Date): "morning" | "afternoon" | "evening" {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Europe/Brussels",
      }).format(date),
    );
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }

  function renderSlots(entry: DayAvailability): void {
    slotsBox.textContent = "";

    if (entry.closed || entry.slots.length === 0) {
      slotsBox.dataset.state = "empty";
      slotsBox.textContent = root!.dataset.labelEmpty ?? "";
      return;
    }
    slotsBox.dataset.state = "";

    const groups: Record<string, string[]> = { morning: [], afternoon: [], evening: [] };
    for (const iso of entry.slots) groups[groupOf(new Date(iso))]!.push(iso);

    const labels: Record<string, string> = {
      morning: root!.dataset.labelMorning ?? "",
      afternoon: root!.dataset.labelAfternoon ?? "",
      evening: root!.dataset.labelEvening ?? "",
    };

    for (const key of ["morning", "afternoon", "evening"]) {
      const list = groups[key]!;
      if (list.length === 0) continue;

      const block = document.createElement("div");
      block.className = "rdv__group";

      const title = document.createElement("p");
      title.className = "rdv__group-name";
      title.textContent = labels[key]!;

      const row = document.createElement("div");
      row.className = "rdv__times";

      for (const iso of list) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rdv__time";
        button.textContent = fmt.time.format(new Date(iso));
        button.addEventListener("click", () => {
          for (const other of slotsBox.querySelectorAll(".rdv__time")) {
            other.removeAttribute("aria-pressed");
          }
          button.setAttribute("aria-pressed", "true");
          chosen.slot = iso;
          fieldSlot.value = iso;
          markDone("time", fmt.time.format(new Date(iso)));
          updateRecap();
          openStep("you");
        });
        row.append(button);
      }

      block.append(title, row);
      slotsBox.append(block);
    }
  }

  /* ----------------------------------------------------------- récapitulatif */

  function updateRecap(): void {
    const ready = Boolean(fieldService.value && fieldSlot.value);
    submit.disabled = !ready;

    recap.textContent = ready
      ? `${chosen.serviceName} · ${fmt.full.format(new Date(chosen.slot))} · ${chosen.price}`
      : "";
  }

  /* ------------------------------------------------------------ confirmation */

  /**
   * Fichier calendrier produit sur place, sans rien demander au serveur.
   * Un rendez-vous qu'on peut ajouter d'un geste à son téléphone est un
   * rendez-vous qu'on oublie moins — et les absences coûtent au salon.
   */
  function calendarFile(): string {
    const start = new Date(chosen.slot);
    const end = new Date(start.getTime() + chosen.duration * 60_000);
    const stamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const escape = (value: string) => value.replace(/([,;\\])/g, "\\$1");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WebsiteBXL//RDV//FR",
      "BEGIN:VEVENT",
      `UID:${start.getTime()}@${location.hostname}`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(`${chosen.serviceName} — ${root!.dataset.business}`)}`,
      `LOCATION:${escape(root!.dataset.address ?? "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
  }

  form.addEventListener("bxl:booked", () => {
    const when = fmt.full.format(new Date(chosen.slot));
    root.querySelector<HTMLElement>("[data-done-when]")!.textContent =
      `${chosen.serviceName} · ${when}`;

    const ics = root.querySelector<HTMLAnchorElement>("[data-ics]")!;
    ics.href = calendarFile();
    ics.hidden = false;

    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  root.querySelector<HTMLButtonElement>("[data-again]")!.addEventListener("click", () => {
    done.hidden = true;
    form.hidden = false;
    form.reset();
    fieldService.value = "";
    fieldSlot.value = "";
    chosen.serviceName = "";
    chosen.day = "";
    chosen.slot = "";
    for (const step of steps) step.dataset.done = "false";
    for (const summary of root.querySelectorAll("[data-summary]")) {
      summary.textContent = "";
    }
    for (const pressed of root.querySelectorAll("[aria-pressed]")) {
      pressed.removeAttribute("aria-pressed");
    }
    slotsBox.textContent = "";
    daysBox.textContent = "";
    updateRecap();
    openStep("service");
  });

  openStep("service", false);
}

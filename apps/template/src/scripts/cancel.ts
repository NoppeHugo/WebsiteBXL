/**
 * Annulation d'un rendez-vous depuis le lien reçu par courriel.
 *
 * Le jeton présent dans l'adresse tient lieu d'authentification : le connaître
 * prouve qu'on a reçu le courriel de confirmation. La page commence donc par
 * afficher le rendez-vous concerné avant de proposer quoi que ce soit —
 * annuler à l'aveugle est le meilleur moyen de supprimer le mauvais.
 */

const root = document.querySelector<HTMLElement>("[data-cancel]");

interface Appointment {
  business: string;
  service: string;
  startsAt: string;
  status: string;
  name: string;
}

if (root) {
  const whenLine = root.querySelector<HTMLElement>("[data-cancel-when]")!;
  const message = root.querySelector<HTMLElement>("[data-cancel-message]")!;
  const confirm = root.querySelector<HTMLButtonElement>("[data-cancel-confirm]")!;
  const keep = root.querySelector<HTMLElement>("[data-cancel-keep]")!;

  const lang = root.dataset.lang ?? "fr";
  const labels = {
    unknown: root.dataset.labelUnknown ?? "",
    already: root.dataset.labelAlready ?? "",
    tooLate: root.dataset.labelTooLate ?? "",
    done: root.dataset.labelDone ?? "",
    error: root.dataset.labelError ?? "",
    back: root.dataset.labelBack ?? "",
  };

  const full = new Intl.DateTimeFormat(`${lang}-BE`, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  });

  /** Un état terminal : plus rien à confirmer, seulement une phrase à lire. */
  function settle(when: string, text: string): void {
    whenLine.textContent = when;
    message.textContent = text;
    confirm.hidden = true;
    /*
     * Le lien change de sens une fois la décision prise : « finalement, je le
     * garde » n'a plus d'objet quand le rendez-vous vient d'être annulé, et
     * laisser cette phrase donnerait à croire qu'un clic le rétablit.
     */
    if (labels.back) keep.textContent = labels.back;
    keep.hidden = false;
  }

  const token = new URLSearchParams(location.search).get("t") ?? "";

  /*
   * Le jeton est vérifié ici avant tout appel réseau : une adresse tronquée
   * par un client de messagerie est le cas le plus probable, et lui répondre
   * immédiatement vaut mieux qu'un aller-retour pour un 400.
   */
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    settle("", labels.unknown);
  } else {
    void (async () => {
      let appointment: Appointment;

      try {
        const response = await fetch(
          `${root.dataset.lookup}?token=${encodeURIComponent(token)}`,
          { headers: { Accept: "application/json" } },
        );
        if (response.status === 404 || response.status === 400) {
          settle("", labels.unknown);
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        appointment = (await response.json()) as Appointment;
      } catch {
        settle("", labels.error);
        return;
      }

      const starts = new Date(appointment.startsAt);
      const when = `${appointment.service} — ${full.format(starts)}`;

      if (appointment.status === "cancelled") {
        settle(when, labels.already);
        return;
      }
      if (starts.getTime() <= Date.now()) {
        settle(when, labels.tooLate);
        return;
      }

      whenLine.textContent = when;
      message.textContent = "";
      confirm.hidden = false;
      keep.hidden = false;

      confirm.addEventListener("click", async () => {
        confirm.disabled = true;

        try {
          const response = await fetch(root.dataset.cancelUrl!, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ token }),
          });
          const body = (await response.json()) as {
            ok?: boolean;
            reason?: string;
          };

          if (body.ok) {
            settle(when, labels.done);
            return;
          }

          /*
           * Le serveur reste seul juge : entre l'affichage et le clic, le
           * rendez-vous a pu passer ou être annulé depuis un autre appareil.
           */
          settle(
            when,
            body.reason === "already"
              ? labels.already
              : body.reason === "too_late"
                ? labels.tooLate
                : body.reason === "unknown"
                  ? labels.unknown
                  : labels.error,
          );
        } catch {
          message.textContent = labels.error;
          confirm.disabled = false;
        }
      });
    })();
  }
}

/*
 * Marque le fichier comme module : chaque script du template vit sinon dans le
 * même espace de noms global aux yeux de TypeScript, et deux `root` suffisent
 * à faire échouer la vérification.
 */
export {};

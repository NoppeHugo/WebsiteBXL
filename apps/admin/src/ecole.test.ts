import { describe, it, expect } from "vitest";
import {
  avancement,
  dateDeRemise,
  emailValide,
  enRetard,
  estRendu,
  etatDuTravail,
  invitationOuverte,
  lienPresentable,
  nomComplet,
  validerExercice,
  type Travail,
} from "./ecole.ts";

/**
 * Les règles de l'espace de cours.
 *
 * Deux d'entre elles coûtent cher si elles cèdent : le lien d'un exercice, qui
 * devient un `href` sous les yeux d'élèves parfois mineurs, et l'invitation,
 * qui ouvre un compte à qui la porte. Le reste tient des comptes que le
 * professeur lit avant d'appeler un parent — s'y tromper est moins grave, mais
 * se voit tout de suite.
 */

const travail = (surcharge: Partial<Travail> = {}): Travail => ({
  exercice_id: "5",
  reponse: "Ma réponse",
  statut: "rendu",
  rendu_le: new Date("2026-03-01T10:00:00Z"),
  correction: null,
  appreciation: null,
  corrige_le: null,
  ...surcharge,
});

describe("etatDuTravail", () => {
  it("rend « pas commencé » quand rien n'a été écrit", () => {
    // L'absence de ligne est l'état de départ : c'est ce qui permet de publier
    // un exercice pour cent élèves sans écrire cent lignes.
    expect(etatDuTravail(undefined)).toBe("a-faire");
  });

  it("distingue le brouillon du rendu", () => {
    expect(etatDuTravail(travail({ statut: "commence", rendu_le: null }))).toBe("commence");
    expect(etatDuTravail(travail())).toBe("rendu");
  });

  it("rend l'appréciation dès que le travail est corrigé", () => {
    expect(
      etatDuTravail(
        travail({ appreciation: "acquis", corrige_le: new Date(), correction: "Bien" }),
      ),
    ).toBe("acquis");
    expect(
      etatDuTravail(
        travail({ appreciation: "a_revoir", corrige_le: new Date(), correction: "Revoir" }),
      ),
    ).toBe("a-revoir");
  });

  it("ignore une appréciation sans date de correction", () => {
    // Une seconde version efface la correction : appréciation et date partent
    // ensemble. L'une sans l'autre est une incohérence, et l'état affiché doit
    // rester celui du travail rendu plutôt que d'inventer une correction.
    expect(etatDuTravail(travail({ appreciation: "acquis", corrige_le: null }))).toBe("rendu");
  });
});

describe("avancement", () => {
  it("compte comme fait tout ce qui a été rendu, corrigé ou non", () => {
    /*
     * « À revoir » compte comme rendu. Une barre qui recule après une
     * correction découragerait exactement l'élève qu'elle doit encourager :
     * il a travaillé, et on le lui retirerait.
     */
    expect(avancement(["a-faire", "commence", "rendu", "acquis", "a-revoir"])).toEqual({
      rendus: 3,
      total: 5,
      pourcentage: 60,
    });
  });

  it("ne met pas une école sans exercice à cent pour cent", () => {
    // Zéro sur zéro vaut zéro : la jauge d'un élève qui n'a rien à faire doit
    // rester vide, pas pleine.
    expect(avancement([])).toEqual({ rendus: 0, total: 0, pourcentage: 0 });
  });

  it("estRendu couvre les trois états qui suivent une remise", () => {
    expect(["rendu", "acquis", "a-revoir"].every((e) => estRendu(e as never))).toBe(true);
    expect(["a-faire", "commence"].some((e) => estRendu(e as never))).toBe(false);
  });
});

describe("enRetard", () => {
  const hier = new Date("2026-03-01T00:00:00Z");
  const aujourdhui = new Date("2026-03-02T09:00:00Z");

  it("ne met en retard que ce qui est dû et pas rendu", () => {
    expect(enRetard(hier, "a-faire", aujourdhui)).toBe(true);
    expect(enRetard(hier, "commence", aujourdhui)).toBe(true);
    expect(enRetard(hier, "rendu", aujourdhui)).toBe(false);
  });

  it("laisse la journée entière : un devoir dû aujourd'hui n'est pas en retard", () => {
    expect(enRetard(new Date("2026-03-02T23:00:00Z"), "a-faire", aujourdhui)).toBe(false);
  });

  it("ne met jamais en retard un devoir sans date", () => {
    // « Pour le prochain cours » n'a pas de date, et une date obligatoire se
    // remplit alors n'importe comment.
    expect(enRetard(null, "a-faire", aujourdhui)).toBe(false);
  });
});

describe("lienPresentable", () => {
  it("accepte http et https", () => {
    expect(lienPresentable("https://exemple.be/video")).toBe("https://exemple.be/video");
    expect(lienPresentable("  http://exemple.be  ")).toBe("http://exemple.be/");
  });

  it("refuse tout autre schéma", () => {
    /*
     * Le test qui justifie la fonction. Ce lien devient un `href` sur la page
     * d'un élève : un `javascript:` collé là par un professeur — par
     * maladresse, ou par un compte d'école ouvert pour ça — s'exécuterait dans
     * le navigateur de toute la classe, avec leur session.
     */
    expect(lienPresentable("javascript:alert(1)")).toBeUndefined();
    expect(lienPresentable("data:text/html,<script>")).toBeUndefined();
    expect(lienPresentable("file:///etc/passwd")).toBeUndefined();
  });

  it("refuse ce qui n'est pas une adresse, sans lever", () => {
    expect(lienPresentable("exemple.be")).toBeUndefined();
    expect(lienPresentable("")).toBeUndefined();
    expect(lienPresentable(null)).toBeUndefined();
  });
});

describe("validerExercice", () => {
  it("exige un titre", () => {
    // C'est la ligne sur laquelle l'élève clique : sans titre, il clique au
    // hasard.
    expect(validerExercice({ titre: "   " })).toEqual({
      ok: false,
      raison: "Un exercice a besoin d'un titre.",
    });
  });

  it("accepte un exercice sans consigne", () => {
    // Un exercice qui n'est qu'un lien vers une vidéo se suffit.
    const r = validerExercice({ titre: "Les priorités" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valeur.consigne).toBe("");
  });

  it("refuse un lien impossible plutôt que de l'effacer en silence", () => {
    /*
     * Effacer serait pire que refuser : le professeur croirait avoir donné la
     * vidéo, et l'élève ouvrirait un exercice sans ressource sans que personne
     * ne comprenne pourquoi.
     */
    expect(validerExercice({ titre: "T", lien: "javascript:alert(1)" })).toEqual({
      ok: false,
      raison: "Le lien doit commencer par http:// ou https://.",
    });
  });

  it("range les champs vides à null plutôt qu'en chaînes vides", () => {
    const r = validerExercice({ titre: " Les priorités ", matiere: "  ", lien: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valeur).toEqual({
        titre: "Les priorités",
        consigne: "",
        matiere: null,
        lien: null,
      });
    }
  });
});

describe("invitationOuverte", () => {
  const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000);

  it("accepte une invitation récente et jamais utilisée", () => {
    expect(
      invitationOuverte({ invitation: "jeton", invitation_fin: dans(7), actif_le: null }),
    ).toBe(true);
  });

  it("refuse une invitation périmée", () => {
    /*
     * Un lien qui ouvre un compte reste dangereux tant qu'il vaut : une
     * adresse mal tapée met l'invitation dans la boîte de quelqu'un d'autre,
     * et deux semaines suffisent à ce que l'élève attendu s'en aperçoive.
     */
    expect(
      invitationOuverte({ invitation: "jeton", invitation_fin: dans(-1), actif_le: null }),
    ).toBe(false);
  });

  it("refuse une invitation déjà acceptée", () => {
    // Sinon le lien gardé dans un fil de messages rouvrirait le compte des
    // mois plus tard, et permettrait d'en changer le mot de passe.
    expect(
      invitationOuverte({ invitation: "jeton", invitation_fin: dans(7), actif_le: new Date() }),
    ).toBe(false);
  });

  it("refuse une invitation sans jeton ou sans échéance", () => {
    expect(invitationOuverte({ invitation: null, invitation_fin: dans(7), actif_le: null })).toBe(
      false,
    );
    expect(invitationOuverte({ invitation: "jeton", invitation_fin: null, actif_le: null })).toBe(
      false,
    );
  });
});

describe("dateDeRemise", () => {
  it("accepte une date du formulaire, ou rien", () => {
    expect(dateDeRemise("2026-03-15")?.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(dateDeRemise("")).toBeNull();
    expect(dateDeRemise(undefined)).toBeNull();
  });

  it("refuse ce qui n'est pas une date plutôt que d'en fabriquer une", () => {
    // Une date illisible deviendrait un devoir éternellement en retard, ou
    // jamais.
    expect(dateDeRemise("le 15 mars")).toBeNull();
    expect(dateDeRemise("2026-13-45")).toBeNull();
  });
});

describe("nomComplet et emailValide", () => {
  it("se passe du nom de famille quand il manque", () => {
    expect(nomComplet({ prenom: "Sofia", nom: "" })).toBe("Sofia");
    expect(nomComplet({ prenom: "Sofia", nom: "Mertens" })).toBe("Sofia Mertens");
  });

  it("écarte les adresses manifestement fausses", () => {
    expect(emailValide("sofia@exemple.be")).toBe(true);
    expect(emailValide("sofia@exemple")).toBe(false);
    expect(emailValide("sofia exemple.be")).toBe(false);
  });
});

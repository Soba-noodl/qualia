#!/usr/bin/env python3
"""One-off: backfill the missing showcase translations (hand-translated, no API).

For each audit, deep-merge the additions into showcase_audits.translations at the
locale level, preserving sibling keys (card_summary, card_subtitle, etc.).
"""
import json, os, subprocess, sys, urllib.request

REF = subprocess.check_output(
    "grep -oE 'project_id = \"[^\"]+\"' supabase/config.toml | cut -d'\"' -f2",
    shell=True, text=True).strip()
SK = subprocess.check_output(
    f"supabase projects api-keys --project-ref {REF} | grep service_role | awk '{{print $NF}}'",
    shell=True, text=True).strip()
URL = f"https://{REF}.supabase.co"
H = {"apikey": SK, "Authorization": f"Bearer {SK}", "Content-Type": "application/json"}
DRY = "--dry-run" in sys.argv


def req(method, path, body=None):
    r = urllib.request.Request(URL + path, method=method,
                               data=json.dumps(body).encode() if body is not None else None,
                               headers={**H, "Prefer": "return=representation"})
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read() or "[]")


# engine finding helper
def F(issue, principle, why, sugg):
    return {"issue": issue, "principle": principle, "why_it_matters": why, "suggestion": sugg}


# ---- pando: full EN body (Italian source) -------------------------------------
PANDO_EN = {
    "project_mission": "Give Italian assisted-living facilities (RSA) a safe, simple tool to monitor residents. Monitoring covers a range of safety parameters such as presence in bed or in the room and vital signs (heart rate, respiratory rate). It's designed to reduce the workload of socio-health operators and provide leaner workflows that promote accountability.",
    "one_big_thing": "The prototype excels at the operational handling of alerts (Alert Center and Alert Card), but it shows critical fragmentation in the 'Supporto' (Support) module, which acts as the data-management system (new resident, transfer, removal). This architectural choice hides core functionality (data CRUD) behind a 'support/ticket' metaphor, creating high cognitive load and a lack of direct control for the expert user (the Director), who must navigate rigid linear flows instead of having a dedicated admin interface.",
    "engines": {
        "system_logic": [
            F("Mismatch between the 'Preso in gestione' (Handled) state and operator availability.",
              "Nielsen #1: System Status",
              "In the Alert Center (Frame 8), an alert can be under handling but the operator is not always immediately visible if the column is empty. This undermines the accountability promised by the product's mission.",
              "Make associating the operator's name mandatory at the moment of clicking 'Ci penso io' (I've got this), instantly populating the corresponding cell."),
            F("Asynchronous password validation shown as a blocking error.",
              "Nielsen #5: Error Prevention",
              "Frame 30 shows a length error before the user has finished the action. This generates frustration (Emotional Friction) and discourages the user.",
              "Show the password requirements (8 characters) as a checklist that ticks off in real time, instead of a red error message that appears prematurely or after submission."),
        ],
        "heuristic": [
            F("Inconsistent terminology for socio-health staff.",
              "Nielsen #4: Consistency",
              "The prototype uses 'Operatore' (Frame 5), 'OSS' (Frame 13), and 'OSS / OSA' (Frame 34) to describe the same role. In an RSA context, role precision is essential for legal permissions.",
              "Adopt a single taxonomy defined in the design tokens and apply it rigorously across dropdowns and labels."),
            F("Unclear affordance of the 'Interpretazione' (Interpretation) charts.",
              "Signal-to-Noise",
              "The semicircle charts (e.g. Frame 1) show a central green checkmark even when the value is not optimal (e.g. 70%). This sends conflicting messages about patient safety.",
              "Remove the checkmark or change the color of the chart and icon based on predefined clinical thresholds (e.g. red < 50, yellow 50-80, green > 80)."),
        ],
        "cognitive": [
            F("Excessive segmentation of the support wizard.",
              "Hick's Law",
              "Using radio buttons to select the operation (Frame 45) followed by long linear wizards increases completion time for frequent tasks. The facility director suffers needless cognitive load for routine operations.",
              "Replace the wizard with an admin dashboard where common actions (new resident) are accessible with a single click."),
            F("Lack of context in the 'real-time' data.",
              "Pre-attentive Processing",
              "The data overlay (Frame 19) shows charts without reference values (normal ranges). A stressed operator might not recall the physiological limits for heart rate, increasing clinical risk.",
              "Add colored bands to the chart background (e.g. green for the normal range) to allow immediate at-a-glance interpretation."),
        ],
        "interaction": [
            F("Non-optimized interaction with the search bar.",
              "Fitts's Law",
              "The prototype shows an explanatory tooltip on hover (Frame 17), but the input itself (Frame 25) provides no contextual suggestions or quick filters, increasing the interaction cost of finding a specific resident.",
              "Implement suggested results (auto-complete) directly below the input as the user types, as suggested in Frame 26."),
            F("Save feedback in the profile is too subtle.",
              "Feedback Loop",
              "The 'Modifica salvata' (Change saved) badge (Frame 22) appears above a specific field. If the user edited multiple fields, it's unclear whether the entire form was persisted to the database.",
              "Use a global toast notification or a clear success state on the 'Fatto' (Done) button to confirm the whole transaction."),
        ],
    },
}

# ---- windtre: EN body is source. Need IT body + EN mission. --------------------
WINDTRE_EN = {
    "project_mission": "Bring value to (electrical) energy data in a time of heightened uncertainty and rising costs, through a meter reader and an engagement app developed together with WindTre.",
}
WINDTRE_IT = {
    "one_big_thing": "I loop di onboarding e di errore di connessione (Schermate 43-46) rimandano a pagine di supporto esterne generiche invece di mantenere l'utente all'interno dell'app con flussi diagnostici contestuali, passo per passo. Questo crea un alto rischio di abbandono durante la fase critica di attivazione dell'hardware.",
    "engines": {
        "system_logic": [
            F("La scheda 'Notifiche' mostra un badge di notifica sull'icona nella barra inferiore in più schermate (es. Schermata 1), ma l'accesso alla lista non rimuove né risolve dinamicamente questo indicatore di stato.",
              "Feedback Loop",
              "Quando gli indicatori di stato non cambiano in risposta alle azioni dell'utente, gli utenti perdono fiducia nell'accuratezza del sistema. Questo può portarli a ignorare gli avvisi futuri.",
              "Mostrare uno stato secondario di 'azzerato' per la barra di navigazione inferiore, in cui il puntino viola di notifica viene rimosso una volta caricata la Schermata 7."),
            F("La Schermata 31 ('Schermata di attesa attivazione') si basa su una schermata statica che descrive un'operazione in background senza alcuna indicazione di avanzamento attiva o stato di polling automatico.",
              "Nielsen #1: System Status",
              "Le schermate di attesa statiche con istruzioni asciutte lasciano gli utenti incerti se l'app si sia bloccata, il che spesso porta ad azioni ripetute o a disinstallazioni premature.",
              "Sostituire le illustrazioni statiche con un loader pulsante o una checklist attiva che mostra i passaggi di registrazione completati."),
        ],
        "heuristic": [
            F("La freccia indietro nella Schermata 3 ('Previsioni consumi') è posizionata accanto al titolo dell'header ma non si allinea visivamente con i layout di navigazione standard usati altrove nei flussi delle impostazioni del sistema operativo.",
              "Nielsen #4: Consistency",
              "Discostarsi dal posizionamento standard della navigazione indietro della piattaforma aumenta l'attrito meccanico e riduce la sicurezza nel wayfinding.",
              "Allineare il pulsante indietro a un inset standard sul lato sinistro dell'header, rispecchiando il comportamento delle Schermate 8 e 15."),
            F("Nella Schermata 2, lo stato di avviso per 'nessun obiettivo' usa #1e1e1e con un'icona di allerta rossa, ma manca un messaggio descrittivo inline sulla card del grafico stesso su come risolvere il problema.",
              "Information Scent",
              "L'icona di allerta rossa segnala uno stato di errore, ma l'area principale del grafico non indirizza chiaramente l'utente verso l'azione di configurazione, dando uno scarso 'Information Scent'.",
              "Aggiungere un blocco di testo CTA diretto e ben visibile 'Imposta Ora' direttamente sotto il livello di testo 'nessun obiettivo' centrale."),
        ],
        "cognitive": [
            F("Le Schermate 37 (Live-B) e 38 (Live-C) presentano avvisi ad alto stress ('rischio di distacco', 'distacco imminente') con timer prominenti che creano una notevole frizione emotiva senza fornire un pulsante d'azione immediato.",
              "Emotional Friction",
              "Avvisare un utente di un imminente distacco domestico senza offrire un passaggio immediato e attuabile dentro l'app aumenta l'ansia e lo fa sentire impotente.",
              "Inserire un link ad azione rapida come 'Vedi cosa spegnere' direttamente all'interno delle card di avviso arancioni e rosse."),
            F("Le Schermate 41 e 42 ('Home - Attivazione') presentano grandi barre di avanzamento arancioni molto sature che sembrano avvisi di sistema o stati di errore anziché normali barre di elaborazione.",
              "Pre-attentive Processing",
              "L'arancione saturo è universalmente interpretato come un indicatore di avviso. Usarlo per una normale attività in background non critica genera un allarme inutile.",
              "Usare un blu neutro o un viola coerente col brand (#6207ab) per le barre di avanzamento standard e non di errore."),
        ],
        "interaction": [
            F("L'azione 'Modifica Obiettivo' nelle Schermate 9 e 17 usa liste di radio standard in cui toccare la riga stessa della lista non dà feedback interattivo, lasciando intendere che solo il piccolo pallino radio sia cliccabile.",
              "State Completeness",
              "I target interattivi piccoli aumentano il costo di interazione e la frustrazione dell'utente, in particolare su dispositivi mobili dove la precisione è limitata.",
              "Estendere l'area cliccabile a tutta la card di sfondo del blocco di scelta e fornire un sottile cambiamento di sfondo al passaggio/tocco."),
            F("Gli slider e i nodi del grafico a linee nella Schermata 1 ('Rispetto agli altri') sembrano molto interattivi ma nel prototipo non hanno stati di trascinamento espliciti né tooltip.",
              "False Affordance",
              "Elementi dall'aspetto interattivo che in realtà sono statici creano una falsa affordance, che tradisce le aspettative dell'utente.",
              "Aggiungere tooltip o linee indicatrici dell'handle che mostrano i valori quando l'utente tocca lungo la barra di avanzamento."),
        ],
    },
}

# ---- 4 dev tools: add IT context (mission/screen_context/personas) ------------
LINEAR_IT = {
    "project_mission": "Aiuta i team di prodotto e ingegneria a rilasciare più velocemente tracciando issue, cicli e avanzamento dei progetti in un unico flusso di lavoro strutturato. Riduce il sovraccarico dei tradizionali strumenti di project management e mette in evidenza cosa rilasciare per primo.",
    "screen_context": "Usare efficacemente la funzione principale della piattaforma: coordinare il lavoro di ingegneria del software attraverso i task.",
    "personas": [
        {"name": "Sara, senior backend engineer",
         "description": "Gestisce 8-12 issue attive su 2-3 progetti. Ogni giorno passa tra elenco issue, vista board e vista del ciclo corrente. Tiene alle scorciatoie da tastiera e al minimo numero di click per aggiornare lo stato. La frustrano gli strumenti che la costringono a reinserire il contesto due volte."},
    ],
}
VERCEL_IT = {
    "project_mission": "Permette agli sviluppatori frontend di distribuire, visualizzare in anteprima e scalare applicazioni web senza il sovraccarico dell'infrastruttura. Ogni git push diventa un deployment di anteprima; la produzione si aggiorna in modo atomico.",
    "screen_context": "Controllare l'ultimo deployment di un progetto specifico.",
    "personas": [
        {"name": "Davide, indie founder",
         "description": "Distribuisce 3-5 progetti personali. Controlla i log di build quando qualcosa va storto, monitora l'utilizzo per non superare i limiti. A suo agio con la CLI di Vercel, ma usa la dashboard per variabili d'ambiente, domini e analytics."},
    ],
}
SUPABASE_IT = {
    "project_mission": "Offre un backend-as-a-service open source così gli sviluppatori possono rilasciare app full-stack senza gestire l'infrastruttura. Postgres + Auth + Storage + Edge Functions, accessibili da dashboard o SDK.",
    "screen_context": "Controllare rapidamente come stanno andando le cose nel database.",
    "personas": [
        {"name": "Alessio, sviluppatore frontend che adotta Supabase",
         "description": "Ha familiarità con React, è nuovo a SQL e ai concetti di backend. Usa Supabase Studio per ispezionare le tabelle, scrivere e testare le policy RLS, consultare i log. Lo frustrano l'attrito dell'editor SQL e i messaggi di errore poco chiari. Legge la documentazione di continuo."},
    ],
}
FIGMA_IT = {
    "project_mission": "Permette a designer e sviluppatori di collaborare sul design delle interfacce in tempo reale, nel browser. Sostituisce i file di design locali isolati con artefatti sempre condivisi e sempre aggiornati.",
    "screen_context": "Condividere un prototipo.",
    "personas": [
        {"name": "Giulia, product designer",
         "description": "Lavora in Figma 4-6 ore al giorno. Costruisce librerie di componenti, prototipi, specifiche di design. Passa spesso tra modalità design e prototipo. Tiene all'ecosistema dei plugin e all'affidabilità dell'auto-layout."},
        {"name": "Luca, sviluppatore frontend in Dev Mode",
         "description": "Apre i file Figma per recuperare le specifiche (spaziature, colori, testi) ed esportare gli asset. Non modifica, perlopiù ispeziona. Vuole la scheda Dev Mode aperta di default; si innervosisce quando i file sono disordinati."},
    ],
}

# audit_id -> { locale: additions }
JOBS = {
    "252ba27e-0158-4f7f-8680-ad55ebe3e1ab": {"en": PANDO_EN},                  # pando
    "c4007d74-0ce1-4a2a-b76c-8113ae8951da": {"en": WINDTRE_EN, "it": WINDTRE_IT},  # windtre
    "e396d03c-8378-4a8b-b56f-5c3f0ee7a842": {"it": LINEAR_IT},                 # linear
    "5bc6eceb-1f4a-4a20-af97-a888c599ed09": {"it": VERCEL_IT},                 # vercel
    "aa2e25b7-df5d-450d-a48d-4a166aee02de": {"it": SUPABASE_IT},               # supabase
    "ce71cc3c-201b-48a3-82f3-c7461e64ead2": {"it": FIGMA_IT},                  # figma
}


def main():
    for audit_id, by_locale in JOBS.items():
        rows = req("GET", f"/rest/v1/showcase_audits?audit_id=eq.{audit_id}&select=id,slug,translations")
        if not rows:
            print(f"!! no showcase row for {audit_id}"); continue
        row = rows[0]
        current = row.get("translations") or {}
        nxt = json.loads(json.dumps(current))  # deep copy
        for loc, additions in by_locale.items():
            nxt.setdefault(loc, {})
            nxt[loc].update(additions)  # locale-level merge: preserve card_*
        added = {loc: list(a.keys()) for loc, a in by_locale.items()}
        print(f"{row['slug']:10} +{added}")
        if not DRY:
            req("PATCH", f"/rest/v1/showcase_audits?id=eq.{row['id']}", {"translations": nxt})
    print("DRY RUN (nothing written)" if DRY else "✓ written")


if __name__ == "__main__":
    main()

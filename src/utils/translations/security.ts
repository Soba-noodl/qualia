/** Security / vulnerability disclosure page */
export const security = {
  en: {
    securityTitle: "Security – Qualia",
    securityLastUpdated: "Last updated: 20 May 2026",
    securityIntroTitle: "Introduction",
    securityIntroText:
      "We take the security of Qualia seriously. This page describes our process for handling security vulnerabilities in Qualia, including the web application and the Qualia Figma plugin. We welcome reports from security researchers and the community.",
    securityScopeTitle: "Scope",
    securityScopeIntro:
      "This process covers:",
    securityScopeItem1: "The Qualia web application (qualia-ux.com) and its backend services.",
    securityScopeItem2: "The Qualia Figma plugin: the plugin runs inside Figma and sends only the data necessary to perform analyses (e.g. exported screens, flow context) to our backend. It does not access design files beyond what you explicitly export for an audit.",
    securityScopeItem3: "Backend and infrastructure we operate or use to run analyses and store data (e.g. Supabase, AI providers).",
    securityScopeOutro:
      "Third-party services you connect to Qualia (Figma, Notion, Google) have their own security and vulnerability programs; this process does not cover those services.",
    securityReportTitle: "How to report",
    securityReportText:
      "If you believe you have found a security vulnerability, please report it to us at qualia.ai.analysis@gmail.com. Please include a clear description of the issue, steps to reproduce (if possible), and any impact you are aware of. We ask that you do not publicly disclose the issue before we have had a reasonable opportunity to address it.",
    securityExpectTitle: "What to expect",
    securityExpectText:
      "We will acknowledge your report within a few business days. We will triage and investigate the issue and, where appropriate, keep you updated on our progress. We will work to resolve valid security issues in a timely manner. We may contact you for additional information.",
    securitySafeHarborTitle: "Safe harbor",
    securitySafeHarborText:
      "We will not pursue legal action against researchers who report vulnerabilities in good faith and who follow responsible disclosure practices (e.g. allowing us time to fix the issue before any public disclosure). We may recognize contributors who help us improve security, at our discretion.",
    securityContactTitle: "Contact",
    securityContactText:
      "For security-related matters, including vulnerability reports, contact us at qualia.ai.analysis@gmail.com.",
    securityByokTitle: "AI provider API keys",
    securityByokText:
      "When you save an AI provider key in Settings, Qualia encrypts it using AES-256 (Web Crypto API, GCM mode) before storing it in the database. The encryption key is held server-side as a Supabase secret, separate from the database. The plaintext key only exists in memory during the request that triggers an LLM call, and only the relevant Supabase Edge Function can decrypt it (via service-role access). We never log the plaintext key. We never expose the encrypted key to your browser — only a metadata view that includes provider name, model selection, and last-used timestamp.",
    securityKeyRotationTitle: "Key rotation",
    securityKeyRotationText:
      "If our master encryption key is ever rotated, all stored provider keys become unrecoverable and users will need to re-enter them. We treat the master key as a long-lived secret stored only in Supabase's secret manager.",
  },
  it: {
    securityTitle: "Sicurezza – Qualia",
    securityLastUpdated: "Ultimo aggiornamento: 20 maggio 2026",
    securityIntroTitle: "Introduzione",
    securityIntroText:
      "Prendiamo sul serio la sicurezza di Qualia. Questa pagina descrive il nostro processo per la gestione delle vulnerabilità di sicurezza in Qualia, inclusa l'applicazione web e il plugin Qualia per Figma. Accogliamo con favore le segnalazioni da ricercatori della sicurezza e dalla community.",
    securityScopeTitle: "Ambito",
    securityScopeIntro:
      "Questo processo copre:",
    securityScopeItem1: "L'applicazione web Qualia (qualia-ux.com) e i relativi servizi backend.",
    securityScopeItem2: "Il plugin Qualia per Figma: il plugin viene eseguito all'interno di Figma e invia al nostro backend solo i dati necessari per eseguire le analisi (es. schermate esportate, contesto dei flussi). Non accede ai file di design oltre quanto esporti esplicitamente per un audit.",
    securityScopeItem3: "Backend e infrastrutture che gestiamo o utilizziamo per eseguire le analisi e conservare i dati (es. Supabase, provider di AI).",
    securityScopeOutro:
      "I servizi di terze parti che colleghi a Qualia (Figma, Notion, Google) dispongono di propri programmi di sicurezza e vulnerabilità; questo processo non copre tali servizi.",
    securityReportTitle: "Come segnalare",
    securityReportText:
      "Se ritieni di aver individuato una vulnerabilità di sicurezza, segnalacela a qualia.ai.analysis@gmail.com. Includi una descrizione chiara del problema, i passaggi per riprodurlo (se possibile) e eventuali impatti noti. Ti chiediamo di non divulgare pubblicamente il problema prima che abbiamo avuto un ragionevole periodo per affrontarlo.",
    securityExpectTitle: "Cosa aspettarsi",
    securityExpectText:
      "Accuseremo ricevuta della tua segnalazione entro pochi giorni lavorativi. Effettueremo triage e analisi del problema e, ove opportuno, ti terremo aggiornato sui progressi. Lavoreremo per risolvere le vulnerabilità valide in tempi ragionevoli. Potremmo contattarti per informazioni aggiuntive.",
    securitySafeHarborTitle: "Safe harbor",
    securitySafeHarborText:
      "Non intraprenderemo azioni legali nei confronti di ricercatori che segnalano vulnerabilità in buona fede e che seguono pratiche di disclosure responsabile (es. consentendoci il tempo di correggere il problema prima di qualsiasi divulgazione pubblica). Potremmo riconoscere i contributori che ci aiutano a migliorare la sicurezza, a nostra discrezione.",
    securityContactTitle: "Contatti",
    securityContactText:
      "Per questioni relative alla sicurezza, incluse le segnalazioni di vulnerabilità, contattaci a qualia.ai.analysis@gmail.com.",
    securityByokTitle: "Chiavi API dei provider AI",
    securityByokText:
      "Quando salvi una chiave provider AI nelle Impostazioni, Qualia la cifra usando AES-256 (Web Crypto API, modalità GCM) prima di salvarla nel database. La chiave di cifratura è conservata lato server come secret Supabase, separata dal database. La chiave in chiaro esiste in memoria solo durante la richiesta che attiva una chiamata LLM, e solo l'Edge Function Supabase pertinente può decifrarla (tramite accesso service-role). Non registriamo mai la chiave in chiaro. Non esponiamo mai la chiave cifrata al browser — solo una vista metadata che include nome provider, scelta del modello e timestamp dell'ultimo utilizzo.",
    securityKeyRotationTitle: "Rotazione della chiave",
    securityKeyRotationText:
      "Se la nostra chiave di cifratura master viene mai ruotata, tutte le chiavi provider salvate diventano irrecuperabili e gli utenti dovranno reinserirle. Trattiamo la chiave master come un secret a lunga vita conservato solo nel secret manager di Supabase.",
  },
} as const;

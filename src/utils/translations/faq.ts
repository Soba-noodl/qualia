export const faq = {
  en: {
    faqPageTitle: "FAQ | Qualia",
    faqNavLabel: "FAQ",
    faqHeroTitle: "Frequently asked questions",
    faqHeroSubtitle: "Answers to the questions teams ask most before bringing Qualia into their workflow.",

    faqSectionProductTitle: "Product & workflow",
    faqQ1: "What is Qualia, in one sentence?",
    faqA1:
      "Qualia is an AI-powered UX auditing tool that analyzes your screens and flows, surfaces issues with spatial pins, and helps you prioritize what to fix next.",
    faqQ2: "When should I use Qualia in my design process?",
    faqA2:
      "Qualia works best once you have reasonably stable wireframes or hi-fi mockups and want to sanity-check flows before handing them to engineering or usability testing.",
    faqQ3: "Do I need a fully clickable prototype, or are static screens enough?",
    faqA3:
      "Static screenshots or Figma frames are enough. Qualia infers flows and state changes from your screens and optional context images.",
    faqQ4: "How many screens can I analyze at once?",
    faqA4:
      "Single audits work on one screen; flow audits support multiple screens representing a complete user journey.",
    faqQ5: "What kind of issues does Qualia find?",
    faqA5:
      "Layout and hierarchy problems, missing states, accessibility issues, copy clarity, navigation dead ends, and friction across a flow, each with pinned locations.",
    faqQ6: "How is this different from just using an accessibility checker?",
    faqA6:
      "Qualia includes accessibility checks, but it goes beyond them. It reasons about context, user goals, and flow logic instead of only testing color contrast and semantics.",

    faqSectionSynthTitle: "Synth user research",
    faqQ7: "What is “Synth user research” exactly?",
    faqA7:
      "It’s an optional layer where synthetic personas “walk through” your screen or flow, each returning a verdict (PASS / FRICTION / BLOCKER), an emotion, and a short inner monologue.",
    faqQ8: "Why would I trust synthetic users over real usability tests?",
    faqA8:
      "You shouldn’t replace real users. Synth users are a fast, low-cost way to stress-test designs between usability rounds or when you don’t have access to your target audience.",
    faqQ9: "Which personas are available today?",
    faqA9:
      "We ship with six archetypes (for example Power User, Spreadsheet Veteran, Admin Gatekeeper, The Boss, Automator, Daily Driver), each with detailed heuristics and biases.",
    faqQ10: "Can I customize or add my own personas?",
    faqA10:
      "Today personas are predefined. In future versions we plan to let teams tune or extend personas while still keeping their behavior consistent and debuggable.",
    faqQ11: "Does Synth user research change the audit results?",
    faqA11:
      "No. The core UX audit runs first and stands on its own. Synth users are an additional research section layered on top, not a replacement or re-ranking of issues.",
    faqQ12: "How should teams use Synth user insights in practice?",
    faqA12:
      "Treat them like structured “what if” scenarios: validate whether your primary persona is blocked, compare reactions between personas, then decide which flows to revisit or test with real users.",

    faqSectionDataTitle: "Data, privacy & accuracy",
    faqQ13: "What data does Qualia store when I run an audit?",
    faqA13:
      "We store your uploaded screenshots or Figma snapshots, the generated audit report (findings and pins), and basic project metadata such as mission, language, and selected personas.",
    faqQ14: "Do you use my designs to train your models?",
    faqA14:
      "No. Your project data is used only to run audits for your account. It’s not added to any public training dataset.",
    faqQ15: "Can I delete an audit or project and all associated data?",
    faqA15:
      "Yes. Deleting a project deletes its audits and associated reports from our database; storage is handled via Supabase.",
    faqQ16: "How do you handle accessibility standards such as WCAG?",
    faqA16:
      "We align checks against WCAG 2.1 guidelines where relevant. For example, we look at contrast, focus states, and target sizes, and we call that out explicitly in findings when applicable.",
    faqQ17: "How do you reduce “AI hallucinations”?",
    faqA17:
      "We ground the model on your actual screenshots, optional Figma metadata, and clear prompts. Findings are anchored to visible regions and, for synth users, to a strict JSON schema.",

    faqSectionPricingTitle: "Access & limits",
    faqQ18: "Is Qualia free?",
    faqA18:
      "Yes. Qualia is a free portfolio project. You bring your own AI provider key (Gemini, Claude, or GPT) and pay the provider directly per audit; we don't charge for the platform. Per-provider frame caps apply for performance reasons: up to 50 frames on Gemini, 35 on GPT, 8 on Claude.",
    faqQ19: "Is Qualia for individuals or teams?",
    faqA19:
      "Both. Solo designers and PMs can use it for quick reviews, while teams can share projects, standardize audit criteria, and use it as part of design review rituals.",
    faqQ20: "How does Qualia integrate with Figma and other tools?",
    faqA20:
      "You can paste a Figma frame link or use the Figma plugin for direct imports; we also support uploads from files and plan to add more integrations over time.",
  },
  it: {
    faqPageTitle: "FAQ | Qualia",
    faqNavLabel: "FAQ",
    faqHeroTitle: "Domande frequenti",
    faqHeroSubtitle: "Le risposte alle domande che i team fanno più spesso prima di portare Qualia nel loro workflow.",

    faqSectionProductTitle: "Prodotto e workflow",
    faqQ1: "Cos'è Qualia, in una frase?",
    faqA1:
      "Qualia è uno strumento di audit UX basato su AI che analizza schermate e flussi, evidenzia i problemi con pin spaziali e ti aiuta a decidere cosa correggere per primo.",
    faqQ2: "Quando dovrei usare Qualia nel mio processo di design?",
    faqA2:
      "Qualia funziona meglio quando hai wireframe stabili o mockup hi-fi e vuoi fare un check dei flussi prima di passare il lavoro all'ingegneria o ai test di usabilità.",
    faqQ3: "Serve un prototipo cliccabile o bastano schermate statiche?",
    faqA3:
      "Bastano screenshot o frame Figma. Qualia deduce flussi e cambi di stato dalle schermate e dalle eventuali immagini di contesto.",
    faqQ4: "Quante schermate posso analizzare in una volta?",
    faqA4:
      "Gli audit singoli lavorano su una schermata; gli audit di flusso supportano più schermate che rappresentano un percorso utente completo.",
    faqQ5: "Che tipo di problemi trova Qualia?",
    faqA5:
      "Problemi di layout e gerarchia, stati mancanti, questioni di accessibilità, chiarezza del copy, vicoli ciechi di navigazione e frizioni lungo il flusso, ognuno con una posizione ancorata.",
    faqQ6: "In cosa è diverso da un semplice checker di accessibilità?",
    faqA6:
      "Qualia include check di accessibilità, ma va oltre. Ragiona su contesto, obiettivi utente e logica del flusso invece di limitarsi a testare contrasto e semantica.",

    faqSectionSynthTitle: "Ricerca con utenti sintetici",
    faqQ7: "Che cos'è esattamente la “ricerca con utenti sintetici”?",
    faqA7:
      "È uno strato opzionale in cui personas sintetiche “attraversano” la tua schermata o il tuo flusso, restituendo un verdetto (PASS / FRICTION / BLOCKER), uno stato emotivo e un breve monologo interiore.",
    faqQ8: "Perché dovrei fidarmi di utenti sintetici rispetto ai test con utenti reali?",
    faqA8:
      "Non dovresti sostituire gli utenti reali. Gli utenti sintetici sono un modo veloce e a basso costo per stressare i design tra un round di test e l'altro o quando non hai accesso al tuo pubblico di riferimento.",
    faqQ9: "Quali personas sono disponibili oggi?",
    faqA9:
      "Forniamo sei archetipi (per esempio Power User, Spreadsheet Veteran, Admin Gatekeeper, The Boss, Automator, Daily Driver), ognuno con euristiche e bias dettagliati.",
    faqQ10: "Posso personalizzare o aggiungere personas mie?",
    faqA10:
      "Oggi le personas sono predefinite. Nelle versioni future vogliamo permettere ai team di affinarle o estenderle mantenendo comunque un comportamento coerente e verificabile.",
    faqQ11: "La ricerca con utenti sintetici modifica i risultati dell'audit?",
    faqA11:
      "No. L'audit UX principale gira per primo e sta in piedi da solo. Gli utenti sintetici sono una sezione di ricerca aggiuntiva sopra, non una sostituzione o un riordinamento dei problemi.",
    faqQ12: "Come dovrebbero usare i team gli insight degli utenti sintetici, in pratica?",
    faqA12:
      "Trattali come scenari strutturati “what if”: verifica se la tua persona primaria è bloccata, confronta le reazioni tra personas e poi decidi quali flussi rivedere o testare con utenti reali.",

    faqSectionDataTitle: "Dati, privacy e accuratezza",
    faqQ13: "Quali dati salva Qualia quando eseguo un audit?",
    faqA13:
      "Salviamo gli screenshot caricati o gli snapshot Figma, il report generato dell'audit (problemi e pin) e alcuni metadati di progetto come mission, lingua e personas selezionate.",
    faqQ14: "Usate i miei design per addestrare i modelli?",
    faqA14:
      "No. I dati del tuo progetto vengono usati solo per eseguire audit per il tuo account. Non vengono aggiunti a nessun dataset di training pubblico.",
    faqQ15: "Posso eliminare un audit o un progetto e tutti i dati associati?",
    faqA15:
      "Sì. Eliminando un progetto vengono eliminati anche i suoi audit e i relativi report dal nostro database; lo storage è gestito tramite Supabase.",
    faqQ16: "Come gestite gli standard di accessibilità come le WCAG?",
    faqA16:
      "Allineiamo i check alle linee guida WCAG 2.1 dove rilevante. Per esempio guardiamo contrasto, stati di focus e dimensioni dei target, e lo esplicitiamo nelle segnalazioni quando applicabile.",
    faqQ17: "Come riducete le “allucinazioni” dell'AI?",
    faqA17:
      "Ancoriamo il modello alle tue schermate reali, agli eventuali metadati Figma e a prompt chiari. Le segnalazioni sono ancorate a regioni visibili e, per gli utenti sintetici, a uno schema JSON rigido.",

    faqSectionPricingTitle: "Accesso e limiti",
    faqQ18: "Qualia è gratuito?",
    faqA18:
      "Sì. Qualia è un progetto di portfolio gratuito. Porti la tua chiave AI (Gemini, Claude o GPT) e paghi direttamente il provider per ogni audit; noi non addebitiamo nulla per la piattaforma. Per ragioni di performance, ci sono limiti per provider sul numero di frame analizzabili: fino a 50 con Gemini, 35 con GPT, 8 con Claude.",
    faqQ19: "Qualia è pensato per singoli professionisti o per team?",
    faqA19:
      "Entrambi. Designer e PM singoli possono usarlo per revisioni veloci, mentre i team possono condividere progetti, standardizzare i criteri di audit e usarlo nei rituali di design review.",
    faqQ20: "Come si integra Qualia con Figma e altri strumenti?",
    faqA20:
      "Puoi incollare un link a un frame Figma o usare il plugin Figma per importare direttamente; supportiamo anche upload da file e in futuro aggiungeremo altre integrazioni.",
  },
} as const;


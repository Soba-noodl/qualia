/** Use Cases page */
export const useCases = {
  en: {
    useCasesPageTitle: "Use Cases | Qualia",
    useCasesHeroHeadline: "Three powerful audit modes",
    useCasesHeroSubheadline:
      "From single screens to full flows to Figma prototypes, Qualia adapts the analysis depth to your workflow.",

    // Single Screenshot section
    useCasesSingleTitle: "Single screen audit",
    useCasesSingleSubtitle: "Deep-dive into one interface",
    useCasesSingleDesc:
      "Upload a screenshot or sync a Figma frame and get a comprehensive UX audit in seconds. The AI evaluates layout, hierarchy, accessibility, copy, and interaction patterns against your product context:with the option to layer on synthetic user research when you need persona-specific insight.",
    useCasesSinglePerk1Title: "Spatial issue pinning",
    useCasesSinglePerk1Desc:
      "Every issue is pinned to a precise region of your screen with visual markers, so you know exactly what to fix and where.",
    useCasesSinglePerk2Title: "Context-aware scoring",
    useCasesSinglePerk2Desc:
      "The audit considers your product mission, user personas, and constraints. A dashboard widget scored differently than an onboarding screen.",
    useCasesSinglePerk3Title: "One Big Thing",
    useCasesSinglePerk3Desc:
      "Each report highlights the single most critical failure, giving your team a clear priority before diving into the full issue list.",

    // Context images sub-section
    useCasesContextTitle: "Context images",
    useCasesContextSubtitle: "Help the AI understand the bigger picture",
    useCasesContextDesc:
      "Add up to 5 reference screens (previous or next steps) that won't be audited but give the AI the surrounding journey context. This eliminates false positives and produces smarter, more relevant feedback.",
    useCasesContextPerk1: "Screens before and after the audited view",
    useCasesContextPerk2: "Reduces false positives from missing context",
    useCasesContextPerk3: "AI understands navigation flow and state transitions",

    // Flow Analysis section
    useCasesFlowTitle: "Flow analysis",
    useCasesFlowSubtitle: "Audit the entire user journey",
    useCasesFlowDesc:
      "Upload 2 to 10 screens that represent a complete user flow. The AI evaluates each step individually and the journey as a whole, catching logic gaps, dead ends, and inconsistencies that single-screen reviews miss:and can simulate multiple personas experiencing the same journey.",
    useCasesFlowPerk1Title: "Step-by-step + journey-wide",
    useCasesFlowPerk1Desc:
      "Micro-UI issues per screen and Macro-UI issues across the flow. Transition logic, consistency, and cognitive load are all evaluated.",
    useCasesFlowPerk2Title: "Interactive carousel",
    useCasesFlowPerk2Desc:
      "Click any issue card and the carousel navigates to the relevant step automatically, with spatial pins showing the exact problem area.",
    useCasesFlowPerk3Title: "Missing states detection",
    useCasesFlowPerk3Desc:
      "The AI flags empty states, error states, loading states, and edge cases that your prototype doesn't show but production will hit.",

    // Prototype Crawl section
    useCasesPrototypeTitle: "Prototype crawl",
    useCasesPrototypeSubtitle: "Audit flows directly from a Figma prototype",
    useCasesPrototypeDesc:
      "Paste a Figma prototype URL and Qualia crawls connected steps to audit transitions, decision points, and flow-level friction. It also extrapolates design-system patterns from the prototype itself so consistency issues surface early.",
    useCasesPrototypePerk1Title: "Prototype-native flow coverage",
    useCasesPrototypePerk1Desc:
      "Capture connected screens and transitions from the clickable prototype, not just a manually selected subset.",
    useCasesPrototypePerk2Title: "Design-system consistency checks",
    useCasesPrototypePerk2Desc:
      "Qualia infers recurring patterns from the prototype and flags inconsistencies in spacing, component behavior, and visual language.",
    useCasesPrototypePerk3Title: "Journey + system signal in one run",
    useCasesPrototypePerk3Desc:
      "Get both user-flow friction and design-system drift in the same audit output, ready to prioritize with your team.",

    // Enhancements (Context + Deep Figma), short copy for cards
    useCasesEnhancementsTitle: "Enhance your audit",
    useCasesEnhancementsSubtitle: "Add context or Figma metadata to get sharper feedback in Single Screen and Flow analysis. In Prototype analysis, this intelligence is already on by default.",
    useCasesEnhanceContextTitle: "Context images",
    useCasesEnhanceContextDesc: "Add reference screens before or after the one you audit. The AI uses them for journey context only:they are not audited:so feedback is smarter and fewer false positives.",
    useCasesEnhanceContextBullet1: "Up to 5 reference screens",
    useCasesEnhanceContextBullet2: "Reduces false positives",
    useCasesEnhanceContextBullet3: "Available for single screen audits",
    useCasesEnhanceFigmaTitle: "Deep Figma UI analysis",
    useCasesEnhanceFigmaDesc: "Import from Figma with a frame link and include metadata. The AI reads structure:layers, components:for element-level precision instead of generic “the button on the left”. In Prototype analysis, this is enabled by default.",
    useCasesEnhanceFigmaBullet1: "Node names and hierarchy",
    useCasesEnhanceFigmaBullet2: "Design token hints (color, spacing)",
    useCasesEnhanceFigmaBullet3: "Feedback references specific elements",
    useCasesEnhanceSynthTitle: "Synth user analysis",
    useCasesEnhanceSynthDesc: "Add a persona-level simulation layer on top of your audit to see where different user types pass, struggle, or get blocked.",
    useCasesEnhanceSynthBullet1: "Up to 3 personas per run",
    useCasesEnhanceSynthBullet2: "PASS / FRICTION / BLOCKER verdicts",
    useCasesEnhanceSynthBullet3: "Inner-monologue insight snippets",

    // Synth user research section
    useCasesSynthTitle: "Synth user research",
    useCasesSynthSubtitle: "See how different personas actually experience your flow",
    useCasesSynthDesc:
      "On top of the core UX audit, Qualia can run synthetic user simulations for up to three personas at once. Each one gets a verdict (PASS / FRICTION / BLOCKER), an emotional state, and a short inner monologue so you understand how real people with different goals would react.",
    useCasesSynthPerk1Title: "Persona-level verdicts",
    useCasesSynthPerk1Desc:
      "Compare how Power Users, first-time visitors, and admins move through the same interface, with clear PASS / FRICTION / BLOCKER outcomes.",
    useCasesSynthPerk2Title: "Inner monologue quotes",
    useCasesSynthPerk2Desc:
      "Each synthetic user writes a short diary-like reaction, turning abstract UX issues into concrete, human-readable feedback.",
    useCasesSynthPerk3Title: "Layered on top of audits",
    useCasesSynthPerk3Desc:
      "Synth user research is optional and non-blocking: first you get the standard audit, then the persona insights appear as an extra research layer.",

    // Deep Figma UI section (full copy used elsewhere if needed)
    useCasesDeepFigmaTitle: "Deep Figma UI analysis",
    useCasesDeepFigmaSubtitle: "Figma metadata for sharper feedback",
    useCasesDeepFigmaDesc:
      "When you import from Figma with a frame link, Qualia can read the design's structure:layers, components, text nodes:and use it to ground the audit. You get element-level precision: the AI references specific buttons, cards, or labels instead of generic 'the element on the left'.",
    useCasesDeepFigmaPerk1Title: "Structure-aware audits",
    useCasesDeepFigmaPerk1Desc:
      "The AI sees node names, types, and hierarchy from your Figma file. Issues are tied to real component and layer names when relevant.",
    useCasesDeepFigmaPerk2Title: "Design token hints",
    useCasesDeepFigmaPerk2Desc:
      "Colors, spacing, and typography from the file help the model suggest consistency and spot deviations from your design system.",
    useCasesDeepFigmaPerk3Title: "Copy link to selection",
    useCasesDeepFigmaPerk3Desc:
      "Use Figma's 'Copy link to selection' (⌘L) so the link includes a node-id. Single-screen imports with a frame link get metadata automatically when the option is on.",

    // CTA
    useCasesCtaTitle: "Ready to try it?",
    useCasesCtaButton: "Start free audit",

    // Nav
    useCasesNavLabel: "Use Cases",
  },
  it: {
    useCasesPageTitle: "Casi d'uso | Qualia",
    useCasesHeroHeadline: "Tre modalità di audit potenti",
    useCasesHeroSubheadline:
      "Dalla schermata singola ai flussi completi fino ai prototipi Figma, Qualia adatta la profondità dell'analisi al tuo workflow.",

    useCasesSingleTitle: "Audit schermata singola",
    useCasesSingleSubtitle: "Analisi approfondita di un'interfaccia",
    useCasesSingleDesc:
      "Carica uno screenshot o sincronizza un frame Figma per ottenere un audit UX completo in pochi secondi. L'IA valuta layout, gerarchia, accessibilità, copy e pattern di interazione rispetto al contesto del tuo prodotto, con la possibilità di aggiungere ricerca con utenti sintetici quando ti servono insight specifici per persona.",
    useCasesSinglePerk1Title: "Pin spaziali dei problemi",
    useCasesSinglePerk1Desc:
      "Ogni problema è ancorato a una regione precisa dello schermo con indicatori visivi, così sai esattamente cosa e dove correggere.",
    useCasesSinglePerk2Title: "Punteggio contestuale",
    useCasesSinglePerk2Desc:
      "L'audit considera la mission del prodotto, le personas utente e i vincoli. Un widget dashboard viene valutato diversamente da una schermata di onboarding.",
    useCasesSinglePerk3Title: "One Big Thing",
    useCasesSinglePerk3Desc:
      "Ogni report evidenzia il singolo problema più critico, dando al team una priorità chiara prima di analizzare la lista completa.",

    useCasesContextTitle: "Immagini di contesto",
    useCasesContextSubtitle: "Aiuta l'IA a capire il quadro generale",
    useCasesContextDesc:
      "Aggiungi fino a 5 schermate di riferimento (passaggi precedenti o successivi) che non verranno analizzate ma forniscono all'IA il contesto del percorso. Questo elimina i falsi positivi e produce feedback più intelligenti e pertinenti.",
    useCasesContextPerk1: "Schermate prima e dopo la vista analizzata",
    useCasesContextPerk2: "Riduce i falsi positivi da contesto mancante",
    useCasesContextPerk3: "L'IA comprende il flusso di navigazione e le transizioni di stato",

    useCasesFlowTitle: "Analisi del flusso",
    useCasesFlowSubtitle: "Analizza l'intero percorso utente",
    useCasesFlowDesc:
      "Carica da 2 a 5 schermate che rappresentano un flusso utente completo. L'IA valuta ogni passaggio singolarmente e il percorso nel suo insieme, individuando lacune logiche, vicoli ciechi e inconsistenze che le revisioni a schermata singola non rilevano:and può simulare più personas che vivono lo stesso percorso.",
    useCasesFlowPerk1Title: "Passo dopo passo + visione d'insieme",
    useCasesFlowPerk1Desc:
      "Problemi Micro-UI per schermata e Macro-UI lungo il flusso. Logica di transizione, coerenza e carico cognitivo vengono tutti valutati.",
    useCasesFlowPerk2Title: "Carosello interattivo",
    useCasesFlowPerk2Desc:
      "Clicca su qualsiasi scheda problema e il carosello naviga automaticamente al passaggio pertinente, con pin spaziali che mostrano l'area esatta del problema.",
    useCasesFlowPerk3Title: "Rilevamento stati mancanti",
    useCasesFlowPerk3Desc:
      "L'IA segnala stati vuoti, stati di errore, stati di caricamento e casi limite che il tuo prototipo non mostra ma che la produzione incontrerà.",

    // Sezione Prototype Crawl
    useCasesPrototypeTitle: "Prototype crawl",
    useCasesPrototypeSubtitle: "Analizza i flussi direttamente da un prototipo Figma",
    useCasesPrototypeDesc:
      "Incolla un URL di prototipo Figma e Qualia percorre gli step collegati per analizzare transizioni, punti decisionali e frizioni di flusso. Inoltre estrapola pattern di design system direttamente dal prototipo, cosi le incoerenze emergono prima.",
    useCasesPrototypePerk1Title: "Copertura nativa del flusso prototipo",
    useCasesPrototypePerk1Desc:
      "Acquisisci schermate e transizioni collegate dal prototipo cliccabile, non solo da un sottoinsieme selezionato manualmente.",
    useCasesPrototypePerk2Title: "Controlli di coerenza del design system",
    useCasesPrototypePerk2Desc:
      "Qualia inferisce pattern ricorrenti dal prototipo e segnala incoerenze in spaziature, comportamento dei componenti e linguaggio visivo.",
    useCasesPrototypePerk3Title: "Segnale su journey e sistema in un solo run",
    useCasesPrototypePerk3Desc:
      "Ottieni frizioni del flusso utente e drift del design system nello stesso output di audit, pronto da prioritizzare con il team.",

    useCasesEnhancementsTitle: "Migliora il tuo audit",
    useCasesEnhancementsSubtitle: "Aggiungi contesto o metadati Figma per un feedback più preciso in analisi Schermata singola e Flusso. Nell'analisi Prototype questa intelligence è già attiva di default.",
    useCasesEnhanceContextTitle: "Immagini di contesto",
    useCasesEnhanceContextDesc: "Aggiungi schermate di riferimento prima o dopo quella che auditi. L'IA le usa solo come contesto del percorso:non vengono auditate:per un feedback più intelligente e meno falsi positivi.",
    useCasesEnhanceContextBullet1: "Fino a 5 schermate di riferimento",
    useCasesEnhanceContextBullet2: "Riduce i falsi positivi",
    useCasesEnhanceContextBullet3: "Disponibile per gli audit a schermata singola",
    useCasesEnhanceFigmaTitle: "Analisi UI Figma approfondita",
    useCasesEnhanceFigmaDesc: "Importa da Figma con link al frame e includi i metadati. L'IA legge la struttura:livelli, componenti:per precisione a livello di elemento invece di generici «il pulsante a sinistra». Nell'analisi Prototype e attiva di default.",
    useCasesEnhanceFigmaBullet1: "Nomi e gerarchia dei nodi",
    useCasesEnhanceFigmaBullet2: "Suggerimenti su design token (colore, spaziatura)",
    useCasesEnhanceFigmaBullet3: "Il feedback cita elementi specifici",
    useCasesEnhanceSynthTitle: "Analisi utenti sintetici",
    useCasesEnhanceSynthDesc: "Aggiungi un livello di simulazione per persona sopra l'audit, per vedere dove tipi diversi di utenti passano, faticano o si bloccano.",
    useCasesEnhanceSynthBullet1: "Fino a 3 personas per run",
    useCasesEnhanceSynthBullet2: "Verdetti PASS / FRICTION / BLOCKER",
    useCasesEnhanceSynthBullet3: "Snippet di monologo interiore",

    // Sezione ricerca con utenti sintetici
    useCasesSynthTitle: "Ricerca con utenti sintetici",
    useCasesSynthSubtitle: "Vedi come personas diverse vivono davvero il tuo flusso",
    useCasesSynthDesc:
      "Sopra all'audit UX di base, Qualia può eseguire simulazioni con utenti sintetici per fino a tre personas alla volta. Ognuna riceve un verdetto (PASS / FRICTION / BLOCKER), uno stato emotivo e un breve monologo interiore, così capisci come reagirebbero persone reali con obiettivi diversi.",
    useCasesSynthPerk1Title: "Verdetti a livello di persona",
    useCasesSynthPerk1Desc:
      "Confronta come Power User, nuovi utenti e admin attraversano la stessa interfaccia, con esiti chiari PASS / FRICTION / BLOCKER.",
    useCasesSynthPerk2Title: "Citazioni in prima persona",
    useCasesSynthPerk2Desc:
      "Ogni utente sintetico scrive una breve reazione in stile diario, trasformando problemi UX astratti in feedback concreti e leggibili.",
    useCasesSynthPerk3Title: "Strato sopra gli audit",
    useCasesSynthPerk3Desc:
      "La ricerca con utenti sintetici è opzionale e non blocca nulla: prima ricevi l'audit standard, poi gli insight per persona compaiono come livello di ricerca aggiuntivo.",

    useCasesDeepFigmaTitle: "Analisi UI Figma approfondita",
    useCasesDeepFigmaSubtitle: "Metadati Figma per feedback più preciso",
    useCasesDeepFigmaDesc:
      "Quando importi da Figma con un link al frame, Qualia può leggere la struttura del design:livelli, componenti, nodi di testo:e usarla per ancorare l'audit. Ottieni precisione a livello di elemento: l'IA fa riferimento a pulsanti, card o etichette specifiche invece di generici 'l'elemento a sinistra'.",
    useCasesDeepFigmaPerk1Title: "Audit consapevoli della struttura",
    useCasesDeepFigmaPerk1Desc:
      "L'IA vede nomi, tipi e gerarchia dei nodi dal tuo file Figma. I problemi sono collegati a componenti e livelli reali quando rilevante.",
    useCasesDeepFigmaPerk2Title: "Suggerimenti sui design token",
    useCasesDeepFigmaPerk2Desc:
      "Colori, spaziatura e tipografia dal file aiutano il modello a suggerire coerenza e individuare scostamenti dal design system.",
    useCasesDeepFigmaPerk3Title: "Copia link alla selezione",
    useCasesDeepFigmaPerk3Desc:
      "Usa 'Copia link alla selezione' (⌘L) in Figma così il link include un node-id. Le importazioni a schermata singola con link al frame ricevono i metadati automaticamente quando l'opzione è attiva.",

    useCasesCtaTitle: "Pronto a provarlo?",
    useCasesCtaButton: "Inizia audit gratuito",

    useCasesNavLabel: "Casi d'uso",
  },
} as const;

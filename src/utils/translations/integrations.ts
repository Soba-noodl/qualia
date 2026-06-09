/** Integration-related translations (Drive / Notion connector) */
export const integrations = {
  en: {
    // Import flow steps
    importStepConnect: "Connect account",
    importStepSelectDocs: "Select documents",
    importStepReview: "Review & edit",
    importConnectFirstTitle: "Import context",
    importConnectFirstDesc:
      "Connect at least one tool so you can import context from Drive, Notion, or other sources. You can still upload files directly.",
    importSelectDocsTitle: "Choose where to import context from",
    importSelectDocsDesc:
      "Upload files and/or pick documents from your tools. We'll extract product name, mission, and user archetypes for you.",
    importConnectToolsOptional: "Optionally connect Drive or Notion to add documents from there.",
    importFetchAndContinue: "Fetch & continue",
    importFetching: "Fetching documents…",
    importExtracting: "Extracting context…",
    importNoLinks: "Add at least one link to continue",
    importReviewTitle: "Review extracted context",
    importReviewDesc:
      "We prefilled these fields from your documents. Edit anything before creating your project.",
    importScopeSwitchLabel: "Treat as section of a product",
    importScopeSwitchHint: "Switch if we got it wrong: section = one area (e.g. Checkout); whole = entire product.",

    // Connection
    integrationConnected: "Connected",
    integrationConnectDrive: "Connect Google Drive",
    integrationConnectNotion: "Connect Notion",
    integrationConnectInSettings: "Connect in settings",
    integrationDrive: "Google Drive",
    integrationNotion: "Notion",
    integrationUnknownProvider: "Unknown provider",

    // DocumentLinkInput
    linkInputPlaceholder: "Select documents from your tools",
    linkInputAdd: "Add",
    linkInputFetchContent: "Fetch content",
    linkInputOr: "or pick from your tools",
    linkInputLimitHint: "You can add up to 5 linked documents in total.",

    // Source labels
    sourceUpload: "Upload",
    sourceDrive: "Google Drive",
    sourceNotion: "Notion",

    // Errors
    integrationFetchFailed: "Failed to fetch documents. Please try again.",
    integrationFetchDisconnected:
      "Failed to fetch: {providers} is not connected. Please connect it first in the connection status below or in Settings.",
    integrationFetchNetworkError:
      "Couldn't reach the server. Deploy the Supabase Edge Functions (google-drive-auth, google-drive-fetch, etc.) or enable them in your host's backend settings.",
    integrationExtractFailed: "Failed to extract context. Please try again.",
    integrationOAuthFailed: "Failed to start connection. Please try again.",
    integrationFetchPermissionError:
      "Unable to fetch: the document may be private or not shared with the integration. Please check sharing permissions and try again.",
    integrationFetchPartialFailed:
      "{count} document(s) could not be fetched. They may be private or in an unsupported format.",
    linkInputFetchRequired: "You must fetch content before saving. Click \"Fetch content\" above.",
    integrationNotConnected: "Connect {provider} first to fetch documents.",
    integrationPermissionSettingsHint: "You can update permissions or reconnect integrations in Settings.",

    // Drive Picker
    chooseFromDrive: "Choose from Google Drive",
    pickerLoading: "Opening…",
    pickerErrorGeneric: "Failed to open Google Drive picker. Please try again.",
    pickerErrorNotConfigured: "Google Picker is not configured. Please contact support.",
    pickerErrorNotConnected: "Google Drive not connected. Please connect your account first.",

    // Notion Picker
    chooseFromNotion: "Choose from Notion",
    notionPickerTitle: "Choose from Notion",
    notionPickerDescription: "Select one or more pages to add as context. Only pages shared with the integration appear.",
    notionPickerSearchPlaceholder: "Search pages…",
    notionPickerNoResults: "No pages match your search.",
    notionPickerEmpty: "No pages found. Share pages with the integration in Notion.",
    notionPickerCancel: "Cancel",
    notionPickerConfirm: "Add selected",
  },
  it: {
    importStepConnect: "Connetti account",
    importStepSelectDocs: "Seleziona documenti",
    importStepReview: "Rivedi e modifica",
    importConnectFirstTitle: "Importa contesto",
    importConnectFirstDesc:
      "Connetti almeno uno strumento per importare contesto da Drive, Notion o altre fonti. Puoi comunque caricare file direttamente.",
    importSelectDocsTitle: "Scegli da dove importare il contesto",
    importSelectDocsDesc:
      "Carica file e/o scegli documenti dai tuoi strumenti. Estrarremo nome prodotto, missione e archetipi utente per te.",
    importConnectToolsOptional: "Opzionalmente connetti Drive o Notion per aggiungere documenti da lì.",
    importFetchAndContinue: "Recupera e continua",
    importFetching: "Recupero documenti…",
    importExtracting: "Estrazione contesto…",
    importNoLinks: "Aggiungi almeno un link per continuare",
    importReviewTitle: "Rivedi il contesto estratto",
    importReviewDesc:
      "Abbiamo precompilato questi campi dai tuoi documenti. Modifica quello che vuoi prima di creare il progetto.",
    importScopeSwitchLabel: "Tratta come sezione di un prodotto",
    importScopeSwitchHint: "Cambia se abbiamo sbagliato: sezione = un'area (es. Checkout); intero = prodotto completo.",

    integrationConnected: "Connesso",
    integrationConnectDrive: "Connetti Google Drive",
    integrationConnectNotion: "Connetti Notion",
    integrationConnectInSettings: "Connetti nelle impostazioni",
    integrationDrive: "Google Drive",
    integrationNotion: "Notion",
    integrationUnknownProvider: "Provider sconosciuto",

    linkInputPlaceholder: "Seleziona documenti dai tuoi strumenti",
    linkInputAdd: "Aggiungi",
    linkInputFetchContent: "Recupera contenuto",
    linkInputOr: "oppure scegli dai tuoi strumenti",
    linkInputLimitHint: "Puoi aggiungere fino a 5 documenti collegati in totale.",

    sourceUpload: "Upload",
    sourceDrive: "Google Drive",
    sourceNotion: "Notion",

    integrationFetchFailed: "Recupero documenti fallito. Riprova.",
    integrationFetchDisconnected:
      "Recupero fallito: {providers} non è connesso. Connettilo prima nello stato connessione qui sotto o nelle Impostazioni.",
    integrationFetchNetworkError:
      "Impossibile raggiungere il server. Distribuisci le Edge Functions Supabase o abilitalle nelle impostazioni del backend.",
    integrationExtractFailed: "Estrazione contesto fallita. Riprova.",
    integrationOAuthFailed: "Avvio connessione fallito. Riprova.",
    integrationFetchPermissionError:
      "Impossibile recuperare: il documento potrebbe essere privato o non condiviso con l'integrazione. Controlla i permessi di condivisione e riprova.",
    integrationFetchPartialFailed:
      "{count} documento/i non recuperati. Potrebbero essere privati o in un formato non supportato.",
    linkInputFetchRequired: "Devi recuperare il contenuto prima di salvare. Clicca \"Recupera contenuto\" sopra.",
    integrationNotConnected: "Connetti prima {provider} per recuperare i documenti.",
    integrationPermissionSettingsHint: "Puoi aggiornare i permessi o riconnettere le integrazioni nelle Impostazioni.",

    // Drive Picker
    chooseFromDrive: "Scegli da Google Drive",
    pickerLoading: "Apertura…",
    pickerErrorGeneric: "Impossibile aprire il selettore Google Drive. Riprova.",
    pickerErrorNotConfigured: "Google Picker non configurato. Contatta l'assistenza.",
    pickerErrorNotConnected: "Google Drive non connesso. Connetti il tuo account.",

    // Notion Picker
    chooseFromNotion: "Scegli da Notion",
    notionPickerTitle: "Scegli da Notion",
    notionPickerDescription: "Seleziona una o più pagine da aggiungere come contesto. Appaiono solo le pagine condivise con l'integrazione.",
    notionPickerSearchPlaceholder: "Cerca pagine…",
    notionPickerNoResults: "Nessuna pagina corrisponde alla ricerca.",
    notionPickerEmpty: "Nessuna pagina trovata. Condividi le pagine con l'integrazione in Notion.",
    notionPickerCancel: "Annulla",
    notionPickerConfirm: "Aggiungi selezionate",
  },
} as const;

/** Context images in upload/flow */
export const contextImages = {
  en: {
    addContextOptional: "Add Context (Optional)",
    contextImagesLabel: "Context Images",
    contextImagesDescription:
      "Add previous or next screens to help the AI understand the user journey. These will NOT be audited.",
    maxContextImagesReached: "Maximum context images reached",
    addContextDragHint: "Drop context screens here",
    remaining: "remaining",
    addContextFromFigma: "Add Context Screen",
    connectFigmaFirst: "Connect Figma in Settings to add context screens from Figma",
    contextImageAdded: "Context screen added",
    maxContextImages: "Max 5 images",
    figmaContextHint: "Paste up to 3 Figma frame links. They will be imported when you click Import & Analyze.",
    figmaContextLinkNumber: "Link {{n}}",
    contextImportLimitReached: "Imported the first 5 screens (limit reached)",
    contextImagesAdded: "{count} context screens added",
  },
  it: {
    addContextOptional: "Aggiungi Contesto (Opzionale)",
    contextImagesLabel: "Immagini di Contesto",
    contextImagesDescription:
      "Aggiungi schermate precedenti o successive per aiutare l'IA a capire il percorso utente. Queste NON verranno analizzate.",
    maxContextImagesReached: "Raggiunto il massimo di immagini di contesto",
    addContextDragHint: "Trascina qui le schermate di contesto",
    remaining: "rimanenti",
    addContextFromFigma: "Aggiungi Schermata Contesto",
    connectFigmaFirst: "Connetti Figma nelle Impostazioni per aggiungere schermate di contesto",
    contextImageAdded: "Schermata di contesto aggiunta",
    maxContextImages: "Max 5 immagini",
    figmaContextHint: "Incolla fino a 3 link a frame Figma. Verranno importati quando clicchi Importa e analizza.",
    figmaContextLinkNumber: "Link {{n}}",
    contextImportLimitReached: "Importate le prime 5 schermate (limite raggiunto)",
    contextImagesAdded: "{count} schermate di contesto aggiunte",
  },
} as const;

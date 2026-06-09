/** MCP Setup Modal translations */
export const mcpSetup = {
  en: {
    mcpSetupTitle: "Connect Qualia to Claude",
    mcpSetupDesc: "One-time setup · 2 minutes",
    mcpSetupStep1Label: "Copy the Qualia MCP URL",
    mcpSetupStep2Label: "Add it to Claude",
    mcpSetupStep2Recommended: "(recommended)",
    mcpSetupStep2AiTitle: "Claude.ai or Claude Desktop",
    mcpSetupStep2AiDesc:
      "Go to Settings → Connectors → click Add custom connector. Enter name Qualia and paste the URL above → click Add",
    mcpSetupStep2CodeTitle: "Claude Code (terminal)",
    mcpSetupStep3Label: "Authorize Qualia",
    mcpSetupStep3Desc:
      "Claude will open a browser tab asking you to log in to Qualia and grant access. Takes 30 seconds.",
    mcpSetupDone: "Done",
    mcpSetupCopyPrompt: "I've set it up — Copy prompt",
    mcpSetupSkip: "Skip",
    mcpSetupPromptCopied: "Prompt copied — paste it in Claude (⌘V)",
  },
  it: {
    mcpSetupTitle: "Connetti Qualia a Claude",
    mcpSetupDesc: "Configurazione unica · 2 minuti",
    mcpSetupStep1Label: "Copia l'URL MCP di Qualia",
    mcpSetupStep2Label: "Aggiungilo a Claude",
    mcpSetupStep2Recommended: "(consigliato)",
    mcpSetupStep2AiTitle: "Claude.ai o Claude Desktop",
    mcpSetupStep2AiDesc:
      "Vai su Impostazioni → Connettori → clicca Aggiungi connettore personalizzato. Inserisci nome Qualia e incolla l'URL sopra → clicca Aggiungi",
    mcpSetupStep2CodeTitle: "Claude Code (terminale)",
    mcpSetupStep3Label: "Autorizza Qualia",
    mcpSetupStep3Desc:
      "Claude aprirà una scheda del browser chiedendoti di accedere a Qualia e concedere l'accesso. Richiede 30 secondi.",
    mcpSetupDone: "Fatto",
    mcpSetupCopyPrompt: "L'ho configurato — Copia prompt",
    mcpSetupSkip: "Salta",
    mcpSetupPromptCopied: "Prompt copiato — incollalo in Claude (⌘V)",
  },
} as const;
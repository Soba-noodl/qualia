/** Changelog */
export const changelog = {
  en: {
    changelogNavLabel: "Changelog",
    changelogMonthJuly2026: "July 2026",
    changelogDate20260707: "July 7, 2026",
    changelogVersion20260707: "Open v10.4",
    changelogTitle20260707: "New Google Gemini key format supported",
    changelogBody20260707:
      "Google recently changed the format of its Gemini API keys, and Qualia was rejecting the new ones when you tried to save them. New keys now work, and your existing keys keep working too.",
    changelogItem20260707A:
      "New Google Gemini keys (the AQ. format Google now issues) are accepted when you add or replace a key in Settings.",
    changelogItem20260707B:
      "Older Gemini keys keep working exactly as before. Both formats are validated the same way.",
    changelogItem20260707C:
      "The fix applies everywhere you paste a key, including the prompt shown when a free trial runs out.",
    changelogMonthMay2026: "May 2026",
    changelogDate20260526: "May 26, 2026",
    changelogVersion20260526: "Open v10.1",
    changelogTitle20260526: "Gemini-first, reliable flow audits",
    changelogBody20260526:
      "Qualia is now Gemini-first. Claude was removed as a supported audit provider because the per-provider machinery kept causing mid-audit failures, and we fixed the flow-audit crashes that were hitting users on multi-screen runs.",
    changelogItem20260526A:
      "Claude is no longer a BYOK option. Gemini stays preferred, GPT remains a secondary choice. Existing Claude keys were removed; pick Gemini or GPT in Settings.",
    changelogItem20260526B:
      "Multi-screen flow audits no longer fail mid-run from worker limits. We now pass signed image URLs directly to the provider, keeping each audit well inside the compute budget.",
    changelogItem20260526C:
      "Per-audit provider override in the upload modal now actually routes to the picked provider. Previously the choice was silently dropped and the account default was used.",
    changelogDate20260524: "May 24, 2026",
    changelogVersion20260524: "Open v10.0",
    changelogTitle20260524: "Bring Your Own Key, complete privacy overhaul",
    changelogBody20260524:
      "v10.0 marks the production-ready release. Audits run on your own LLM keys at zero cost to us, account deletion now purges every byte of your data from storage, and we've scrubbed sensitive content (your design files, LLM responses, OAuth flows) from all logs.",
    changelogItem20260524A:
      "Bring Your Own Key is generally available across Gemini, GPT, and Claude. Bring your own credits and run unlimited audits with no per-audit fee.",
    changelogItem20260524B:
      "Account deletion now removes every screenshot, document, project, plugin export, and OAuth token from storage, not just the database row.",
    changelogItem20260524C:
      "Logs no longer record your Figma file contents, LLM responses, OAuth tokens, or design payloads. Only error metadata for debugging.",
    changelogDate20260515: "May 15, 2026",
    changelogVersion20260515: "Beta v9.7",
    changelogTitle20260515: "Faster app load, complete keyboard a11y, hardened stack",
    changelogBody20260515:
      "The app loads dramatically faster on first visit, the main JavaScript chunk is 64% smaller and each page now streams in only when needed. Keyboard and screen-reader users get a complete experience for the first time, and five known vulnerabilities in the dependency tree are gone.",
    changelogItem20260515A:
      "First-load JavaScript is 64% smaller (775 → 282 kB gzipped). Each page now loads on demand instead of bundling everything upfront.",
    changelogItem20260515B:
      "Skip-to-content link on every page, aria-labels on 15 icon buttons, and audit/upload/export loading states now announce to screen readers.",
    changelogItem20260515C:
      "Zero security advisories in the dependency tree (was five). Vite and jsdom updated, GitHub Actions pinned to commit SHA, install scripts disabled by default.",
    changelogDate20260511: "May 11, 2026",
    changelogVersion20260511: "Beta v9.6",
    changelogTitle20260511: "Daily limit visibility, plugin cancel, app-wide reliability",
    changelogBody20260511:
      "Your remaining daily audits are now visible everywhere, Project page, Re-audit button, and inside the Figma plugin home and report views, and audit cards disable cleanly the moment you hit zero. On top of that, 25+ reliability fixes landed across the app: the plugin Cancel button actually cancels now, network failures surface clear retry buttons on Analytics, Contact and OAuth callbacks, and executive PDF/PPTX exports no longer silently produce broken output.",
    changelogItem20260511A:
      "Daily audit count is now visible on Project, Re-audit, and inside the Figma plugin, controls auto-disable with a tooltip the moment you hit your limit.",
    changelogItem20260511B:
      "Plugin reliability: Cancel actually cancels the running analysis, re-audit times out cleanly after 60s instead of spinning forever, and long frame names show the full text on hover.",
    changelogItem20260511C:
      "App-wide robustness: error states with Retry on Analytics, Audits, Contact and OAuth callbacks; safer Back button on Auth; mobile-friendly changelog and Settings tabs; broken executive exports no longer ship silently.",
    changelogDate20260509: "May 9, 2026",
    changelogVersion20260509: "Beta v9.5",
    changelogTitle20260509: "Sharper errors, safer destructive actions, gentler flows",
    changelogBody20260509:
      "Twelve UX improvements across Auth, Dashboard, Settings, and Project pages. Network failures now surface a clear retry button instead of looking silently empty. Disconnecting integrations and revoking MCP access now require explicit confirmation. Several smaller flows were softened, Auth's email submit defers to Google as the primary, project card actions are visible without hovering, and the post-create flow guides with a toast instead of forcing a modal.",
    changelogItem20260509A:
      "Network failures across Dashboard, Settings, and Project now show a clear error state with a Try again button, no more 'looks empty when actually broken'.",
    changelogItem20260509B:
      "Disconnecting Figma, Notion, Drive, or revoking MCP access now opens a confirmation dialog with context-specific warnings, a single misclick can no longer break in-flight audits.",
    changelogItem20260509C:
      "Polish across the app: Google sign-in is the visual primary on Auth, project card actions are visible at low opacity by default, signup confirmation animations respect reduced-motion, and the Settings icon no longer self-references on the Settings page.",
    changelogDate20260508: "May 8, 2026",
    changelogVersion20260508: "Beta v9.4",
    changelogTitle20260508: "Synth on prototypes, crawl reliability, plugin CTAs",
    changelogBody20260508:
      "Synth user analysis can now be triggered on any completed prototype audit without re-running it, and prototype re-audits inherit your previous synth selection. Prototype crawls exit cleanly on timeout or Figma paywall, surfacing a clear error toast instead of hanging silently.",
    changelogItem20260508A:
      "Prototype audits now include a \"Run Synth Analysis\" card, add synth user perspectives to any finished audit without starting over.",
    changelogItem20260508B:
      "Prototype crawl now fails cleanly on timeout or Figma starter-plan paywall, a clear toast tells you what blocked the export.",
    changelogItem20260508C:
      "New plugin nudges across the app, banner in the upload modal, dashboard header pill, empty-state link, and a Settings entry all point to the Figma plugin.",
    changelogDate20260507: "May 7, 2026",
    changelogVersion20260507: "Beta v9.3",
    changelogTitle20260507: "Session stability, prototype fixes, invite reliability",
    changelogBody20260507:
      "The Figma plugin no longer logs you out on transient connection errors, an inline reconnect prompt appears instead, letting you decide when to re-authenticate. Prototype audits in the home feed now show the correct name, scores, and Design System tab, and the team invite flow works reliably with Google OAuth.",
    changelogItem20260507A:
      "Plugin sessions now survive temporary network hiccups, no forced logout; an inline prompt lets you reconnect only when truly needed.",
    changelogItem20260507B:
      "Prototype audits in the home feed now show their correct name, Prototype and Frames score chips, and the Design System tab.",
    changelogItem20260507C:
      "Team invite links now work correctly for Google OAuth sign-ups; back from any report now returns to the home feed.",
    changelogDate20260506: "May 6, 2026",
    changelogVersion20260506: "Beta v9.2",
    changelogTitle20260506: "Plugin home, redesigned reports, retention emails",
    changelogBody20260506:
      "The Figma plugin opens directly to your previous audits, pick one to revisit or tap to start a new one. The report view is fully redesigned with tabs, four-stance feedback, and a re-audit flow that uses your feedback to refine results.",
    changelogItem20260506A:
      "The plugin now lands on a home feed of your last 20 audits, open any one, then re-audit it without leaving Figma.",
    changelogItem20260506B:
      "Plugin reports are redesigned with tabs (UX, Accessibility, Design System), four-stance feedback, and a re-audit flow that learns from your responses.",
    changelogItem20260506C:
      "New welcome and re-engagement emails, plus a unified language setting that follows you across plugin, web app, and emails.",
    changelogDate20260505: "May 5, 2026",
    changelogVersion20260505: "Beta v9.1",
    changelogTitle20260505: "MCP reliability, email confirmation, plugin polish",
    changelogBody20260505:
      "The Claude connection is now significantly more stable, OAuth disconnects are resolved and the MCP server is hosted at qualia-ux.com. A dedicated email confirmation panel lands for new signups, and the plugin settings get a full design-system refresh.",
    changelogItem20260505A:
      "MCP connection is now stable, OAuth token rotation fixed, qualia-ux.com hosting, and RFC-compliant discovery all ship together, eliminating random Claude disconnects.",
    changelogItem20260505B:
      "After signup you land on a dedicated confirmation panel, resend the email or change your address without leaving the flow.",
    changelogItem20260505C:
      "Plugin settings redesigned to match the design system; audit export actions condensed into a single dropdown.",
    changelogMonthApril2026: "April 2026",
    changelogDate20260430: "April 30, 2026",
    changelogVersion20260430: "Beta v9.0",
    changelogTitle20260430: "Connect Qualia to Claude",
    changelogBody20260430:
      "Claude can now read your Qualia audits directly. Connect once from Settings or right after running an audit, and Claude has instant access to your findings, scores, screenshots, and project context, no copy-pasting required. Works with Claude.ai, Claude Desktop, and Claude Code.",
    changelogItem20260430A: "Set up the Qualia MCP once from Settings or right after an audit, Claude authenticates securely with OAuth and keeps access until you revoke it.",
    changelogItem20260430B: "Ask Claude to analyze your top issues, generate fixes, or compare audits. It reads the full report including all findings, scores, and screenshots.",
    changelogItem20260430C: "Works with Claude.ai (Connectors), Claude Desktop, and Claude Code, connect from any client in under two minutes.",
    changelogDate20260421: "April 21, 2026",
    changelogVersion20260421: "Beta v8.1",
    changelogTitle20260421: "Export audit as AI-ready markdown",
    changelogBody20260421:
      "Every audit can now be exported as structured markdown that any AI tool can read. The export packs findings, scores, accessibility data, and screen context into a single file ready to drop into a chat or pipeline.",
    changelogItem20260421A: "New \"Export for AI\" button in the audit action bar, one click generates a full structured markdown file.",
    changelogItem20260421B: "Figma frame names are used as screen labels, so the output maps cleanly to what you see in your designs.",
    changelogItem20260421C: "Export covers all three audit modes: screenshot upload, Figma frame, and prototype crawl.",
    changelogDate20260415: "April 15, 2026",
    changelogVersion20260415: "Beta v8.0",
    changelogTitle20260415: "Team workspaces, user profiles, and project visibility",
    changelogBody20260415:
      "Qualia now supports full team collaboration. Invite teammates, share projects with your org, and move work between personal and team spaces. Each user gets a profile with display name and avatar. The Figma plugin now separates personal and team projects so you always know what you're auditing against.",
    changelogItem20260415A: "Team workspaces: invite members, share projects with your org, and control who can manage or delete them.",
    changelogItem20260415B: "User profiles with display name and avatar, visible on project cards and the breadcrumb.",
    changelogItem20260415C: "Plugin now shows a Personal / Team toggle so you can pick the right project scope before every audit.",
    changelogDate20260414: "April 14, 2026",
    changelogVersion20260414: "Beta v7.2",
    changelogTitle20260414: "Plugin stability overhaul, instant audit saves, numbered issue badges",
    changelogBody20260414:
      "The Figma plugin no longer freezes when reviewing audits. Pinpoint markers now render in parallel, fonts are pre-loaded, and rapid interactions are queued, eliminating the 5–10 second lockups. Audits also save directly to Qualia the moment analysis finishes, and every issue card now shows a numbered badge matching its canvas marker.",
    changelogItem20260414A: "Plugin freezes eliminated, markers render in parallel with pre-loaded fonts, so highlighting, toggling, and clearing are instant.",
    changelogItem20260414B: "Audits are immediately visible in Qualia after analysis, no separate save step required.",
    changelogItem20260414C: "Issue cards now display numbered badges that match the corresponding pinpoint markers on the canvas.",
    changelogDate20260409: "April 9, 2026",
    changelogVersion20260409: "Beta v7.1",
    changelogTitle20260409: "Prototype audit out of alpha, sharper report labels, security improvements",
    changelogBody20260409:
      "Prototype audit is now always available and no longer experimental. Screen label accuracy in prototype reports is improved, and a security hardening pass ships across the backend.",
    changelogItem20260409A: "Prototype audit is out of alpha, always visible on any Figma frame or flow.",
    changelogItem20260409B: "Screen labels in prototype reports use 1-based numbering, anchored to the correct frames.",
    changelogItem20260409C: "Security improvements: tighter rate limits, stricter CORS, and safer image upload handling.",
    changelogDate20260402: "April 2, 2026",
    changelogVersion20260402: "Beta v7.0",
    changelogTitle20260402: "Qualia plugin is now live on Figma Community",
    changelogBody20260402:
      "The Qualia plugin is publicly available, anyone can install it directly from Figma Community and run audits without leaving Figma. This is the first version open to all users.",
    changelogItem20260402A: "Install the plugin from Figma Community and run UX audits on any frame without switching tools.",
    changelogItem20260402B: "Audit results sync to your Qualia dashboard so you can share and track findings across the team.",
    changelogItem20260402C: "Prototype crawl is available inside the plugin from day one, run full multi-screen audits without leaving Figma.",
    changelogTitle: "Product changelog",
    changelogSubtitle:
      "New improvements shipped to Qualia, focused on what you can do better and faster.",
    changelogUpdatedLabel: "Updated",
    changelogIndexTitle: "Jump to month",
    changelogMonthMarch2026: "March 2026",
    changelogDate20260331: "March 31, 2026",
    changelogVersion20260331: "Beta v6.1",
    changelogTitle20260331: "More reliable Figma prototype crawls and clearer audit reports",
    changelogBody20260331:
      "This release strengthens prototype-based audits from Figma: more dependable crawls, clearer reporting for multi-screen flows, and steady improvements to the plugin and presentation exports.",
    changelogItem20260331A:
      "Improved stability and reliability when crawling Figma prototypes, including more consistent capture of linked screens.",
    changelogItem20260331B:
      "Prototype audit reports better separate UX findings, design-system checks, and prototype-specific insights.",
    changelogItem20260331C:
      "Smoother in-plugin workflow and more dependable deck exports when you share results with your team.",
    changelogDate20260327: "March 27, 2026",
    changelogVersion20260327: "Beta v6.0",
    changelogMajorLabel: "Major release",
    changelogImportantLabel: "Important release",
    changelogTitle20260327: "Prototype crawl for Figma is now available",
    changelogBody20260327:
      "You can now run audits from Figma prototype flows, so multi-screen journeys are easier to evaluate in one pass.",
    changelogItem20260327A: "Start from a Figma prototype URL and capture connected flow screens.",
    changelogItem20260327B: "Get a more complete UX signal across transitions, not just single frames.",
    changelogItem20260327C: "Automatically audit design-system consistency extrapolated from the prototype itself.",
    changelogDate20260325: "March 25, 2026",
    changelogVersion20260325: "Beta v5.0",
    changelogTitle20260325: "Synth user perspective added to audit reports",
    changelogBody20260325:
      "Audit reports can now include an optional simulated-user perspective to reveal likely friction across different user profiles.",
    changelogItem20260325A: "Enable synth users when running an audit.",
    changelogItem20260325B: "Compare key friction points across selected personas.",
    changelogItem20260325C: "Use the extra lens without disrupting your core audit flow.",
    changelogDate20260321: "March 21, 2026",
    changelogVersion20260321: "Beta v4.3",
    changelogTitle20260321: "More reliable Figma import and analysis",
    changelogBody20260321:
      "We improved the end-to-end Figma import experience so audits complete more consistently.",
    changelogItem20260321A: "More stable sign-in and connection behavior for Figma.",
    changelogItem20260321B: "Better handling of export/upload steps during analysis.",
    changelogItem20260321C: "Clearer error feedback when something needs your attention.",
    changelogDate20260312: "March 12, 2026",
    changelogVersion20260312: "Beta v4.2",
    changelogTitle20260312: "Stronger accessibility checks and report quality",
    changelogBody20260312:
      "Accessibility and report signals were refined so issues are easier to prioritize and fix.",
    changelogItem20260312A: "More dependable accessibility checks inside the audit flow.",
    changelogItem20260312B: "Cleaner report output for faster review.",
    changelogItem20260312C: "Sharper guidance to move from findings to action.",
    changelogDate20260311: "March 11, 2026",
    changelogVersion20260311: "Beta v4.1",
    changelogTitle20260311: "Important bugfixes for Figma stability and Notion OAuth",
    changelogBody20260311:
      "We fixed multiple reliability issues affecting the Figma experience and improved Notion OAuth error handling so sign-in failures are easier to understand and recover from.",
    changelogItem20260311A: "More stable Figma iframe with safer `localStorage` access and clearer crash feedback.",
    changelogItem20260311B: "Notion OAuth now surfaces real API errors and respects `returnPath` after token exchange.",
    changelogItem20260311C: "Improved export pagination and auth export/migration reliability.",
  },
  it: {
    changelogNavLabel: "Changelog",
    changelogMonthJuly2026: "Luglio 2026",
    changelogDate20260707: "7 luglio 2026",
    changelogVersion20260707: "Open v10.4",
    changelogTitle20260707: "Supportato il nuovo formato delle chiavi Google Gemini",
    changelogBody20260707:
      "Google ha cambiato di recente il formato delle sue chiavi API Gemini, e Qualia rifiutava quelle nuove quando provavi a salvarle. Ora le nuove chiavi funzionano, e anche quelle esistenti continuano a funzionare.",
    changelogItem20260707A:
      "Le nuove chiavi Google Gemini (il formato AQ. che Google ora rilascia) vengono accettate quando aggiungi o sostituisci una chiave nelle Impostazioni.",
    changelogItem20260707B:
      "Le vecchie chiavi Gemini continuano a funzionare esattamente come prima. Entrambi i formati vengono validati allo stesso modo.",
    changelogItem20260707C:
      "La correzione si applica ovunque incolli una chiave, incluso il messaggio mostrato quando una prova gratuita termina.",
    changelogMonthMay2026: "Maggio 2026",
    changelogDate20260526: "26 maggio 2026",
    changelogVersion20260526: "Open v10.1",
    changelogTitle20260526: "Gemini-first, flow audit affidabili",
    changelogBody20260526:
      "Qualia ora è Gemini-first. Abbiamo rimosso Claude come provider supportato perché l'infrastruttura multi-provider continuava a causare errori a metà audit, e abbiamo risolto i crash dei flow audit che colpivano gli audit multi-schermata.",
    changelogItem20260526A:
      "Claude non è più un'opzione BYOK. Gemini resta il provider preferito, GPT rimane la scelta secondaria. Le chiavi Claude esistenti sono state rimosse; scegli Gemini o GPT nelle Impostazioni.",
    changelogItem20260526B:
      "Gli audit multi-schermata non falliscono più a metà esecuzione per i limiti del worker. Ora passiamo URL firmati direttamente al provider, restando ampiamente dentro il budget di compute.",
    changelogItem20260526C:
      "La scelta del provider per audit, dal modal di upload, ora indirizza davvero al provider selezionato. Prima la scelta veniva persa e veniva usato il default dell'account.",
    changelogDate20260524: "24 maggio 2026",
    changelogVersion20260524: "Open v10.0",
    changelogTitle20260524: "Bring Your Own Key, privacy completamente rifatta",
    changelogBody20260524:
      "La v10.0 segna la release pronta per la produzione. Gli audit girano sulle tue chiavi LLM a costo zero per noi, l'eliminazione dell'account rimuove ogni byte dei tuoi dati dallo storage, e abbiamo ripulito i contenuti sensibili (file di design, risposte degli LLM, flussi OAuth) da tutti i log.",
    changelogItem20260524A:
      "Bring Your Own Key è disponibile per Gemini, GPT e Claude. Usa il tuo credito per audit illimitati, senza costi aggiuntivi.",
    changelogItem20260524B:
      "L'eliminazione dell'account rimuove ora ogni screenshot, documento, progetto, export del plugin e token OAuth dallo storage, non solo dal database.",
    changelogItem20260524C:
      "I log non registrano più contenuti dei file Figma, risposte LLM, token OAuth o payload di design. Solo metadati di errore per il debug.",
    changelogDate20260515: "15 maggio 2026",
    changelogVersion20260515: "Beta v9.7",
    changelogTitle20260515: "Caricamenti più rapidi, accessibilità completa da tastiera, stack sicuro",
    changelogBody20260515:
      "L'app si carica molto più velocemente al primo accesso, il bundle JavaScript principale è del 64% più leggero e ogni pagina viene caricata solo quando serve. Utenti da tastiera e screen reader hanno per la prima volta un'esperienza completa, e cinque vulnerabilità note nell'albero delle dipendenze sono state eliminate.",
    changelogItem20260515A:
      "Il JavaScript del primo caricamento è del 64% più leggero (775 → 282 kB gzip). Ogni pagina ora si carica solo quando serve.",
    changelogItem20260515B:
      "Skip-to-content link su ogni pagina, aria-label su 15 pulsanti icona, e gli stati di caricamento di upload/audit/export ora vengono annunciati agli screen reader.",
    changelogItem20260515C:
      "Zero avvisi di sicurezza nell'albero delle dipendenze (erano cinque). Vite e jsdom aggiornati, GitHub Actions ancorate al SHA del commit, script di installazione disabilitati di default.",
    changelogDate20260511: "11 maggio 2026",
    changelogVersion20260511: "Beta v9.6",
    changelogTitle20260511: "Limite giornaliero visibile, cancel nel plugin, affidabilità diffusa",
    changelogBody20260511:
      "Gli audit giornalieri rimanenti sono ora visibili ovunque, pagina Progetto, pulsante Re-audit e dentro il plugin Figma (home e report), e le card si disabilitano in modo pulito non appena raggiungi zero. Oltre a questo, sono arrivati oltre 25 fix di affidabilità: il pulsante Annulla del plugin ora annulla davvero, i fallimenti di rete mostrano un pulsante Riprova chiaro su Analytics, Contatti e callback OAuth, e gli export PDF/PPTX esecutivi non producono più file rotti silenziosamente.",
    changelogItem20260511A:
      "Il conteggio audit giornalieri è ora visibile su Progetto, pulsante Re-audit e dentro il plugin Figma, controlli e card si disabilitano automaticamente con tooltip al raggiungimento del limite.",
    changelogItem20260511B:
      "Affidabilità plugin: Annulla davvero annulla l'analisi in corso, il re-audit ha un timeout pulito a 60s invece di girare all'infinito, e i nomi frame lunghi mostrano il testo completo al passaggio del mouse.",
    changelogItem20260511C:
      "Robustezza diffusa: stati di errore con Riprova su Analytics, Audit, Contatti e callback OAuth; pulsante Indietro più sicuro su Auth; changelog e tab Impostazioni mobile-friendly; gli export esecutivi rotti non vengono più consegnati silenziosamente.",
    changelogDate20260509: "9 maggio 2026",
    changelogVersion20260509: "Beta v9.5",
    changelogTitle20260509: "Errori espliciti, conferme sui disconnetti, flussi più gentili",
    changelogBody20260509:
      "Dodici miglioramenti UX su Auth, Dashboard, Impostazioni e pagine progetto. I fallimenti di rete mostrano ora un pulsante Riprova invece di sembrare vuoti silenziosamente. Disconnettere integrazioni e revocare l'accesso MCP richiede ora una conferma esplicita. Diversi flussi minori sono stati ammorbiditi, il submit email su Auth lascia il primario a Google, le azioni delle card progetto sono visibili senza dover passare con il mouse, e il flusso post-creazione guida con un toast invece di forzare un modale.",
    changelogItem20260509A:
      "I fallimenti di rete su Dashboard, Impostazioni e Progetto mostrano ora uno stato di errore con pulsante Riprova, niente più 'sembra vuoto quando in realtà è rotto'.",
    changelogItem20260509B:
      "Disconnettere Figma, Notion, Drive o revocare l'accesso MCP apre ora un dialogo di conferma con avvisi contestuali, un click di troppo non può più interrompere audit in corso.",
    changelogItem20260509C:
      "Rifinitura: Google è ora il pulsante primario visivo su Auth, le azioni delle card progetto sono visibili al 30% di opacità di default, le animazioni di conferma signup rispettano prefers-reduced-motion, e l'icona Impostazioni non rimanda più a sé stessa quando si è su Impostazioni.",
    changelogDate20260508: "8 maggio 2026",
    changelogVersion20260508: "Beta v9.4",
    changelogTitle20260508: "Synth sui prototipi, crawl affidabili, CTA plugin",
    changelogBody20260508:
      "L'analisi synth può ora essere avviata su qualsiasi audit prototipo completato senza ripeterlo, e i re-audit ereditano la selezione synth precedente. Il crawl del prototipo termina in modo pulito in caso di timeout o paywall Figma, mostrando un toast di errore chiaro invece di bloccarsi silenziosamente.",
    changelogItem20260508A:
      "Gli audit prototipo includono ora una card \"Avvia Analisi Synth\", aggiungi le prospettive degli utenti synth a qualsiasi audit completato senza ricominciare.",
    changelogItem20260508B:
      "Il crawl del prototipo fallisce in modo pulito in caso di timeout o paywall del piano Figma starter, un toast chiaro ti spiega cosa ha bloccato l'export.",
    changelogItem20260508C:
      "Nuovi inviti al plugin in tutta l'app, banner nel modale di upload, pill nell'intestazione della dashboard, link nello stato vuoto e voce nelle Impostazioni ti guidano al plugin Figma.",
    changelogDate20260507: "7 maggio 2026",
    changelogVersion20260507: "Beta v9.3",
    changelogTitle20260507: "Stabilità sessione, fix prototipi, inviti affidabili",
    changelogBody20260507:
      "Il plugin Figma non effettua più il logout automatico per errori di connessione temporanei, appare invece un prompt inline che ti lascia decidere quando ri-autenticarti. Gli audit prototipo nella home mostrano ora il nome corretto, i punteggi e il tab Design System, e il flusso di invito al team funziona correttamente anche con Google OAuth.",
    changelogItem20260507A:
      "Le sessioni del plugin resistono ora ai problemi di rete temporanei, nessun logout forzato; un prompt inline ti permette di riconnetterti solo quando è davvero necessario.",
    changelogItem20260507B:
      "Gli audit prototipo nella home mostrano ora il nome corretto, i chip Prototype e Frames, e il tab Design System.",
    changelogItem20260507C:
      "I link di invito al team funzionano correttamente con Google OAuth; il pulsante indietro da qualsiasi report ora torna alla home feed.",
    changelogDate20260506: "6 maggio 2026",
    changelogVersion20260506: "Beta v9.2",
    changelogTitle20260506: "Home plugin, report ridisegnati, email di follow-up",
    changelogBody20260506:
      "Il plugin Figma si apre direttamente sui tuoi audit precedenti, riapri uno qualsiasi o tocca per crearne uno nuovo. La vista report è completamente ridisegnata con tabs, feedback in quattro opzioni e un flusso di re-audit che usa le tue risposte per affinare i risultati.",
    changelogItem20260506A:
      "Il plugin ora si apre su una home con i tuoi ultimi 20 audit, riapri uno qualsiasi e rifallo senza uscire da Figma.",
    changelogItem20260506B:
      "I report del plugin sono ridisegnati con tabs (UX, Accessibilità, Design System), feedback in quattro opzioni e un flusso di re-audit che impara dalle tue risposte.",
    changelogItem20260506C:
      "Nuove email di benvenuto e di richiamo, più un'impostazione di lingua unificata che ti segue tra plugin, web app ed email.",
    changelogDate20260505: "5 maggio 2026",
    changelogVersion20260505: "Beta v9.1",
    changelogTitle20260505: "Affidabilità MCP, conferma email, aggiornamenti plugin",
    changelogBody20260505:
      "La connessione con Claude è ora molto più stabile, i disconnessioni OAuth sono risolti e il server MCP è ospitato su qualia-ux.com. Un pannello dedicato alla conferma email arriva per i nuovi iscritti, e le impostazioni del plugin ricevono un redesign completo.",
    changelogItem20260505A:
      "La connessione MCP è ora stabile, rotazione token OAuth corretta, hosting su qualia-ux.com e discovery conforme RFC eliminano i disconnessioni casuali con Claude.",
    changelogItem20260505B:
      "Dopo la registrazione arrivi su un pannello dedicato, rispedisci l'email di conferma o cambia indirizzo senza uscire dal flusso.",
    changelogItem20260505C:
      "Le impostazioni del plugin sono state ridisegnate seguendo il design system; le azioni di export dell'audit sono raccolte in un unico dropdown.",
    changelogMonthApril2026: "Aprile 2026",
    changelogDate20260430: "30 aprile 2026",
    changelogVersion20260430: "Beta v9.0",
    changelogTitle20260430: "Collega Qualia a Claude",
    changelogBody20260430:
      "Claude può ora leggere direttamente i tuoi audit Qualia. Connetti una volta sola dalle Impostazioni o subito dopo aver eseguito un audit, e Claude ha accesso immediato ai tuoi finding, punteggi, screenshot e contesto di progetto, senza copiare e incollare nulla. Funziona con Claude.ai, Claude Desktop e Claude Code.",
    changelogItem20260430A: "Configura il Qualia MCP una volta sola dalle Impostazioni o subito dopo un audit, Claude si autentica in modo sicuro con OAuth e mantiene l'accesso finché non lo revochi.",
    changelogItem20260430B: "Chiedi a Claude di analizzare i problemi principali, generare fix o confrontare audit. Legge il report completo inclusi finding, punteggi e screenshot.",
    changelogItem20260430C: "Funziona con Claude.ai (Connectors), Claude Desktop e Claude Code, connetti da qualsiasi client in meno di due minuti.",
    changelogDate20260421: "21 aprile 2026",
    changelogVersion20260421: "Beta v8.1",
    changelogTitle20260421: "Esporta l'audit come markdown pronto per l'AI",
    changelogBody20260421:
      "Ogni audit può ora essere esportato come markdown strutturato che qualsiasi strumento AI può leggere. L'export raccoglie finding, punteggi, dati di accessibilità e contesto schermata in un unico file pronto da incollare in una chat o in una pipeline.",
    changelogItem20260421A: "Nuovo pulsante \"Esporta per AI\" nella barra azioni dell'audit, un clic genera un file markdown completo e strutturato.",
    changelogItem20260421B: "I nomi dei frame Figma vengono usati come etichette schermata, così l'output si abbina esattamente a ciò che vedi nei tuoi design.",
    changelogItem20260421C: "L'export copre tutti e tre i modi di audit: upload screenshot, frame Figma e crawl del prototipo.",
    changelogDate20260415: "15 aprile 2026",
    changelogVersion20260415: "Beta v8.0",
    changelogTitle20260415: "Team, profili utente e visibilità dei progetti",
    changelogBody20260415:
      "Qualia supporta ora la collaborazione in team. Invita i tuoi colleghi, condividi progetti con la tua organizzazione e sposta il lavoro tra spazio personale e team. Ogni utente ha un profilo con nome e avatar. Il plugin Figma ora separa i progetti personali da quelli del team, così sai sempre su cosa stai facendo l'audit.",
    changelogItem20260415A: "Team workspace: invita membri, condividi progetti con la tua org e controlla chi può gestirli o eliminarli.",
    changelogItem20260415B: "Profilo utente con nome e avatar, visibili sulle card dei progetti e nel breadcrumb.",
    changelogItem20260415C: "Il plugin mostra ora un toggle Personale / Team per scegliere il contesto giusto prima di ogni audit.",
    changelogDate20260414: "14 aprile 2026",
    changelogVersion20260414: "Beta v7.2",
    changelogTitle20260414: "Rework stabilita plugin, salvataggio audit istantaneo, badge numerati sui problemi",
    changelogBody20260414:
      "Il plugin Figma non si blocca piu durante la revisione degli audit. I marker di pinpoint ora si renderizzano in parallelo, i font vengono pre-caricati e le interazioni rapide vengono accodate, eliminando i blocchi da 5–10 secondi. Gli audit vengono anche salvati direttamente su Qualia non appena l'analisi termina, e ogni scheda di problema mostra un badge numerato che corrisponde al marker sulla canvas.",
    changelogItem20260414A: "Blocchi del plugin eliminati, i marker si renderizzano in parallelo con font pre-caricati, rendendo evidenziazione, toggle e pulizia istantanei.",
    changelogItem20260414B: "Gli audit sono immediatamente visibili su Qualia dopo l'analisi, nessun passaggio di salvataggio separato richiesto.",
    changelogItem20260414C: "Le schede dei problemi mostrano ora badge numerati che corrispondono ai marker pinpoint sulla canvas.",
    changelogDate20260409: "9 aprile 2026",
    changelogVersion20260409: "Beta v7.1",
    changelogTitle20260409: "Audit prototipo fuori dall'alpha, etichette piu precise, miglioramenti alla sicurezza",
    changelogBody20260409:
      "L'audit prototipo è ora sempre disponibile e non piu sperimentale. Le etichette schermata nei report prototipo sono piu accurate e un intervento di hardening viene rilasciato sul backend.",
    changelogItem20260409A: "L'audit prototipo è uscito dall'alpha, sempre visibile su qualsiasi frame o flusso Figma.",
    changelogItem20260409B: "Le etichette nei report prototipo usano la numerazione a partire da 1, ancorate ai frame corretti.",
    changelogItem20260409C: "Miglioramenti alla sicurezza: rate limit piu stringenti, CORS piu restrittivo e gestione piu sicura dell'upload immagini.",
    changelogDate20260402: "2 aprile 2026",
    changelogVersion20260402: "Beta v7.0",
    changelogTitle20260402: "Il plugin Qualia è ora disponibile su Figma Community",
    changelogBody20260402:
      "Il plugin Qualia è disponibile pubblicamente, chiunque può installarlo direttamente da Figma Community ed eseguire audit senza uscire da Figma. Questa è la prima versione aperta a tutti gli utenti.",
    changelogItem20260402A: "Installa il plugin da Figma Community ed esegui audit UX su qualsiasi frame senza cambiare strumento.",
    changelogItem20260402B: "I risultati degli audit si sincronizzano con la tua dashboard Qualia per condividere e tracciare i finding con il team.",
    changelogItem20260402C: "Il crawl dei prototipi è disponibile nel plugin fin dal primo giorno, esegui audit multi-schermata completi senza uscire da Figma.",
    changelogTitle: "Changelog prodotto",
    changelogSubtitle:
      "Nuovi miglioramenti rilasciati in Qualia, concentrati su cio che puoi fare meglio e piu velocemente.",
    changelogUpdatedLabel: "Aggiornato",
    changelogIndexTitle: "Vai al mese",
    changelogMonthMarch2026: "Marzo 2026",
    changelogDate20260331: "31 marzo 2026",
    changelogVersion20260331: "Beta v6.1",
    changelogTitle20260331: "Crawl dei prototipi Figma piu affidabile e report di audit piu chiari",
    changelogBody20260331:
      "Questa release rafforza gli audit basati su prototipo da Figma: crawl piu affidabili, report piu chiari per i flussi multi-schermata e miglioramenti costanti al plugin e agli export per presentazioni.",
    changelogItem20260331A:
      "Maggiore stabilita e affidabilita nel crawl dei prototipi Figma, con acquisizione piu costante delle schermate collegate.",
    changelogItem20260331B:
      "I report d'audit prototipo separano meglio i finding UX, i controlli sul design system e le insight specifiche del prototipo.",
    changelogItem20260331C:
      "Flusso nel plugin piu fluido ed export verso le slide piu affidabili quando condividi i risultati con il team.",
    changelogDate20260327: "27 marzo 2026",
    changelogVersion20260327: "Beta v6.0",
    changelogMajorLabel: "Release principale",
    changelogImportantLabel: "Release importante",
    changelogTitle20260327: "Disponibile il crawl dei prototipi Figma",
    changelogBody20260327:
      "Ora puoi avviare audit da flussi di prototipo Figma, cosi i percorsi multi-schermata sono piu facili da valutare in un'unica analisi.",
    changelogItem20260327A: "Parti da un URL di prototipo Figma e acquisisci le schermate collegate del flusso.",
    changelogItem20260327B: "Ottieni un segnale UX piu completo sulle transizioni, non solo su singoli frame.",
    changelogItem20260327C: "Audit automatico della coerenza del design system estratto direttamente dal prototipo.",
    changelogDate20260325: "25 marzo 2026",
    changelogVersion20260325: "Beta v5.0",
    changelogTitle20260325: "Aggiunta la prospettiva degli utenti sintetici ai report",
    changelogBody20260325:
      "I report di audit possono ora includere una prospettiva opzionale di utenti simulati per evidenziare attriti probabili su profili diversi.",
    changelogItem20260325A: "Attiva gli utenti sintetici durante l'audit.",
    changelogItem20260325B: "Confronta i principali punti di attrito tra le personas selezionate.",
    changelogItem20260325C: "Usa questa lente in piu senza interrompere il flusso principale di audit.",
    changelogDate20260321: "21 marzo 2026",
    changelogVersion20260321: "Beta v4.3",
    changelogTitle20260321: "Import e analisi Figma piu affidabili",
    changelogBody20260321:
      "Abbiamo migliorato l'esperienza end-to-end di import da Figma per completare gli audit in modo piu costante.",
    changelogItem20260321A: "Comportamento di accesso e connessione a Figma piu stabile.",
    changelogItem20260321B: "Gestione migliore delle fasi di export/upload durante l'analisi.",
    changelogItem20260321C: "Feedback di errore piu chiari quando serve il tuo intervento.",
    changelogDate20260312: "12 marzo 2026",
    changelogVersion20260312: "Beta v4.2",
    changelogTitle20260312: "Controlli accessibilita e qualita report migliorati",
    changelogBody20260312:
      "I segnali di accessibilita e report sono stati raffinati per aiutarti a prioritizzare e risolvere piu rapidamente.",
    changelogItem20260312A: "Controlli di accessibilita piu affidabili nel flusso di audit.",
    changelogItem20260312B: "Output del report piu pulito per revisioni piu veloci.",
    changelogItem20260312C: "Indicazioni piu nette per passare dai finding alle azioni.",
    changelogDate20260311: "11 marzo 2026",
    changelogVersion20260311: "Beta v4.1",
    changelogTitle20260311: "Correzioni importanti per stabilita Figma e OAuth Notion",
    changelogBody20260311:
      "Abbiamo risolto diversi problemi di affidabilita che impattano l'esperienza Figma e migliorato la gestione degli errori OAuth di Notion, cosi i problemi di accesso sono piu chiari e piu facili da recuperare.",
    changelogItem20260311A: "Finestra Figma piu stabile: accesso piu sicuro a `localStorage` e feedback piu chiaro in caso di crash.",
    changelogItem20260311B: "OAuth Notion: ora vengono mostrati errori reali dell'API e viene rispettato `returnPath` dopo lo scambio del token.",
    changelogItem20260311C: "Migliorata l'affidabilita di export paginati e di export/migrazioni dell'autenticazione.",
  },
} as const;

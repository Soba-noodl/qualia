// supabase/functions/_shared/email-templates.ts

/** Shared header HTML for all emails. */
function header(): string {
  return `
    <tr>
      <td style="background:#7c3aed;padding:16px 24px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:0;line-height:0;"><img src="https://qualia-ux.com/qualia-logo.png" alt="Qualia" width="18" height="18" style="display:block;border:0;width:18px;height:18px;"></td>
            <td style="padding-left:8px;color:#ffffff;font-weight:600;font-size:14px;letter-spacing:0.02em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Qualia</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** Shared footer HTML. */
function footer(unsubscribeUrl: string, lastMessage = ""): string {
  return `
    <tr>
      <td style="padding:12px 24px;border-top:1px solid #f0f0f0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:11px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              ${lastMessage ? lastMessage : "Qualia"}
            </td>
            <td align="right">
              <a href="${unsubscribeUrl}" style="font-size:11px;color:#9ca3af;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** Wraps body content in the email shell. */
function shell(bodyRows: string, footerRow: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          ${header()}
          ${bodyRows}
          ${footerRow}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface WelcomeEmailParams {
  screenName: string;
  score: number;
  topIssueName: string | null;
  topIssueDesc: string | null;
  auditUrl: string;
  unsubscribeUrl: string;
  lang: "en" | "it";
}

export function welcomeEmail(p: WelcomeEmailParams): string {
  const it = p.lang === "it";

  const issueBlock = p.topIssueName
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
        <tr>
          <td style="background:#f9f7ff;border-left:3px solid #7c3aed;padding:10px 14px;border-radius:0 6px 6px 0;">
            <p style="font-size:13px;font-weight:600;color:#111111;margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escHtml(p.topIssueName)}</p>
            <p style="font-size:12px;color:#4b5563;margin:0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escHtml(p.topIssueDesc ?? "")}</p>
          </td>
        </tr>
      </table>`
    : "";

  const label = it ? "Primo audit completato" : "First audit complete";
  const heading = it
    ? `${escHtml(p.screenName)} ha ottenuto un punteggio di ${p.score}`
    : `${escHtml(p.screenName)} scored ${p.score}`;
  const issueIntro = it ? "Ecco il problema più importante da risolvere:" : "Here is the most important issue to fix:";
  const nextStep = it
    ? "<strong style=\"color:#111111;\">Cosa fare dopo:</strong> correggi i problemi critici, poi esegui un nuovo audit. La maggior parte degli schermi migliora di 5-15 punti dopo una prima iterazione."
    : "<strong style=\"color:#111111;\">What to do next:</strong> fix the critical issues, then run a re-audit. Most screens improve 5 to 15 points after a first iteration.";
  const btnLabel = it ? "Visualizza i risultati dell'audit" : "View your audit results";

  const body = `
    <tr>
      <td style="padding:24px;">
        <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${label}</p>
        <h1 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${heading}</h1>
        ${p.topIssueName ? `<p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${issueIntro}</p>` : ""}
        ${issueBlock}
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr>
            <td style="background:#f9f7ff;border-left:3px solid #7c3aed;padding:10px 14px;border-radius:0 6px 6px 0;">
              <p style="font-size:12px;color:#4b5563;margin:0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${nextStep}</p>
            </td>
          </tr>
        </table>
        <a href="${p.auditUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${btnLabel}</a>
      </td>
    </tr>`;

  return shell(body, footer(p.unsubscribeUrl));
}

export interface ReengagementEmailParams {
  step: 1 | 2 | 3;
  screenName?: string;
  score?: number;
  projectUrl?: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
  appUrl: string;
  lang: "en" | "it";
}

export function reengagementEmail(p: ReengagementEmailParams): string {
  const it = p.lang === "it";
  let body: string;

  if (p.step === 1) {
    const label = it ? "48 ore dopo" : "48 hours later";
    const heading = it ? "Cosa hai cambiato dopo il tuo audit?" : "What did you change after your audit?";
    const line1 = it
      ? `Il tuo schermo <strong style="color:#111111;">${escHtml(p.screenName ?? "ultimo schermo")}</strong> ha ottenuto <strong style="color:#7c3aed;">${p.score ?? ""}</strong> due giorni fa. Qualia ha evidenziato i problemi critici.`
      : `Your <strong style="color:#111111;">${escHtml(p.screenName ?? "latest screen")}</strong> scored <strong style="color:#7c3aed;">${p.score ?? ""}</strong> two days ago. Qualia flagged the critical issues.`;
    const line2 = it
      ? "Se hai apportato modifiche, esegui un nuovo audit. Richiede 60 secondi e mostra esattamente cosa è cambiato."
      : "If you've made changes, run a re-audit. It takes 60 seconds and shows you exactly what moved.";
    const btn = it ? "Esegui nuovo audit" : "Run re-audit";
    body = `
      <tr>
        <td style="padding:24px;">
          <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${label}</p>
          <h1 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${heading}</h1>
          <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${line1}</p>
          <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${line2}</p>
          <a href="${p.projectUrl ?? p.dashboardUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${btn}</a>
        </td>
      </tr>`;
  } else if (p.step === 2) {
    const label = it ? "7 giorni dopo" : "7 days later";
    const heading = it
      ? "I tuoi design sono probabilmente cambiati dall'ultimo audit"
      : "Your designs have probably changed since your last audit";
    const line1 = it
      ? "La maggior parte dei team itera ogni settimana. Un audit vecchio di una settimana non considera già il contesto attuale: nuovi flussi, testi rivisti, modifiche al layout."
      : "Most teams iterate weekly. A week-old audit is already missing context: new flows, revised copy, layout changes.";
    const line2 = it
      ? "Qualia intercetta i problemi che il tuo occhio non nota più dopo aver fissato gli stessi schermi."
      : "Qualia catches the issues your eye skips over after you've been staring at the same screens.";
    const btn = it ? "Verifica i tuoi ultimi schermi" : "Audit your latest screens";
    body = `
      <tr>
        <td style="padding:24px;">
          <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${label}</p>
          <h1 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${heading}</h1>
          <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${line1}</p>
          <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${line2}</p>
          <a href="${p.dashboardUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${btn}</a>
        </td>
      </tr>`;
  } else {
    const label = it ? "3 settimane dopo" : "3 weeks later";
    const heading = it ? "Ti è ancora utile?" : "Still useful to you?";
    const body1 = it
      ? "Non continueremo a mandarti email se Qualia non fa per te in questo momento. Se vuoi tornare quando hai design da revisionare, il tuo account è ancora qui."
      : "We won't keep sending emails if Qualia isn't the right fit right now. If you'd like to come back when you have designs to review, your account is still here.";
    const btn1 = it ? "Esegui un audit" : "Run an audit";
    const btn2 = it ? "Disiscriviti" : "Unsubscribe";
    body = `
      <tr>
        <td style="padding:24px;">
          <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${label}</p>
          <h1 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${heading}</h1>
          <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${body1}</p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:10px;">
                <a href="${p.dashboardUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${btn1}</a>
              </td>
              <td>
                <a href="${p.unsubscribeUrl}" style="display:inline-block;background:#ffffff;color:#6b7280;font-size:13px;font-weight:500;padding:9px 20px;border-radius:6px;text-decoration:none;border:1px solid #e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${btn2}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }

  const footerMsg = p.step === 3
    ? (it ? "Qualia. Questa è l'ultima email che ti invieremo per ora." : "Qualia. This is the last email we'll send for now.")
    : "";
  return shell(body, footer(p.unsubscribeUrl, footerMsg));
}

export interface DigestEmailParams {
  auditCount: number;
  avgScore: number;
  scoreDelta: number | null;
  lowestScreenName: string;
  lowestScore: number;
  lowestIssueCount: number;
  reauditUrl: string;
  unsubscribeUrl: string;
  lang: "en" | "it";
}

export function digestEmail(p: DigestEmailParams): string {
  const it = p.lang === "it";
  const deltaColor = p.scoreDelta === null ? "#9ca3af"
    : p.scoreDelta >= 0 ? "#16a34a"
    : "#dc2626";
  const deltaText = p.scoreDelta === null ? "N/A"
    : p.scoreDelta >= 0 ? `+${p.scoreDelta}` : `${p.scoreDelta}`;
  const deltaBg = p.scoreDelta === null ? "#f9fafb"
    : p.scoreDelta >= 0 ? "#f0fdf4"
    : "#fef2f2";

  const label = it ? "Riepilogo settimanale" : "Weekly digest";
  const heading = it ? "La tua settimana su Qualia" : "Your week in Qualia";
  const statAudits = it ? "audit eseguiti" : "audits run";
  const statAvg = it ? "punteggio medio" : "avg score";
  const statVs = it ? "vs settimana scorsa" : "vs last week";
  const sectionLabel = it ? "Peggiore questa settimana" : "Lowest this week";
  const issueCopy = p.lowestIssueCount > 0
    ? (it
        ? `${p.lowestIssueCount} problem${p.lowestIssueCount !== 1 ? "i critici" : "a critico"} non ${p.lowestIssueCount !== 1 ? "risolti" : "risolto"}. Ottimo candidato per un nuovo audit.`
        : `${p.lowestIssueCount} critical issue${p.lowestIssueCount !== 1 ? "s" : ""} unresolved. Good candidate for a re-audit.`)
    : (it
        ? "Buon candidato per un nuovo audit dopo le prossime modifiche."
        : "Good candidate for a re-audit after your next round of changes.");
  const btnLabel = it ? "Rivedi il tuo schermo peggiore" : "Re-audit your lowest screen";

  const body = `
    <tr>
      <td style="padding:24px;">
        <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${label}</p>
        <h1 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${heading}</h1>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr>
            <td width="33%" style="padding-right:6px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:#f9f7ff;border-radius:6px;padding:12px;text-align:center;">
                  <p style="font-size:24px;font-weight:700;color:#7c3aed;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${p.auditCount}</p>
                  <p style="font-size:11px;color:#6b7280;margin:4px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${statAudits}</p>
                </td></tr>
              </table>
            </td>
            <td width="33%" style="padding-right:6px;padding-left:3px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:#f9f7ff;border-radius:6px;padding:12px;text-align:center;">
                  <p style="font-size:24px;font-weight:700;color:#7c3aed;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${p.avgScore}</p>
                  <p style="font-size:11px;color:#6b7280;margin:4px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${statAvg}</p>
                </td></tr>
              </table>
            </td>
            <td width="33%" style="padding-left:3px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="background:${deltaBg};border-radius:6px;padding:12px;text-align:center;">
                  <p style="font-size:24px;font-weight:700;color:${deltaColor};margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${deltaText}</p>
                  <p style="font-size:11px;color:#6b7280;margin:4px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${statVs}</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:6px;margin-bottom:20px;">
          <tr>
            <td style="padding:14px 16px;">
              <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${sectionLabel}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:14px;font-weight:600;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escHtml(p.lowestScreenName)}</td>
                  <td align="right" style="font-size:14px;font-weight:700;color:#dc2626;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${p.lowestScore}</td>
                </tr>
              </table>
              <p style="font-size:12px;color:#6b7280;margin:6px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${issueCopy}</p>
            </td>
          </tr>
        </table>
        <a href="${p.reauditUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${btnLabel}</a>
      </td>
    </tr>`;

  return shell(body, footer(p.unsubscribeUrl));
}

/** Escapes HTML special characters for safe template interpolation. */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Footer for transactional emails — no unsubscribe link. */
function transactionalFooter(): string {
  return `
    <tr>
      <td style="padding:12px 24px;border-top:1px solid #f0f0f0;">
        <p style="font-size:11px;color:#9ca3af;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Qualia</p>
      </td>
    </tr>`;
}

export interface InviteEmailParams {
  orgName: string;
  acceptUrl: string;
}

export function inviteEmail(p: InviteEmailParams): string {
  const body = `
    <tr>
      <td style="padding:24px;">
        <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">You've been invited</p>
        <h1 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Join ${escHtml(p.orgName)} on Qualia</h1>
        <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">You've been invited to collaborate on UX audits for ${escHtml(p.orgName)}. Accept below to set up your account. This link expires in 7 days.</p>
        <a href="${p.acceptUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Accept invite</a>
        <p style="font-size:12px;color:#9ca3af;margin:16px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">If you didn't expect this invitation, you can safely ignore it.</p>
      </td>
    </tr>`;

  return shell(body, transactionalFooter());
}

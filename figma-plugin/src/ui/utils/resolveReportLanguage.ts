export function resolveReportLanguage(
  projectLang: string | null | undefined,
  uiLang: "en" | "it"
): string {
  if (projectLang) return projectLang;
  return uiLang === "it" ? "Italian" : "English";
}

import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";
import { CHANGELOG_MONTHS } from "@/lib/changelog";

const Changelog = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main id="main-content" className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 [text-wrap:balance]">
              {t("changelogTitle")}
            </h1>
            <p className="text-muted-foreground max-w-3xl text-sm sm:text-base">
              {t("changelogSubtitle")}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              {t("changelogUpdatedLabel")}: {t("changelogDate20260707")}
            </p>
          </header>

          {/* Mobile jump nav — hidden on lg+ where sidebar handles this */}
          <div className="lg:hidden mb-6">
            <label htmlFor="changelog-nav-select" className="sr-only">{t("changelogIndexTitle")}</label>
            <select
              id="changelog-nav-select"
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-foreground"
              defaultValue=""
              onChange={(e) => {
                // eslint-disable-next-line no-restricted-syntax -- REACT-004: mobile section-jump via id (sections have static ids; pure scroll-into-view, no React state)
                const el = document.getElementById(e.target.value);
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <option value="" disabled>{t("changelogIndexTitle")}</option>
              {CHANGELOG_MONTHS.map((month) => (
                <option key={month.id} value={month.id}>{t(month.labelKey)}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 h-fit">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                {t("changelogIndexTitle")}
              </p>
              <nav className="flex flex-col gap-1">
                {CHANGELOG_MONTHS.map((month) => (
                  <a
                    key={month.id}
                    href={`#${month.id}`}
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {t(month.labelKey)}
                  </a>
                ))}
              </nav>
            </aside>

            <div className="space-y-10">
              {CHANGELOG_MONTHS.map((month) => (
                <section key={month.id} id={month.id} className="scroll-mt-24">
                  <h2 className="text-2xl font-semibold text-foreground mb-5">{t(month.labelKey)}</h2>
                  <div className="space-y-5">
                    {month.entries.map((entry) => (
                      <article key={entry.titleKey} className="rounded-xl border border-border bg-surface-1 p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground">{t(entry.dateKey)}</span>
                          <span className="text-xs font-medium rounded-full border border-border px-2 py-0.5 text-foreground">
                            {t(entry.versionKey)}
                          </span>
                          {entry.releaseLevel === "major" ? (
                            <span className="text-xs font-medium rounded-full bg-primary/25 text-primary px-2 py-0.5">
                              {"\u2605"} {t("changelogMajorLabel")}
                            </span>
                          ) : entry.releaseLevel === "important" ? (
                            <span className="text-xs font-medium rounded-full bg-amber-500/25 text-amber-400 px-2 py-0.5">
                              {"\u2726"} {t("changelogImportantLabel")}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{t(entry.titleKey)}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t(entry.bodyKey)}</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {entry.itemKeys.map((itemKey) => (
                            <li key={itemKey}>{t(itemKey)}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Changelog;

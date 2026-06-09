import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";
import { substituteLegalAddress } from "@/lib/legal-address";

const Privacy = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      {/* Content */}
      <main id="main-content" className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("privacyTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t("privacyLastUpdated")}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              1. {t("privacyIntroTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("privacyIntroText")} {t("privacyIntroPolicyExplain")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              2. {t("privacyControllerTitle")}
            </h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{t("privacyControllerText")}</li>
              <li>{substituteLegalAddress(t("privacyControllerLocation"))}</li>
              <li>
                {t("privacyControllerEmail")}{" "}
                <a href="mailto:qualia.ai.analysis@gmail.com">qualia.ai.analysis@gmail.com</a>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              3. {t("privacyDataTitle")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("privacyDataIntro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-3">
              <li>
                <strong className="text-foreground">{t("privacyDataAccount")}</strong> {t("privacyDataAccountDesc")}
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>
                    <strong className="text-foreground">{t("privacyDataAccountPurpose")}</strong> {t("privacyDataAccountPurposeText")}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("privacyDataLegalBasis")}</strong> {t("privacyDataLegalBasisContract")}
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">{t("privacyDataUsage")}</strong> {t("privacyDataUsageDesc")}
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>
                    <strong className="text-foreground">{t("privacyDataAccountPurpose")}</strong> {t("privacyDataUsagePurpose")}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("privacyDataLegalBasis")}</strong> {t("privacyDataUsageBasis")}
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">{t("privacyDataIntegration")}</strong> {t("privacyDataIntegrationDesc")}
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>
                    <strong className="text-foreground">{t("privacyDataAccountPurpose")}</strong> {t("privacyDataIntegrationPurpose")}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("privacyDataLegalBasis")}</strong> {t("privacyDataLegalBasisContract")}
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">{t("privacyDataThirdParty")}</strong> {t("privacyDataThirdPartyDesc")}
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>
                    <strong className="text-foreground">{t("privacyDataAccountPurpose")}</strong> {t("privacyDataThirdPartyPurpose")}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("privacyDataLegalBasis")}</strong> {t("privacyDataThirdPartyBasis")}
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">{t("privacyDataApiKeys")}</strong> {t("privacyDataApiKeysDesc")}
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                  <li>
                    <strong className="text-foreground">{t("privacyDataAccountPurpose")}</strong> {t("privacyDataApiKeysPurpose")}
                  </li>
                  <li>
                    <strong className="text-foreground">{t("privacyDataLegalBasis")}</strong> {t("privacyDataApiKeysBasis")}
                  </li>
                </ul>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              4. {t("privacyGoogleTitle")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("privacyGoogleIntro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
              <li><strong className="text-foreground">{t("privacyGoogleLabelCollect")}:</strong> {t("privacyGoogleCollect")}</li>
              <li><strong className="text-foreground">{t("privacyGoogleLabelUse")}:</strong> {t("privacyGoogleUse")}</li>
              <li><strong className="text-foreground">{t("privacyGoogleLabelShare")}:</strong> {t("privacyGoogleShare")}</li>
              <li><strong className="text-foreground">{t("privacyGoogleLabelProtect")}:</strong> {t("privacyGoogleProtect")}</li>
              <li><strong className="text-foreground">{t("privacyGoogleLabelRetention")}:</strong> {t("privacyGoogleRetention")}</li>
            </ul>
            <p className="text-muted-foreground">
              {t("privacyGoogleProhibited")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              5. {t("privacyProcessorsTitle")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("privacyProcessorsIntro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>{t("privacyProcessorSupabase")}</li>
              <li>{t("privacyProcessorPosthog")}</li>
              <li>{t("privacyProcessorPosthogPlugin")}</li>
              <li>{t("privacyProcessorAI")}</li>
              <li>{t("privacyProcessorFigma")}</li>
              <li>{t("privacyProcessorNotionGoogle")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              6. {t("privacyAiProvidersTitle")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("privacyAiProvidersText")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>
                <strong className="text-foreground">{t("privacyAiProvidersGoogle")}</strong>{" "}
                <a href={t("privacyAiProvidersGoogleUrl")} target="_blank" rel="noopener noreferrer">
                  {t("privacyAiProvidersGoogleUrl")}
                </a>
              </li>
              <li>
                <strong className="text-foreground">{t("privacyAiProvidersOpenAI")}</strong>{" "}
                <a href={t("privacyAiProvidersOpenAIUrl")} target="_blank" rel="noopener noreferrer">
                  {t("privacyAiProvidersOpenAIUrl")}
                </a>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              7. {t("privacyTelemetryTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("privacyTelemetryText")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">8. {t("privacyRetentionTitle")}</h2>
            <p className="text-muted-foreground mb-3">
              {t("privacyRetentionIntro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>{t("privacyRetentionAccount")}</li>
              <li>{t("privacyRetentionUsage")}</li>
              <li>{t("privacyRetentionNotionGoogle")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">9. {t("privacyRightsTitle")}</h2>
            <p className="text-muted-foreground mb-3">
              {t("privacyRightsIntro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
              <li>{t("privacyRights1")}</li>
              <li>{t("privacyRights2")}</li>
              <li>{t("privacyRights3")}</li>
              <li>{t("privacyRights4")}</li>
              <li>{t("privacyRights5")}</li>
            </ul>
            <p className="text-muted-foreground">
              {t("privacyRightsContact")}{" "}
              <a href="mailto:qualia.ai.analysis@gmail.com">qualia.ai.analysis@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;

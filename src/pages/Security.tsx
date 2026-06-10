import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";

const Security = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main id="main-content" className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("securityTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t("securityLastUpdated")}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              1. {t("securityIntroTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("securityIntroText")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              2. {t("securityScopeTitle")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("securityScopeIntro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-3">
              <li>{t("securityScopeItem1")}</li>
              <li>{t("securityScopeItem2")}</li>
              <li>{t("securityScopeItem3")}</li>
            </ul>
            <p className="text-muted-foreground">
              {t("securityScopeOutro")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              3. {t("securityReportTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("securityReportText")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              4. {t("securityExpectTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("securityExpectText")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              5. {t("securitySafeHarborTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("securitySafeHarborText")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              6. {t("securityContactTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("securityContactText")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              7. {t("securityByokTitle")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("securityByokText")}
            </p>
            <h3 className="text-base font-semibold text-foreground mb-2">
              {t("securityKeyRotationTitle")}
            </h3>
            <p className="text-muted-foreground">
              {t("securityKeyRotationText")}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Security;

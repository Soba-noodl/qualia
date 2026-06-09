import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";
import { substituteLegalAddress } from "@/lib/legal-address";

const Terms = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      {/* Content */}
      <main id="main-content" className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("termsTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t("termsLastUpdated")}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              1. {t("termsSection1Title")}
            </h2>
            <p className="text-muted-foreground">
              {substituteLegalAddress(t("termsSection1Body"))}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              2. {t("termsSection2Title")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("termsSection2Intro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>{t("termsSection2Item1")}</li>
              <li>{t("termsSection2ItemPlugin")}</li>
              <li>{t("termsSection2Item2")}</li>
              <li>{t("termsSection2Item3")}</li>
              <li>{t("termsSection2Item4")}</li>
              <li>{t("termsSection2Item5")}</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              {t("termsSection2Outro")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              3. {t("termsSection3Title")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("termsSection3Body")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              4. {t("termsSection4Title")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("termsSection4Intro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>
                <strong className="text-foreground">Figma:</strong> {t("termsSection4ItemFigma")}
              </li>
              <li>
                <strong className="text-foreground">Notion and Google (including Drive):</strong>{" "}
                {t("termsSection4ItemNotionGoogle")}
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              5. {t("termsSection5Title")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("termsSection5Intro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>{t("termsSection5Item1")}</li>
              <li>{t("termsSection5Item2")}</li>
              <li>{t("termsSection5Item3")}</li>
              <li>{t("termsSection5Item4")}</li>
              <li>{t("termsSection5Item5")}</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              {t("termsSection5Outro")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              6. {t("termsSection6Title")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("termsSection6Body1")}
            </p>
            <p className="text-muted-foreground">
              {t("termsSection6Body2")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              7. {t("termsSection7Title")}
            </h2>
            <p className="text-muted-foreground">
              {t("termsSection7Body")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              8. {t("termsSection8Title")}
            </h2>
            <p className="text-muted-foreground">
              {t("termsSection8Body")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              9. {t("termsSection9Title")}
            </h2>
            <p className="text-muted-foreground">
              {t("termsSection9Body")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              10. {t("termsSection10Title")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {substituteLegalAddress(t("termsSection10Body1"))}
            </p>
            <p className="text-muted-foreground">
              {t("termsSection10Body2")}{" "}
              <a href="mailto:qualia.ai.analysis@gmail.com">qualia.ai.analysis@gmail.com</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              11. {t("termsByokTitle")}
            </h2>
            <p className="text-muted-foreground mb-3">
              {t("termsByokIntro")}
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>{t("termsByokItem1")}</li>
              <li>{t("termsByokItem2a")} <strong className="text-foreground">{t("termsByokItem2Bold")}</strong> {t("termsByokItem2b")}</li>
              <li>{t("termsByokItem3a")} <strong className="text-foreground">{t("termsByokItem3Bold")}</strong> {t("termsByokItem3b")}</li>
              <li>{t("termsByokItem4")}</li>
              <li>{t("termsByokItem5")}</li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;

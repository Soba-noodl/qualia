import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";

const Faq = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main id="main-content" className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 [text-wrap:balance]">
              {t("faqHeroTitle")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
              {t("faqHeroSubtitle")}
            </p>
          </header>

          <div className="space-y-10">
            {/* Product & workflow */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t("faqSectionProductTitle")}
              </h2>
              <div className="space-y-4">
                <FaqItem question={t("faqQ1")} answer={t("faqA1")} />
                <FaqItem question={t("faqQ2")} answer={t("faqA2")} />
                <FaqItem question={t("faqQ3")} answer={t("faqA3")} />
                <FaqItem question={t("faqQ4")} answer={t("faqA4")} />
                <FaqItem question={t("faqQ5")} answer={t("faqA5")} />
                <FaqItem question={t("faqQ6")} answer={t("faqA6")} />
              </div>
            </section>

            {/* Synth user research */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t("faqSectionSynthTitle")}
              </h2>
              <div className="space-y-4">
                <FaqItem question={t("faqQ7")} answer={t("faqA7")} />
                <FaqItem question={t("faqQ8")} answer={t("faqA8")} />
                <FaqItem question={t("faqQ9")} answer={t("faqA9")} />
                <FaqItem question={t("faqQ10")} answer={t("faqA10")} />
                <FaqItem question={t("faqQ11")} answer={t("faqA11")} />
                <FaqItem question={t("faqQ12")} answer={t("faqA12")} />
              </div>
            </section>

            {/* Data, privacy & accuracy */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t("faqSectionDataTitle")}
              </h2>
              <div className="space-y-4">
                <FaqItem question={t("faqQ13")} answer={t("faqA13")} />
                <FaqItem question={t("faqQ14")} answer={t("faqA14")} />
                <FaqItem question={t("faqQ15")} answer={t("faqA15")} />
                <FaqItem question={t("faqQ16")} answer={t("faqA16")} />
                <FaqItem question={t("faqQ17")} answer={t("faqA17")} />
              </div>
            </section>

            {/* Pricing, access & limits */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t("faqSectionPricingTitle")}
              </h2>
              <div className="space-y-4">
                <FaqItem question={t("faqQ18")} answer={t("faqA18")} />
                <FaqItem question={t("faqQ19")} answer={t("faqA19")} />
                <FaqItem question={t("faqQ20")} answer={t("faqA20")} />
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

const FaqItem = ({ question, answer }: { question: string; answer: string }) => (
  <div className="rounded-xl border border-border bg-surface-1 p-4">
    <p className="text-sm font-semibold text-foreground mb-1">{question}</p>
    <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
  </div>
);

export default Faq;


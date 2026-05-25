import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Gamepad2 } from "lucide-react";

const About = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none" />

      <PublicHeader />

      <main id="main-content" className="relative z-10 flex-1">
        {/* Hero section, photo + intro */}
        <section className="max-w-5xl mx-auto px-6 pt-24 pb-10 grid md:grid-cols-[340px_1fr] gap-12 items-start">
          {/* Photo, container fits image edge-to-edge */}
          <div className="flex justify-center md:justify-start">
            <div className="w-fit max-w-[340px] rounded-2xl overflow-hidden border border-border glow-border">
              <img
                src="/andrea-about.webp"
                alt={t("aboutHeroAlt")}
                loading="lazy"
                decoding="async"
                className="block w-full h-auto align-top"
              />
            </div>
          </div>

          {/* Intro */}
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-gradient" style={{ textWrap: "balance" } as React.CSSProperties}>
              {t("aboutHeroTitle")}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("aboutHeroParagraph1")}
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("aboutHeroParagraph2")}
            </p>
          </div>
        </section>

        <Separator className="max-w-5xl mx-auto" />

        {/* Why Qualia */}
        <section className="max-w-3xl mx-auto px-6 py-12 space-y-6">
          <h2 className="text-2xl font-semibold">{t("aboutWhyTitle")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("aboutWhyParagraph1")}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t("aboutWhyParagraph2")}
          </p>
        </section>

        <Separator className="max-w-3xl mx-auto" />

        {/* The name Qualia */}
        <section className="max-w-3xl mx-auto px-6 py-12 space-y-6">
          <h2 className="text-2xl font-semibold">{t("aboutNameTitle")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("aboutNameParagraph1")}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t("aboutNameParagraph2")}
          </p>
        </section>

        <Separator className="max-w-3xl mx-auto" />

        {/* Life offline */}
        <section className="max-w-3xl mx-auto px-6 py-12 space-y-6">
          <h2 className="text-2xl font-semibold">{t("aboutLifeTitle")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("aboutLifeParagraph1")}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t("aboutLifeParagraph2")}
          </p>
        </section>

        <Separator className="max-w-3xl mx-auto" />

        {/* Currently */}
        <section className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold mb-6">{t("aboutCurrentlyTitle")}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
              <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {t("aboutCurrentlyReadingLabel")}
                </p>
                <p className="font-medium">
                  {t("aboutCurrentlyReadingValue")}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
              <Gamepad2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {t("aboutCurrentlyPlayingLabel")}
                </p>
                <p className="font-medium">
                  {t("aboutCurrentlyPlayingValue")}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;

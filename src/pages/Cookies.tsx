import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { acceptCookies, declineCookies, resetCookieBanner } from "@/lib/posthog";
import { toast } from "@/components/ui/sonner";

const CONSENT_KEY = "cookie-consent";

const Cookies = () => {
  const { t } = useLanguage();
  const [consent, setConsent] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(CONSENT_KEY) : null
  );

  const refreshConsent = useCallback(() => {
    setConsent(localStorage.getItem(CONSENT_KEY));
  }, []);

  useEffect(() => {
    refreshConsent();
  }, [refreshConsent]);

  const handleAllow = () => {
    acceptCookies();
    refreshConsent();
    toast.success(t("cookiesPageSaved"));
  };

  const handleWithdraw = () => {
    declineCookies();
    refreshConsent();
    toast.success(t("cookiesPageWithdrawn"));
  };

  const handleResetBanner = () => {
    resetCookieBanner();
    refreshConsent();
    toast.success(t("cookiesPageBannerReset"));
  };

  const statusMessage =
    consent === null
      ? t("cookiesPageStatusNoDecision")
      : consent === "true"
        ? t("cookiesPageStatusAccepted")
        : t("cookiesPageStatusDeclined");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main id="main-content" className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto prose prose-invert">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("cookiesPageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mb-2">
            {t("cookiesPageLastReviewed")}
          </p>
          <p className="text-muted-foreground mb-8">
            {t("cookiesPageIntro")}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("cookiesPageEssentialTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("cookiesPageEssentialDesc")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("cookiesPageAnalyticsTitle")}
            </h2>
            <p className="text-muted-foreground mb-4">
              {t("cookiesPageAnalyticsDesc")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              {t("cookiesPageYourChoiceTitle")}
            </h2>
            <p className="text-sm font-medium text-foreground mb-1">
              {t("cookiesPageStatusLabel")}
            </p>
            <p className="text-muted-foreground mb-4">{statusMessage}</p>
            <div className="flex flex-wrap gap-2">
              {consent !== "true" && (
                <Button size="sm" onClick={handleAllow}>
                  {t("cookiesPageAllowAnalytics")}
                </Button>
              )}
              {consent === "true" && (
                <Button variant="outline" size="sm" onClick={handleWithdraw}>
                  {t("cookiesPageWithdrawConsent")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetBanner}
              >
                {t("cookiesPageResetBanner")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {t("cookiesPageResetBannerDesc")}
            </p>
          </section>

          <p className="text-sm text-muted-foreground">
            {t("cookiesPagePrivacyLink")}{" "}
            <Link
              to="/privacy"
              className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {t("cookiesPagePrivacyLinkText")}
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Cookies;

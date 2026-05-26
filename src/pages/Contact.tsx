import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import PublicHeader from "@/components/PublicHeader";
import { ContactForm } from "@/components/ContactForm";

class ContactFormBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          We had trouble loading the form — email us at{" "}
          <a href="mailto:support@qualia.design" className="text-primary underline">
            support@qualia.design
          </a>
        </p>
      );
    }
    return this.props.children;
  }
}

const Contact = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none" />

      <PublicHeader />

      <main id="main-content" className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-6 pt-24 pb-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2" style={{ textWrap: "balance" as React.CSSProperties["textWrap"] }}>
            {t("contactTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("contactSubtitle")}
          </p>
        </div>

        <div className="glass rounded-xl p-6 border border-border">
          <ContactFormBoundary>
            <ContactForm showHeader={true} skipEmail={false} />
          </ContactFormBoundary>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;

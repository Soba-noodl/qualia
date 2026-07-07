import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Menu } from "lucide-react";
import Logo from "@/components/Logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function PublicHeader() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + desktop nav links */}
          <div className="flex items-center gap-6">
            <Link
              to="/home"
              className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <Logo size="md" />
            </Link>
            <Link
              to="/use-cases"
              className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline"
            >
              {t("useCasesNavLabel")}
            </Link>
            <Link
              to="/teams"
              className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline"
            >
              {t("teamsNavLabel")}
            </Link>
            <Link
              to="/plugin"
              className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline"
            >
              {t("pluginNavLabel")}
            </Link>
          </div>

          {/* Mobile: hamburger menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden text-foreground"
                aria-label={t("openMenu")}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100vw-2rem,320px)]">
              <SheetHeader>
                <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 pt-4">
                <Link
                  to="/use-cases"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("useCasesNavLabel")}
                </Link>
                <Link
                  to="/teams"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("teamsNavLabel")}
                </Link>
                <Link
                  to="/plugin"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("pluginNavLabel")}
                </Link>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="px-3 py-2 text-sm text-muted-foreground">{t("language")}</div>
                  <div className="px-3">
                  </div>
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Right side: language (desktop only) + auth buttons */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
            </div>
            {loading ? (
              <div className="w-24 h-9 bg-muted animate-pulse rounded-md" />
            ) : user ? (
              <Button onClick={() => navigate("/dashboard")}>
                {t("landingGoToDashboard")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/auth")}>
                  {t("landingLogin")}
                </Button>
                <Button onClick={() => navigate("/auth?mode=signup")}>
                  {t("landingGetStarted")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

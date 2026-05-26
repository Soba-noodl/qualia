import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" />
      <div className="relative z-10 max-w-lg mx-auto px-6">
        <div className="flex flex-col items-center gap-6 glass rounded-2xl px-8 py-10 border border-border">
          <Logo className="h-8 text-foreground" />
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">404</h1>
            <p className="text-lg font-semibold text-foreground">{t("notFoundTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("notFoundSubtitle")}
            </p>
          </div>
          <Button asChild className="mt-2">
            <Link to={user ? "/dashboard" : "/home"}>
              {t("notFoundCta")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

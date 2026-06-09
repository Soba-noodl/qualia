import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X, Info } from 'lucide-react';
import { acceptCookies, declineCookies, hasConsentDecision } from '@/lib/posthog';
import { useLanguage } from '@/contexts/LanguageContext';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Show banner when there is no consent decision; re-check on every route change so it follows the user (e.g. after login)
  useEffect(() => {
    if (!hasConsentDecision()) {
      setVisible(true);
    }
  }, [location.pathname]);

  const handleAccept = () => {
    acceptCookies();
    setVisible(false);
  };

  const handleDecline = () => {
    declineCookies();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t border-border shadow-lg">
      <div className="relative max-w-4xl mx-auto">
        {/* Close button - absolute positioned with safe zone */}
        <button
          onClick={handleDecline}
          className="absolute top-0 right-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        
        {/* Content container with right padding to prevent overlap */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pr-10">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              {t('cookieMessage')}
            </p>
            <button
              onClick={() => navigate('/privacy')}
              className="text-muted-foreground/60 hover:text-primary transition-colors flex-shrink-0"
              aria-label="Read Privacy Policy"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/settings?tab=privacy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setVisible(false)}
            >
              Manage preferences
            </Link>
            <Button variant="outline" size="sm" onClick={handleDecline}>
              {t('cookieDecline')}
            </Button>
            <Button size="sm" onClick={handleAccept}>
              {t('cookieAccept')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
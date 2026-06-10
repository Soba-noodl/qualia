import { useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, RequireAuth } from "@/contexts/AuthContext";
import { TourStateProvider } from "@/contexts/TourStateContext";
import { CookieConsent } from "@/components/CookieConsent";
import { initPostHog } from "@/lib/posthog";
import { queryClient } from "@/lib/query-client";
// Eager-import the two highest-traffic entry routes:
// - Index (/home) is the post-signout landing target
// - Auth (/auth) is the login destination
// Both need to feel instant; lazy-loading produces a visible "blank with spinner"
// flash that users perceive as a black screen.
import Index from "./pages/Index";
import Auth from "./pages/Auth";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Project = lazy(() => import("./pages/Project"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Security = lazy(() => import("./pages/Security"));
const NotionCallback = lazy(() => import("./pages/NotionCallback"));
const FigmaCallback = lazy(() => import("./pages/FigmaCallback"));
const McpAuthorizePage = lazy(() => import("./pages/McpAuthorizePage"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Cookies = lazy(() => import("./pages/Cookies"));
const UseCases = lazy(() => import("./pages/UseCases"));
const Teams = lazy(() => import("./pages/Teams"));
const Plugin = lazy(() => import("./pages/Plugin"));
const Faq = lazy(() => import("./pages/Faq"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Showcase = lazy(() => import("./pages/Showcase"));
const ShowcaseAudit = lazy(() => import("./pages/ShowcaseAudit"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PluginAuth = lazy(() => import("./pages/PluginAuth"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

/** Renders Index at / when URL has hash or query (e.g. OAuth callback) so tokens aren't lost; otherwise redirects to /home. */
function RootRoute() {
  const location = useLocation();
  const isOAuthCallback = !!(location.hash || location.search);
  if (isOAuthCallback) return <Index />;
  return <Navigate to="/home" replace />;
}

const App = () => {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <TourStateProvider>
              <ScrollToTop />
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md focus:outline focus:outline-2 focus:outline-primary"
              >
                Skip to main content
              </a>
              <Suspense
                fallback={
                  <div
                    className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<RootRoute />} />
                  <Route path="/home" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Navigate to="/auth" replace />} />
                  <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                  <Route path="/project/:id" element={<RequireAuth><Project /></RequireAuth>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
                  <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/cookies" element={<Cookies />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/security" element={<Security />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/faq" element={<Faq />} />
                  <Route path="/changelog" element={<Changelog />} />
                  <Route path="/use-cases" element={<UseCases />} />
                  <Route path="/showcase" element={<Showcase />} />
                  <Route path="/showcase/:slug" element={<ShowcaseAudit />} />
                  <Route path="/teams" element={<Teams />} />
                  <Route path="/plugin" element={<Plugin />} />
                  <Route path="/auth/notion/callback" element={<NotionCallback />} />
                  <Route path="/auth/figma/callback" element={<FigmaCallback />} />
                  <Route path="/auth/mcp/authorize" element={<McpAuthorizePage />} />
                  <Route path="/plugin-auth" element={<PluginAuth />} />
                  <Route path="/accept-invite" element={<AcceptInvite />} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <CookieConsent />
              </TourStateProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;

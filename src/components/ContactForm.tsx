import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export interface ContactFormProps {
  /** When true, hide the email field (e.g. in Settings; submit uses userEmail) */
  skipEmail?: boolean;
  /** When skipEmail is true, this email is used as sender (e.g. user.email) */
  userEmail?: string;
  /** Optional: show compact form title/subtitle (false when embedded in Settings) */
  showHeader?: boolean;
  /** Optional: custom class for the form container */
  className?: string;
}

export function ContactForm({
  skipEmail = false,
  userEmail = "",
  showHeader = true,
  className = "",
}: ContactFormProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitEmail = skipEmail ? userEmail : email;
    if (!name.trim() || !message.trim()) return;
    if (!submitEmail?.trim()) return;

    setSending(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contact`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const body = { name: name.trim(), message: message.trim(), email: submitEmail.trim() };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Send failed");
      }
      toast.success(t("contactSuccess"));
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      // intentional: send failure surfaces to user via toast — exception details not actionable
      toast.error(t("contactError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {showHeader && (
        <>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {t("contactFormTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("contactFormSubtitle")}
          </p>
        </>
      )}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contact-name" className="text-sm text-foreground">
            {t("contactNameLabel")}
          </Label>
          <Input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("contactNamePlaceholder")}
            required
            className="bg-surface-1 border-border"
          />
        </div>
        {!skipEmail && (
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-sm text-foreground">
              {t("contactEmailLabel")}
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("contactEmailPlaceholder")}
              required
              className="bg-surface-1 border-border"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="contact-message" className="text-sm text-foreground">
            {t("contactMessageLabel")}
          </Label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("contactMessagePlaceholder")}
            required
            rows={4}
            className="bg-surface-1 border-border resize-none"
          />
        </div>
        <div className="flex justify-end">
        <Button
          type="submit"
          disabled={
            sending ||
            !name.trim() ||
            !message.trim() ||
            (skipEmail ? !userEmail?.trim() : !email.trim())
          }
        >
          {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {sending ? t("contactSending") : t("contactSendButton")}
        </Button>
        </div>
      </div>
    </form>
  );
}

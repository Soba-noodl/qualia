import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ScreenContextInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

const ScreenContextInput = ({ value, onChange, label, placeholder }: ScreenContextInputProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <Label htmlFor="screen-context">
        {label || t("screenContext")}
      </Label>
      <Textarea
        id="screen-context"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t("screenContextPlaceholder")}
        className="bg-surface-1 border-border resize-none"
        rows={1}
      />
      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        {t("screenContextHelper")}
      </p>
    </div>
  );
};

export default ScreenContextInput;

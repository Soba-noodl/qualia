import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserDataInputProps {
  value: string;
  onChange: (value: string) => void;
}

const UserDataInput = ({ value, onChange }: UserDataInputProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <Label htmlFor="user-data">
        {t("userDataLabel")}{" "}
        <span className="text-muted-foreground font-normal">({t("optional")})</span>
      </Label>
      <Textarea
        id="user-data"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("userDataPlaceholder")}
        className="bg-surface-1 border-border resize-none"
        rows={2}
      />
      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        {t("userDataHelper")}
      </p>
    </div>
  );
};

export default UserDataInput;

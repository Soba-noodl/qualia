import { useState } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { formatDate, formatDateRange } from "@/lib/dateFormat";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

type PresetKey = "last7" | "last30" | "allTime" | "custom";

const DateRangeFilter = ({ dateRange, onDateRangeChange }: DateRangeFilterProps) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>("allTime");

  const handlePresetClick = (preset: PresetKey) => {
    if (preset === "custom") {
      setOpen(true);
      return;
    }
    setActivePreset(preset);
    const today = new Date();
    switch (preset) {
      case "last7":
        onDateRangeChange({ from: startOfDay(subDays(today, 6)), to: endOfDay(today) });
        break;
      case "last30":
        onDateRangeChange({ from: startOfDay(subDays(today, 29)), to: endOfDay(today) });
        break;
      case "allTime":
        onDateRangeChange(undefined);
        break;
    }
  };

  const handleCustomDateChange = (range: DateRange | undefined) => {
    setActivePreset("custom");
    onDateRangeChange(range);
    // Close popover once a full range is selected
    if (range?.from && range?.to) setOpen(false);
  };

  const getCustomLabel = () => {
    if (!dateRange?.from) return t("customRange");
    if (dateRange.to) return formatDateRange(dateRange.from, dateRange.to);
    return formatDate(dateRange.from);
  };

  const presets: { key: PresetKey; label: string }[] = [
    { key: "last7", label: t("last7Days") },
    { key: "last30", label: t("last30Days") },
    { key: "allTime", label: t("allTime") },
    { key: "custom", label: activePreset === "custom" ? getCustomLabel() : t("customRange") },
  ];

  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {presets.map(({ key, label }) =>
        key === "custom" ? (
          <Popover key={key} open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={activePreset === "custom" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetClick("custom")}
                className={cn("h-8 px-3 text-sm gap-1.5", activePreset === "custom" && "font-medium")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50 bg-popover" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleCustomDateChange}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            key={key}
            variant={activePreset === key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handlePresetClick(key)}
            className="h-8 px-3 text-sm"
          >
            {label}
          </Button>
        )
      )}
    </div>
  );
};

export default DateRangeFilter;

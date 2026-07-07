import { X, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTourState } from "@/contexts/TourStateContext";

interface UserDataNudgeProps {
  userData: string | null | undefined;
}

const UserDataNudge = ({ userData }: UserDataNudgeProps) => {
  const { shouldShowTour, markTourCompleted } = useTourState();

  if (userData?.trim() || !shouldShowTour("userDataNudge")) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <BarChart2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Your audit ran without user evidence.</span>{" "}
        Expand "Add User Data" next time — drop-off rates, session times, or heatmap observations
        help the AI ground its findings in real behaviour.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground -mt-0.5 -mr-0.5"
        onClick={() => markTourCompleted("userDataNudge")}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default UserDataNudge;

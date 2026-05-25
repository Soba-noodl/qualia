import { useLanguage } from "@/contexts/LanguageContext";
import { SCORE_THRESHOLDS } from "@/lib/score-colors";

interface ScoreCardProps {
  score: number;
}

const ScoreCard = ({ score }: ScoreCardProps) => {
  const { t } = useLanguage();

  const getScoreConfig = (score: number) => {
    if (score >= SCORE_THRESHOLDS.GOOD) {
      return {
        color: "text-green-400",
        bgColor: "bg-green-500/20",
        strokeColor: "stroke-green-400",
        label: t("scoreExcellent"),
        ringBg: "stroke-green-500/20",
      };
    }
    if (score >= SCORE_THRESHOLDS.WARNING) {
      return {
        color: "text-amber-400",
        bgColor: "bg-amber-500/20",
        strokeColor: "stroke-amber-400",
        label: t("scoreGood"),
        ringBg: "stroke-amber-500/20",
      };
    }
    return {
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      strokeColor: "stroke-red-400",
      label: t("scoreCritical"),
      ringBg: "stroke-red-500/20",
    };
  };

  const config = getScoreConfig(score);
  const accessibleLabel = `${t("qualiaUxScore")}: ${score} (${config.label})`;
  
  // SVG circle calculations
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div
      className="flex flex-col items-center gap-3"
      role="group"
      aria-label={accessibleLabel}
    >
      <p className="text-sm font-medium text-muted-foreground">{t("qualiaUxScore")}</p>
      
      {/* Circular Progress Ring */}
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={config.ringBg}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={config.strokeColor}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: dashOffset,
              transition: "stroke-dashoffset 0.5s ease-out",
            }}
          />
        </svg>
        
        {/* Score number in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-4xl font-bold ${config.color}`}>
            {score}
          </span>
        </div>
      </div>

      {/* Label badge */}
      <div className={`px-4 py-1.5 rounded-full ${config.bgColor}`}>
        <span className={`text-sm font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
};

export default ScoreCard;

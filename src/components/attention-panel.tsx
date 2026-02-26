import {
  AlertTriangle,
  CircleAlert,
  CircleCheck,
} from "lucide-react";

export interface Alert {
  type: "critical" | "warning" | "info";
  message: string;
}

interface Props {
  alerts: Alert[];
}

const STYLES = {
  critical: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    icon: AlertTriangle,
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    icon: CircleAlert,
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    icon: CircleAlert,
  },
} as const;

export function AttentionPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <CircleCheck className="size-5 text-emerald-500" />
        <p className="text-sm text-muted-foreground">All clear</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => {
        const style = STYLES[alert.type];
        const Icon = style.icon;
        return (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${style.bg}`}
          >
            <Icon className={`size-3.5 mt-0.5 flex-shrink-0 ${style.text}`} />
            <span className={`text-xs leading-relaxed ${style.text}`}>
              {alert.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

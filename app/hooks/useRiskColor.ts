import type { RiskLevel } from "~/lib/constants";

const RISK_COLOR_MAP: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  safe:     { text: "text-status-safe",     bg: "bg-status-safe-bg",     border: "border-status-safe" },
  moderate: { text: "text-status-moderate", bg: "bg-status-moderate-bg", border: "border-status-moderate" },
  high:     { text: "text-status-high",     bg: "bg-status-high-bg",     border: "border-status-high" },
  critical: { text: "text-status-critical", bg: "bg-status-critical-bg", border: "border-status-critical" },
  offline:  { text: "text-status-offline",  bg: "bg-status-offline-bg",  border: "border-status-offline" },
};

export function useRiskColor(level: RiskLevel) {
  return RISK_COLOR_MAP[level] ?? RISK_COLOR_MAP.offline;
}

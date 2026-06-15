export const RISK_LEVELS = ["safe", "moderate", "high", "critical", "offline"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const LANGUAGES = ["en", "mr", "hi"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  mr: "मराठी",
  hi: "हिंदी",
};

export const USER_ROLES = ["msme", "lrdb"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SENSITIVITY_TYPES = [
  "water",
  "heat",
  "fragile",
  "perishable",
  "flammable",
  "theft",
  "humidity",
] as const;
export type SensitivityType = (typeof SENSITIVITY_TYPES)[number];

export const QUERY_STATUSES = [
  "pending",
  "under-review",
  "assigned",
  "resolved",
  "escalated",
] as const;
export type QueryStatus = (typeof QUERY_STATUSES)[number];

export const PRIORITY_LEVELS = ["low", "medium", "high", "critical"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const ALERT_CATEGORIES = ["Flood", "Wind", "Power Outage", "Heat Wave", "Earthquake"] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const CHART_COLORS = [
  "#1A6B4A",
  "#2563EB",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#0891B2",
] as const;

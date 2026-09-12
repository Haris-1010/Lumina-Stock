export type DashboardPeriod = "daily" | "weekly" | "monthly";

// Store reporting uses Pakistan Standard Time (UTC+05:00), independent of server timezone.
export function getDashboardPeriod(value: unknown, now = new Date()) {
  const period: DashboardPeriod = value === "weekly" || value === "monthly" ? value : "daily";
  const offset = 5 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  if (period === "weekly") start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  if (period === "monthly") start.setUTCDate(1);
  return { period, start: new Date(start.getTime() - offset), end: now };
}

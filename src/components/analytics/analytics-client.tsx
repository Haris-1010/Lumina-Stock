"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import type { SalesDataPoint, CategoryBreakdown } from "@/types";

export function AnalyticsClient({
  salesData,
  categoryData,
  currencyCode,
}: {
  salesData: SalesDataPoint[];
  categoryData: CategoryBreakdown[];
  currencyCode: string;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const axisColor = isDark ? "#94a3b8" : "#a1a1aa";
  const gridColor = isDark ? "#273247" : "#f0f0f0";
  const tooltipStyle = {
    borderRadius: "8px",
    border: isDark ? "1px solid #334155" : "1px solid #e4e4e7",
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#18181b",
    boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.35)" : "0 1px 3px rgba(0,0,0,0.1)",
  };

  function formatCompactCurrency(value: number) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    } catch {
      return formatCurrency(value, currencyCode);
    }
  }

  return (
    <Tabs defaultValue="sales" className="space-y-4">
      <TabsList>
        <TabsTrigger value="sales">{t("analytics.tab.salesVsStock")}</TabsTrigger>
        <TabsTrigger value="categories">{t("analytics.tab.categoryBreakdown")}</TabsTrigger>
      </TabsList>

      <TabsContent value="sales">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.card.salesVsStock30")}</CardTitle>
          </CardHeader>
          <CardContent>
            {salesData.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">{t("analytics.noSalesData")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={salesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={axisColor} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke={axisColor} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke={axisColor} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: isDark ? "#cbd5e1" : "#3f3f46" }} />
                  <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={2} dot={false} name={t("analytics.legend.unitsSold")} />
                  <Line yAxisId="right" type="monotone" dataKey="stock" stroke="#10b981" strokeWidth={2} dot={false} name={t("analytics.legend.stockLevel")} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="categories">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.card.inventoryValueByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">{t("analytics.noCategoryData")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={categoryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} stroke={axisColor} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke={axisColor}
                    tickFormatter={(v) => formatCompactCurrency(Number(v))}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currencyCode)}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} name={t("analytics.legend.inventoryValue")} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

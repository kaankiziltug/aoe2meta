"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { CivEloBreakdown } from "@/lib/api/types";

interface EloChartProps {
  eloBreakdown: CivEloBreakdown[];
}

export function EloChart({ eloBreakdown }: EloChartProps) {
  const chartData = eloBreakdown.map((e) => ({
    name: e.eloLabel,
    winRate: parseFloat(e.winRate.toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
        <XAxis
          dataKey="name"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[44, 58]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "#1c1c1e",
            border: "1px solid #f97316",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#ffffff",
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
          labelStyle={{ color: "#f97316", fontWeight: 600 }}
          itemStyle={{ color: "#ffffff" }}
          cursor={{ fill: "rgba(249,115,22,0.08)" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [
            typeof value === "number" ? `${(value as number).toFixed(1)}%` : String(value ?? ""),
            "Win Rate",
          ]}
        />
        <ReferenceLine
          y={50}
          stroke="#f97316"
          strokeDasharray="4 2"
          strokeWidth={1.5}
          label={{ value: "50%", fill: "#f97316", fontSize: 11, position: "right" }}
        />
        <Bar dataKey="winRate" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={52} />
      </BarChart>
    </ResponsiveContainer>
  );
}

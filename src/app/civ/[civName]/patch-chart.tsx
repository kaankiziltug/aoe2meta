"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { CivPatchPoint } from "@/lib/api/types";

interface PatchChartProps {
  data: CivPatchPoint[];
}

export function PatchChart({ data }: PatchChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
        <XAxis
          dataKey="patchLabel"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
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
          formatter={(value) => {
            const v = typeof value === "number" ? value : Number(value);
            return [`${v.toFixed(2)}%`, "Win Rate"];
          }}
        />
        <ReferenceLine y={50} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5} />
        <Line
          type="monotone"
          dataKey="winRate"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ fill: "#f97316", r: 4 }}
          activeDot={{ r: 6, fill: "#f97316" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

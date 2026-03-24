"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RatingPoint } from "@/lib/api/types";

interface RatingChartProps {
  data: RatingPoint[];
}

export function RatingChart({ data }: RatingChartProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No rating history available
      </div>
    );
  }

  const chartData = data.map((point) => ({
    date: new Date(point.timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    rating: point.rating,
    timestamp: point.timestamp,
  }));

  const ratings = data.map((p) => p.rating);
  const minRating = Math.floor(Math.min(...ratings) / 50) * 50 - 50;
  const maxRating = Math.ceil(Math.max(...ratings) / 50) * 50 + 50;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.70 0.20 55)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="oklch(0.70 0.20 55)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 250)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "oklch(0.6 0.01 250)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "oklch(0.25 0.01 250)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minRating, maxRating]}
            tick={{ fill: "oklch(0.6 0.01 250)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "oklch(0.25 0.01 250)" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.16 0.01 250)",
              border: "1px solid oklch(0.25 0.01 250)",
              borderRadius: "8px",
              color: "oklch(0.93 0.01 90)",
              fontSize: "12px",
            }}
            labelStyle={{ color: "oklch(0.6 0.01 250)" }}
            formatter={(value) => [`${value}`, "Rating"]}
          />
          <Area
            type="monotone"
            dataKey="rating"
            stroke="oklch(0.70 0.20 55)"
            strokeWidth={2}
            fill="url(#ratingGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartData {
  name?: string;
  value?: number;
  [key: string]: string | number | undefined;
}

interface DashboardChartProps {
  title: string;
  data: ChartData[];
  type: "line" | "bar" | "pie";
  dataKey?: string;
  xAxisKey?: string;
  className?: string;
  height?: number;
  colors?: string[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function DashboardChart({
  title,
  data,
  type,
  dataKey = "value",
  xAxisKey = "name",
  className,
  height = 300,
  colors,
}: DashboardChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Use provided colors or fall back to default colors
  const chartColors = colors && colors.length > 0 ? colors : COLORS;

  const chartProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  };

  const renderChart = (): React.ReactElement | null => {
    switch (type) {
      case "line":
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
            <XAxis dataKey={xAxisKey} stroke={isDark ? "#9ca3af" : "#6b7280"} fontSize={12} />
            <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1f2937" : "#ffffff",
                border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                borderRadius: "6px",
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={chartColors[0]}
              strokeWidth={3}
              dot={{ fill: chartColors[0], r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case "bar":
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
            <XAxis dataKey={xAxisKey} stroke={isDark ? "#9ca3af" : "#6b7280"} fontSize={12} />
            <YAxis stroke={isDark ? "#9ca3af" : "#6b7280"} fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1f2937" : "#ffffff",
                border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                borderRadius: "6px",
              }}
            />
            <Bar dataKey={dataKey} fill={chartColors[0]} radius={[8, 8, 0, 0]} />
          </BarChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={dataKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn("border-border bg-card", className)}>
      <div className="p-6">
        <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart() || <div>No chart available</div>}
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

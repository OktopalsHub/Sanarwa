"use client";

import { Card } from "@sanarwa/ui/card";
import { cn } from "@/lib/utils";
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
  type PieLabelRenderProps,
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
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--popover-foreground)",
  fontSize: "12px",
  boxShadow: "var(--shadow-card)",
} as const;

function pieLabel({ name, percent }: PieLabelRenderProps) {
  const share = typeof percent === "number" ? `${(percent * 100).toFixed(0)}%` : "";
  return `${typeof name === "string" ? name : ""} ${share}`.trim();
}

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
  const chartColors = colors && colors.length > 0 ? colors : COLORS;

  const chartProps = {
    data,
    margin: { top: 5, right: 8, left: 0, bottom: 5 },
  };

  const renderChart = (): React.ReactElement | null => {
    switch (type) {
      case "line":
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} width={40} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={chartColors[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        );

      case "bar":
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xAxisKey} {...axisProps} />
            <YAxis {...axisProps} width={40} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey={dataKey} fill={chartColors[0]} radius={[4, 4, 0, 0]} />
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
              label={pieLabel}
              outerRadius={80}
              dataKey={dataKey}
            >
              {data.map((entry, index) => (
                <Cell
                  key={typeof entry.name === "string" ? entry.name : index}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn("border-border bg-card", className)}>
      <div className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart() ?? <div>No chart available</div>}
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

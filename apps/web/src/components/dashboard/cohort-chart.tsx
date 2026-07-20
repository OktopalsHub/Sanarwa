"use client";

import { User, Users } from '@/lib/icons';

import { Card } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface CohortData {
  date: string;
  totalUsers: number;
  retention: Record<string, number>;
}

interface CohortChartProps {
  data: CohortData[];
  title?: string;
  description?: string;
}

export function CohortChart({
  data,
  title = "User Retention Cohorts",
  description = "Percentage of users returning over time",
}: CohortChartProps) {
  // Get all unique periods (keys from retention objects)
  const periods = Array.from(
    new Set(data.flatMap((item) => Object.keys(item.retention)))
  ).sort((a, b) => parseInt(a) - parseInt(b));

  const getRetentionColor = (percentage: number) => {
    // Gradient from red (low) to green (high)
    if (percentage >= 80) return "bg-emerald-500/90 text-white";
    if (percentage >= 60) return "bg-emerald-400/80 text-white";
    if (percentage >= 40) return "bg-yellow-400/80 text-black";
    if (percentage >= 20) return "bg-orange-400/80 text-white";
    return "bg-red-400/80 text-white";
  };

  return (
    <Card className="glass border-border/50 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="mb-2 flex">
            <div className="w-32 flex-shrink-0 text-sm font-medium">Cohort</div>
            <div className="w-24 flex-shrink-0 text-center text-sm font-medium">
              Users
            </div>
            <div className="flex flex-1">
              {periods.map((period) => (
                <div
                  key={period}
                  className="flex-1 text-center text-sm font-medium"
                >
                  {period === "0" ? "Month 0" : `Month ${period}`}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {data.map((cohort, index) => (
              <div key={index} className="flex items-center">
                <div className="text-muted-foreground w-32 flex-shrink-0 text-sm">
                  {new Date(cohort.date).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                <div className="w-24 flex-shrink-0 text-center text-sm">
                  {cohort.totalUsers.toLocaleString()}
                </div>
                <div className="flex flex-1 gap-1">
                  {periods.map((period) => {
                    const value = cohort.retention[period];
                    return (
                      <div key={period} className="flex-1">
                        {value !== undefined ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex h-8 w-full items-center justify-center rounded text-xs font-medium transition-colors ${getRetentionColor(
                                    value
                                  )}`}
                                >
                                  {value}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {Math.round(
                                    (cohort.totalUsers * value) / 100
                                  )}{" "}
                                  users
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <div className="bg-muted/20 h-8 w-full rounded" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

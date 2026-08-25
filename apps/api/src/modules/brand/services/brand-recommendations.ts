export type RecommendationPriority = "high" | "medium" | "low";

export interface BrandRecommendation {
  priority: RecommendationPriority;
  title: string;
  description: string;
  action: string;
}

export interface ScoredRecommendations {
  status: "excellent" | "good" | "needs_improvement" | "poor";
  score: number;
  recommendations: BrandRecommendation[];
}

export function scoreToStatus(score: number): ScoredRecommendations["status"] {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "needs_improvement";
  return "poor";
}

export function recommendationFailure(message?: string): ScoredRecommendations {
  return {
    status: "poor",
    score: 0,
    recommendations: [
      {
        priority: "high",
        title: "Fix Brand Configuration",
        description: message ?? "Unable to analyze brand configuration due to an error",
        action: "Check brand settings and try again",
      },
    ],
  };
}

export interface PathRequest {
  task: string;
  availableHours?: number | null;
  deadlineDate?: string | null;
}

export interface PathStep {
  title: string;
  description: string;
  estimated_minutes: number;
}

export interface PathResponse {
  risk_level: "Low" | "Medium" | "High";
  minimum_viable_outcome: string;
  must_do: string[];
  skip: string[];
  next_action: string;
  steps: PathStep[];
  efficiency_quote: string;
  estimated_total_hours: number;
  is_fallback?: boolean;
}

export interface SavedPath {
  id: string;
  createdAt: string;
  task: string;
  availableHours?: number | null;
  deadlineDate?: string | null;
  response: PathResponse;
}

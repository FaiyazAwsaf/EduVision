// API client for the script evaluation backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// RubricSet from rubrics module (replaces QuestionPaper)
export interface RubricSet {
  id: string;
  title: string;
  subject: string;
  total_marks: number;
  state: "draft" | "published" | "archived";
  version: number;
  metadata?: Record<string, unknown>;
  questions?: QuestionRubric[];
  created_at: string;
  updated_at?: string;
}

export interface QuestionRubric {
  id: string;
  question_number: string;
  question_text: string;
  max_marks: number;
  evaluation_rules: Record<string, unknown> | unknown[]; // JSON object with marking criteria
  created_at: string;
  updated_at?: string;
}

export interface AnswerScript {
  id: string;
  student_name?: string;
  student_id?: string;
  rubric_set: RubricSet;  // Changed from question_paper
  status: "pending" | "processing" | "evaluated" | "error";
  total_score?: number;
  percentage?: number;
  feedback_summary?: string;
  strengths?: string[];
  areas_for_improvement?: string[];
  pages?: ScriptPage[];
  question_evaluations?: QuestionEvaluation[];
  created_at: string;
  evaluated_at?: string;
}

export interface ScriptPage {
  id: string;
  page_number: number;
  image: string;
  image_url?: string;
  extracted_text?: string;
  extracted_equations?: string[];
  ocr_confidence?: number;
}

export interface QuestionEvaluation {
  id: string;
  question_number: string;
  question_text: string;
  max_marks: number;
  method_marks_awarded: number;
  calculation_marks_awarded: number;
  answer_marks_awarded: number;
  total_marks_awarded: number;
  student_answer_text?: string;
  method_feedback?: string;
  calculation_feedback?: string;
  answer_feedback?: string;
  key_points_found?: string[];
  key_points_missing?: string[];
  mistakes_identified?: string[];
  overall_feedback?: string;
  confidence_score?: number;
  needs_manual_review?: boolean;
  review_reason?: string;
}

export interface EvaluationReport {
  script_id: string;
  student_name?: string;
  student_id?: string;
  rubric_set: {  // Changed from question_paper
    id: string;
    title: string;
    subject: string;
    total_marks: number;
  };
  evaluation_summary: {
    total_score: number;
    max_score: number;
    percentage: number;
    status: string;
    evaluated_at?: string;
  };
  question_results: {
    question_number: string;
    question_text: string;
    marks: {
      method: { awarded: number; max: number; feedback?: string };
      calculation: { awarded: number; max: number; feedback?: string };
      answer: { awarded: number; max: number; feedback?: string };
      total: number;
      max_total: number;
    };
    student_answer?: string;
    key_points_found?: string[];
    key_points_missing?: string[];
    mistakes_identified?: string[];
    overall_feedback?: string;
    confidence_score?: number;
    needs_manual_review?: boolean;
    review_reason?: string;
  }[];
  overall_feedback: {
    summary?: string;
    strengths?: string[];
    areas_for_improvement?: string[];
  };
}

class EvaluationAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/evaluation`;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // Rubric Sets (from rubrics module)
  async getRubricSets(filters?: {
    state?: "draft" | "published" | "archived";
    subject?: string;
  }): Promise<RubricSet[]> {
    const params = new URLSearchParams();
    if (filters?.state) params.set("state", filters.state);
    if (filters?.subject) params.set("subject", filters.subject);
    
    const query = params.toString() ? `?${params.toString()}` : "";
    // Call rubrics API, not evaluation API
    const url = `${API_BASE_URL}/rubrics/${query}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }
    return response.json();
  }

  async getRubricSet(id: string): Promise<RubricSet> {
    const url = `${API_BASE_URL}/rubrics/${id}/`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }
    return response.json();
  }

  // Answer Scripts
  async getScripts(filters?: {
    rubric_set?: string;  // Changed from question_paper
    status?: string;
  }): Promise<AnswerScript[]> {
    const params = new URLSearchParams();
    if (filters?.rubric_set) params.set("rubric_set", filters.rubric_set);  // Changed
    if (filters?.status) params.set("status", filters.status);
    
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.fetch<AnswerScript[]>(`/scripts/${query}`);
  }

  async getScript(id: string): Promise<AnswerScript> {
    return this.fetch<AnswerScript>(`/scripts/${id}/`);
  }

  async uploadScript(data: {
    rubric_set: string;  // Changed from question_paper
    student_name?: string;
    student_id?: string;
    pages: File[];
  }): Promise<AnswerScript> {
    const formData = new FormData();
    formData.append("rubric_set", data.rubric_set);  // Changed
    if (data.student_name) formData.append("student_name", data.student_name);
    if (data.student_id) formData.append("student_id", data.student_id);
    data.pages.forEach((page) => {
      formData.append("pages", page);
    });

    return this.fetch<AnswerScript>("/scripts/", {
      method: "POST",
      body: formData,
    });
  }

  async evaluateScript(scriptId: string): Promise<AnswerScript> {
    return this.fetch<AnswerScript>(`/scripts/${scriptId}/evaluate/`, {
      method: "POST",
    });
  }

  async getEvaluationReport(scriptId: string): Promise<EvaluationReport> {
    return this.fetch<EvaluationReport>(`/scripts/${scriptId}/report/`);
  }

  async deleteScript(id: string): Promise<void> {
    await this.fetch(`/scripts/${id}/`, { method: "DELETE" });
  }

  // Question Evaluations
  async overrideMarks(
    evaluationId: string,
    data: {
      method_marks_awarded?: number;
      calculation_marks_awarded?: number;
      answer_marks_awarded?: number;
      overall_feedback?: string;
    }
  ): Promise<QuestionEvaluation> {
    return this.fetch<QuestionEvaluation>(
      `/evaluations/${evaluationId}/override_marks/`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
  }
}

export const evaluationAPI = new EvaluationAPI();
export default evaluationAPI;

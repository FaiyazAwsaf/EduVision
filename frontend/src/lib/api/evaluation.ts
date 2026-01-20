// API client for the script evaluation backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface QuestionPaper {
  id: string;
  title: string;
  subject: string;
  class_level: string;
  total_marks: number;
  description?: string;
  questions?: Question[];
  question_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Question {
  id: string;
  question_number: string;
  question_text: string;
  question_type: string;
  max_marks: number;
  model_answer?: string;
  rubric?: Rubric;
}

export interface Rubric {
  id: string;
  method_marks: number;
  calculation_marks: number;
  answer_marks: number;
  total_marks: number;
  key_points: string[];
  common_mistakes: string[];
  grading_notes?: string;
}

export interface AnswerScript {
  id: string;
  student_name?: string;
  student_id?: string;
  question_paper: QuestionPaper;
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
  question_paper: {
    title: string;
    subject: string;
    class_level: string;
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
    question_type: string;
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

  // Question Papers
  async getQuestionPapers(): Promise<QuestionPaper[]> {
    return this.fetch<QuestionPaper[]>("/question-papers/");
  }

  async getQuestionPaper(id: string): Promise<QuestionPaper> {
    return this.fetch<QuestionPaper>(`/question-papers/${id}/`);
  }

  async createQuestionPaper(data: {
    title: string;
    subject: string;
    class_level: string;
    description?: string;
    questions?: Omit<Question, "id">[];
  }): Promise<QuestionPaper> {
    return this.fetch<QuestionPaper>("/question-papers/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async addQuestionToPaper(
    paperId: string,
    question: Omit<Question, "id">
  ): Promise<Question> {
    return this.fetch<Question>(`/question-papers/${paperId}/add-question/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(question),
    });
  }

  async uploadQuestionPaperPDF(data: {
    pdf: File;
    paper_type?: "question" | "rubric" | "combined";
    title?: string;
    subject?: string;
    class_level?: string;
  }): Promise<QuestionPaper> {
    const formData = new FormData();
    formData.append("pdf", data.pdf);
    if (data.paper_type) formData.append("paper_type", data.paper_type);
    if (data.title) formData.append("title", data.title);
    if (data.subject) formData.append("subject", data.subject);
    if (data.class_level) formData.append("class_level", data.class_level);

    return this.fetch<QuestionPaper>("/question-papers/upload_pdf/", {
      method: "POST",
      body: formData,
    });
  }

  async uploadRubricPDF(paperId: string, pdf: File): Promise<QuestionPaper> {
    const formData = new FormData();
    formData.append("pdf", pdf);

    return this.fetch<QuestionPaper>(
      `/question-papers/${paperId}/upload_rubric_pdf/`,
      {
        method: "POST",
        body: formData,
      }
    );
  }

  // Questions
  async updateQuestion(
    questionId: string,
    data: Partial<Question>
  ): Promise<Question> {
    return this.fetch<Question>(`/questions/${questionId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async updateRubric(questionId: string, rubric: Partial<Rubric>): Promise<Rubric> {
    return this.fetch<Rubric>(`/questions/${questionId}/rubric/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rubric),
    });
  }

  // Answer Scripts
  async getScripts(filters?: {
    question_paper?: string;
    status?: string;
  }): Promise<AnswerScript[]> {
    const params = new URLSearchParams();
    if (filters?.question_paper) params.set("question_paper", filters.question_paper);
    if (filters?.status) params.set("status", filters.status);
    
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.fetch<AnswerScript[]>(`/scripts/${query}`);
  }

  async getScript(id: string): Promise<AnswerScript> {
    return this.fetch<AnswerScript>(`/scripts/${id}/`);
  }

  async uploadScript(data: {
    question_paper: string;
    student_name?: string;
    student_id?: string;
    pages: File[];
  }): Promise<AnswerScript> {
    const formData = new FormData();
    formData.append("question_paper", data.question_paper);
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

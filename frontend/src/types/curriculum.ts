/* ─── Curriculum Types ─────────────────────────────────────────────────────── */

export type ParsingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type MaterialType = "FILE" | "LINK" | "GENERATED";

/* ─── Course Outline ──────────────────────────────────────────────────────── */

export interface CourseOutlineListItem {
  id: string;
  title: string;
  course_code: string;
  parsing_status: ParsingStatus;
  subject_name: string;
  section_name: string;
  teacher_name: string;
  created_at: string;
  /** Injected by my-courses endpoint */
  progress?: CourseProgressSummary;
}

export interface CourseOutlineDetail {
  id: string;
  title: string;
  course_code: string;
  course_objectives: string[];
  parsing_status: ParsingStatus;
  parsing_error: string;
  subject_name: string;
  section_name: string;
  teacher_name: string;
  weeks: CourseWeek[];
  created_at: string;
  updated_at: string;
  /** Included for students — progress summary */
  progress_summary?: CourseProgressSummary;
}

/* ─── Week & Topic ────────────────────────────────────────────────────────── */

export interface CourseWeek {
  id: string;
  week_number: number;
  is_exam_week: boolean;
  exam_label: string;
  topics: CourseTopic[];
}

export interface CourseTopic {
  id: string;
  title: string;
  description: string;
  order: number;
  course_outcomes: string[];
  parent_topic: string | null;
  subtopics: CourseTopic[];

  /** Included in teacher outline detail */
  materials?: TopicMaterial[];

  /** Student-only fields (with-progress serializer) */
  progress_status?: ProgressStatus;
  is_flagged_difficult?: boolean;
  materials_count?: number;
}

/* ─── Progress ────────────────────────────────────────────────────────────── */

export interface CourseProgressSummary {
  total_topics: number;
  completed: number;
  in_progress: number;
  not_started: number;
  percentage: number;
}

/* ─── Difficulty ──────────────────────────────────────────────────────────── */

export interface DifficultyFlagStudent {
  id: string;
  name: string;
  note: string;
  flagged_at: string;
}

export interface DifficultyReportItem {
  topic_id: string;
  topic_title: string;
  flag_count: number;
  total_students: number;
  percentage: number;
  above_threshold: boolean;
  students: DifficultyFlagStudent[];
}

/* ─── Materials ───────────────────────────────────────────────────────────── */

export interface TopicMaterial {
  id: string;
  title: string;
  description: string;
  material_type: MaterialType;
  file_url: string | null;
  external_link: string;
  content_request_id: string | null;
  uploaded_by_name: string;
  created_at: string;
}

/* ─── Notifications ───────────────────────────────────────────────────────── */

export interface TeacherNotification {
  id: string;
  notification_type: string;
  message: string;
  topic_title: string;
  course_title: string;
  flag_count: number;
  total_students: number;
  percentage: number;
  is_read: boolean;
  created_at: string;
}

/* ─── Topic Search (for content gen autocomplete) ─────────────────────────── */

export interface TopicSearchResult {
  id: string;
  title: string;
  course_title: string;
  course_id: string;
  parent_topic: string | null;
}

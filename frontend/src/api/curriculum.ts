/**
 * Curriculum API Client
 *
 * Handles all communication with curriculum endpoints for both
 * teacher (outline upload, difficulty, materials, notifications)
 * and student (courses, progress, flags, materials) flows.
 */

import { API_ENDPOINTS } from "@/config/api";
import { authenticatedFetch } from "@/api/auth";
import type {
  CourseOutlineListItem,
  CourseOutlineDetail,
  CourseProgressSummary,
  DifficultyReportItem,
  TopicMaterial,
  TeacherNotification,
  TopicSearchResult,
  ProgressStatus,
} from "@/types/curriculum";

// ─── Teacher: Outline Management ─────────────────────────────────────────────

export async function uploadCourseOutline(
  teachingAssignmentId: string,
  pdfFile: File,
): Promise<CourseOutlineListItem> {
  const form = new FormData();
  form.append("teaching_assignment_id", teachingAssignmentId);
  form.append("pdf", pdfFile);

  const res = await authenticatedFetch(API_ENDPOINTS.CURRICULUM_OUTLINES, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload outline");
  }
  return res.json();
}

export async function listMyOutlines(): Promise<CourseOutlineListItem[]> {
  const res = await authenticatedFetch(API_ENDPOINTS.CURRICULUM_OUTLINES_LIST);
  if (!res.ok) throw new Error("Failed to list outlines");
  return res.json();
}

export async function getOutlineDetail(
  id: string,
): Promise<CourseOutlineDetail> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_OUTLINE_DETAIL(id),
  );
  if (!res.ok) throw new Error("Failed to load outline");
  return res.json();
}

export async function reparseOutline(
  id: string,
): Promise<{ status: string; outline_id: string }> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_OUTLINE_REPARSE(id),
    { method: "POST" },
  );
  if (!res.ok) throw new Error("Failed to reparse outline");
  return res.json();
}

export async function deleteOutline(id: string): Promise<void> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_OUTLINE_DETAIL(id),
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete outline");
}

// ─── Teacher: Difficulty Report ──────────────────────────────────────────────

export async function getDifficultyReport(
  outlineId: string,
): Promise<DifficultyReportItem[]> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_DIFFICULTY_REPORT(outlineId),
  );
  if (!res.ok) throw new Error("Failed to load difficulty report");
  return res.json();
}

// ─── Teacher: Materials ──────────────────────────────────────────────────────

export async function uploadTopicMaterial(
  topicId: string,
  data: {
    title: string;
    material_type: "FILE" | "LINK";
    description?: string;
    file?: File;
    external_link?: string;
  },
): Promise<TopicMaterial> {
  const form = new FormData();
  form.append("title", data.title);
  form.append("material_type", data.material_type);
  if (data.description) form.append("description", data.description);
  if (data.file) form.append("file", data.file);
  if (data.external_link) form.append("external_link", data.external_link);

  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_TOPIC_MATERIALS_UPLOAD(topicId),
    { method: "POST", body: form },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload material");
  }
  return res.json();
}

export async function deleteTopicMaterial(materialId: string): Promise<void> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_MATERIAL_DELETE(materialId),
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete material");
}

// ─── Teacher: Notifications ──────────────────────────────────────────────────

export async function getNotifications(
  unreadOnly = false,
): Promise<TeacherNotification[]> {
  const url = unreadOnly
    ? `${API_ENDPOINTS.CURRICULUM_NOTIFICATIONS}?unread_only=true`
    : API_ENDPOINTS.CURRICULUM_NOTIFICATIONS;
  const res = await authenticatedFetch(url);
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

export async function markNotificationsRead(
  ids?: string[],
  markAll = false,
): Promise<{ marked_read: number }> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_NOTIFICATIONS_MARK_READ,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        markAll ? { mark_all: true } : { notification_ids: ids },
      ),
    },
  );
  if (!res.ok) throw new Error("Failed to mark notifications read");
  return res.json();
}

// ─── Student: Courses ────────────────────────────────────────────────────────

export async function getMyCourses(): Promise<CourseOutlineListItem[]> {
  const res = await authenticatedFetch(API_ENDPOINTS.CURRICULUM_MY_COURSES);
  if (!res.ok) throw new Error("Failed to load courses");
  return res.json();
}

export async function getCourseTopics(outlineId: string) {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_COURSE_TOPICS(outlineId),
  );
  if (!res.ok) throw new Error("Failed to load topics");
  return res.json();
}

export async function getCourseSummary(
  outlineId: string,
): Promise<CourseProgressSummary> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_COURSE_SUMMARY(outlineId),
  );
  if (!res.ok) throw new Error("Failed to load summary");
  return res.json();
}

// ─── Student: Progress ───────────────────────────────────────────────────────

export async function updateTopicProgress(
  topicId: string,
  progressStatus: ProgressStatus,
) {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_TOPIC_PROGRESS(topicId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: progressStatus }),
    },
  );
  if (!res.ok) throw new Error("Failed to update progress");
  return res.json();
}

// ─── Student: Difficulty Flags ───────────────────────────────────────────────

export async function flagTopicDifficult(topicId: string, note = "") {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_TOPIC_FLAG(topicId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    },
  );
  if (!res.ok) throw new Error("Failed to flag topic");
  return res.json();
}

export async function unflagTopicDifficult(topicId: string): Promise<void> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_TOPIC_FLAG(topicId),
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to unflag topic");
}

// ─── Student: Materials ──────────────────────────────────────────────────────

export async function getTopicMaterials(
  topicId: string,
): Promise<TopicMaterial[]> {
  const res = await authenticatedFetch(
    API_ENDPOINTS.CURRICULUM_TOPIC_MATERIALS_LIST(topicId),
  );
  if (!res.ok) throw new Error("Failed to load materials");
  return res.json();
}

// ─── Shared: Topic Search ────────────────────────────────────────────────────

export async function searchCurriculumTopics(
  query: string,
): Promise<TopicSearchResult[]> {
  const res = await authenticatedFetch(
    `${API_ENDPOINTS.CURRICULUM_TOPIC_SEARCH}?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) return [];
  return res.json();
}

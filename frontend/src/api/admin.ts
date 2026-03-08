/**
 * Admin API Client
 *
 * Handles all admin panel API calls: user management, stats,
 * classes, sections, subjects, and teacher assignments.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";
import { authenticatedFetch } from "@/api/auth";
import type { User } from "@/api/auth";
import type {
  SchoolClass,
  SchoolSection,
  TeacherProfile,
  StudentProfile,
  TeachingAssignment,
} from "@/api/school";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminStats {
  total_users: number;
  total_teachers: number;
  total_students: number;
  active_users: number;
  inactive_users: number;
  total_classes: number;
  total_sections: number;
  total_subjects: number;
  total_assignments: number;
  teachers_with_profile: number;
  teachers_without_profile: number;
  students_with_profile: number;
  students_without_profile: number;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: "teacher" | "student";
}

export interface UpdateUserPayload {
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  role?: "teacher" | "student";
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface TeacherSubjectAssignment {
  id: string;
  teacher: string;
  subject: string;
  section: number;
  subject_detail: Subject;
  section_detail: {
    id: number;
    name: string;
    class_name: string;
    stream: string;
    academic_year: string;
    capacity: number;
  };
  teacher_name: string;
  created_at: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function adminFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await authenticatedFetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await parseApiError(
      response,
      `API Error: ${response.status}`,
    );
    throw new Error(message);
  }

  return response.json();
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const data = await adminFetch<{ payload: AdminStats }>("/auth/admin/stats/");
  return data.payload;
}

// ─── User Management ─────────────────────────────────────────────────────────

export async function getUsers(params?: {
  role?: string;
  search?: string;
  is_active?: string;
}): Promise<User[]> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.set("role", params.role);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.is_active) searchParams.set("is_active", params.is_active);
  const query = searchParams.toString();
  const url = `/auth/admin/users/${query ? `?${query}` : ""}`;
  const data = await adminFetch<{ payload: User[] }>(url);
  return data.payload;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const data = await adminFetch<{ payload: User }>(
    "/auth/admin/users/create/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return data.payload;
}

export async function getUser(userId: string): Promise<User> {
  const data = await adminFetch<{ payload: User }>(
    `/auth/admin/users/${userId}/`,
  );
  return data.payload;
}

export async function updateUser(
  userId: string,
  payload: UpdateUserPayload,
): Promise<User> {
  const data = await adminFetch<{ payload: User }>(
    `/auth/admin/users/${userId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return data.payload;
}

export async function deleteUser(userId: string): Promise<void> {
  await adminFetch(`/auth/admin/users/${userId}/`, { method: "DELETE" });
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  await adminFetch(`/auth/admin/users/${userId}/reset-password/`, {
    method: "POST",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export async function getClasses(): Promise<SchoolClass[]> {
  const data = await adminFetch<SchoolClass[] | { results: SchoolClass[] }>(
    "/school/classes/",
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createClass(payload: {
  name: string;
  stream?: string;
  academic_year: string;
}): Promise<SchoolClass> {
  return adminFetch<SchoolClass>("/school/classes/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClass(
  id: number,
  payload: { name?: string; stream?: string; academic_year?: string },
): Promise<SchoolClass> {
  return adminFetch<SchoolClass>(`/school/classes/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteClass(id: number): Promise<void> {
  await adminFetch(`/school/classes/${id}/`, { method: "DELETE" });
}

// ─── Sections ────────────────────────────────────────────────────────────────

export async function getSections(classId?: number): Promise<SchoolSection[]> {
  const params = classId ? `?class_id=${classId}` : "";
  const data = await adminFetch<SchoolSection[] | { results: SchoolSection[] }>(
    `/school/sections/${params}`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createSection(payload: {
  class_ref: number;
  name: string;
  capacity?: number;
}): Promise<SchoolSection> {
  return adminFetch<SchoolSection>("/school/sections/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSection(
  id: number,
  payload: { name?: string; capacity?: number },
): Promise<SchoolSection> {
  return adminFetch<SchoolSection>(`/school/sections/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSection(id: number): Promise<void> {
  await adminFetch(`/school/sections/${id}/`, { method: "DELETE" });
}

// ─── Teacher Profiles ────────────────────────────────────────────────────────

export async function getTeachers(): Promise<TeacherProfile[]> {
  const data = await adminFetch<
    TeacherProfile[] | { results: TeacherProfile[] }
  >("/school/teachers/");
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createTeacherProfile(payload: {
  user_id: string;
  employee_id: string;
  department?: string;
  qualification?: string;
  date_of_birth?: string;
  phone?: string;
  address?: string;
  class_teacher_of?: number | null;
}): Promise<TeacherProfile> {
  return adminFetch<TeacherProfile>("/school/teachers/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTeacherProfile(
  userId: string,
  payload: Record<string, unknown>,
): Promise<TeacherProfile> {
  return adminFetch<TeacherProfile>(`/school/teachers/${userId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ─── Student Profiles ────────────────────────────────────────────────────────

export async function getStudents(params?: {
  section?: number;
  class_id?: number;
}): Promise<StudentProfile[]> {
  const searchParams = new URLSearchParams();
  if (params?.section) searchParams.set("section", String(params.section));
  if (params?.class_id) searchParams.set("class_id", String(params.class_id));
  const query = searchParams.toString();
  const data = await adminFetch<
    StudentProfile[] | { results: StudentProfile[] }
  >(`/school/students/${query ? `?${query}` : ""}`);
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createStudentProfile(payload: {
  user_id: string;
  roll_number: string;
  section?: number | null;
  blood_group?: string;
  date_of_birth?: string;
  address?: string;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
}): Promise<StudentProfile> {
  return adminFetch<StudentProfile>("/school/students/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStudentProfile(
  userId: string,
  payload: Record<string, unknown>,
): Promise<StudentProfile> {
  return adminFetch<StudentProfile>(`/school/students/${userId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ─── Subjects ────────────────────────────────────────────────────────────────

export async function getSubjects(): Promise<Subject[]> {
  return adminFetch<Subject[]>("/school/subjects/");
}

export async function createSubject(payload: {
  name: string;
  code: string;
}): Promise<Subject> {
  return adminFetch<Subject>("/school/subjects/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSubject(
  id: string,
  payload: { name?: string; code?: string },
): Promise<Subject> {
  return adminFetch<Subject>(`/school/subjects/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSubject(id: string): Promise<void> {
  await adminFetch(`/school/subjects/${id}/`, { method: "DELETE" });
}

// ─── Teacher Subject Assignments ─────────────────────────────────────────────

export async function getAssignments(params?: {
  teacher?: string;
  subject?: string;
  section?: number;
}): Promise<TeacherSubjectAssignment[]> {
  const searchParams = new URLSearchParams();
  if (params?.teacher) searchParams.set("teacher", params.teacher);
  if (params?.subject) searchParams.set("subject", params.subject);
  if (params?.section) searchParams.set("section", String(params.section));
  const query = searchParams.toString();
  const data = await adminFetch<
    TeacherSubjectAssignment[] | { results: TeacherSubjectAssignment[] }
  >(`/school/assignments/${query ? `?${query}` : ""}`);
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function createAssignment(payload: {
  teacher: string;
  subject: string;
  section: number;
}): Promise<TeacherSubjectAssignment> {
  return adminFetch<TeacherSubjectAssignment>("/school/assignments/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteAssignment(id: string): Promise<void> {
  await adminFetch(`/school/assignments/${id}/`, { method: "DELETE" });
}

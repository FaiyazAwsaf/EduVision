/**
 * School API Client
 *
 * Handles fetching school-related data: student profiles, teacher profiles,
 * classes, and sections.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";
import { authenticatedFetch } from "@/api/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionDetail {
  id: number;
  name: string;
  class_name: string;
  stream: string;
  academic_year: string;
  capacity: number;
}

export interface StudentProfile {
  user_id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  section: number | null;
  section_detail: SectionDetail | null;
  blood_group: string;
  date_of_birth: string | null;
  address: string;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  guardian_name: string;
  guardian_phone: string;
  created_at: string;
  updated_at: string;
}

export interface SchoolSection {
  id: number;
  class_ref: number;
  name: string;
  capacity: number;
  created_at: string;
  updated_at: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  stream: string;
  academic_year: string;
  sections: SchoolSection[];
  created_at: string;
  updated_at: string;
}

export interface TeacherProfile {
  user_id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  department: string;
  qualification: string;
  date_of_birth: string | null;
  phone: string;
  address: string;
  class_teacher_of: number | null;
  class_teacher_of_detail: SectionDetail | null;
  created_at: string;
  updated_at: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const SCHOOL_URL = `${API_BASE_URL}/school`;

async function schoolFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${SCHOOL_URL}${endpoint}`;
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

// ─── Student Profile ─────────────────────────────────────────────────────────

export async function getStudentProfile(
  userId: string,
): Promise<StudentProfile> {
  return schoolFetch<StudentProfile>(`/students/${userId}/`);
}

// ─── Teacher Profile ─────────────────────────────────────────────────────────

export async function getTeacherProfile(
  userId: string,
): Promise<TeacherProfile> {
  return schoolFetch<TeacherProfile>(`/teachers/${userId}/`);
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export async function getClasses(
  academicYear?: string,
): Promise<SchoolClass[]> {
  const params = academicYear
    ? `?academic_year=${encodeURIComponent(academicYear)}`
    : "";
  const data = await schoolFetch<SchoolClass[] | { results: SchoolClass[] }>(
    `/classes/${params}`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

// ─── Sections ────────────────────────────────────────────────────────────────

export async function getSections(classId?: number): Promise<SchoolSection[]> {
  const params = classId ? `?class_id=${classId}` : "";
  const data = await schoolFetch<
    SchoolSection[] | { results: SchoolSection[] }
  >(`/sections/${params}`);
  return Array.isArray(data) ? data : (data.results ?? []);
}

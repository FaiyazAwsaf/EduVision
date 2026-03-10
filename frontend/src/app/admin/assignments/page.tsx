"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  getAssignments,
  createAssignment,
  deleteAssignment,
  getSubjects,
  getSections,
  getClasses,
  type TeacherSubjectAssignment,
  type Subject,
} from "@/api/admin";
import { getUsers } from "@/api/admin";
import type { User } from "@/api/auth";
import type { SchoolClass, SchoolSection } from "@/api/school";
import { Plus, Trash2, X, ClipboardCheck, GraduationCap, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

function Pagination({
  total,
  page,
  onChange,
}: {
  total: number;
  page: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;

  const getPages = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1, 2, 3, 4];
    if (page > 5) pages.push("...");
    if (page > 4 && page < totalPages - 3) pages.push(page - 1, page, page + 1);
    if (page <= 5) {
      pages.splice(0, pages.length, 1, 2, 3, 4, 5);
    }
    if (page >= totalPages - 4) {
      pages.splice(0, pages.length, 1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push("...");
      pages.push(totalPages - 2, totalPages - 1, totalPages);
    }
    return [...new Set(pages)];
  };

  return (
    <div className="flex items-center gap-1 justify-end px-5 py-4">
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="w-8 text-center text-muted text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
              p === page
                ? "bg-primary-dark text-white"
                : "text-muted hover:bg-background"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(page + 1, totalPages))}
        disabled={page === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-background disabled:opacity-30 transition"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary/30">
          <h2 className="text-lg font-semibold text-primary-dark">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background text-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] =
    useState<TeacherSubjectAssignment | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAssignments();
      setAssignments(data);
      setPage(1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Teacher Assignments
          </h1>
          <p className="text-muted text-sm mt-1">
            {assignments.length} assignment
            {assignments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Assignment
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-16 text-muted bg-white rounded-2xl border border-secondary/30">
          No assignments created yet
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-secondary/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background/60 text-left">
                <th className="px-5 py-3 font-medium text-muted">Teacher</th>
                <th className="px-5 py-3 font-medium text-muted">Subject</th>
                <th className="px-5 py-3 font-medium text-muted">Section</th>
                <th className="px-5 py-3 font-medium text-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/20">
              {assignments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-primary/2 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-primary-dark">
                        {a.teacher_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="text-primary-dark">
                        {a.subject_detail.name}
                      </p>
                      <p className="text-xs text-muted">
                        {a.subject_detail.code}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="text-primary-dark">
                        Class {a.section_detail.class_name}-
                        {a.section_detail.name}
                      </p>
                      <p className="text-xs text-muted">
                        {a.section_detail.stream &&
                          `${a.section_detail.stream} · `}
                        {a.section_detail.academic_year}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setDeleteConfirm(a)}
                      className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination total={assignments.length} page={page} onChange={setPage} />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Assignment"
      >
        <AssignmentForm
          onSave={async (data) => {
            await createAssignment(data);
            fetchAssignments();
            setCreateOpen(false);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Assignment"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Remove{" "}
              <span className="font-medium text-primary-dark">
                {deleteConfirm.teacher_name}
              </span>{" "}
              from teaching{" "}
              <span className="font-medium text-primary-dark">
                {deleteConfirm.subject_detail.name}
              </span>{" "}
              to{" "}
              <span className="font-medium text-primary-dark">
                Class {deleteConfirm.section_detail.class_name}-
                {deleteConfirm.section_detail.name}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:bg-background transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteAssignment(deleteConfirm.id);
                  setDeleteConfirm(null);
                  fetchAssignments();
                }}
                className="px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AssignmentForm({
  onSave,
  onCancel,
}: {
  onSave: (data: {
    teacher: string;
    subject: string;
    section: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [form, setForm] = useState({
    teacher: "",
    subject: "",
    section: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getUsers({ role: "teacher" }),
      getSubjects(),
      getClasses(),
    ]).then(([t, s, c]) => {
      setTeachers(t);
      setSubjects(s);
      setClasses(c);
    });
  }, []);

  // Flatten sections from classes
  const allSections = classes.flatMap((cls) =>
    cls.sections.map((sec) => ({
      ...sec,
      className: cls.name,
      stream: cls.stream,
      academicYear: cls.academic_year,
    })),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSave({
        teacher: form.teacher,
        subject: form.subject,
        section: Number(form.section),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Teacher
        </label>
        <select
          value={form.teacher}
          onChange={(e) => setForm({ ...form, teacher: e.target.value })}
          required
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        >
          <option value="">Select Teacher</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.first_name} {t.last_name} ({t.username})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Subject
        </label>
        <select
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          required
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        >
          <option value="">Select Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Section
        </label>
        <select
          value={form.section}
          onChange={(e) => setForm({ ...form, section: e.target.value })}
          required
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        >
          <option value="">Select Section</option>
          {allSections.map((s) => (
            <option key={s.id} value={s.id}>
              Class {s.className}-{s.name}
              {s.stream ? ` (${s.stream})` : ""} [{s.academicYear}]
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:bg-background transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Assignment"}
        </button>
      </div>
    </form>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  type Subject,
} from "@/api/admin";
import { Plus, Edit2, Trash2, X, BookOpen } from "lucide-react";

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
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

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Subject | null>(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Subjects</h1>
          <p className="text-muted text-sm mt-1">
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Subject
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-16 text-muted bg-white rounded-2xl border border-secondary/30">
          No subjects created yet
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-2xl border border-secondary/30 p-5 flex items-center justify-between transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-dark">
                    {sub.name}
                  </h3>
                  <p className="text-xs text-muted">Code: {sub.code}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditSubject(sub)}
                  className="p-2 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-600 transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(sub)}
                  className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Subject"
      >
        <SubjectForm
          onSave={async (data) => {
            await createSubject(data);
            fetchSubjects();
            setCreateOpen(false);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editSubject}
        onClose={() => setEditSubject(null)}
        title="Edit Subject"
      >
        {editSubject && (
          <SubjectForm
            initial={editSubject}
            onSave={async (data) => {
              await updateSubject(editSubject.id, data);
              fetchSubjects();
              setEditSubject(null);
            }}
            onCancel={() => setEditSubject(null)}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Subject"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Delete subject{" "}
              <span className="font-medium text-primary-dark">
                {deleteConfirm.name}
              </span>
              ? This will also remove all related assignments.
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
                  await deleteSubject(deleteConfirm.id);
                  setDeleteConfirm(null);
                  fetchSubjects();
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

function SubjectForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Subject;
  onSave: (data: { name: string; code: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    code: initial?.code || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSave(form);
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
          Subject Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="e.g. Mathematics"
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Subject Code
        </label>
        <input
          type="text"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          required
          placeholder="e.g. MATH"
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
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
          {loading ? "Saving..." : initial ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  createSection,
  updateSection,
  deleteSection,
} from "@/api/admin";
import type { SchoolClass, SchoolSection } from "@/api/school";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  School,
} from "lucide-react";

// ─── Modal ───────────────────────────────────────────────────────────────────

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<number | null>(null);

  // Modals
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [editClassData, setEditClassData] = useState<SchoolClass | null>(null);
  const [deleteClassConfirm, setDeleteClassConfirm] =
    useState<SchoolClass | null>(null);
  const [addSectionFor, setAddSectionFor] = useState<SchoolClass | null>(null);
  const [editSectionData, setEditSectionData] = useState<{
    section: SchoolSection;
    classId: number;
  } | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClasses();
      setClasses(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Classes & Sections
          </h1>
          <p className="text-muted text-sm mt-1">
            {classes.length} class{classes.length !== 1 ? "es" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateClassOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Class
        </button>
      </div>

      {/* Class cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 text-muted bg-white rounded-2xl border border-secondary/30">
          No classes created yet
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => {
            const isExpanded = expandedClass === cls.id;
            return (
              <div
                key={cls.id}
                className="bg-white rounded-2xl border border-secondary/30 overflow-hidden"
              >
                {/* Class header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-primary/[0.02] transition"
                  onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <School className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary-dark">
                        Class {cls.name}
                        {cls.stream && (
                          <span className="text-muted font-normal">
                            {" "}
                            — {cls.stream}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-muted">
                        {cls.academic_year} · {cls.sections.length} section
                        {cls.sections.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditClassData(cls);
                      }}
                      className="p-2 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-600 transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteClassConfirm(cls);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted" />
                    )}
                  </div>
                </div>

                {/* Sections */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-secondary/20">
                    <div className="mt-3 space-y-2">
                      {cls.sections.length === 0 ? (
                        <p className="text-sm text-muted py-2">
                          No sections yet
                        </p>
                      ) : (
                        cls.sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="flex items-center justify-between bg-background/60 rounded-xl px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <Layers className="w-4 h-4 text-purple-500" />
                              <div>
                                <p className="text-sm font-medium text-primary-dark">
                                  Section {sec.name}
                                </p>
                                <p className="text-xs text-muted">
                                  Capacity: {sec.capacity}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() =>
                                  setEditSectionData({
                                    section: sec,
                                    classId: cls.id,
                                  })
                                }
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-600 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete Section ${sec.name}?`)) {
                                    await deleteSection(sec.id);
                                    fetchClasses();
                                  }
                                }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                      <button
                        onClick={() => setAddSectionFor(cls)}
                        className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary-dark transition pt-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Section
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Class Modal */}
      <Modal
        open={createClassOpen}
        onClose={() => setCreateClassOpen(false)}
        title="Create Class"
      >
        <ClassForm
          onSave={async (data) => {
            await createClass(data);
            fetchClasses();
            setCreateClassOpen(false);
          }}
          onCancel={() => setCreateClassOpen(false)}
        />
      </Modal>

      {/* Edit Class Modal */}
      <Modal
        open={!!editClassData}
        onClose={() => setEditClassData(null)}
        title="Edit Class"
      >
        {editClassData && (
          <ClassForm
            initial={editClassData}
            onSave={async (data) => {
              await updateClass(editClassData.id, data);
              fetchClasses();
              setEditClassData(null);
            }}
            onCancel={() => setEditClassData(null)}
          />
        )}
      </Modal>

      {/* Delete Class Confirm */}
      <Modal
        open={!!deleteClassConfirm}
        onClose={() => setDeleteClassConfirm(null)}
        title="Delete Class"
      >
        {deleteClassConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Delete{" "}
              <span className="font-medium text-primary-dark">
                Class {deleteClassConfirm.name}
              </span>
              ? This will also delete all its sections.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteClassConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:bg-background transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteClass(deleteClassConfirm.id);
                  setDeleteClassConfirm(null);
                  fetchClasses();
                }}
                className="px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Section Modal */}
      <Modal
        open={!!addSectionFor}
        onClose={() => setAddSectionFor(null)}
        title={`Add Section to Class ${addSectionFor?.name || ""}`}
      >
        {addSectionFor && (
          <SectionForm
            classId={addSectionFor.id}
            onSave={async (data) => {
              await createSection(data);
              fetchClasses();
              setAddSectionFor(null);
            }}
            onCancel={() => setAddSectionFor(null)}
          />
        )}
      </Modal>

      {/* Edit Section Modal */}
      <Modal
        open={!!editSectionData}
        onClose={() => setEditSectionData(null)}
        title="Edit Section"
      >
        {editSectionData && (
          <SectionForm
            classId={editSectionData.classId}
            initial={editSectionData.section}
            onSave={async (data) => {
              await updateSection(editSectionData.section.id, {
                name: data.name,
                capacity: data.capacity,
              });
              fetchClasses();
              setEditSectionData(null);
            }}
            onCancel={() => setEditSectionData(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Class Form ──────────────────────────────────────────────────────────────

function ClassForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SchoolClass;
  onSave: (data: {
    name: string;
    stream: string;
    academic_year: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    stream: initial?.stream || "",
    academic_year: initial?.academic_year || "2025-2026",
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
          Class Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="e.g. 10, 12"
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Stream
        </label>
        <input
          type="text"
          value={form.stream}
          onChange={(e) => setForm({ ...form, stream: e.target.value })}
          placeholder="e.g. Science, Commerce (optional)"
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Academic Year
        </label>
        <input
          type="text"
          value={form.academic_year}
          onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
          required
          placeholder="e.g. 2025-2026"
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

// ─── Section Form ────────────────────────────────────────────────────────────

function SectionForm({
  classId,
  initial,
  onSave,
  onCancel,
}: {
  classId: number;
  initial?: SchoolSection;
  onSave: (data: {
    class_ref: number;
    name: string;
    capacity: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    capacity: initial?.capacity || 40,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSave({ class_ref: classId, ...form });
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
          Section Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder="e.g. A, B, C"
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Capacity
        </label>
        <input
          type="number"
          value={form.capacity}
          onChange={(e) =>
            setForm({ ...form, capacity: Number(e.target.value) })
          }
          min={1}
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

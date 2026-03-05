"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  getSections,
  getClasses,
  createSection,
  updateSection,
  deleteSection,
} from "@/api/admin";
import type { SchoolClass, SchoolSection } from "@/api/school";
import { Plus, Edit2, Trash2, X, Layers } from "lucide-react";

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

export default function SectionsPage() {
  const [sections, setSections] = useState<SchoolSection[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editData, setEditData] = useState<SchoolSection | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [secData, clsData] = await Promise.all([
        getSections(filterClass ? Number(filterClass) : undefined),
        getClasses(),
      ]);
      setSections(secData);
      setClasses(clsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterClass]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a map of class_ref -> class for display
  const classMap = new Map(classes.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Sections</h1>
          <p className="text-muted text-sm mt-1">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Section
        </button>
      </div>

      {/* Filter */}
      <div>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-secondary/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              Class {c.name} {c.stream && `- ${c.stream}`} ({c.academic_year})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-16 text-muted bg-white rounded-2xl border border-secondary/30">
          No sections found
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-secondary/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background/60 text-left">
                <th className="px-5 py-3 font-medium text-muted">Section</th>
                <th className="px-5 py-3 font-medium text-muted">Class</th>
                <th className="px-5 py-3 font-medium text-muted">Capacity</th>
                <th className="px-5 py-3 font-medium text-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/20">
              {sections.map((sec) => {
                const cls = classMap.get(sec.class_ref);
                return (
                  <tr
                    key={sec.id}
                    className="hover:bg-primary/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="font-medium text-primary-dark">
                          Section {sec.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {cls
                        ? `Class ${cls.name}${cls.stream ? ` - ${cls.stream}` : ""} (${cls.academic_year})`
                        : `Class ID ${sec.class_ref}`}
                    </td>
                    <td className="px-5 py-3.5 text-muted">{sec.capacity}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditData(sec)}
                          className="p-2 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-600 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete Section ${sec.name}?`)) {
                              await deleteSection(sec.id);
                              fetchData();
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Section"
      >
        <SectionForm
          classes={classes}
          onSave={async (data) => {
            await createSection(data);
            fetchData();
            setCreateOpen(false);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editData}
        onClose={() => setEditData(null)}
        title="Edit Section"
      >
        {editData && (
          <SectionForm
            classes={classes}
            initial={editData}
            onSave={async (data) => {
              await updateSection(editData.id, {
                name: data.name,
                capacity: data.capacity,
              });
              fetchData();
              setEditData(null);
            }}
            onCancel={() => setEditData(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function SectionForm({
  classes,
  initial,
  onSave,
  onCancel,
}: {
  classes: SchoolClass[];
  initial?: SchoolSection;
  onSave: (data: {
    class_ref: number;
    name: string;
    capacity: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    class_ref: initial?.class_ref?.toString() || "",
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
      await onSave({
        class_ref: Number(form.class_ref),
        name: form.name,
        capacity: form.capacity,
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
      {!initial && (
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-1">
            Class
          </label>
          <select
            value={form.class_ref}
            onChange={(e) => setForm({ ...form, class_ref: e.target.value })}
            required
            className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          >
            <option value="">Select Class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.name} {c.stream && `- ${c.stream}`} ({c.academic_year})
              </option>
            ))}
          </select>
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

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  createTeacherProfile,
  createStudentProfile,
  getClasses,
  type CreateUserPayload,
} from "@/api/admin";
import type { User } from "@/api/auth";
import type { SchoolClass } from "@/api/school";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  X,
  UserCheck,
  UserX,
  GraduationCap,
  Users as UsersIcon,
  ChevronDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ open, onClose, children, title }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
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

// ─── Create User Form ────────────────────────────────────────────────────────

function CreateUserForm({
  onCreated,
  onClose,
}: {
  onCreated: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateUserPayload>({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "pass1234",
    role: "student",
  });
  const [createProfile, setCreateProfile] = useState(true);
  const [profileForm, setProfileForm] = useState({
    employee_id: "",
    department: "",
    qualification: "",
    roll_number: "",
    section: "",
  });
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await createUser(form);

      if (createProfile) {
        try {
          if (form.role === "teacher") {
            await createTeacherProfile({
              user_id: user.id,
              employee_id: profileForm.employee_id || `EMP-${Date.now()}`,
              department: profileForm.department,
              qualification: profileForm.qualification,
            });
          } else {
            await createStudentProfile({
              user_id: user.id,
              roll_number: profileForm.roll_number || `ROLL-${Date.now()}`,
              section: profileForm.section
                ? Number(profileForm.section)
                : undefined,
            });
          }
        } catch (profileErr: unknown) {
          // User created but profile failed — still refresh
          const msg =
            profileErr instanceof Error ? profileErr.message : "Unknown error";
          setError(`User created but profile failed: ${msg}`);
          onCreated();
          return;
        }
      }

      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create user");
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-1">
            First Name
          </label>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
            className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-1">
            Last Name
          </label>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
            className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Username
        </label>
        <input
          type="text"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Password
        </label>
        <input
          type="text"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Role
        </label>
        <select
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value as "teacher" | "student" })
          }
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
      </div>

      {/* Profile creation toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={createProfile}
          onChange={(e) => setCreateProfile(e.target.checked)}
          id="createProfile"
          className="accent-primary"
        />
        <label htmlFor="createProfile" className="text-sm text-primary-dark">
          Also create {form.role} profile
        </label>
      </div>

      {createProfile && form.role === "teacher" && (
        <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
          <p className="text-sm font-medium text-blue-700">Teacher Profile</p>
          <div>
            <label className="block text-xs text-muted mb-1">Employee ID</label>
            <input
              type="text"
              value={profileForm.employee_id}
              onChange={(e) =>
                setProfileForm({ ...profileForm, employee_id: e.target.value })
              }
              placeholder="Auto-generated if empty"
              className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">
                Department
              </label>
              <input
                type="text"
                value={profileForm.department}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, department: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Qualification
              </label>
              <input
                type="text"
                value={profileForm.qualification}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    qualification: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {createProfile && form.role === "student" && (
        <div className="space-y-3 p-4 bg-teal-50/50 rounded-xl border border-teal-100">
          <p className="text-sm font-medium text-teal-700">Student Profile</p>
          <div>
            <label className="block text-xs text-muted mb-1">Roll Number</label>
            <input
              type="text"
              value={profileForm.roll_number}
              onChange={(e) =>
                setProfileForm({ ...profileForm, roll_number: e.target.value })
              }
              placeholder="Auto-generated if empty"
              className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setProfileForm({ ...profileForm, section: "" });
              }}
              className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.stream ? ` — ${c.stream}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Section</label>
            <select
              value={profileForm.section}
              onChange={(e) =>
                setProfileForm({ ...profileForm, section: e.target.value })
              }
              disabled={!selectedClassId}
              className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">No Section</option>
              {selectedClassId &&
                (classes.find((c) => c.id === Number(selectedClassId))?.sections ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:bg-background transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create User"}
        </button>
      </div>
    </form>
  );
}

// ─── Edit User Form ──────────────────────────────────────────────────────────

function EditUserForm({
  user,
  onUpdated,
  onClose,
}: {
  user: User;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    is_active: user.is_active,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await updateUser(user.id, form);
      onUpdated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update user");
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-1">
            First Name
          </label>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-1">
            Last Name
          </label>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          id="isActive"
          className="accent-primary"
        />
        <label htmlFor="isActive" className="text-sm text-primary-dark">
          Active
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:bg-background transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Reset Password Form ────────────────────────────────────────────────────

function ResetPasswordForm({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("pass1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await resetUserPassword(user.id, password);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reset password");
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
      {success && (
        <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg border border-green-200">
          Password reset successfully!
        </div>
      )}

      <p className="text-sm text-muted">
        Reset password for{" "}
        <span className="font-medium text-primary-dark">
          {user.first_name} {user.last_name}
        </span>{" "}
        ({user.username})
      </p>

      <div>
        <label className="block text-sm font-medium text-primary-dark mb-1">
          New Password
        </label>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full px-3 py-2 rounded-lg border border-secondary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:bg-background transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || success}
          className="px-5 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const searchParams = useSearchParams();
  const roleFilter = searchParams.get("role") || "";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState(roleFilter);
  const [filterActive, setFilterActive] = useState("");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [actionError, setActionError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers({
        role: filterRole || undefined,
        search: search || undefined,
        is_active: filterActive || undefined,
      });
      setUsers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterRole, search, filterActive]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Update filter when URL changes
  useEffect(() => {
    setFilterRole(roleFilter);
  }, [roleFilter]);

  const handleDeactivate = async (user: User) => {
    try {
      await updateUser(user.id, { is_active: false });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to deactivate user");
    }
  };

  const handleDelete = async (user: User) => {
    try {
      await deleteUser(user.id);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to delete user");
    }
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      teacher: "bg-blue-50 text-blue-700 border-blue-200",
      student: "bg-teal-50 text-teal-700 border-teal-200",
      admin: "bg-purple-50 text-purple-700 border-purple-200",
    };
    return (
      <span
        className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${styles[role] || "bg-gray-50 text-gray-700 border-gray-200"}`}
      >
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            User Management
          </h1>
          <p className="text-muted text-sm mt-1">
            {users.length} user{users.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-secondary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-secondary/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Roles</option>
          <option value="teacher">Teachers</option>
          <option value="student">Students</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-secondary/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-secondary/30 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background/60 text-left">
                <th className="px-5 py-3 font-medium text-muted">Name</th>
                <th className="px-5 py-3 font-medium text-muted">Username</th>
                <th className="px-5 py-3 font-medium text-muted">Email</th>
                <th className="px-5 py-3 font-medium text-muted">Role</th>
                {filterRole === "teacher" && (
                  <th className="px-5 py-3 font-medium text-muted">Department</th>
                )}
                {filterRole === "student" && (
                  <>
                    <th className="px-5 py-3 font-medium text-muted">Class</th>
                    <th className="px-5 py-3 font-medium text-muted">Section</th>
                  </>
                )}
                <th className="px-5 py-3 font-medium text-muted">Status</th>
                <th className="px-5 py-3 font-medium text-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/20">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-primary/2 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-dark flex items-center justify-center text-white text-xs font-semibold">
                        {u.first_name[0] || ""}
                        {u.last_name[0] || ""}
                      </div>
                      <span className="font-medium text-primary-dark">
                        {u.first_name} {u.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{u.username}</td>
                  <td className="px-5 py-3.5 text-muted">{u.email}</td>
                  <td className="px-5 py-3.5">{roleBadge(u.role)}</td>
                  {filterRole === "teacher" && (
                    <td className="px-5 py-3.5 text-muted">
                      {u.department || <span className="text-secondary/40 italic text-xs">—</span>}
                    </td>
                  )}
                  {filterRole === "student" && (
                    <>
                      <td className="px-5 py-3.5 text-muted">
                        {u.student_class || <span className="text-secondary/40 italic text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-muted">
                        {u.student_section || <span className="text-secondary/40 italic text-xs">—</span>}
                      </td>
                    </>
                  )}
                  <td className="px-5 py-3.5">
                    {u.is_active ? (
                      <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                        <UserCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                        <UserX className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditUser(u)}
                        title="Edit"
                        className="p-2 rounded-lg hover:bg-blue-50 text-muted hover:text-blue-600 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setResetUser(u)}
                        title="Reset Password"
                        className="p-2 rounded-lg hover:bg-amber-50 text-muted hover:text-amber-600 transition"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(u)}
                        title="Deactivate"
                        className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New User"
      >
        <CreateUserForm
          onCreated={fetchUsers}
          onClose={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Edit User"
      >
        {editUser && (
          <EditUserForm
            user={editUser}
            onUpdated={fetchUsers}
            onClose={() => setEditUser(null)}
          />
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        title="Reset Password"
      >
        {resetUser && (
          <ResetPasswordForm
            user={resetUser}
            onClose={() => setResetUser(null)}
          />
        )}
      </Modal>

      {/* Deactivate / Delete Confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => { setDeleteConfirm(null); setActionError(""); }}
        title="Manage User"
      >
        {deleteConfirm && (
          <div className="space-y-5">
            <p className="text-sm text-muted">
              What would you like to do with{" "}
              <span className="font-medium text-primary-dark">
                {deleteConfirm.first_name} {deleteConfirm.last_name}
              </span>
              ?
            </p>

            {actionError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                {actionError}
              </div>
            )}

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/50">
                <p className="text-sm font-medium text-orange-700 mb-0.5">Deactivate</p>
                <p className="text-xs text-orange-600/80">
                  The account is kept but the user can no longer log in. This can be undone.
                </p>
              </div>
              <div className="p-3 rounded-xl border border-red-200 bg-red-50/50">
                <p className="text-sm font-medium text-red-700 mb-0.5">Delete</p>
                <p className="text-xs text-red-600/80">
                  Permanently removes the user and all their data. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteConfirm(null); setActionError(""); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:bg-background transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeactivate(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition"
              >
                Deactivate
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
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

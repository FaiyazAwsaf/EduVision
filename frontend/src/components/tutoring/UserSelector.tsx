"use client";

/**
 * User Selector Component
 *
 * Temporary authentication component for development.
 * Allows selecting a test user (teacher or student) from a dropdown.
 */

import React, { useEffect, useState } from "react";
import {
  TutoringUser,
  getUsers,
  getCurrentUserId,
  setCurrentUserId,
} from "@/api/tutoring";

interface UserSelectorProps {
  onUserChange?: (user: TutoringUser | null) => void;
  filterRole?: "TEACHER" | "STUDENT";
  className?: string;
}

export default function UserSelector({
  onUserChange,
  filterRole,
  className = "",
}: UserSelectorProps) {
  const [users, setUsers] = useState<TutoringUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load users on mount
  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const allUsers = await getUsers();
        let filteredUsers = allUsers;

        if (filterRole) {
          filteredUsers = allUsers.filter((user) => user.role === filterRole);
        }

        setUsers(filteredUsers);

        // Check if there's a saved user ID
        const savedUserId = getCurrentUserId();
        if (savedUserId) {
          const savedUser = filteredUsers.find((u) => u.id === savedUserId);
          if (savedUser) {
            setSelectedUserId(savedUserId);
            onUserChange?.(savedUser);
          }
        }
      } catch (err) {
        console.error("Failed to load users:", err);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [filterRole, onUserChange]);

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;

    if (!userId) {
      setSelectedUserId(null);
      setCurrentUserId("");
      onUserChange?.(null);
      return;
    }

    const selectedUser = users.find((u) => u.id === userId);
    if (selectedUser) {
      setSelectedUserId(userId);
      setCurrentUserId(userId);
      onUserChange?.(selectedUser);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-gray-500">Loading users...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-red-500">{error}</span>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-yellow-600">
          No {filterRole ? filterRole.toLowerCase() : "user"}s found. Create
          test users first.
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label
        htmlFor="user-selector"
        className="text-sm font-medium text-gray-700"
      >
        Select User:
      </label>
      <select
        id="user-selector"
        value={selectedUserId || ""}
        onChange={handleUserChange}
        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <option value="">-- Select a user --</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.full_name} ({user.role})
          </option>
        ))}
      </select>
      {selectedUserId && (
        <span className="text-xs text-gray-500">
          ID: {selectedUserId.substring(0, 8)}...
        </span>
      )}
    </div>
  );
}

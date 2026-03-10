/**
 * MembersList Component
 * 
 * Displays all members in the current whiteboard session
 * Can be toggled open/closed from a button
 */

"use client";

import { useState } from "react";

export interface Member {
  id: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  role: string;
  joined_at: string;
  last_active_at: string;
}

interface MembersListProps {
  members: Member[];
  ownerId: string;
  isConnected: boolean;
}

export default function MembersList({ members, ownerId, isConnected }: MembersListProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-5 right-5 z-[1100] bg-[#48A6A7] hover:bg-[#006A71] text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
        title="View session members"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span className="font-medium">
          {members.length} {members.length === 1 ? "Member" : "Members"}
        </span>
      </button>

      {/* Members Panel */}
      <>
        {/* Backdrop (transparent, only for click-outside close) */}
        <div
          className={`fixed inset-0 z-[1150] transition-opacity duration-300 ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setIsOpen(false)}
        />

        {/* Panel */}
        <div
          className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-[1200] flex flex-col transform transition-transform duration-300 ease-out ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
            {/* Header */}
            <div className="bg-[#48A6A7] text-white p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Session Members</h2>
                <p className="text-sm text-white/80">
                  {members.length} {members.length === 1 ? "member" : "members"} • 
                  <span className={`ml-1 ${isConnected ? 'text-green-300' : 'text-red-300'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-4">
              {members.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No members in this session
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const isOwner = member.user.id === ownerId;
                    return (
                      <div
                        key={member.id}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-[#48A6A7] transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {member.user.username}
                              </h3>
                              {isOwner && (
                                <span className="text-xs bg-[#48A6A7] text-white px-2 py-0.5 rounded-full">
                                  Owner
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {member.user.email}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                member.user.role === "teacher"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {member.user.role}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Joined {new Date(member.joined_at).toLocaleDateString()} at{" "}
                          {new Date(member.joined_at).toLocaleTimeString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      </>
    </>
  );
}

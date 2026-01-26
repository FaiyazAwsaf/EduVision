"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  BookOpen,
  Archive,
  Eye,
  CheckCircle,
  Loader2,
  AlertCircle,
  Filter,
  X,
} from "lucide-react";
import { listRubrics, archiveRubric, getRubric } from "@/lib/api/rubrics";
import type { RubricListItem, Rubric } from "@/lib/api/rubrics";

interface RubricsLibraryProps {
  onSelectRubric?: (rubric: Rubric) => void;
}

export default function RubricsLibrary({
  onSelectRubric,
}: RubricsLibraryProps) {
  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const [filteredRubrics, setFilteredRubrics] = useState<RubricListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRubric, setSelectedRubric] = useState<Rubric | null>(null);

  // Load rubrics on mount
  useEffect(() => {
    loadRubrics();
  }, []);

  // Filter rubrics when search or subject changes
  useEffect(() => {
    filterRubrics();
  }, [searchQuery, subjectFilter, rubrics]);

  const loadRubrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listRubrics();
      // Filter to show only published rubrics
      const publishedRubrics = data.filter((r) => r.state === "published");
      setRubrics(publishedRubrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rubrics");
    } finally {
      setIsLoading(false);
    }
  };

  const filterRubrics = () => {
    let filtered = [...rubrics];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.subject.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Apply subject filter
    if (subjectFilter !== "all") {
      filtered = filtered.filter((r) => r.subject === subjectFilter);
    }

    setFilteredRubrics(filtered);
  };

  const handleViewRubric = async (id: string) => {
    try {
      const rubric = await getRubric(id);
      setSelectedRubric(rubric);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rubric");
    }
  };

  const handleArchiveRubric = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to archive "${title}"?`)) {
      return;
    }

    try {
      await archiveRubric(id);
      await loadRubrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive rubric");
    }
  };

  const handleUseRubric = (rubric: Rubric) => {
    if (onSelectRubric) {
      onSelectRubric(rubric);
    }
  };

  // Get unique subjects for filter
  const subjects = Array.from(new Set(rubrics.map((r) => r.subject))).sort();

  // Rubric Detail View
  if (selectedRubric) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-[#006A71]">
              Rubric Details
            </h2>
            <button
              onClick={() => setSelectedRubric(null)}
              className="text-[#48A6A7] hover:text-[#006A71] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Header Info */}
            <div className="pb-6 border-b border-[#9ACBD0]">
              <h3 className="text-xl font-semibold text-[#006A71] mb-2">
                {selectedRubric.title}
              </h3>
              <div className="flex items-center gap-4 text-sm text-[#48A6A7]">
                <span>Subject: {selectedRubric.subject}</span>
                <span>•</span>
                <span>Total Marks: {selectedRubric.total_marks}</span>
                <span>•</span>
                <span>Version: {selectedRubric.version}</span>
              </div>
            </div>

            {/* Question */}
            <div>
              <h4 className="text-sm font-semibold text-[#006A71] mb-2">
                Question
              </h4>
              <p className="text-[#48A6A7] bg-[#F2EFE7] p-4 rounded-lg">
                {selectedRubric.question_text}
              </p>
            </div>

            {/* Reference Answer */}
            <div>
              <h4 className="text-sm font-semibold text-[#006A71] mb-2">
                Reference Answer
              </h4>
              <p className="text-[#48A6A7] bg-[#F2EFE7] p-4 rounded-lg whitespace-pre-wrap">
                {selectedRubric.reference_answer}
              </p>
            </div>

            {/* Evaluation Rules */}
            <div>
              <h4 className="text-sm font-semibold text-[#006A71] mb-3">
                Evaluation Rules
              </h4>
              <div className="space-y-3">
                {selectedRubric.evaluation_rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="bg-[#F2EFE7] p-4 rounded-lg border border-[#9ACBD0]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-[#006A71]">
                        Rule {index + 1} -{" "}
                        {rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}
                      </span>
                      <span className="text-sm font-semibold text-[#48A6A7]">
                        {rule.marks} marks
                      </span>
                    </div>
                    <div className="text-sm text-[#48A6A7] space-y-2">
                      {rule.type === "keyword" &&
                        "required_keywords" in rule.config && (
                          <div>
                            <span className="font-medium">Keywords:</span>{" "}
                            {Array.isArray(rule.config.required_keywords)
                              ? rule.config.required_keywords.join(", ")
                              : "None"}
                            <div className="text-xs mt-1">
                              Mode:{" "}
                              {rule.config.scoring_mode === "proportional"
                                ? "Proportional"
                                : "All or Nothing"}
                            </div>
                          </div>
                        )}
                      {rule.type === "numeric" &&
                        "expected_value" in rule.config && (
                          <div>
                            <span className="font-medium">Expected Value:</span>{" "}
                            {String(rule.config.expected_value)}
                            <div className="text-xs mt-1">
                              Tolerance: ±{rule.config.tolerance}
                            </div>
                          </div>
                        )}
                      {rule.type === "stepwise" &&
                        "step_description" in rule.config && (
                          <div>
                            <span className="font-medium">Step:</span>{" "}
                            {rule.config.step_description}
                            {rule.config.allow_partial_credit && (
                              <div className="text-xs mt-1">
                                Partial credit allowed
                              </div>
                            )}
                          </div>
                        )}
                      <div className="text-xs text-[#9ACBD0] mt-2 space-y-1">
                        <div>✓ Success: {rule.feedback.on_success}</div>
                        {rule.feedback.on_partial && (
                          <div>◐ Partial: {rule.feedback.on_partial}</div>
                        )}
                        <div>✗ Failure: {rule.feedback.on_failure}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {onSelectRubric && (
              <div className="pt-6 border-t border-[#9ACBD0]">
                <button
                  onClick={() => handleUseRubric(selectedRubric)}
                  className="w-full py-3 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors font-medium"
                >
                  Use This Rubric
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Library View
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#006A71] mb-2">
          Published Rubrics Library
        </h2>
        <p className="text-[#48A6A7]">
          Browse and select from published rubrics to use in evaluation
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-[#9ACBD0] p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ACBD0]" />
            <input
              type="text"
              placeholder="Search rubrics by title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#9ACBD0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
            />
          </div>

          {/* Subject Filter */}
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ACBD0] pointer-events-none" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#9ACBD0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-3 text-sm text-[#48A6A7]">
          Showing {filteredRubrics.length} of {rubrics.length} published rubrics
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-[#48A6A7]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading rubrics...</span>
          </div>
        </div>
      ) : filteredRubrics.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#9ACBD0] p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-[#9ACBD0] mb-4" />
          <h3 className="text-lg font-medium text-[#006A71] mb-2">
            {searchQuery || subjectFilter !== "all"
              ? "No rubrics found"
              : "No published rubrics yet"}
          </h3>
          <p className="text-[#48A6A7] text-sm">
            {searchQuery || subjectFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Create and publish rubrics in the Rubrics page"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRubrics.map((rubric) => (
            <div
              key={rubric.id}
              className="bg-white rounded-xl border border-[#9ACBD0] p-5 hover:border-[#48A6A7] transition-all hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#006A71] mb-1 line-clamp-2">
                    {rubric.title}
                  </h3>
                  <p className="text-sm text-[#48A6A7]">{rubric.subject}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 ml-2" />
              </div>

              {/* Info */}
              <div className="space-y-1 text-sm text-[#48A6A7] mb-4">
                <p>Total Marks: {rubric.total_marks}</p>
                <p>Version: {rubric.version}</p>
                <p className="text-xs text-[#9ACBD0]">
                  Updated: {new Date(rubric.updated_at).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-[#9ACBD0]">
                <button
                  onClick={() => handleViewRubric(rubric.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => handleArchiveRubric(rubric.id, rubric.title)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[#9ACBD0] text-[#48A6A7] rounded-lg hover:bg-[#F2EFE7] transition-colors"
                  title="Archive rubric"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

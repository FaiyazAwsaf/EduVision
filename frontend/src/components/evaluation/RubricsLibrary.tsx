"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BookOpen,
  Archive,
  Eye,
  Loader2,
  AlertCircle,
  X,
  Edit,
} from "lucide-react";
import { listRubrics, archiveRubric, getRubricSet } from "@/api/rubrics";
import type { RubricListItem, RubricSet } from "@/api/rubrics";

interface RubricsLibraryProps {
  onSelectRubric?: (rubric: RubricSet) => void;
}

export default function RubricsLibrary({
  onSelectRubric,
}: RubricsLibraryProps) {
  const router = useRouter();
  const [rubrics, setRubrics] = useState<RubricListItem[]>([]);
  const [filteredRubrics, setFilteredRubrics] = useState<RubricListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRubric, setSelectedRubric] = useState<RubricSet | null>(null);

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
      const rubric = await getRubricSet(id);
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

  const handleUseRubric = (rubric: RubricSet) => {
    if (onSelectRubric) {
      onSelectRubric(rubric);
    }
  };

  const handleEditRubric = async (id: string) => {
    // Navigate directly to the rubrics editor page with the rubric ID
    router.push(`/rubrics?id=${id}`);
  };

  // Get unique subjects for filter
  const subjects = Array.from(new Set(rubrics.map((r) => r.subject))).sort();

  // Rubric Detail View
  if (selectedRubric) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => setSelectedRubric(null)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-dark mb-4 transition-colors"
        >
          <X className="w-4 h-4" />
          Close
        </button>

        <div className="bg-white border border-secondary/30 rounded-xl">
          {/* Header */}
          <div className="px-6 py-5 border-b border-secondary/20">
            <h2 className="text-lg font-semibold text-primary-dark">
              {selectedRubric.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-secondary mt-1">
              <span>{selectedRubric.subject}</span>
              <span>&middot;</span>
              <span>{selectedRubric.total_marks} marks</span>
              <span>&middot;</span>
              <span>v{selectedRubric.version}</span>
            </div>
          </div>

          {/* Questions */}
          <div className="divide-y divide-secondary/20">
            {selectedRubric.questions?.map((question, qIndex) => (
              <div key={question.id} className="px-6 py-5">
                {/* Question header row */}
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary-dark">
                    Q{qIndex + 1}
                  </h3>
                  <span className="text-xs text-secondary">
                    {question.max_marks} marks
                  </span>
                </div>

                {/* Question text */}
                <p className="text-sm text-primary-dark bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  {question.question_text}
                </p>

                {/* Reference answer */}
                {question.reference_answer && (
                  <div className="mb-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-secondary">
                      Reference Answer
                    </span>
                    <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">
                      {question.reference_answer}
                    </p>
                  </div>
                )}

                {/* Evaluation rules */}
                {question.evaluation_rules.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-secondary">
                      Rules ({question.evaluation_rules.length})
                    </span>
                    <div className="mt-2 space-y-2">
                      {question.evaluation_rules.map((rule, rIndex) => (
                        <div
                          key={rule.id}
                          className="bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-primary-dark">
                              {rIndex + 1}.{" "}
                              {rule.type.charAt(0).toUpperCase() +
                                rule.type.slice(1)}
                            </span>
                            <span className="text-xs text-secondary">
                              {rule.marks} marks
                            </span>
                          </div>

                          <div className="text-xs text-secondary">
                            {rule.type === "keyword" &&
                              "required_keywords" in rule.config && (
                                <p>
                                  Keywords:{" "}
                                  {Array.isArray(
                                    rule.config.required_keywords,
                                  )
                                    ? rule.config.required_keywords.join(", ")
                                    : "None"}
                                  {" · "}
                                  {rule.config.scoring_mode ===
                                  "proportional"
                                    ? "Proportional"
                                    : "All or Nothing"}
                                </p>
                              )}
                            {rule.type === "numeric" &&
                              "expected_value" in rule.config && (
                                <p>
                                  Expected: {String(rule.config.expected_value)}
                                  {" · "}Tolerance: ±{rule.config.tolerance}
                                </p>
                              )}
                            {rule.type === "stepwise" &&
                              "step_description" in rule.config && (
                                <p>
                                  {rule.config.step_description}
                                  {rule.config.allow_partial_credit &&
                                    " · Partial credit allowed"}
                                </p>
                              )}
                          </div>

                          <div className="mt-1.5 text-xs space-y-0.5">
                            <p className="text-emerald-600">
                              + {rule.feedback.on_success}
                            </p>
                            {rule.feedback.on_partial && (
                              <p className="text-amber-600">
                                ~ {rule.feedback.on_partial}
                              </p>
                            )}
                            <p className="text-red-500">
                              &minus; {rule.feedback.on_failure}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Use rubric action */}
          {onSelectRubric && (
            <div className="px-6 py-4 border-t border-secondary/20">
              <button
                onClick={() => handleUseRubric(selectedRubric)}
                className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
              >
                Use This Rubric
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Library View
  return (
    <div>
      {/* Error */}
      {error && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & filter row */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Search rubrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-secondary/40 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="min-w-[180px] px-3 py-2 text-sm border border-secondary/40 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-white"
        >
          <option value="all">All Subjects</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-secondary mb-4">
        {filteredRubrics.length} of {rubrics.length} published
      </p>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredRubrics.length === 0 ? (
        <div className="bg-white border border-secondary/30 rounded-xl py-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-secondary/50 mb-3" />
          <p className="text-sm text-secondary">
            {searchQuery || subjectFilter !== "all"
              ? "No rubrics match your search."
              : "No published rubrics yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRubrics.map((rubric) => (
            <div
              key={rubric.id}
              className="bg-white border border-secondary/30 rounded-xl p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-primary-dark line-clamp-1">
                    {rubric.title}
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    {rubric.subject} &middot; {rubric.total_marks} marks &middot; v{rubric.version}
                  </p>
                </div>
                <span className="shrink-0 ml-3 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                  Published
                </span>
              </div>

              <p className="text-xs text-secondary mb-3">
                Updated {new Date(rubric.updated_at).toLocaleDateString()}
              </p>

              <div className="flex items-center gap-2 pt-3 border-t border-secondary/20">
                <button
                  onClick={() => handleViewRubric(rubric.id)}
                  className="text-xs font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
                <span className="text-secondary/30">|</span>
                <button
                  onClick={() => handleEditRubric(rubric.id)}
                  className="text-xs font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleArchiveRubric(rubric.id, rubric.title)}
                  className="ml-auto text-xs text-secondary hover:text-red-500 transition-colors flex items-center gap-1"
                  title="Archive rubric"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

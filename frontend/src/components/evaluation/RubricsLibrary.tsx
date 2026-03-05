"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Edit,
  Check,
  CircleDot,
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-secondary p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-primary-dark">
              Rubric Details
            </h2>
            <button
              onClick={() => setSelectedRubric(null)}
              className="text-primary hover:text-primary-dark transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Header Info */}
            <div className="pb-6 border-b border-secondary">
              <h3 className="text-xl font-semibold text-primary-dark mb-2">
                {selectedRubric.title}
              </h3>
              <div className="flex items-center gap-4 text-sm text-primary">
                <span>Subject: {selectedRubric.subject}</span>
                <span>•</span>
                <span>Total Marks: {selectedRubric.total_marks}</span>
                <span>•</span>
                <span>Version: {selectedRubric.version}</span>
              </div>
            </div>

            {/* Questions */}
            <div>
              <h4 className="text-sm font-semibold text-primary-dark mb-3">
                Questions ({selectedRubric.questions?.length || 0})
              </h4>
              <div className="space-y-6">
                {selectedRubric.questions?.map((question, qIndex) => (
                  <div
                    key={question.id}
                    className="border border-secondary rounded-lg p-5 bg-white"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-4 pb-3 border-b border-secondary">
                      <h5 className="text-base font-semibold text-primary-dark">
                        Question {qIndex + 1}
                      </h5>
                      <span className="text-sm font-semibold text-primary bg-background px-3 py-1 rounded">
                        {question.max_marks} marks
                      </span>
                    </div>

                    {/* Question Text */}
                    <div className="mb-4">
                      <h6 className="text-xs font-semibold text-primary-dark mb-2">
                        Question Text
                      </h6>
                      <p className="text-primary bg-background p-3 rounded text-sm">
                        {question.question_text}
                      </p>
                    </div>

                    {/* Reference Answer */}
                    {question.reference_answer && (
                      <div className="mb-4">
                        <h6 className="text-xs font-semibold text-primary-dark mb-2">
                          Reference Answer
                        </h6>
                        <p className="text-primary bg-background p-3 rounded text-sm whitespace-pre-wrap">
                          {question.reference_answer}
                        </p>
                      </div>
                    )}

                    {/* Evaluation Rules */}
                    <div>
                      <h6 className="text-xs font-semibold text-primary-dark mb-2">
                        Evaluation Rules ({question.evaluation_rules.length})
                      </h6>
                      <div className="space-y-2">
                        {question.evaluation_rules.map((rule, rIndex) => (
                          <div
                            key={rule.id}
                            className="bg-background p-3 rounded border border-secondary"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-medium text-primary-dark">
                                Rule {rIndex + 1} -{" "}
                                {rule.type.charAt(0).toUpperCase() +
                                  rule.type.slice(1)}
                              </span>
                              <span className="text-xs font-semibold text-primary">
                                {rule.marks} marks
                              </span>
                            </div>
                            <div className="text-xs text-primary space-y-2">
                              {rule.type === "keyword" &&
                                "required_keywords" in rule.config && (
                                  <div>
                                    <span className="font-medium">
                                      Keywords:
                                    </span>{" "}
                                    {Array.isArray(
                                      rule.config.required_keywords,
                                    )
                                      ? rule.config.required_keywords.join(", ")
                                      : "None"}
                                    <div className="text-xs mt-1">
                                      Mode:{" "}
                                      {rule.config.scoring_mode ===
                                      "proportional"
                                        ? "Proportional"
                                        : "All or Nothing"}
                                    </div>
                                  </div>
                                )}
                              {rule.type === "numeric" &&
                                "expected_value" in rule.config && (
                                  <div>
                                    <span className="font-medium">
                                      Expected Value:
                                    </span>{" "}
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
                              <div className="text-xs text-secondary mt-2 space-y-1">
                                <div className="flex items-start gap-1">
                                  <Check className="w-3 h-3 mt-0.5 text-emerald-500 shrink-0" /> Success: {rule.feedback.on_success}
                                </div>
                                {rule.feedback.on_partial && (
                                  <div className="flex items-start gap-1">
                                    <CircleDot className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" /> Partial: {rule.feedback.on_partial}
                                  </div>
                                )}
                                <div className="flex items-start gap-1">
                                  <X className="w-3 h-3 mt-0.5 text-red-500 shrink-0" /> Failure: {rule.feedback.on_failure}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {onSelectRubric && (
              <div className="pt-6 border-t border-secondary">
                <button
                  onClick={() => handleUseRubric(selectedRubric)}
                  className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
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
        <h2 className="text-2xl font-semibold text-primary-dark mb-2">
          Published Rubrics Library
        </h2>
        <p className="text-primary">
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
      <div className="bg-white rounded-xl border border-secondary p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
            <input
              type="text"
              placeholder="Search rubrics by title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Subject Filter */}
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary pointer-events-none" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
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
        <div className="mt-3 text-sm text-primary">
          Showing {filteredRubrics.length} of {rubrics.length} published rubrics
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading rubrics...</span>
          </div>
        </div>
      ) : filteredRubrics.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-secondary mb-4" />
          <h3 className="text-lg font-medium text-primary-dark mb-2">
            {searchQuery || subjectFilter !== "all"
              ? "No rubrics found"
              : "No published rubrics yet"}
          </h3>
          <p className="text-primary text-sm">
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
              className="bg-white rounded-xl border border-secondary p-5 hover:border-primary transition-all hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-primary-dark mb-1 line-clamp-2">
                    {rubric.title}
                  </h3>
                  <p className="text-sm text-primary">{rubric.subject}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 ml-2" />
              </div>

              {/* Info */}
              <div className="space-y-1 text-sm text-primary mb-4">
                <p>Total Marks: {rubric.total_marks}</p>
                <p>Version: {rubric.version}</p>
                <p className="text-xs text-secondary">
                  Updated: {new Date(rubric.updated_at).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-secondary">
                <button
                  onClick={() => handleViewRubric(rubric.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => handleEditRubric(rubric.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                  title="Edit rubric"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleArchiveRubric(rubric.id, rubric.title)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm border border-secondary text-primary rounded-lg hover:bg-background transition-colors"
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

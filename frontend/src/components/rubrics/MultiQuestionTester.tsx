"use client";

import React, { useState } from "react";
import { QuestionRubric, testRubricSet, QuestionResult } from "@/api/rubrics";

interface MultiQuestionTesterProps {
  questions: QuestionRubric[];
}

export default function MultiQuestionTester({
  questions,
}: MultiQuestionTesterProps) {
  const [answers, setAnswers] = useState<Record<string | number, string>>({});
  const [testResults, setTestResults] = useState<QuestionResult[] | null>(null);
  const [overallScore, setOverallScore] = useState<{
    score: number;
    max: number;
    percentage: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-primary-dark";
    if (percentage >= 60) return "text-primary";
    if (percentage >= 40) return "text-secondary";
    return "text-red-600";
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return "bg-primary-dark/10";
    if (percentage >= 60) return "bg-primary/10";
    if (percentage >= 40) return "bg-secondary/20";
    return "bg-red-100";
  };

  const handleTestAnswers = async () => {
    if (questions.length === 0) {
      setError("No questions available to test");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTestResults(null);
    setOverallScore(null);

    try {
      const result = await testRubricSet({ questions }, answers);

      setTestResults(result.question_results);
      setOverallScore({
        score: result.total_score,
        max: result.max_score,
        percentage: result.percentage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test answers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setAnswers({});
    setTestResults(null);
    setOverallScore(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Answer Input Section */}
      <div className="bg-white rounded-xl border border-secondary p-6">
        <h2 className="text-xl font-semibold text-primary-dark mb-4">
          Test Sample Answers
        </h2>
        <p className="text-sm text-primary mb-6">
          Enter sample answers for each question to see how your rubric set
          would evaluate them.
        </p>

        {questions.length === 0 ? (
          <p className="text-center text-secondary py-8">
            Add questions to the rubric set to enable testing
          </p>
        ) : (
          <div className="space-y-6">
            {questions.map((question) => (
              <div
                key={question.question_number}
                className="border border-secondary rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-primary-dark">
                      Question {question.question_number}
                    </h3>
                    <p className="text-sm text-primary mt-1">
                      {question.question_text || "No question text"}
                    </p>
                    <p className="text-xs text-secondary mt-1">
                      Max marks: {question.max_marks}
                    </p>
                  </div>
                </div>
                <textarea
                  value={answers[question.question_number] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.question_number]: e.target.value,
                    }))
                  }
                  className="w-full mt-3 px-3 py-2 border border-secondary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-primary-dark text-sm resize-none"
                  rows={4}
                  placeholder={`Enter sample answer for Question ${question.question_number}...`}
                />
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={handleTestAnswers}
                disabled={isLoading}
                className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
              >
                {isLoading ? "Testing..." : "Test Answers"}
              </button>
              <button
                onClick={handleClear}
                disabled={isLoading}
                className="px-6 py-2.5 bg-background text-primary-dark border border-secondary rounded-lg hover:bg-secondary/30 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Overall Score */}
      {overallScore && (
        <div className="bg-white rounded-xl border border-secondary p-6">
          <h2 className="text-xl font-semibold text-primary-dark mb-4">
            Overall Results
          </h2>
          <div
            className={`${getScoreBgColor(overallScore.percentage)} rounded-lg p-6 text-center`}
          >
            <div
              className={`text-5xl font-bold ${getScoreColor(overallScore.percentage)} mb-2`}
            >
              {overallScore.score.toFixed(2)} / {overallScore.max.toFixed(2)}
            </div>
            <div
              className={`text-2xl font-semibold ${getScoreColor(overallScore.percentage)}`}
            >
              {overallScore.percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Question Results */}
      {testResults && testResults.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary p-6">
          <h2 className="text-xl font-semibold text-primary-dark mb-4">
            Question Breakdown
          </h2>

          <div className="space-y-4">
            {testResults.map((result) => {
              const percentage = result.percentage;
              return (
                <div
                  key={result.question_number}
                  className="border border-secondary rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-primary-dark">
                      Question {result.question_number}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-lg font-bold ${getScoreColor(percentage)}`}
                      >
                        {result.score.toFixed(2)} / {result.max_marks}
                      </span>
                      <span
                        className={`text-sm font-semibold ${getScoreColor(percentage)}`}
                      >
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {result.rule_results && result.rule_results.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {result.rule_results.map(
                        (ruleResult: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-sm bg-background rounded px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  ruleResult.matched
                                    ? "text-green-600"
                                    : "text-orange-600"
                                }
                              >
                                {ruleResult.matched ? "✓" : "○"}
                              </span>
                              <span className="text-primary-dark font-medium">
                                Rule {index + 1} ({ruleResult.rule_type})
                              </span>
                            </div>
                            <span className="text-primary font-semibold">
                              {ruleResult.score_awarded.toFixed(2)} /{" "}
                              {ruleResult.max_marks}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  <div className="bg-background rounded-lg p-3">
                    <p className="text-xs font-semibold text-primary-dark mb-1">
                      Feedback:
                    </p>
                    <p className="text-sm text-primary whitespace-pre-wrap">
                      {result.feedback}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

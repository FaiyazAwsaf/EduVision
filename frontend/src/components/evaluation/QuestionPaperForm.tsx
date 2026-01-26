"use client";

import React, { useState } from "react";
import evaluationAPI, {
  QuestionPaper,
  Question,
  Rubric,
} from "@/lib/api/evaluation";

interface QuestionPaperFormProps {
  onSuccess: (paper: QuestionPaper) => void;
  onCancel?: () => void;
}

interface QuestionFormData {
  question_number: string;
  question_text: string;
  question_type: string;
  max_marks: number;
  model_answer: string;
  rubric: {
    method_marks: number;
    calculation_marks: number;
    answer_marks: number;
    key_points: string[];
    common_mistakes: string[];
    grading_notes: string;
  };
}

const defaultQuestion: QuestionFormData = {
  question_number: "",
  question_text: "",
  question_type: "mathematical",
  max_marks: 5,
  model_answer: "",
  rubric: {
    method_marks: 2,
    calculation_marks: 2,
    answer_marks: 1,
    key_points: [],
    common_mistakes: [],
    grading_notes: "",
  },
};

export default function QuestionPaperForm({
  onSuccess,
  onCancel,
}: QuestionPaperFormProps) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [classLevel, setClassLevel] = useState("9");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionFormData[]>([
    { ...defaultQuestion },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        ...defaultQuestion,
        question_number: String(questions.length + 1),
      },
    ]);
    setActiveQuestionIndex(questions.length);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
      setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1));
    }
  };

  const updateQuestion = (
    index: number,
    field: keyof QuestionFormData,
    value: unknown
  ) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const updateRubric = (
    questionIndex: number,
    field: keyof QuestionFormData["rubric"],
    value: unknown
  ) => {
    setQuestions(
      questions.map((q, i) =>
        i === questionIndex
          ? { ...q, rubric: { ...q.rubric, [field]: value } }
          : q
      )
    );
  };

  const addKeyPoint = (questionIndex: number, point: string) => {
    if (point.trim()) {
      updateRubric(questionIndex, "key_points", [
        ...questions[questionIndex].rubric.key_points,
        point.trim(),
      ]);
    }
  };

  const removeKeyPoint = (questionIndex: number, pointIndex: number) => {
    updateRubric(
      questionIndex,
      "key_points",
      questions[questionIndex].rubric.key_points.filter(
        (_, i) => i !== pointIndex
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const paper = await evaluationAPI.createQuestionPaper({
        title,
        subject,
        class_level: classLevel,
        description: description || undefined,
        questions: questions.map((q) => ({
          question_number: q.question_number,
          question_text: q.question_text,
          question_type: q.question_type,
          max_marks: q.max_marks,
          model_answer: q.model_answer || undefined,
          rubric: {
            id: "",
            method_marks: q.rubric.method_marks,
            calculation_marks: q.rubric.calculation_marks,
            answer_marks: q.rubric.answer_marks,
            key_points: q.rubric.key_points,
            common_mistakes: q.rubric.common_mistakes,
            grading_notes: q.rubric.grading_notes || undefined,
            total_marks:
              q.rubric.method_marks +
              q.rubric.calculation_marks +
              q.rubric.answer_marks,
          },
        })),
      });
      onSuccess(paper);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create question paper"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Paper Details */}
      <div className="bg-white rounded-xl p-6 border border-[#9ACBD0]">
        <h2 className="text-lg font-semibold text-[#006A71] mb-4">
          Question Paper Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#006A71] mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Mid-Term Examination 2024"
              className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#006A71] mb-1">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
            >
              <option value="Mathematics">Mathematics</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#006A71] mb-1">
              Class Level
            </label>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
            >
              <option value="9">Class 9</option>
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#006A71] mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes about this question paper..."
              rows={2}
              className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Questions Tabs */}
      <div className="bg-white rounded-xl border border-[#9ACBD0] overflow-hidden">
        <div className="border-b border-[#9ACBD0]">
          <div className="flex overflow-x-auto">
            {questions.map((q, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveQuestionIndex(index)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeQuestionIndex === index
                    ? "border-[#48A6A7] text-[#006A71]"
                    : "border-transparent text-[#9ACBD0] hover:text-[#48A6A7]"
                }`}
              >
                Q{q.question_number || index + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={addQuestion}
              className="px-4 py-3 text-sm font-medium text-[#48A6A7] hover:bg-[#48A6A7]/10"
            >
              + Add Question
            </button>
          </div>
        </div>

        {/* Active Question Form */}
        <div className="p-6">
          {questions.map((question, index) => (
            <div
              key={index}
              className={activeQuestionIndex === index ? "" : "hidden"}
            >
              <div className="space-y-4">
                {/* Question Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#006A71] mb-1">
                      Question Number *
                    </label>
                    <input
                      type="text"
                      value={question.question_number}
                      onChange={(e) =>
                        updateQuestion(index, "question_number", e.target.value)
                      }
                      placeholder="e.g., 1, 2a, 2b"
                      className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#006A71] mb-1">
                      Question Type
                    </label>
                    <select
                      value={question.question_type}
                      onChange={(e) =>
                        updateQuestion(index, "question_type", e.target.value)
                      }
                      className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
                    >
                      <option value="mathematical">Mathematical Problem</option>
                      <option value="short">Short Answer</option>
                      <option value="descriptive">Descriptive Answer</option>
                      <option value="proof">Mathematical Proof</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#006A71] mb-1">
                      Max Marks
                    </label>
                    <input
                      type="number"
                      value={question.max_marks}
                      onChange={(e) =>
                        updateQuestion(
                          index,
                          "max_marks",
                          parseInt(e.target.value)
                        )
                      }
                      min={1}
                      className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#006A71] mb-1">
                    Question Text *
                  </label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) =>
                      updateQuestion(index, "question_text", e.target.value)
                    }
                    placeholder="Enter the question text..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#006A71] mb-1">
                    Model Answer / Solution
                  </label>
                  <textarea
                    value={question.model_answer}
                    onChange={(e) =>
                      updateQuestion(index, "model_answer", e.target.value)
                    }
                    placeholder="Enter the correct solution or model answer..."
                    rows={4}
                    className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors resize-none"
                  />
                </div>

                {/* Rubric Section */}
                <div className="border-t border-[#9ACBD0] pt-4 mt-4">
                  <h3 className="text-md font-semibold text-[#006A71] mb-4">
                    Grading Rubric
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-[#006A71] mb-1">
                        Method Marks
                      </label>
                      <input
                        type="number"
                        value={question.rubric.method_marks}
                        onChange={(e) =>
                          updateRubric(
                            index,
                            "method_marks",
                            parseInt(e.target.value)
                          )
                        }
                        min={0}
                        className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#006A71] mb-1">
                        Calculation Marks
                      </label>
                      <input
                        type="number"
                        value={question.rubric.calculation_marks}
                        onChange={(e) =>
                          updateRubric(
                            index,
                            "calculation_marks",
                            parseInt(e.target.value)
                          )
                        }
                        min={0}
                        className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#006A71] mb-1">
                        Answer Marks
                      </label>
                      <input
                        type="number"
                        value={question.rubric.answer_marks}
                        onChange={(e) =>
                          updateRubric(
                            index,
                            "answer_marks",
                            parseInt(e.target.value)
                          )
                        }
                        min={0}
                        className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Key Points */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#006A71] mb-1">
                      Key Points to Check
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {question.rubric.key_points.map((point, pointIndex) => (
                        <span
                          key={pointIndex}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-[#48A6A7]/10 text-[#006A71] rounded-full text-sm"
                        >
                          {point}
                          <button
                            type="button"
                            onClick={() => removeKeyPoint(index, pointIndex)}
                            className="hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a key point..."
                        className="flex-1 px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addKeyPoint(index, e.currentTarget.value);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#006A71] mb-1">
                      Grading Notes
                    </label>
                    <textarea
                      value={question.rubric.grading_notes}
                      onChange={(e) =>
                        updateRubric(index, "grading_notes", e.target.value)
                      }
                      placeholder="Additional grading instructions..."
                      rows={2}
                      className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Remove Question Button */}
                {questions.length > 1 && (
                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove Question
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-[#9ACBD0] rounded-lg text-[#48A6A7] hover:bg-[#F2EFE7] transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Creating...
            </>
          ) : (
            "Create Question Paper"
          )}
        </button>
      </div>
    </form>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { BookOpenCheck, Search, X, Loader2 } from "lucide-react";
import { searchCurriculumTopics } from "@/api/curriculum";
import type { TopicSearchResult } from "@/types/curriculum";

interface CurriculumTopicPickerProps {
  onSelect: (topic: TopicSearchResult | null) => void;
  selected: TopicSearchResult | null;
}

export default function CurriculumTopicPicker({
  onSelect,
  selected,
}: CurriculumTopicPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TopicSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchCurriculumTopics(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (topic: TopicSearchResult) => {
    onSelect(topic);
    setQuery("");
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
        <BookOpenCheck className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-primary-dark">
            {selected.title}
          </span>
          <span className="text-muted ml-1.5 text-xs">
            ({selected.course_title})
          </span>
        </div>
        <button
          onClick={handleClear}
          className="shrink-0 p-0.5 text-muted hover:text-red-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search curriculum topics…"
          className="w-full pl-9 pr-8 py-2 border border-secondary/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-secondary/30 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map((topic) => (
            <button
              key={topic.id}
              onClick={() => handleSelect(topic)}
              className="w-full text-left px-3 py-2 hover:bg-background transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <p className="text-sm font-medium text-primary-dark">
                {topic.title}
              </p>
              <p className="text-[11px] text-muted">{topic.course_title}</p>
            </button>
          ))}
        </div>
      )}

      {showDropdown &&
        query.length >= 2 &&
        !isSearching &&
        results.length === 0 && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-secondary/30 rounded-xl shadow-lg px-3 py-3 text-center text-xs text-muted">
            No matching curriculum topics found.
          </div>
        )}
    </div>
  );
}

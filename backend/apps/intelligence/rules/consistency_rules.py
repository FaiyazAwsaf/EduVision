"""
Rule-Based Consistency Analyzer.

Analyzes learning consistency using deterministic rules based on:
- Session frequency
- Session duration variance
- Time-of-day patterns
- Day-of-week patterns

⚠️ This is a RULE-BASED implementation.
⚠️ Can be swapped for ML implementation without interface changes.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID
import statistics

from ..interfaces.base import EstimatorConfig, EstimatorResult
from ..interfaces.consistency_analyzer import ConsistencyAnalyzer
from ..domain.events import LearningEventData
from ..domain.enums import EventType


class RuleBasedConsistencyAnalyzer(ConsistencyAnalyzer):
    """
    Rule-based implementation of consistency analysis.
    
    Rules:
    1. Regular session intervals → higher consistency
    2. Consistent session durations → higher consistency
    3. Stable time-of-day patterns → higher consistency
    4. Multiple active days per week → higher consistency
    """
    
    def _default_config(self) -> EstimatorConfig:
        """Default configuration with consistency thresholds."""
        return EstimatorConfig(
            name="RuleBased Consistency Analyzer",
            version="1.0.0",
            parameters={
                # Expected days between sessions
                "expected_session_gap_days": 2,
                # Maximum acceptable variance in session gap (coefficient)
                "max_gap_variance_coefficient": 1.5,
                # Weight for frequency factor
                "frequency_weight": 0.35,
                # Weight for duration variance factor
                "duration_variance_weight": 0.25,
                # Weight for time pattern factor
                "time_pattern_weight": 0.20,
                # Weight for day pattern factor
                "day_pattern_weight": 0.20,
                # Default time window (days)
                "default_time_window_days": 30,
                # Minimum events for confident analysis
                "min_events_for_confidence": 7,
            },
            fallback_value=0.5,
        )
    
    def estimate(self, *args, **kwargs) -> EstimatorResult[float]:
        """Satisfy BaseEstimator contract — delegates to analyze()."""
        return self.analyze(*args, **kwargs)

    def analyze(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        time_window: Optional[timedelta] = None
    ) -> EstimatorResult[float]:
        """
        Analyze consistency based on learning events.
        """
        # Apply time window
        window_days = self.config.get_param("default_time_window_days", 30)
        if time_window is None:
            time_window = timedelta(days=window_days)
        
        cutoff = datetime.now(timezone.utc) - time_window
        filtered_events = [e for e in events if e.timestamp >= cutoff]
        
        if len(filtered_events) < 2:
            return self._fallback_result("Insufficient events for consistency analysis")
        
        # Calculate factors
        frequency_factor = self._calculate_frequency_factor(filtered_events)
        duration_factor = self._calculate_duration_variance_factor(filtered_events)
        time_factor = self._calculate_time_pattern_factor(filtered_events)
        day_factor = self._calculate_day_pattern_factor(filtered_events)
        
        # Get weights
        freq_weight = self.config.get_param("frequency_weight", 0.35)
        dur_weight = self.config.get_param("duration_variance_weight", 0.25)
        time_weight = self.config.get_param("time_pattern_weight", 0.20)
        day_weight = self.config.get_param("day_pattern_weight", 0.20)
        
        # Calculate weighted consistency score
        consistency_score = (
            frequency_factor * freq_weight +
            duration_factor * dur_weight +
            time_factor * time_weight +
            day_factor * day_weight
        )
        
        consistency_score = max(0.0, min(1.0, consistency_score))
        
        # Calculate confidence
        min_events = self.config.get_param("min_events_for_confidence", 7)
        confidence = min(1.0, len(filtered_events) / max(min_events, 1))
        
        # Build explanation
        explanation = self._build_explanation(
            frequency_factor, duration_factor, time_factor, 
            day_factor, consistency_score
        )
        
        return self._create_result(
            value=consistency_score,
            confidence=confidence,
            explanation=explanation,
            factors={
                "frequency_factor": frequency_factor,
                "duration_variance_factor": duration_factor,
                "time_pattern_factor": time_factor,
                "day_pattern_factor": day_factor,
            },
            raw_inputs={
                "event_count": len(filtered_events),
                "time_window_days": time_window.days,
            }
        )
    
    def get_session_pattern(
        self,
        user_id: UUID,
        events: list[LearningEventData]
    ) -> dict[str, Any]:
        """
        Get the learner's session pattern.
        """
        if not events:
            return {}
        
        # Group events by session or day
        sessions = self._group_into_sessions(events)
        
        # Calculate session statistics
        session_durations = [
            sum(e.duration_seconds or 0 for e in session)
            for session in sessions
        ]
        
        # Count sessions per week
        weeks = max(1, (max(e.timestamp for e in events) - min(e.timestamp for e in events)).days / 7)
        sessions_per_week = len(sessions) / weeks
        
        # Calculate average duration
        avg_duration = sum(session_durations) / max(len(session_durations), 1)
        
        # Determine preferred times
        hour_counts: dict[int, int] = defaultdict(int)
        for event in events:
            hour_counts[event.timestamp.hour] += 1
        
        preferred_times = []
        if sum(hour_counts.get(h, 0) for h in range(5, 12)) > len(events) * 0.3:
            preferred_times.append("morning")
        if sum(hour_counts.get(h, 0) for h in range(12, 17)) > len(events) * 0.3:
            preferred_times.append("afternoon")
        if sum(hour_counts.get(h, 0) for h in range(17, 22)) > len(events) * 0.3:
            preferred_times.append("evening")
        if sum(hour_counts.get(h, 0) for h in list(range(22, 24)) + list(range(0, 5))) > len(events) * 0.3:
            preferred_times.append("night")
        
        # Determine active days
        day_counts: dict[int, int] = defaultdict(int)
        for event in events:
            day_counts[event.timestamp.weekday()] += 1
        
        day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        active_days = [
            day_names[day] 
            for day, count in day_counts.items() 
            if count >= len(events) / 7 * 0.5
        ]
        
        # Calculate regularity
        if len(sessions) < 2:
            regularity = 0.5
        else:
            session_dates = sorted([s[0].timestamp.date() for s in sessions if s])
            gaps = [
                (session_dates[i+1] - session_dates[i]).days 
                for i in range(len(session_dates) - 1)
            ]
            if gaps:
                avg_gap = sum(gaps) / len(gaps)
                if avg_gap > 0:
                    variance = sum((g - avg_gap) ** 2 for g in gaps) / len(gaps)
                    cv = (variance ** 0.5) / avg_gap  # Coefficient of variation
                    regularity = max(0.0, min(1.0, 1.0 - cv))
                else:
                    regularity = 1.0
            else:
                regularity = 0.5
        
        return {
            "avg_sessions_per_week": round(sessions_per_week, 2),
            "avg_session_duration": int(avg_duration),
            "preferred_times": preferred_times or ["varied"],
            "active_days": active_days or ["varied"],
            "session_regularity": round(regularity, 2),
            "total_sessions": len(sessions),
        }
    
    def detect_pattern_change(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        baseline_window: timedelta,
        comparison_window: timedelta
    ) -> EstimatorResult[float]:
        """
        Detect if there's been a change in consistency pattern.
        """
        now = datetime.now(timezone.utc)
        
        # Get baseline events
        baseline_start = now - baseline_window - comparison_window
        baseline_end = now - comparison_window
        baseline_events = [
            e for e in events 
            if baseline_start <= e.timestamp < baseline_end
        ]
        
        # Get comparison events
        comparison_events = [
            e for e in events 
            if e.timestamp >= baseline_end
        ]
        
        if not baseline_events or not comparison_events:
            return self._fallback_result("Insufficient events for pattern change detection")
        
        # Calculate consistency for both periods
        baseline_result = self.analyze(user_id, baseline_events, baseline_window)
        comparison_result = self.analyze(user_id, comparison_events, comparison_window)
        
        # Calculate change magnitude
        change = comparison_result.value - baseline_result.value
        
        # Determine confidence based on event counts
        min_events = self.config.get_param("min_events_for_confidence", 7)
        confidence = min(
            1.0,
            min(len(baseline_events), len(comparison_events)) / max(min_events, 1)
        )
        
        # Build explanation
        if change > 0.2:
            explanation = f"Consistency improved significantly ({change:+.0%})"
        elif change > 0:
            explanation = f"Consistency slightly improved ({change:+.0%})"
        elif change > -0.2:
            explanation = f"Consistency slightly declined ({change:+.0%})"
        else:
            explanation = f"Consistency declined significantly ({change:+.0%})"
        
        return self._create_result(
            value=change,
            confidence=confidence,
            explanation=explanation,
            factors={
                "baseline_consistency": baseline_result.value,
                "current_consistency": comparison_result.value,
            },
            raw_inputs={
                "baseline_events": len(baseline_events),
                "comparison_events": len(comparison_events),
            }
        )
    
    def _group_into_sessions(
        self, 
        events: list[LearningEventData]
    ) -> list[list[LearningEventData]]:
        """Group events into logical sessions."""
        if not events:
            return []
        
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        sessions: list[list[LearningEventData]] = []
        current_session: list[LearningEventData] = [sorted_events[0]]
        
        # Events within 1 hour are considered same session
        session_gap_threshold = timedelta(hours=1)
        
        for i in range(1, len(sorted_events)):
            gap = sorted_events[i].timestamp - sorted_events[i-1].timestamp
            if gap > session_gap_threshold:
                sessions.append(current_session)
                current_session = [sorted_events[i]]
            else:
                current_session.append(sorted_events[i])
        
        sessions.append(current_session)
        return sessions
    
    def _calculate_frequency_factor(self, events: list[LearningEventData]) -> float:
        """Calculate consistency factor from session frequency."""
        sessions = self._group_into_sessions(events)
        
        if len(sessions) < 2:
            return 0.5
        
        # Calculate gaps between sessions
        session_dates = sorted([s[0].timestamp for s in sessions if s])
        gaps = [
            (session_dates[i+1] - session_dates[i]).days
            for i in range(len(session_dates) - 1)
        ]
        
        if not gaps:
            return 0.5
        
        # Calculate variance in gaps
        avg_gap = sum(gaps) / len(gaps)
        expected_gap = self.config.get_param("expected_session_gap_days", 2)
        
        if avg_gap == 0:
            return 1.0
        
        # Consistency is high if gaps are regular
        variance = sum((g - avg_gap) ** 2 for g in gaps) / len(gaps)
        std_dev = variance ** 0.5
        cv = std_dev / avg_gap  # Coefficient of variation
        
        max_cv = self.config.get_param("max_gap_variance_coefficient", 1.5)
        
        return max(0.0, min(1.0, 1.0 - cv / max_cv))
    
    def _calculate_duration_variance_factor(self, events: list[LearningEventData]) -> float:
        """Calculate consistency factor from session duration variance."""
        sessions = self._group_into_sessions(events)
        
        durations = [
            sum(e.duration_seconds or 0 for e in session)
            for session in sessions
            if any(e.duration_seconds for e in session)
        ]
        
        if len(durations) < 2:
            return 0.5
        
        avg = sum(durations) / len(durations)
        if avg == 0:
            return 0.5
        
        variance = sum((d - avg) ** 2 for d in durations) / len(durations)
        std_dev = variance ** 0.5
        cv = std_dev / avg
        
        # Lower CV = higher consistency
        return max(0.0, min(1.0, 1.0 - cv))
    
    def _calculate_time_pattern_factor(self, events: list[LearningEventData]) -> float:
        """Calculate consistency factor from time-of-day patterns."""
        if not events:
            return 0.5
        
        # Group events by hour
        hour_counts: dict[int, int] = defaultdict(int)
        for event in events:
            hour_counts[event.timestamp.hour] += 1
        
        # Calculate concentration (entropy-like measure)
        total = len(events)
        if total == 0:
            return 0.5
        
        # Higher concentration in fewer hours = higher consistency
        proportions = [count / total for count in hour_counts.values()]
        
        # Herfindahl-like index (sum of squared proportions)
        concentration = sum(p ** 2 for p in proportions)
        
        # 1/24 = uniform (0 consistency), 1 = all same hour (max consistency)
        normalized = (concentration - 1/24) / (1 - 1/24)
        
        return max(0.0, min(1.0, normalized))
    
    def _calculate_day_pattern_factor(self, events: list[LearningEventData]) -> float:
        """Calculate consistency factor from day-of-week patterns."""
        if not events:
            return 0.5
        
        # Group events by day of week
        day_counts: dict[int, int] = defaultdict(int)
        for event in events:
            day_counts[event.timestamp.weekday()] += 1
        
        # Calculate how many days per week are active
        active_days = sum(1 for count in day_counts.values() if count > 0)
        
        # Having 3-5 active days is most consistent
        if active_days in [3, 4, 5]:
            base_score = 1.0
        elif active_days in [2, 6]:
            base_score = 0.7
        elif active_days == 7:
            base_score = 0.5
        else:
            base_score = 0.3
        
        # Also check for regularity across weeks
        # (simplified: check if same days are used)
        weeks = defaultdict(lambda: defaultdict(int))
        for event in events:
            week_num = event.timestamp.isocalendar()[1]
            day = event.timestamp.weekday()
            weeks[week_num][day] += 1
        
        if len(weeks) >= 2:
            # Check day consistency across weeks
            week_days = [set(days.keys()) for days in weeks.values()]
            common_days = set.intersection(*week_days) if week_days else set()
            regularity = len(common_days) / 7
            return base_score * 0.7 + regularity * 0.3
        
        return base_score
    
    def _build_explanation(
        self,
        frequency_factor: float,
        duration_factor: float,
        time_factor: float,
        day_factor: float,
        consistency_score: float
    ) -> str:
        """Build human-readable explanation."""
        category = self.categorize(consistency_score)
        
        parts = [f"{category.replace('_', ' ').title()} learning pattern"]
        
        strengths = []
        weaknesses = []
        
        if frequency_factor >= 0.7:
            strengths.append("regular session frequency")
        elif frequency_factor <= 0.3:
            weaknesses.append("irregular session frequency")
        
        if duration_factor >= 0.7:
            strengths.append("consistent session durations")
        elif duration_factor <= 0.3:
            weaknesses.append("variable session durations")
        
        if time_factor >= 0.7:
            strengths.append("consistent study times")
        
        if day_factor >= 0.7:
            strengths.append("regular weekly schedule")
        
        if strengths:
            parts.append(f": {', '.join(strengths)}")
        elif weaknesses:
            parts.append(f": {', '.join(weaknesses)}")
        else:
            parts.append(": balanced across all factors")
        
        return "".join(parts) + "."

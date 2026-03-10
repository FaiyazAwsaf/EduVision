from django.contrib import admin
from .models import (
    CourseOutline,
    CourseWeek,
    CourseTopic,
    TopicProgress,
    TopicDifficultyFlag,
    TopicMaterial,
    TeacherNotification,
)


class CourseWeekInline(admin.TabularInline):
    model = CourseWeek
    extra = 0


class CourseTopicInline(admin.TabularInline):
    model = CourseTopic
    extra = 0
    fields = ("title", "week", "parent_topic", "order", "course_outcomes")


@admin.register(CourseOutline)
class CourseOutlineAdmin(admin.ModelAdmin):
    list_display = ("title", "course_code", "teaching_assignment", "parsing_status", "created_at")
    list_filter = ("parsing_status",)
    search_fields = ("title", "course_code")
    inlines = [CourseWeekInline]


@admin.register(CourseTopic)
class CourseTopicAdmin(admin.ModelAdmin):
    list_display = ("title", "course_outline", "week", "parent_topic", "order")
    list_filter = ("course_outline",)
    search_fields = ("title",)


@admin.register(TopicProgress)
class TopicProgressAdmin(admin.ModelAdmin):
    list_display = ("student", "topic", "status", "updated_at")
    list_filter = ("status",)


@admin.register(TopicDifficultyFlag)
class TopicDifficultyFlagAdmin(admin.ModelAdmin):
    list_display = ("student", "topic", "flagged_at", "resolved")
    list_filter = ("resolved",)


@admin.register(TopicMaterial)
class TopicMaterialAdmin(admin.ModelAdmin):
    list_display = ("title", "topic", "material_type", "uploaded_by", "created_at")
    list_filter = ("material_type",)


@admin.register(TeacherNotification)
class TeacherNotificationAdmin(admin.ModelAdmin):
    list_display = ("teacher", "topic", "percentage", "is_read", "created_at")
    list_filter = ("is_read", "notification_type")

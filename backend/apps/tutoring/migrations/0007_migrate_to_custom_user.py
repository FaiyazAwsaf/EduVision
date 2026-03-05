# Generated migration for consolidating user models
# This migration replaces TutoringUser with authentication.CustomUser

from django.db import migrations, models
import django.db.models.deletion


def migrate_session_users(apps, schema_editor):
    """
    Migrate TutoringSession teacher and student references from TutoringUser to CustomUser.
    
    Strategy:
    1. Delete sessions where teacher/student have no linked CustomUser account
    2. For remaining sessions, update teacher_id and student_id to point to CustomUser
    """
    TutoringSession = apps.get_model('tutoring', 'TutoringSession')
    TutoringUser = apps.get_model('tutoring', 'TutoringUser')
    
    # First, identify and delete sessions that can't be migrated
    sessions_to_delete = []
    
    for session in TutoringSession.objects.select_related('teacher', 'student').all():
        teacher_has_account = False
        student_has_account = True  # Assume true unless student exists
        
        try:
            tutoring_teacher = TutoringUser.objects.get(id=session.teacher_id)
            teacher_has_account = tutoring_teacher.account_id is not None
        except TutoringUser.DoesNotExist:
            pass
        
        if session.student_id:
            try:
                tutoring_student = TutoringUser.objects.get(id=session.student_id)
                student_has_account = tutoring_student.account_id is not None
            except TutoringUser.DoesNotExist:
                student_has_account = False
        
        # Mark for deletion if teacher or student has no linked account
        if not teacher_has_account or not student_has_account:
            sessions_to_delete.append(session.id)
    
    # Delete orphaned sessions
    if sessions_to_delete:
        deleted_count = TutoringSession.objects.filter(id__in=sessions_to_delete).delete()[0]
        print(f"Deleted {deleted_count} sessions with no linked authentication accounts")
    
    # Now migrate remaining sessions
    for session in TutoringSession.objects.select_related('teacher', 'student').all():
        try:
            # Update teacher reference
            tutoring_teacher = TutoringUser.objects.get(id=session.teacher_id)
            session.teacher_id = tutoring_teacher.account_id
            
            # Update student reference if exists
            if session.student_id:
                tutoring_student = TutoringUser.objects.get(id=session.student_id)
                session.student_id = tutoring_student.account_id
            
            session.save(update_fields=['teacher_id', 'student_id'])
            print(f"Migrated session {session.id}")
            
        except TutoringUser.DoesNotExist as e:
            print(f"Error migrating session {session.id}: {e}")


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0002_change_is_active_default'),
        ('tutoring', '0006_add_account_link_to_tutoring_user'),
    ]

    operations = [
        # Step 1: Run data migration to clean up and update existing session records
        migrations.RunPython(migrate_session_users, reverse_code=migrations.RunPython.noop),
        
        # Step 2: Update TutoringSession.teacher to point to CustomUser
        migrations.AlterField(
            model_name='tutoringsession',
            name='teacher',
            field=models.ForeignKey(
                help_text='Teacher who owns this session',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='teacher_sessions',
                to='authentication.customuser'
            ),
        ),
        # Step 3: Update TutoringSession.student to point to CustomUser
        migrations.AlterField(
            model_name='tutoringsession',
            name='student',
            field=models.ForeignKey(
                blank=True,
                help_text='Student who joined this session (null if no student yet)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='student_sessions',
                to='authentication.customuser'
            ),
        ),
        # Step 4: Delete TutoringUser model (drops the tutoring_users table)
        migrations.DeleteModel(
            name='TutoringUser',
        ),
    ]

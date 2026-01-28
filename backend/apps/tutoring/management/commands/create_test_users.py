"""
Management command to create test users for tutoring module.
"""

from django.core.management.base import BaseCommand
from apps.tutoring.models import TutoringUser, UserRole


class Command(BaseCommand):
    help = 'Create test users for the tutoring module'

    def handle(self, *args, **options):
        test_users = [
            {
                'email': 'teacher1@test.com',
                'full_name': 'Dr. John Smith',
                'role': UserRole.TEACHER,
            },
            {
                'email': 'teacher2@test.com',
                'full_name': 'Prof. Jane Doe',
                'role': UserRole.TEACHER,
            },
            {
                'email': 'student1@test.com',
                'full_name': 'Alice Johnson',
                'role': UserRole.STUDENT,
            },
            {
                'email': 'student2@test.com',
                'full_name': 'Bob Williams',
                'role': UserRole.STUDENT,
            },
            {
                'email': 'student3@test.com',
                'full_name': 'Charlie Brown',
                'role': UserRole.STUDENT,
            },
        ]

        created_count = 0
        for user_data in test_users:
            user, created = TutoringUser.objects.get_or_create(
                email=user_data['email'],
                defaults={
                    'full_name': user_data['full_name'],
                    'role': user_data['role'],
                }
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Created {user_data['role']}: {user_data['full_name']} ({user.id})"
                    )
                )
            else:
                self.stdout.write(
                    f"Already exists: {user_data['full_name']} ({user.id})"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone! Created {created_count} new users."
            )
        )
        
        # List all users
        self.stdout.write("\nAll test users:")
        for user in TutoringUser.objects.all():
            self.stdout.write(f"  - {user.full_name} ({user.role}): {user.id}")

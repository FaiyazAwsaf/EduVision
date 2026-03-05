"""
Management command to create test users for tutoring module.
Now uses authentication.CustomUser instead of TutoringUser.
"""

from django.core.management.base import BaseCommand
from apps.authentication.models import CustomUser


class Command(BaseCommand):
    help = 'Create test users for the tutoring module'

    def handle(self, *args, **options):
        test_users = [
            {
                'email': 'teacher1@test.com',
                'first_name': 'John',
                'last_name': 'Smith',
                'role': 'teacher',
            },
            {
                'email': 'teacher2@test.com',
                'first_name': 'Jane',
                'last_name': 'Doe',
                'role': 'teacher',
            },
            {
                'email': 'student1@test.com',
                'first_name': 'Alice',
                'last_name': 'Johnson',
                'role': 'student',
            },
            {
                'email': 'student2@test.com',
                'first_name': 'Bob',
                'last_name': 'Williams',
                'role': 'student',
            },
            {
                'email': 'student3@test.com',
                'first_name': 'Charlie',
                'last_name': 'Brown',
                'role': 'student',
            },
        ]

        created_count = 0
        for user_data in test_users:
            user, created = CustomUser.objects.get_or_create(
                email=user_data['email'],
                defaults={
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'role': user_data['role'],
                    'is_active': True,
                }
            )
            if created:
                # Set a default password for test users
                user.set_password('password123')
                user.save()
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Created {user_data['role']}: {user_data['first_name']} {user_data['last_name']} ({user.id})"
                    )
                )
            else:
                self.stdout.write(
                    f"Already exists: {user_data['first_name']} {user_data['last_name']} ({user.id})"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone! Created {created_count} new users."
            )
        )
        
        # List all users
        self.stdout.write("\nAll test users:")
        for user in CustomUser.objects.all():
            self.stdout.write(f"  - {user.first_name} {user.last_name} ({user.role}): {user.id}")


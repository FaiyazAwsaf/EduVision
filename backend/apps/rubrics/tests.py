from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.rubrics.models import Rubric
import uuid

User = get_user_model()


class RubricAPITestCase(TestCase):
    """Test cases for Rubric API endpoints."""
    
    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        # Create a test user
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Sample rubric data
        self.rubric_data = {
            'title': 'Test Rubric',
            'subject': 'Mathematics',
            'question_text': 'What is 2+2?',
            'reference_answer': '4',
            'total_marks': 10.0,
            'evaluation_rules': [
                {
                    'type': 'numeric',
                    'marks': 10.0,
                    'config': {
                        'expected_value': 4.0,
                        'tolerance': 0.1
                    },
                    'feedback': {
                        'on_success': 'Correct answer!',
                        'on_failure': 'Incorrect answer',
                        'on_partial': None
                    }
                }
            ]
        }
    
    def test_create_rubric(self):
        """Test creating a new draft rubric."""
        response = self.client.post('/api/rubrics/', self.rubric_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['state'], 'draft')
        self.assertEqual(response.data['title'], 'Test Rubric')
    
    def test_list_rubrics(self):
        """Test listing rubrics filtered by current user."""
        # Create a rubric
        rubric = Rubric.objects.create(
            title='Test Rubric',
            subject='Math',
            question_text='Test question',
            reference_answer='Test answer',
            total_marks=10.0,
            evaluation_rules=[],
            created_by=self.user.id
        )
        
        response = self.client.get('/api/rubrics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
    
    def test_retrieve_rubric(self):
        """Test retrieving a specific rubric."""
        rubric = Rubric.objects.create(
            title='Test Rubric',
            subject='Math',
            question_text='Test question',
            reference_answer='Test answer',
            total_marks=10.0,
            evaluation_rules=[],
            created_by=self.user.id
        )
        
        response = self.client.get(f'/api/rubrics/{rubric.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Rubric')
    
    def test_update_draft_rubric(self):
        """Test updating a draft rubric."""
        rubric = Rubric.objects.create(
            title='Test Rubric',
            subject='Math',
            question_text='Test question',
            reference_answer='Test answer',
            total_marks=10.0,
            evaluation_rules=[],
            created_by=self.user.id,
            state='draft'
        )
        
        update_data = self.rubric_data.copy()
        update_data['title'] = 'Updated Rubric'
        
        response = self.client.put(f'/api/rubrics/{rubric.id}/', update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated Rubric')
    
    def test_cannot_update_published_rubric(self):
        """Test that published rubrics cannot be updated."""
        rubric = Rubric.objects.create(
            title='Test Rubric',
            subject='Math',
            question_text='Test question',
            reference_answer='Test answer',
            total_marks=10.0,
            evaluation_rules=[],
            created_by=self.user.id,
            state='published'
        )
        
        update_data = self.rubric_data.copy()
        update_data['title'] = 'Updated Rubric'
        
        response = self.client.put(f'/api/rubrics/{rubric.id}/', update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_publish_rubric(self):
        """Test publishing a draft rubric."""
        rubric = Rubric.objects.create(
            title='Test Rubric',
            subject='Math',
            question_text='Test question',
            reference_answer='Test answer',
            total_marks=10.0,
            evaluation_rules=[],
            created_by=self.user.id,
            state='draft'
        )
        
        response = self.client.post(f'/api/rubrics/{rubric.id}/publish/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'published')

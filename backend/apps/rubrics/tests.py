from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.rubrics.models import Rubric
import uuid


class RubricAPITestCase(TestCase):
    """Test cases for Rubric API endpoints."""
    
    def setUp(self):
        """Set up test client."""
        self.client = APIClient()
        
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
        """Test listing rubrics."""
        # Create a rubric via API
        self.client.post('/api/rubrics/', self.rubric_data, format='json')
        
        response = self.client.get('/api/rubrics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
    
    def test_retrieve_rubric(self):
        """Test retrieving a specific rubric."""
        # Create rubric via API
        create_response = self.client.post('/api/rubrics/', self.rubric_data, format='json')
        rubric_id = create_response.data['id']
        
        response = self.client.get(f'/api/rubrics/{rubric_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Rubric')
    
    def test_update_draft_rubric(self):
        """Test updating a draft rubric."""
        # Create rubric via API
        create_response = self.client.post('/api/rubrics/', self.rubric_data, format='json')
        rubric_id = create_response.data['id']
        
        update_data = self.rubric_data.copy()
        update_data['title'] = 'Updated Rubric'
        
        response = self.client.put(f'/api/rubrics/{rubric_id}/', update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated Rubric')
    
    def test_cannot_update_published_rubric(self):
        """Test that published rubrics cannot be updated."""
        # Create and publish rubric via API
        create_response = self.client.post('/api/rubrics/', self.rubric_data, format='json')
        rubric_id = create_response.data['id']
        
        # Publish the rubric
        self.client.post(f'/api/rubrics/{rubric_id}/publish/')
        
        update_data = self.rubric_data.copy()
        update_data['title'] = 'Updated Rubric'
        
        response = self.client.put(f'/api/rubrics/{rubric_id}/', update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_publish_rubric(self):
        """Test publishing a draft rubric."""
        # Create rubric via API
        create_response = self.client.post('/api/rubrics/', self.rubric_data, format='json')
        rubric_id = create_response.data['id']
        initial_version = create_response.data['version']
        
        response = self.client.post(f'/api/rubrics/{rubric_id}/publish/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['state'], 'published')
        self.assertEqual(response.data['version'], initial_version + 1)
        
        # Verify version snapshot was created
        rubric = Rubric.objects.get(id=rubric_id)
        self.assertEqual(rubric.versions.count(), 1)
        version = rubric.versions.first()
        self.assertEqual(version.version_number, rubric.version)
    
    def test_cannot_publish_with_mismatched_marks(self):
        """Test that rubrics with mismatched rule marks cannot be published."""
        # Create rubric with mismatched marks via API
        mismatched_data = self.rubric_data.copy()
        mismatched_data['evaluation_rules'] = [
            {
                'type': 'numeric',
                'marks': 5.0,  # Only 5 marks, but total is 10
                'config': {
                    'expected_value': 4.0,
                    'tolerance': 0.1
                },
                'feedback': {
                    'on_success': 'Correct',
                    'on_failure': 'Incorrect',
                    'on_partial': None
                }
            }
        ]
        create_response = self.client.post('/api/rubrics/', mismatched_data, format='json')
        rubric_id = create_response.data['id']
        
        response = self.client.post(f'/api/rubrics/{rubric_id}/publish/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('must equal total marks', response.data['detail'])
    
    def test_cannot_publish_without_rules(self):
        """Test that rubrics without evaluation rules cannot be published."""
        # Note: Cannot create rubric without rules via API due to validation
        # So we create it directly and test the publish endpoint
        rubric = Rubric.objects.create(
            title='Test Rubric',
            subject='Math',
            question_text='Test question',
            reference_answer='Test answer',
            total_marks=10.0,
            evaluation_rules=[],
            state='draft'
        )
        
        response = self.client.post(f'/api/rubrics/{rubric.id}/publish/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('evaluation rule is required', response.data['detail'])

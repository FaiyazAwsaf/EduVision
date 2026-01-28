from django.urls import path
from . import views

app_name = 'whiteboard'

urlpatterns = [
    path('convert/', views.convert_to_latex, name="convert-to-latex")
]
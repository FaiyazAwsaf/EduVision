from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import CustomUser

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    def create(self, payload):
        user = CustomUser.objects.create_user(
            username = payload["username"],
            email = payload["email"],
            password = payload["password"],
        )
        return user

    class Meta:
        model = CustomUser
        fields = ["username", "email", "password"]

class LoginSerializer(serializers.ModelSerializer):
    email = serializers.CharField()
    password = serializers.CharField()

    def validate(self, payload):
        user = authenticate(
            username = payload["username"],
            password = payload["password"],
        )

        if not user:
            raise serializers.ValidationError("Invalid credentials")
        
        payload["user"] = user
        return payload
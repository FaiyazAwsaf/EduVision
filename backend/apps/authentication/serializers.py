from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import CustomUser, EmailOTP

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=30)
    last_name = serializers.CharField(max_length=30)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"passsword": "Passwords do not match"})
        return attrs

    def create(self, payload):

        payload.pop("password_confirm")
        password = payload.pop("password")
        user = CustomUser(**payload)
        user.set_password(password)
        user.save()

        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password")
        
        if not user.verify_password(password):
            raise serializers.ValidationError("Invalid email or password")
        
        if not user.is_active:
            raise serializers.ValidationError("User account is not active")
        
        attrs["user"] = user
        return attrs
    
class SendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, email):
        try:
            CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("User with this email does not exist")
        return email
    
class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)

    def validate(self, attrs):
        email = attrs.get("email")
        code = attrs.get("code")

        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("User not found")

        email_otp = EmailOTP.objects.filter(user=user, otp=code).order_by("-created_at").first()

        if not email_otp or email_otp.is_valid():
            raise serializers.ValidationError("Invalid OTP")
        
        attrs["user"] = user
        attrs["email_otp"] = email_otp

        return attrs
        

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "first_name", "last_name", "is_active", "role", "date_joined"]
        read_only_fields = ["id", "date_joined"]
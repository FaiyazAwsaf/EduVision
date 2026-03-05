"""
Custom JWT Authentication for DRF.

Overrides simplejwt's JWTAuthentication to resolve users from
the CustomUser model (which is a plain models.Model, not AbstractUser)
instead of Django's default auth.User.
"""
import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

from apps.authentication.models import CustomUser

logger = logging.getLogger(__name__)


class CustomUserJWTAuthentication(JWTAuthentication):
    """
    JWT authentication backend that resolves tokens to CustomUser instances.
    """

    def get_user(self, validated_token):
        """
        Look up CustomUser by the user_id claim in the JWT payload.
        """
        try:
            user_id = validated_token.get("user_id")
            if user_id is None:
                raise InvalidToken("Token contained no recognizable user identification")

            user = CustomUser.objects.get(id=user_id)

            if not user.is_active:
                raise AuthenticationFailed("User is inactive")

            return user

        except CustomUser.DoesNotExist:
            raise AuthenticationFailed("User not found")
        except Exception as e:
            logger.error(f"JWT user lookup failed: {e}")
            raise AuthenticationFailed("Authentication failed")

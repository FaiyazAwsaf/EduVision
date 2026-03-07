from rest_framework import serializers
from .models import WhiteboardSession, SessionMember, WhiteboardState
from backend.apps.authentication.models import CustomUser

class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "role"]
        read_only_fields = fields

class SessionMemberSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = SessionMember
        fields = ["id", "user", "user_id", "role", "joined_at", "last_active_at"]
        read_only_fields = ["id", "joined_at", "last_active_at"]

class WhiteboardStateSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = WhiteboardState
        fields = ["id", "version", "snapshot_json", "latex_objects", "created_by", "created_at", "description"]
        read_only_fields = ["id", "version", "created_by", "created_at"]

class WhiteboardStateCreateSerializer(serializers.Serializer):
    snapshot_json = serializers.JSONField()
    latex_objects = serializers.ListField(child=serializers.JSONField(), default=list, required=False)
    description = serializers.CharField(max_length=255, required=False, allow_blank=True)
    client_version = serializers.IntegerField(required=False)

class WhiteboardSessionSerializer(serializers.ModelSerializer):
    owner = UserSummarySerializer(read_only=True)
    members = SessionMemberSerializer(many=True, read_only=True)

    class Meta:
        model = WhiteboardSession
        fields = ['id', 'name', 'owner', 'created_at', 'updated_at', 'is_active', 'metadata', 'members']
        read_only_fields = ['id', 'created_at', 'updated_at', 'owner', 'members']

    def create(self, validated_data):
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)
    
class WhiteboardSessionDetailSerializer(WhiteboardSessionSerializer):
    latest_state = serializers.SerializerMethodField()

    class Meta(WhiteboardSessionSerializer.Meta):
        fields = WhiteboardSessionSerializer.Meta.fields + ['latest_state']
        read_only_fields = WhiteboardSessionSerializer.Meta.read_only_fields + ['latest_state']

    def get_latest_state(self, obj):
        latest = WhiteboardState.objects.filter(session=obj).order_by('-version').first()
        if latest:
            return WhiteboardStateSerializer(latest).data
        return None
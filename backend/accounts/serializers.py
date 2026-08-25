from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password_confirm', 'role']

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        # Users can only register as USER or PRACTITIONER
        if attrs.get('role') not in [User.Role.USER, User.Role.PRACTITIONER, None]:
            raise serializers.ValidationError({"role": "You can only register as a User or Practitioner."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        if 'role' not in validated_data or not validated_data['role']:
            validated_data['role'] = User.Role.USER
        user = User.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'bio', 'phone', 'avatar', 'is_active', 'date_joined']
        read_only_fields = ['id', 'username', 'role', 'date_joined', 'is_active']


class UserAdminSerializer(serializers.ModelSerializer):
    """Serializer for admin user management."""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'bio', 'phone', 'is_active', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

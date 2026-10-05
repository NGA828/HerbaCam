from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class UserLoginTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        password = attrs.get('password')
        if username and password:
            try:
                user = get_user_model()._default_manager.get_by_natural_key(username)
            except get_user_model().DoesNotExist:
                user = None
            if user and not user.is_active and user.check_password(password):
                reason = user.deactivation_reason.strip()
                message = 'This account has been deactivated.'
                if reason:
                    message += f' Reason: {reason}'
                raise AuthenticationFailed(message)
        return super().validate(attrs)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password_confirm', 'role']

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        # ADMIN never comes from a form. The diagram's patient, practitioner and
        # specialized expert all sign themselves up; a new specialist starts
        # unverified (see consultations.ExpertProfile) and only an administrator
        # can change that, so the trust decision stays where it was.
        if attrs.get('role') not in [User.Role.USER, User.Role.PRACTITIONER,
                                     User.Role.EXPERT, None]:
            raise serializers.ValidationError(
                {"role": "Register as a User, a Practitioner or a specialized Expert."})
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
                  'bio', 'phone', 'avatar', 'is_active', 'deactivation_reason',
                  'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.is_active and attrs.get('is_active') is False:
            reason = attrs.get('deactivation_reason', '').strip()
            if not reason:
                raise serializers.ValidationError({
                    'deactivation_reason': 'Provide a reason before deactivating this account.'
                })
            attrs['deactivation_reason'] = reason
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

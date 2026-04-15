from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'date_joined']
        read_only_fields = ['date_joined']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'role']

    def create(self, validated_data):
        # If user is asking for ADMIN rights, they must be manually approved (activated)
        requested_role = validated_data.get('role', 'USER')
        user = User.objects.create_user(**validated_data)
        if requested_role == 'ADMIN':
            user.is_active = False
            user.save()
        return user

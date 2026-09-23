"""Views for the conversational assistant ("chat with AI")."""
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import ChatMessage, ChatSession
from .serializers import (
    AskSerializer,
    ChatMessageSerializer,
    ChatSessionSerializer,
)
from .services import answer


class ChatRateThrottle(UserRateThrottle):
    """Chat is a model call, so it gets its own budget like identification."""

    scope = 'ai_chat'


class ChatSessionListCreate(generics.ListCreateAPIView):
    """The caller's conversations, newest activity first."""

    serializer_class = ChatSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            ChatSession.objects.filter(user=self.request.user)
            .annotate(message_count=Count('messages'))
            .order_by('-updated_at')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ChatSessionDetail(generics.RetrieveDestroyAPIView):
    """One conversation's metadata. Delete it and every turn goes with it."""

    serializer_class = ChatSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Read and delete only — a transcript is not a mutable record.
    http_method_names = ['get', 'head', 'options', 'delete']

    def get_queryset(self):
        return (
            ChatSession.objects.filter(user=self.request.user)
            .annotate(message_count=Count('messages'))
        )


class ChatSessionArchive(generics.UpdateAPIView):
    """Hide a conversation from the list without destroying the record."""

    serializer_class = ChatSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['patch']

    def get_queryset(self):
        return ChatSession.objects.filter(user=self.request.user)


class ChatSessionMessages(generics.ListAPIView):
    """Full transcript of one conversation, oldest first."""

    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        session = self._session()
        return session.messages.all()[:200]

    def _session(self):
        session = get_object_or_404(
            ChatSession, pk=self.kwargs['pk'], user=self.request.user,
        )
        return session


class AskView(APIView):
    """Post one turn. The reply is generated and both sides are persisted."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ChatRateThrottle]

    def post(self, request):
        serializer = AskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.validated_data['message'].strip()
        if not message:
            raise ValidationError({'message': 'Please type a question first.'})

        session_id = serializer.validated_data.get('session')
        created_here = False
        if session_id:
            session = ChatSession.objects.filter(pk=session_id, user=request.user).first()
            if session is None:
                raise PermissionDenied('That conversation is not yours.')
        else:
            session = ChatSession.objects.create(user=request.user, title=message[:80])
            created_here = True

        user_turn = ChatMessage.objects.create(
            session=session, role=ChatMessage.Role.USER, content=message,
        )

        result = answer(message, history=list(session.messages.exclude(pk=user_turn.pk)))
        if not result.get('success'):
            # Roll back only what this request added. A failure must not wipe
            # an existing conversation, so the session is deleted solely when
            # it was created moments ago.
            user_turn.delete()
            if created_here:
                session.delete()
            return Response({'error': result.get('error', 'The assistant could not reply.')},
                            status.HTTP_502_BAD_GATEWAY)

        assistant_turn = ChatMessage.objects.create(
            session=session, role=ChatMessage.Role.ASSISTANT,
            content=result['answer'], cited_plant_ids=result.get('cited_plant_ids', []),
        )
        # Touch updated_at so the session bubbles up the list.
        session.save(update_fields=['updated_at'])

        from audit.services import log_action
        log_action(request.user, 'AI_CHAT', 'Asked the assistant a question',
                   target_type='ChatSession', target_id=session.id)

        return Response({
            'session': ChatSessionSerializer(session).data,
            'user_message': ChatMessageSerializer(user_turn).data,
            'reply': ChatMessageSerializer(assistant_turn).data,
            'grounded': bool(result.get('cited_plant_ids')),
        }, status.HTTP_201_CREATED)

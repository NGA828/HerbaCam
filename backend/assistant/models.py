"""Grounded conversational assistant — the ANCESTOR use case ``chat with AI``.

Lives apart from :mod:`identification` on purpose. That app does one-shot
vision classification with a JSON contract; this one is a multi-turn text
conversation that answers questions about the plants already documented in the
database, and cites them. The AI never reaches the database itself: Django
assembles a small context block from verified records and hands it over as
prompt text.
"""
from django.conf import settings
from django.db import models


class ChatSession(models.Model):
    """One running conversation belonging to one user."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='chat_sessions')
    title = models.CharField(max_length=255, blank=True, default='')
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.title or "Untitled"} — {self.user.username}'

    @property
    def display_title(self):
        """Fall back to the first question so a session is always labelable."""
        if self.title:
            return self.title
        first_question = self.messages.filter(role='USER').first()
        if not first_question:
            return 'New conversation'
        text = first_question.content.strip()
        return text if len(text) <= 60 else text[:60] + '…'


class ChatMessage(models.Model):
    """A single turn. Only these two roles exist — the assistant never
    relays a user-authored line as its own, and there is no system turn
    stored because the system prompt is rebuilt per request."""

    class Role(models.TextChoices):
        USER = 'USER', 'User'
        ASSISTANT = 'ASSISTANT', 'Assistant'

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=9, choices=Role.choices)
    content = models.TextField()
    # Plant ids the answer was grounded in, so the UI can link out to them.
    cited_plant_ids = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.role}: {self.content[:40]}'

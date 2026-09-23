"""Keep a profile row in step with the EXPERT role.

Wired here rather than in a view, so a specialist created through the Django
admin, a promotion, registration or the seeder all end up with a profile.
"""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ExpertProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_expert_profile(sender, instance, **kwargs):
    if instance.is_expert:
        ExpertProfile.objects.get_or_create(user=instance)

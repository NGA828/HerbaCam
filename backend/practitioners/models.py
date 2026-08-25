from django.db import models
from django.conf import settings
from geography.models import Region


class PractitionerProfile(models.Model):
    """Profile for traditional medicine practitioners."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                 related_name='practitioner_profile')
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True)
    community_name = models.CharField(max_length=255, blank=True, default='')
    years_of_experience = models.PositiveIntegerField(default=0)
    areas_of_knowledge = models.TextField(blank=True, default='',
                                           help_text='Areas of traditional medicine expertise')
    traditional_training = models.TextField(blank=True, default='',
                                             help_text='How they learned traditional medicine')
    is_verified = models.BooleanField(default=False,
                                       help_text='Verified by admin as legitimate practitioner')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Practitioner: {self.user.get_full_name() or self.user.username}"

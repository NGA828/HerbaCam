"""App feedback ("Send feedback").

Distinct from :class:`identification.models.IdentificationReport`, which is a
correction on one specific AI result. This is general product feedback that an
administrator triages and answers.
"""
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Feedback(models.Model):
    class Category(models.TextChoices):
        BUG = 'BUG', 'Bug or defect'
        SUGGESTION = 'SUGGESTION', 'Improvement idea'
        CONTENT = 'CONTENT', 'Content or knowledge correction'
        DATA = 'DATA', 'Missing plant or region data'
        OTHER = 'OTHER', 'Something else'

    class Status(models.TextChoices):
        NEW = 'NEW', 'New'
        IN_REVIEW = 'IN_REVIEW', 'In review'
        RESOLVED = 'RESOLVED', 'Resolved'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='feedback')
    category = models.CharField(max_length=12, choices=Category.choices,
                                 default=Category.OTHER)
    message = models.TextField(max_length=4000)
    rating = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Optional 1-5 satisfaction rating.',
    )
    page = models.CharField(max_length=255, blank=True, default='',
                            help_text='Path the user was on when they sent it.')
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW)
    admin_response = models.TextField(blank=True, default='')
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'feedback'

    def __str__(self):
        return f'{self.category} from {self.user.username}: {self.message[:40]}'

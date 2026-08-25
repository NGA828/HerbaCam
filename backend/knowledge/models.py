from django.db import models
from django.conf import settings
from plants.models import Plant, PlantPart
from symptoms.models import Symptom
from geography.models import Region, Community


class PreparationMethod(models.Model):
    """Methods of preparing traditional medicines."""

    class MethodType(models.TextChoices):
        DECOCTION = 'DECOCTION', 'Decoction (Boiling)'
        INFUSION = 'INFUSION', 'Infusion (Steeping)'
        POULTICE = 'POULTICE', 'Poultice'
        POWDER = 'POWDER', 'Powder'
        JUICE = 'JUICE', 'Fresh Juice/Extract'
        OINTMENT = 'OINTMENT', 'Ointment/Salve'
        TINCTURE = 'TINCTURE', 'Tincture'
        SMOKE = 'SMOKE', 'Smoking/Inhalation'
        BATH = 'BATH', 'Medicinal Bath'
        RAW = 'RAW', 'Raw Consumption'
        OTHER = 'OTHER', 'Other'

    name = models.CharField(max_length=20, choices=MethodType.choices, unique=True)
    description = models.TextField(blank=True, default='')

    def __str__(self):
        return self.get_name_display()


class TraditionalUse(models.Model):
    """Documented traditional uses of plants."""
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='traditional_uses')
    symptom = models.ForeignKey(Symptom, on_delete=models.CASCADE, related_name='traditional_uses')
    plant_part = models.ForeignKey(PlantPart, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='traditional_uses')
    preparation = models.ForeignKey(PreparationMethod, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='traditional_uses')
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='traditional_uses')
    community = models.ForeignKey(Community, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='traditional_uses')
    description = models.TextField(help_text='Detailed description of the traditional use')
    cultural_context = models.TextField(blank=True, default='',
                                         help_text='Cultural or ceremonial context')
    is_verified = models.BooleanField(default=False, help_text='Verified by expert reviewer')
    source = models.CharField(max_length=255, blank=True, default='',
                               help_text='Source of this knowledge (contributor, publication, etc.)')
    contributor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='traditional_uses_contributed')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='traditional_uses_verified')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.plant.scientific_name} - {self.symptom.name}"


class KnowledgeSubmission(models.Model):
    """Knowledge submitted by practitioners for review."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        PUBLISHED = 'PUBLISHED', 'Published'
        REJECTED = 'REJECTED', 'Rejected'
        REVISION_REQUESTED = 'REVISION_REQUESTED', 'Revision Requested'

    # Contributor
    contributor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                     related_name='knowledge_submissions')

    # Status
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    # Knowledge content
    plant = models.ForeignKey(Plant, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='knowledge_submissions')
    proposed_scientific_name = models.CharField(max_length=255, blank=True, default='',
                                                  help_text='If plant not in database')
    proposed_common_name = models.CharField(max_length=255, blank=True, default='')
    local_name = models.CharField(max_length=255, blank=True, default='')
    language = models.CharField(max_length=100, blank=True, default='')
    symptom = models.ForeignKey(Symptom, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='knowledge_submissions')
    proposed_symptom_name = models.CharField(max_length=255, blank=True, default='',
                                               help_text='If symptom not in database')
    plant_part = models.CharField(max_length=50, blank=True, default='')
    preparation_method = models.CharField(max_length=100, blank=True, default='')
    traditional_use_description = models.TextField(
        help_text='Detailed description of the traditional use')
    cultural_context = models.TextField(blank=True, default='')
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True)
    community = models.ForeignKey(Community, on_delete=models.SET_NULL, null=True, blank=True)
    community_name = models.CharField(max_length=255, blank=True, default='',
                                       help_text='If community not in database')
    supporting_information = models.TextField(blank=True, default='',
                                               help_text='Sources, context, or supporting details')

    # Review
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                  null=True, blank=True, related_name='knowledge_reviews')
    review_comments = models.TextField(blank=True, default='')
    review_reason = models.TextField(blank=True, default='',
                                      help_text='Reason for approval/rejection')
    review_date = models.DateTimeField(null=True, blank=True)

    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Submission #{self.pk} by {self.contributor.username} ({self.status})"

"""
Preservation Risk Calculation Service.

This service calculates risk scores for traditional knowledge preservation.
The risk score is an ANALYTICAL INDICATOR, not a scientific prediction.

Risk Factors (each scored 0-20, total 0-100):
1. Contributor Scarcity - How few unique contributors exist
2. Knowledge Recency - How long since last contribution  
3. Geographic Concentration - How concentrated knowledge is in few regions
4. Documentation Scarcity - How few documented traditional uses exist
5. Submission Decline - Whether new submissions are decreasing

Thresholds:
- LOW: 0-33
- MODERATE: 34-66  
- HIGH: 67-100
"""
import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.db.models import Count, Max, Q
from plants.models import Plant
from knowledge.models import TraditionalUse, KnowledgeSubmission
from geography.models import Region
from preservation.models import RiskAssessment

logger = logging.getLogger(__name__)


def calculate_plant_risk(plant):
    """
    Calculate preservation risk for a specific plant.
    
    Higher risk = less documented / more vulnerable knowledge.
    """
    now = timezone.now()
    
    # Gather statistics
    traditional_uses = TraditionalUse.objects.filter(plant=plant)
    submissions = KnowledgeSubmission.objects.filter(plant=plant)
    
    total_uses = traditional_uses.count()
    total_submissions = submissions.count()
    
    # Unique contributors
    contributors = set()
    for use in traditional_uses.filter(contributor__isnull=False):
        contributors.add(use.contributor_id)
    for sub in submissions:
        contributors.add(sub.contributor_id)
    num_contributors = len(contributors)
    
    # Days since last contribution
    last_use = traditional_uses.aggregate(latest=Max('created_at'))['latest']
    last_sub = submissions.aggregate(latest=Max('created_at'))['latest']
    
    last_contribution = None
    if last_use and last_sub:
        last_contribution = max(last_use, last_sub)
    elif last_use:
        last_contribution = last_use
    elif last_sub:
        last_contribution = last_sub
    
    days_since = 365  # Default high risk if no contributions
    if last_contribution:
        days_since = (now - last_contribution).days
    
    # Unique regions
    regions = set()
    for use in traditional_uses.filter(region__isnull=False):
        regions.add(use.region_id)
    num_regions = len(regions)
    
    # Calculate component scores
    
    # 1. Contributor Scarcity (0-20)
    # Fewer contributors = higher risk
    if num_contributors == 0:
        contributor_score = 20
    elif num_contributors == 1:
        contributor_score = 16
    elif num_contributors <= 3:
        contributor_score = 12
    elif num_contributors <= 5:
        contributor_score = 8
    elif num_contributors <= 10:
        contributor_score = 4
    else:
        contributor_score = 0
    
    # 2. Knowledge Recency (0-20)
    # Older contributions = higher risk
    if days_since > 365:
        recency_score = 20
    elif days_since > 180:
        recency_score = 16
    elif days_since > 90:
        recency_score = 12
    elif days_since > 30:
        recency_score = 8
    elif days_since > 7:
        recency_score = 4
    else:
        recency_score = 0
    
    # 3. Geographic Concentration (0-20)
    # More concentrated = higher risk
    if num_regions == 0:
        geo_score = 20
    elif num_regions == 1:
        geo_score = 16
    elif num_regions == 2:
        geo_score = 10
    elif num_regions <= 4:
        geo_score = 6
    else:
        geo_score = 0
    
    # 4. Documentation Scarcity (0-20)
    # Fewer documented uses = higher risk
    if total_uses == 0:
        doc_score = 20
    elif total_uses <= 2:
        doc_score = 16
    elif total_uses <= 5:
        doc_score = 10
    elif total_uses <= 10:
        doc_score = 6
    else:
        doc_score = 0
    
    # 5. Submission Decline (0-20)
    # Compare recent submissions vs older period
    recent_period = now - timedelta(days=90)
    older_period = now - timedelta(days=180)
    
    recent_count = submissions.filter(created_at__gte=recent_period).count()
    older_count = submissions.filter(created_at__gte=older_period, created_at__lt=recent_period).count()
    
    if total_submissions == 0:
        decline_score = 15  # Moderate risk if no submissions at all
    elif recent_count == 0 and older_count > 0:
        decline_score = 20  # High risk if submissions stopped
    elif recent_count < older_count and older_count > 0:
        ratio = recent_count / older_count
        decline_score = int(15 * (1 - ratio))
    else:
        decline_score = 0
    
    # Total risk score
    risk_score = contributor_score + recency_score + geo_score + doc_score + decline_score
    risk_score = min(100, max(0, risk_score))
    
    # Determine risk level
    thresholds = settings.RISK_THRESHOLDS
    if risk_score >= thresholds['HIGH'][0]:
        risk_level = RiskAssessment.RiskLevel.HIGH
    elif risk_score >= thresholds['MODERATE'][0]:
        risk_level = RiskAssessment.RiskLevel.MODERATE
    else:
        risk_level = RiskAssessment.RiskLevel.LOW
    
    # Create or update risk assessment
    assessment, created = RiskAssessment.objects.update_or_create(
        plant=plant,
        defaults={
            'risk_score': risk_score,
            'risk_level': risk_level,
            'contributor_scarcity_score': contributor_score,
            'knowledge_recency_score': recency_score,
            'geographic_concentration_score': geo_score,
            'documentation_scarcity_score': doc_score,
            'submission_decline_score': decline_score,
            'total_contributors': num_contributors,
            'total_traditional_uses': total_uses,
            'days_since_last_contribution': days_since,
            'unique_regions_count': num_regions,
        }
    )
    
    return assessment


def calculate_region_risk(region):
    """Calculate preservation risk for a geographic region."""
    now = timezone.now()
    
    uses_in_region = TraditionalUse.objects.filter(region=region)
    submissions_in_region = KnowledgeSubmission.objects.filter(region=region)
    
    num_uses = uses_in_region.count()
    num_submissions = submissions_in_region.count()
    
    # Unique plants
    plants = set(uses_in_region.values_list('plant_id', flat=True))
    num_plants = len(plants)
    
    # Unique contributors
    contributors = set(uses_in_region.filter(contributor__isnull=False).values_list('contributor_id', flat=True))
    num_contributors = len(contributors)
    
    # Days since last
    last_use = uses_in_region.aggregate(latest=Max('created_at'))['latest']
    days_since = 365
    if last_use:
        days_since = (now - last_use).days
    
    # Scoring (same logic, region-focused)
    contributor_score = max(0, 20 - num_contributors * 4)
    recency_score = min(20, max(0, days_since // 18))
    doc_score = max(0, 20 - num_uses * 2)
    plant_score = max(0, 20 - num_plants * 3)
    
    # Submission activity
    recent = submissions_in_region.filter(created_at__gte=now - timedelta(days=90)).count()
    decline_score = 15 if recent == 0 else max(0, 15 - recent * 3)
    
    risk_score = min(100, contributor_score + recency_score + doc_score + plant_score + decline_score)
    
    thresholds = settings.RISK_THRESHOLDS
    if risk_score >= thresholds['HIGH'][0]:
        risk_level = RiskAssessment.RiskLevel.HIGH
    elif risk_score >= thresholds['MODERATE'][0]:
        risk_level = RiskAssessment.RiskLevel.MODERATE
    else:
        risk_level = RiskAssessment.RiskLevel.LOW
    
    assessment, _ = RiskAssessment.objects.update_or_create(
        region=region, plant=None,
        defaults={
            'risk_score': risk_score,
            'risk_level': risk_level,
            'contributor_scarcity_score': contributor_score,
            'knowledge_recency_score': recency_score,
            'documentation_scarcity_score': doc_score,
            'submission_decline_score': decline_score,
            'total_contributors': num_contributors,
            'total_traditional_uses': num_uses,
            'days_since_last_contribution': days_since,
            'unique_regions_count': 1,
        }
    )
    
    return assessment


def run_full_risk_assessment():
    """Calculate risk for all plants and regions."""
    results = {'plants': [], 'regions': []}
    
    for plant in Plant.objects.filter(is_published=True):
        assessment = calculate_plant_risk(plant)
        results['plants'].append(assessment)
    
    for region in Region.objects.all():
        assessment = calculate_region_risk(region)
        results['regions'].append(assessment)
    
    return results

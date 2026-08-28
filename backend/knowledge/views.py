from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import KnowledgeSubmission, TraditionalUse, PreparationMethod
from .serializers import (
    KnowledgeSubmissionSerializer, KnowledgeReviewSerializer,
    TraditionalUseSerializer, PreparationMethodSerializer
)
from audit.services import log_action
from notifications.services import send_notification


class IsPractitioner(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_practitioner or request.user.is_admin_role or request.user.is_superuser
        )


class IsExpert(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_expert or request.user.is_admin_role or request.user.is_superuser
        )


class KnowledgeSubmissionCreateView(generics.CreateAPIView):
    """Practitioner submits knowledge."""
    serializer_class = KnowledgeSubmissionSerializer
    permission_classes = [IsPractitioner]

    def perform_create(self, serializer):
        # Check if user explicitly wants to save as draft
        is_draft = self.request.data.get('status') == 'DRAFT'
        
        if is_draft:
            submission = serializer.save(
                contributor=self.request.user,
                status=KnowledgeSubmission.Status.DRAFT
            )
        else:
            # Default: auto-submit for review
            submission = serializer.save(
                contributor=self.request.user,
                status=KnowledgeSubmission.Status.SUBMITTED,
                submitted_at=timezone.now()
            )
            # Notify experts of new submission
            from accounts.models import User
            experts = User.objects.filter(role__in=[User.Role.EXPERT, User.Role.ADMIN])
            for expert in experts:
                send_notification(
                    expert, 'NEW_REVIEW',
                    'New Knowledge Submission',
                    f'A new knowledge submission #{submission.pk} is awaiting review.',
                    related_object_type='KnowledgeSubmission',
                    related_object_id=submission.pk,
                )
        
        log_action(self.request.user, 'KNOWLEDGE_SUBMIT',
                   f'{"Saved draft" if is_draft else "Submitted"} knowledge: #{submission.pk}',
                   target_type='KnowledgeSubmission', target_id=submission.pk)


class KnowledgeSubmissionListView(generics.ListAPIView):
    """View practitioner's own submissions."""
    serializer_class = KnowledgeSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = KnowledgeSubmission.objects.all()
        
        # Practitioners see only their own submissions
        if user.is_practitioner:
            qs = qs.filter(contributor=user)
        # Experts and admins see all
        elif not (user.is_expert or user.is_admin_role or user.is_superuser):
            qs = qs.filter(contributor=user)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        return qs


class KnowledgeSubmissionDetailView(generics.RetrieveUpdateAPIView):
    """View/update a specific submission."""

    # The client edits with PATCH; PUT (full replacement) is not offered.
    http_method_names = ['get', 'head', 'options', 'patch']
    serializer_class = KnowledgeSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_expert or user.is_admin_role or user.is_superuser:
            return KnowledgeSubmission.objects.all()
        return KnowledgeSubmission.objects.filter(contributor=user)

    def perform_update(self, serializer):
        current = serializer.instance
        user = self.request.user
        # Published knowledge is immutable for contributors. Corrections must go through
        # a fresh verification workflow rather than silently altering public knowledge.
        if current.status in [KnowledgeSubmission.Status.APPROVED, KnowledgeSubmission.Status.PUBLISHED] and not (user.is_admin_role or user.is_superuser):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Verified submissions cannot be edited. Submit a new correction for review.')
        submission = serializer.save()
        # A contributor editing a rejected record explicitly resubmits it for expert review.
        if submission.status == KnowledgeSubmission.Status.REJECTED and user == submission.contributor:
            submission.status = KnowledgeSubmission.Status.SUBMITTED
            submission.submitted_at = timezone.now()
            submission.reviewer = None
            submission.review_comments = ''
            submission.review_reason = ''
            submission.save()
        log_action(user, 'KNOWLEDGE_UPDATE', f'Updated knowledge submission #{submission.pk}', target_type='KnowledgeSubmission', target_id=submission.pk)


class PendingReviewListView(generics.ListAPIView):
    """Expert: view pending submissions for review."""
    serializer_class = KnowledgeSubmissionSerializer
    permission_classes = [IsExpert]

    def get_queryset(self):
        return KnowledgeSubmission.objects.filter(
            status__in=[
                KnowledgeSubmission.Status.SUBMITTED,
                KnowledgeSubmission.Status.UNDER_REVIEW,
            ]
        )


class ReviewSubmissionView(APIView):
    """Expert: approve, reject, or request revision."""
    permission_classes = [IsExpert]

    def post(self, request, pk):
        try:
            submission = KnowledgeSubmission.objects.get(pk=pk)
        except KnowledgeSubmission.DoesNotExist:
            return Response({'error': 'Submission not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = KnowledgeReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        action = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')
        reason = serializer.validated_data.get('reason', '')
        
        submission.reviewer = request.user
        submission.review_comments = comments
        submission.review_reason = reason
        submission.review_date = timezone.now()
        
        if action == 'approve':
            submission.status = KnowledgeSubmission.Status.APPROVED
            # Create verified traditional use record
            if submission.plant and submission.symptom:
                TraditionalUse.objects.create(
                    plant=submission.plant,
                    symptom=submission.symptom,
                    description=submission.traditional_use_description,
                    cultural_context=submission.cultural_context,
                    region=submission.region,
                    community=submission.community,
                    is_verified=True,
                    source=f'Contributor: {submission.contributor.get_full_name() or submission.contributor.username}',
                    contributor=submission.contributor,
                    verified_by=request.user,
                )
            # Publish it
            submission.status = KnowledgeSubmission.Status.PUBLISHED
            send_notification(
                submission.contributor, 'SUBMISSION_APPROVED',
                'Knowledge Submission Approved',
                f'Your knowledge submission #{submission.pk} has been approved and published.',
                related_object_type='KnowledgeSubmission',
                related_object_id=submission.pk,
            )
            log_action(request.user, 'KNOWLEDGE_APPROVE',
                       f'Approved submission #{submission.pk}',
                       target_type='KnowledgeSubmission', target_id=submission.pk)
        
        elif action == 'reject':
            submission.status = KnowledgeSubmission.Status.REJECTED
            send_notification(
                submission.contributor, 'SUBMISSION_REJECTED',
                'Knowledge Submission Rejected',
                f'Your submission #{submission.pk} was rejected. Reason: {reason}',
                related_object_type='KnowledgeSubmission',
                related_object_id=submission.pk,
            )
            log_action(request.user, 'KNOWLEDGE_REJECT',
                       f'Rejected submission #{submission.pk}: {reason}',
                       target_type='KnowledgeSubmission', target_id=submission.pk)
        
        elif action == 'request_revision':
            submission.status = KnowledgeSubmission.Status.REVISION_REQUESTED
            send_notification(
                submission.contributor, 'SUBMISSION_REVISION',
                'Revision Requested',
                f'Your submission #{submission.pk} needs revision: {comments}',
                related_object_type='KnowledgeSubmission',
                related_object_id=submission.pk,
            )
            log_action(request.user, 'KNOWLEDGE_REVISION',
                       f'Requested revision for #{submission.pk}',
                       target_type='KnowledgeSubmission', target_id=submission.pk)
        
        submission.save()
        return Response(KnowledgeSubmissionSerializer(submission).data)


class TraditionalUseListView(generics.ListAPIView):
    """List verified traditional uses."""
    serializer_class = TraditionalUseSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = TraditionalUse.objects.select_related(
            'plant', 'symptom', 'plant_part', 'preparation', 'region'
        )
        
        # Only show verified uses to public
        user = self.request.user
        if not (user.is_authenticated and (user.is_expert or user.is_admin_role)):
            qs = qs.filter(is_verified=True)
        
        plant = self.request.query_params.get('plant')
        if plant:
            qs = qs.filter(plant_id=plant)
        
        symptom = self.request.query_params.get('symptom')
        if symptom:
            qs = qs.filter(symptom_id=symptom)
        
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(region_id=region)
        
        return qs


class PreparationMethodListView(generics.ListAPIView):
    serializer_class = PreparationMethodSerializer
    permission_classes = [permissions.AllowAny]
    queryset = PreparationMethod.objects.all()

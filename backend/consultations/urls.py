from django.urls import path

from .views import (
    AppointmentDetail,
    ExpertDirectory,
    ExpertMyProfile,
    ExpertProfileDetail,
    AppointmentList,
    AvailabilityDetail,
    AvailabilityListCreate,
    BookAppointment,
    ConsultationStats,
    ConversationList,
    ConversationMessages,
    ConversationSignal,
    MarkThreadRead,
    PublicSlotList,
    StartConsultation,
    RescheduleAppointment,
    UpdateAppointmentStatus,
)

urlpatterns = [
    # Availability
    path('availability/', AvailabilityListCreate.as_view(), name='availability-list-create'),
    path('availability/<int:pk>/', AvailabilityDetail.as_view(), name='availability-detail'),
    path('slots/', PublicSlotList.as_view(), name='slot-list'),
    # Appointments
    path('appointments/', AppointmentList.as_view(), name='appointment-list'),
    path('appointments/book/', BookAppointment.as_view(), name='appointment-book'),
    path('appointments/<int:pk>/', AppointmentDetail.as_view(), name='appointment-detail'),
    path('appointments/<int:pk>/status/', UpdateAppointmentStatus.as_view(), name='appointment-status'),
    path('appointments/<int:pk>/reschedule/', RescheduleAppointment.as_view(),
         name='appointment-reschedule'),
    path('appointments/<int:pk>/start/', StartConsultation.as_view(), name='appointment-start'),
    # Messaging + signalling
    path('conversations/', ConversationList.as_view(), name='conversation-list'),
    path('conversations/<int:pk>/messages/', ConversationMessages.as_view(), name='conversation-messages'),
    path('conversations/<int:pk>/signal/', ConversationSignal.as_view(), name='conversation-signal'),
    path('conversations/<int:pk>/read/', MarkThreadRead.as_view(), name='conversation-read'),
    # Specialist directory
    path('experts/', ExpertDirectory.as_view(), name='expert-directory'),
    path('experts/me/', ExpertMyProfile.as_view(), name='expert-my-profile'),
    path('experts/<int:pk>/', ExpertProfileDetail.as_view(), name='expert-profile-detail'),
    # Oversight
    path('stats/', ConsultationStats.as_view(), name='consultation-stats'),
]

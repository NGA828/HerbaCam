from django.contrib import admin

from .models import Appointment, AvailabilitySlot, Conversation, Message


@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ('expert', 'starts_at', 'ends_at', 'is_closed', 'is_booked')
    list_filter = ('is_closed', 'expert')
    date_hierarchy = 'starts_at'


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'expert', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('patient__username', 'expert__username', 'reason')
    readonly_fields = ('room_id', 'created_at', 'updated_at')


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'appointment', 'last_activity_at')
    inlines = [MessageInline]

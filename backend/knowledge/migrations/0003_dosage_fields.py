from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge', '0002_alter_preparationmethod_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='traditionaluse',
            name='dosage',
            field=models.CharField(blank=True, default='', help_text='Traditionally reported amount per intake (e.g. 1 teacup ~150 ml)', max_length=255),
        ),
        migrations.AddField(
            model_name='traditionaluse',
            name='frequency',
            field=models.CharField(blank=True, default='', help_text='Traditionally reported frequency (e.g. twice daily)', max_length=255),
        ),
        migrations.AddField(
            model_name='traditionaluse',
            name='duration',
            field=models.CharField(blank=True, default='', help_text='Traditionally reported duration (e.g. for 3 days)', max_length=255),
        ),
        migrations.AddField(
            model_name='traditionaluse',
            name='administration',
            field=models.TextField(blank=True, default='', help_text='How the preparation is traditionally taken (route, timing, with/without food)'),
        ),
        migrations.AddField(
            model_name='knowledgesubmission',
            name='dosage',
            field=models.CharField(blank=True, default='', help_text='Amount per intake as traditionally used', max_length=255),
        ),
        migrations.AddField(
            model_name='knowledgesubmission',
            name='frequency',
            field=models.CharField(blank=True, default='', help_text='How often the preparation is traditionally taken', max_length=255),
        ),
        migrations.AddField(
            model_name='knowledgesubmission',
            name='duration',
            field=models.CharField(blank=True, default='', help_text='How long the preparation is traditionally taken', max_length=255),
        ),
        migrations.AddField(
            model_name='knowledgesubmission',
            name='administration',
            field=models.TextField(blank=True, default='', help_text='How the preparation is taken (route, timing, with/without food)'),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('accounts', '0001_initial')]
    operations = [migrations.CreateModel(
        name='SystemSetting',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('key', models.CharField(max_length=100, unique=True)),
            ('value', models.JSONField(default=dict)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='accounts.user')),
        ],
        options={'ordering': ['key']},
    )]

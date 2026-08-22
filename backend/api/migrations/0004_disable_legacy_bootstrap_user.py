from django.contrib.auth.hashers import make_password
from django.db import migrations


LEGACY_USERNAME = "Ashribad2005"


def disable_legacy_bootstrap_user(apps, schema_editor):
    """Disable the account created by the historical unsafe migration."""
    User = apps.get_model("auth", "User")
    user = User.objects.filter(username=LEGACY_USERNAME).first()
    if user is None:
        return

    user.is_active = False
    user.is_staff = False
    user.is_superuser = False
    user.password = make_password(None)
    user.save(
        update_fields=["is_active", "is_staff", "is_superuser", "password"]
    )


def restore_legacy_bootstrap_user(apps, schema_editor):
    """Do not restore credentials when rolling back this safety migration."""
    return


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0003_auto_20260821_1814"),
    ]

    operations = [
        migrations.RunPython(
            disable_legacy_bootstrap_user,
            restore_legacy_bootstrap_user,
        ),
    ]

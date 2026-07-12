from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from core.models import User


@receiver(pre_save, sender=User)
def flag_role_change(sender, instance, **kwargs):
    if not instance.pk:
        instance._role_changed = False
        return

    try:
        old_role = sender.objects.only("role").get(pk=instance.pk).role
    except sender.DoesNotExist:
        instance._role_changed = False
        return

    instance._role_changed = old_role != instance.role


@receiver(post_save, sender=User)
def revoke_refresh_tokens_after_role_change(sender, instance, **kwargs):
    if not getattr(instance, "_role_changed", False):
        return

    from security.tokens import revoke_user_refresh_tokens

    revoke_user_refresh_tokens(instance)

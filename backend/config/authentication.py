"""Authentication that survives a proxy which drops ``Authorization``.

The hosted preview sits behind a proxy that forwards the page but strips the
standard ``Authorization`` header, so an app opened through it cannot
authenticate at all: every request arrives as an anonymous one, the SPA bounces
you back to the public pages, and it looks like a stale deployment rather than a
proxy quirk.  The client therefore mirrors the token into ``X-Herbacam-Token``
and this class lifts it into place when — and only when — the real header is
missing.

Same bearer semantics, same signature check, same expiry. Nothing here is
cookie-based, so it adds no CSRF surface; ``Authorization`` keeps priority so
normal clients are unaffected.
"""
import logging

from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)

FALLBACK_HEADER = 'HTTP_X_HERBACAM_TOKEN'


class HeaderResilientJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        meta = request.META
        has_authorization = bool(meta.get('HTTP_AUTHORIZATION'))
        token = meta.get(FALLBACK_HEADER)
        if token and not has_authorization:
            # Logged at warning because it is the one visible trace of a proxy
            # mangling credentials: a reviewer's "it never lets me sign in" is
            # otherwise indistinguishable from a bad password.
            logger.warning(
                'Authorization header absent but %s present on %s %s — a proxy '
                'is stripping credential headers; authenticating from the fallback.',
                'X-Herbacam-Token', request.method, request.path,
            )
            meta['HTTP_AUTHORIZATION'] = f'Bearer {token}'
        return super().authenticate(request)

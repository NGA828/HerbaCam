"""Tests for article curation rights.

The ANCESTOR use-case diagram hands ``manage articles`` to the specialized
expert. Drafts must stay invisible to readers no matter who is allowed to write
them, so the read path is asserted here too.
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from articles.models import Article

ENDPOINT = '/api/articles/admin/'


def rows(payload):
    """The management list is paginated in some configurations, plain in others."""
    if isinstance(payload, dict):
        return payload.get('results', [])
    return payload


class ArticleCurationPermissionTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='art_expert', password='test1234!', role=User.Role.EXPERT)
        self.admin = User.objects.create_user(
            username='art_admin', password='test1234!', role=User.Role.ADMIN)
        self.practitioner = User.objects.create_user(
            username='art_pract', password='test1234!', role=User.Role.PRACTITIONER)
        self.draft = Article.objects.create(
            title='Fermented bark preparations', slug='fermented-bark',
            content='Field notes.', is_published=False)

    def article_payload(self, slug='neem-in-the-home-garden'):
        return {'title': 'Neem in the home garden', 'slug': slug,
                'content': 'A practical write-up.', 'is_published': False}

    # -- the use case: the specialized expert manages articles ---------------

    def test_expert_can_write_an_article(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(ENDPOINT, self.article_payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Article.objects.get(slug='neem-in-the-home-garden')
        self.assertEqual(created.author, self.expert)

    def test_expert_can_publish_a_draft_and_the_timestamp_follows(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.patch(f'{ENDPOINT}{self.draft.pk}/', {'is_published': True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.draft.refresh_from_db()
        self.assertTrue(self.draft.is_published)
        self.assertIsNotNone(self.draft.published_at)

    def test_expert_can_withdraw_an_article(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.patch(f'{ENDPOINT}{self.draft.pk}/', {'is_published': False})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_expert_can_delete_an_article(self):
        doomed = Article.objects.create(title='Doomed', slug='doomed', content='x')
        self.client.force_authenticate(user=self.expert)
        res = self.client.delete(f'{ENDPOINT}{doomed.pk}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Article.objects.filter(pk=doomed.pk).exists())

    def test_admin_has_identical_rights(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(ENDPOINT, self.article_payload('admin-authored-piece'))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    # -- roles the diagram does not give curation to -------------------------

    def test_practitioner_cannot_write_articles(self):
        self.client.force_authenticate(user=self.practitioner)
        res = self.client.post(ENDPOINT, self.article_payload())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_management_list_never_leaks_drafts_to_readers(self):
        res = self.client.get(ENDPOINT)
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertNotIn('fermented-bark', res.content.decode())

    def test_public_article_list_still_excludes_the_draft(self):
        res = self.client.get('/api/articles/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn('fermented-bark', [r['slug'] for r in rows(res.data)])

    def test_a_published_article_is_readable_by_anyone(self):
        self.draft.is_published = True
        self.draft.published_at = timezone.now()
        self.draft.save()
        res = self.client.get(f'/api/articles/{self.draft.slug}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['title'], 'Fermented bark preparations')

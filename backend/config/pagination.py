"""Project-wide pagination.

Allows clients to page deeply with ``?page=N&page_size=M`` (capped by
``max_page_size``), which the admin UI relies on to load complete tables.
"""
from rest_framework.pagination import PageNumberPagination


class StandardPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 500

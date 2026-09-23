"""Tests for the administrative tree and geolocation lookup."""
from rest_framework import status
from rest_framework.test import APITestCase

from geography.models import Region
from plants.models import Plant


class LocateTests(APITestCase):
    def setUp(self):
        self.centre = Region.objects.create(name='Centre', latitude=3.5, longitude=11.5)
        self.far_north = Region.objects.create(name='Far North', latitude=10.5, longitude=14.3)
        self.plant = Plant.objects.create(scientific_name='Aframomum melegueta',
                                          common_name='Grains of Selim', is_published=True)
        self.plant.regions.add(self.centre)

    def test_nearest_region_wins(self):
        res = self.client.get('/api/geography/locate/?lat=3.9&lng=11.6')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['region']['name'], 'Centre')
        self.assertTrue(res.data['in_cameroon'])
        self.assertEqual(res.data['plant_count'], 1)

    def test_a_point_up_north_resolves_to_the_far_north(self):
        res = self.client.get('/api/geography/locate/?lat=10.4&lng=14.0')
        self.assertEqual(res.data['region']['name'], 'Far North')

    def test_locations_outside_the_country_are_flagged_not_rejected(self):
        res = self.client.get('/api/geography/locate/?lat=51.5&lng=-0.1')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['in_cameroon'])
        self.assertGreater(res.data['distance_km'], 4000)

    def test_missing_and_malformed_coordinates_are_refused(self):
        for query in ('', 'lat=3.5', 'lat=abc&lng=11.5', 'lat=999&lng=0'):
            res = self.client.get(f'/api/geography/locate/?{query}')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, query)

    def test_no_geolocated_regions_returns_a_clear_404(self):
        Region.objects.update(latitude=None)
        res = self.client.get('/api/geography/locate/?lat=3.5&lng=11.5')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_reads_need_no_login(self):
        res = self.client.get('/api/geography/locate/?lat=3.5&lng=11.5')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

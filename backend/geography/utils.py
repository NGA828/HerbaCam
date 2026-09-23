"""Distance helpers shared by the region lookup and the specialist directory."""
import math


def haversine_km(lat_a, lng_a, lat_b, lng_b):
    """Great-circle distance in kilometres between two WGS-84 points."""
    radius = 6371.0
    phi_a, phi_b = math.radians(lat_a), math.radians(lat_b)
    d_phi = math.radians(lat_b - lat_a)
    d_lambda = math.radians(lng_b - lng_a)
    h = (math.sin(d_phi / 2) ** 2
         + math.cos(phi_a) * math.cos(phi_b) * math.sin(d_lambda / 2) ** 2)
    return 2 * radius * math.asin(math.sqrt(h))

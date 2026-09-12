"""Kuvira Sports master catalogs and geography metadata.

Only static reference catalogs (Sports, Skill levels, Indian cities) are kept here.
No fake players, coaches, courts, events, tournaments, games, community posts,
or products are defined here or seeded into the database.
"""

# ---------------------------------------------------------------------------
# Indian cities with real lat/lng (used for location matching + geocoding)
# ---------------------------------------------------------------------------
INDIA_CITIES = [
    {"city": "Bangalore", "state": "Karnataka", "lat": 12.9716, "lng": 77.5946},
    {"city": "Mysore", "state": "Karnataka", "lat": 12.2958, "lng": 76.6394},
    {"city": "Mumbai", "state": "Maharashtra", "lat": 19.0760, "lng": 72.8777},
    {"city": "Pune", "state": "Maharashtra", "lat": 18.5204, "lng": 73.8567},
    {"city": "Nagpur", "state": "Maharashtra", "lat": 21.1458, "lng": 79.0882},
    {"city": "Delhi", "state": "Delhi", "lat": 28.6139, "lng": 77.2090},
    {"city": "Noida", "state": "Uttar Pradesh", "lat": 28.5355, "lng": 77.3910},
    {"city": "Gurugram", "state": "Haryana", "lat": 28.4595, "lng": 77.0266},
    {"city": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707},
    {"city": "Coimbatore", "state": "Tamil Nadu", "lat": 11.0168, "lng": 76.9558},
    {"city": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lng": 78.4867},
    {"city": "Visakhapatnam", "state": "Andhra Pradesh", "lat": 17.6868, "lng": 83.2185},
    {"city": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lng": 75.7873},
    {"city": "Jodhpur", "state": "Rajasthan", "lat": 26.2389, "lng": 73.0243},
    {"city": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714},
    {"city": "Surat", "state": "Gujarat", "lat": 21.1702, "lng": 72.8311},
    {"city": "Vadodara", "state": "Gujarat", "lat": 22.3072, "lng": 73.1812},
    {"city": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lng": 88.3639},
    {"city": "Kochi", "state": "Kerala", "lat": 9.9312, "lng": 76.2673},
    {"city": "Thiruvananthapuram", "state": "Kerala", "lat": 8.5241, "lng": 76.9366},
    {"city": "Chandigarh", "state": "Chandigarh", "lat": 30.7333, "lng": 76.7794},
    {"city": "Ludhiana", "state": "Punjab", "lat": 30.9010, "lng": 75.8573},
    {"city": "Amritsar", "state": "Punjab", "lat": 31.6340, "lng": 74.8723},
    {"city": "Indore", "state": "Madhya Pradesh", "lat": 22.7196, "lng": 75.8577},
    {"city": "Bhopal", "state": "Madhya Pradesh", "lat": 23.2599, "lng": 77.4126},
    {"city": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8467, "lng": 80.9462},
    {"city": "Agra", "state": "Uttar Pradesh", "lat": 27.1767, "lng": 78.0081},
    {"city": "Varanasi", "state": "Uttar Pradesh", "lat": 25.3176, "lng": 82.9739},
    {"city": "Bhubaneswar", "state": "Odisha", "lat": 20.2961, "lng": 85.8245},
    {"city": "Guwahati", "state": "Assam", "lat": 26.1445, "lng": 91.7362},
    {"city": "Dehradun", "state": "Uttarakhand", "lat": 30.3165, "lng": 78.0322},
    {"city": "Ranchi", "state": "Jharkhand", "lat": 23.3441, "lng": 85.3096},
    {"city": "Patna", "state": "Bihar", "lat": 25.5941, "lng": 85.1376},
    {"city": "Goa", "state": "Goa", "lat": 15.2993, "lng": 74.1240},
]

SPORTS = [
    {"id": "sport-pickleball", "name": "Pickleball", "slug": "pickleball", "icon": "tennisball-outline", "active": True, "order": 1},
    {"id": "sport-badminton", "name": "Badminton", "slug": "badminton", "icon": "tennisball-outline", "active": True, "order": 2},
    {"id": "sport-tennis", "name": "Tennis", "slug": "tennis", "icon": "tennisball-outline", "active": True, "order": 3},
    {"id": "sport-tabletennis", "name": "Table Tennis", "slug": "table-tennis", "icon": "tennisball-outline", "active": True, "order": 4},
    {"id": "sport-basketball", "name": "Basketball", "slug": "basketball", "icon": "basketball-outline", "active": True, "order": 5},
]

SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Pro"]

# Empty containers for any backwards-compatibility imports
FACILITIES = []
PLAYERS = []
COACHES = []
EVENTS = []
TOURNAMENTS = []
GAMES = []
PRODUCTS = []
COMMUNITY_POSTS = []
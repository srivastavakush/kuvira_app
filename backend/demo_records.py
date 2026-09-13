"""Exact legacy seed identities; never classify real data by name or ID prefix."""
LEGACY_IDS = {'facilities': ['fac-hsr', 'fac-bandra', 'fac-koramangala', 'fac-indiranagar', 'fac-whitefield', 'fac-hitec-city'], 'players': ['player-arjun', 'player-priya', 'player-rohan', 'player-sara', 'player-anaya', 'player-vikram', 'player-rohit', 'player-sneha', 'player-kabir', 'player-ananya'], 'coaches': ['coach-vikram', 'coach-neha', 'coach-marcus', 'coach-priya'], 'events': ['event-monsoon-mixer', 'event-womens-clinic', 'event-blitz-cup', 'event-sunday-mixer', 'event-masterclass'], 'tournaments': ['trn-bangalore-open', 'trn-mumbai-championship', 'tourn-karnataka-state'], 'products': ['prod-paddle-pro', 'prod-paddle-control', 'prod-court-shoes', 'prod-balls', 'prod-bag', 'prod-apparel', 'prod-pro-carbon-paddle', 'prod-outdoor-balls-6pk', 'prod-court-duffle'], 'posts': ['post-1', 'post-2', 'post-3'], 'games': ['game-1', 'game-2', 'game-3', 'game-4']}
CATALOG_COLLECTIONS = tuple(LEGACY_IDS) + ('users', 'organizations', 'facility_slots')

def demo_query(collection):
    rules = [{flag: True} for flag in ('is_demo', 'is_test', 'is_sample')]
    if LEGACY_IDS.get(collection): rules.append({'id': {'$in': LEGACY_IDS[collection]}})
    if collection in ('games', 'facility_slots'):
        rules.append({'facility_id': {'$in': LEGACY_IDS['facilities']}})
    if collection == 'games':
        rules.append({'host_id': {'$in': LEGACY_IDS['players']}})
    return {'$or': rules}

def real_records(collection, query=None):
    query = dict(query or {})
    query['$nor'] = list(query.get('$nor', [])) + demo_query(collection)['$or']
    return query

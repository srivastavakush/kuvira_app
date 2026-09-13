from demo_records import demo_query, real_records, LEGACY_IDS

def test_unmarked_legacy_games_are_excluded():
    query = real_records('games', {'sport': 'Badminton'})
    assert query['sport'] == 'Badminton'
    assert {'id': {'$in': LEGACY_IDS['games']}} in query['$nor']
    assert {'facility_id': {'$in': LEGACY_IDS['facilities']}} in query['$nor']

def test_flags_and_existing_constraints_are_preserved():
    original = {'id': 'real-game', '$nor': [{'status': 'cancelled'}]}
    query = real_records('games', original)
    assert query['id'] == 'real-game'
    assert {'status': 'cancelled'} in query['$nor']
    assert {'is_test': True} in query['$nor']
    assert original == {'id': 'real-game', '$nor': [{'status': 'cancelled'}]}

def test_cleanup_never_uses_names_or_prefix_regex():
    import json
    serialized = json.dumps(demo_query('users'))
    assert '$regex' not in serialized and 'name' not in serialized
    assert demo_query('users') == {'$or': [{'is_demo': True}, {'is_test': True}, {'is_sample': True}]}

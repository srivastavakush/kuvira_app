"""Allowlisted player data for public discovery, game hosts and community authors."""
PUBLIC_PLAYER_FIELDS = frozenset({
    "id", "name", "avatar", "city", "area", "primary_sport", "sports",
    "skill_level", "bio", "playing_style", "match_score", "matches_played",
    "wins", "availability", "achievements",
})


def public_player(player):
    if not player:
        return None
    return {key: value for key, value in player.items() if key in PUBLIC_PLAYER_FIELDS}

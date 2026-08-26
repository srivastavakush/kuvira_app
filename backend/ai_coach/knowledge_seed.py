"""Seed of coaching knowledge — tiered by authority.

Tier 1 (authority=1): rules / research
Tier 2 (authority=2): expert coaching methodology
Tier 3 (authority=3): Kuvira proprietary drill / tactical library

This is deliberately small; it is a foundation, not a corpus.
"""
from .retriever.base import KnowledgeItem


def seed_items() -> list[KnowledgeItem]:
    return [
        # ------------------- Tier 1: rules & research
        KnowledgeItem(id="pk-rules-nvz", title="Non-volley zone (kitchen) rules",
            body="Players may not volley the ball (strike it out of the air without a bounce) while standing in the non-volley zone or with any body part touching it. Momentum from a volley that carries a player into the NVZ is also a fault.",
            category="rules", source_type="rulebook", source_name="USA Pickleball Rulebook", authority_level=1, confidence=0.98),
        KnowledgeItem(id="pk-rules-serve", title="Legal serve mechanics",
            body="Serve is underhand, contact below the waist, served diagonally to the opposite service court. Only one serve attempt (except lets under the current rules).",
            category="rules", source_type="rulebook", source_name="USA Pickleball Rulebook", authority_level=1, confidence=0.98),
        KnowledgeItem(id="pk-science-transition", title="Transition play and unforced errors",
            body="Sports-analytics work on racket sports consistently finds that most unforced errors occur while moving forward from the baseline. Controlled resets — low, slow, into the opponent kitchen — reduce error rate.",
            category="tactical", situation="transition", source_type="research", source_name="applied racket-sport analytics", authority_level=1, confidence=0.85),
        # ------------------- Tier 2: expert coaching
        KnowledgeItem(id="pk-coach-3sd", title="Third-shot drop fundamentals",
            body="After a return of serve, the serving team is best served hitting a soft third shot that arcs into the opposing kitchen. Key cues: paddle face slightly open, contact out in front, use legs rather than arm, aim for a target 2–3 feet inside the kitchen line.",
            category="technical", skill="third_shot_drop", situation="post_return", source_type="coaching", source_name="consensus coaching methodology", authority_level=2, confidence=0.9),
        KnowledgeItem(id="pk-coach-dink", title="Dinking principles",
            body="Dinks should be arced, contact out in front, targeted to the opponent's non-dominant hip or crosscourt to increase court angle. Keep the paddle face open, use shoulder rotation, avoid wrist snap.",
            category="technical", skill="dink", situation="kitchen", source_type="coaching", source_name="consensus coaching methodology", authority_level=2, confidence=0.9),
        KnowledgeItem(id="pk-coach-backhand", title="Backhand consistency",
            body="For two-handed backhands, initiate the swing from the shoulder with a stable, connected wrist and follow through toward the target. For one-handers, keep the elbow relaxed and use body rotation for power. Consistency is built from a stable contact point out in front of the body.",
            category="technical", skill="backhand", source_type="coaching", source_name="consensus coaching methodology", authority_level=2, confidence=0.85),
        KnowledgeItem(id="pk-coach-serve-return", title="Return of serve strategy",
            body="Return deep, high and slow. A deep return buys time for the returner to move to the kitchen line and puts the serving team on the defensive. Aim for the middle-third of the baseline.",
            category="tactical", skill="return", situation="post_serve", source_type="coaching", source_name="consensus coaching methodology", authority_level=2, confidence=0.88),
        KnowledgeItem(id="pk-coach-positioning", title="Court positioning at the kitchen line",
            body="The team that reaches the kitchen line first almost always wins the point. Stay centered relative to the ball, keep the paddle up and out in front, move as a unit with your partner — if one goes, both go.",
            category="tactical", skill="positioning", source_type="coaching", source_name="consensus coaching methodology", authority_level=2, confidence=0.9),
        # ------------------- Tier 3: Kuvira proprietary drill library
        KnowledgeItem(id="pk-kuvira-drill-3sd", title="Kuvira “Third-Shot Ladder” drill",
            body="Feed a return of serve to Player A. Player A hits a third-shot drop from the baseline. If it lands inside the kitchen and not attackable, they advance one step. If not, they reset. Goal: 8/10 successful drops in a row before advancing to full transition.",
            category="drill", skill="third_shot_drop", source_type="kuvira", source_name="Kuvira drill library", authority_level=3, confidence=0.9),
        KnowledgeItem(id="pk-kuvira-drill-reset", title="Kuvira “Controlled Reset” drill",
            body="Coach or partner drives balls at chest height from mid-court. Player must reset each drive softly into the kitchen. Track error percentage across 20 balls. Success target: below 12% errors before increasing feed speed.",
            category="drill", skill="reset", situation="transition", source_type="kuvira", source_name="Kuvira drill library", authority_level=3, confidence=0.9),
        KnowledgeItem(id="pk-kuvira-drill-dink", title="Kuvira “Cross-Court Dink Rally” drill",
            body="Both players stand at the kitchen line diagonally. Rally cross-court dinks for 60 seconds without missing. Progress: 30 → 60 → 90 seconds. Adds pressure on the third round by adding a target zone (opponent's non-dominant hip).",
            category="drill", skill="dink", source_type="kuvira", source_name="Kuvira drill library", authority_level=3, confidence=0.9),
        KnowledgeItem(id="pk-kuvira-framework-attacking", title="Kuvira attacking-decision framework",
            body="Attack only when three conditions align: (1) the ball is above net height, (2) you are balanced and moving forward or stationary, (3) your partner is at the kitchen line. If any condition fails, reset instead.",
            category="tactical", skill="attacking_decision", source_type="kuvira", source_name="Kuvira tactical framework", authority_level=3, confidence=0.9),
        KnowledgeItem(id="pk-kuvira-archetype-banger", title="Player archetype: banger",
            body="A ‘banger’ relies on drives and pace. Common weaknesses: struggles in dink rallies, over-attacks low balls, gets pulled forward by soft returns. Coaching: build dink and reset patience, punish with unattackable third-shot drops.",
            category="archetype", source_type="kuvira", source_name="Kuvira player archetypes", authority_level=3, confidence=0.85),
        KnowledgeItem(id="pk-kuvira-archetype-dinker", title="Player archetype: dinker",
            body="A ‘dinker’ relies on soft-game patience and shot placement. Common weaknesses: passive on attackable balls, slow to move forward on short returns. Coaching: sharpen decision-making on attackable balls, build controlled counter-attack.",
            category="archetype", source_type="kuvira", source_name="Kuvira player archetypes", authority_level=3, confidence=0.85),
    ]

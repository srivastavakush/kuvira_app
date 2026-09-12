"""Curated, source-attributed starter corpus for Kuchu Puchu AI Coach.

These are short, original coaching notes distilled from the named official
sources; they are not scraped or copied rule books. Refreshing this registry
re-verifies source URLs and replaces only content that has changed.
"""
from __future__ import annotations

from .retriever.ingestion import SourceDocument


def seed_documents() -> list[SourceDocument]:
    return [
        SourceDocument(
            title="Pickleball: non-volley-zone faults", sport="pickleball", topic="rules and kitchen play",
            category="rules", source_type="rulebook", source_name="USA Pickleball", authority_level=1,
            source_url="https://usapickleball.org/rules/", source_updated_at="2026-01-01",
            tags=("kitchen", "non-volley zone", "volley", "fault"),
            text="A player cannot volley while touching the non-volley zone or its line. A volley can also be a fault if the player's momentum from that volley carries them into the zone. Coach the safe alternative: let a low ball bounce, then play it from a balanced position.",
        ),
        SourceDocument(
            title="Pickleball: serve and return priorities", sport="pickleball", topic="serve and return",
            category="rules", skill="serve", situation="start of rally", source_type="rulebook", source_name="USA Pickleball",
            authority_level=1, source_url="https://usapickleball.org/rules/", source_updated_at="2026-01-01",
            tags=("serve", "return", "diagonal", "baseline"),
            text="Use the current USA Pickleball rulebook for the exact legal serve requirements because they are revised periodically. In play, keep the first objective simple: begin the rally legally, return with margin, and recover into a ready position rather than chasing a low-percentage winner.",
        ),
        SourceDocument(
            title="Pickleball: third-shot drop progression", sport="pickleball", topic="transition and soft game",
            category="technical", skill="third-shot drop", situation="after return of serve", source_type="kuvirasports",
            source_name="Kuchu Puchu coaching playbook", authority_level=3, confidence=0.75,
            source_url=None, source_updated_at=None,
            tags=("third shot", "drop", "transition", "common mistake", "beginner"), skill_level="Beginner",
            text="Use a cooperative progression for a third-shot drop: first clear the net with height, then land in the non-volley zone, then add direction. A common mistake is forcing a fast, low ball while off balance. If the ball is below net height or the player is moving, choose a safer reset before advancing.",
        ),
        SourceDocument(
            title="Badminton: rally scoring and service courts", sport="badminton", topic="rules and scoring",
            category="rules", source_type="rulebook", source_name="Badminton World Federation", authority_level=1,
            source_url="https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/Section%204.1-%20Laws%20of%20Badminton%20-%2019052018A.pdf",
            source_updated_at="2018-05-19", tags=("scoring", "service", "court", "rally"),
            text="Badminton uses rally-point scoring: every rally awards a point. Service court and serving order change with the score, so players should confirm the current score before serving. For league play, follow the competition's regulations where they modify the BWF Laws.",
        ),
        SourceDocument(
            title="Badminton: recover to a neutral base", sport="badminton", topic="movement and court coverage",
            category="movement", skill="footwork", situation="after shot", source_type="kuvirasports",
            source_name="Kuchu Puchu coaching playbook", authority_level=3, confidence=0.75,
            source_url=None,
            tags=("footwork", "recovery", "split step", "common mistake"), skill_level="Beginner",
            text="After each shot, recover toward a neutral base with the racquet up and knees flexed. Do not watch the shuttle from a deep corner; begin recovery as the shot leaves the strings. A practical drill is shadow movement to six corners: split step, move, mime the shot, recover, then repeat for controlled time intervals.",
        ),
        SourceDocument(
            title="Tennis: service, scoring and court rules", sport="tennis", topic="rules and scoring",
            category="rules", source_type="rulebook", source_name="International Tennis Federation", authority_level=1,
            source_url="https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf", source_updated_at="2026-01-01",
            tags=("serve", "scoring", "court", "rules"),
            text="Use the current ITF Rules of Tennis for official scoring, serving and court questions. The serve starts each point from behind the baseline and must land in the diagonally opposite service box. In a sanctioned event, the event conditions and ITF rules control any disputed call.",
        ),
        SourceDocument(
            title="Tennis: recover after each groundstroke", sport="tennis", topic="court positioning",
            category="tactical", skill="court positioning", situation="rally", source_type="coaching", source_name="USTA", authority_level=2,
            source_url="https://www.usta.com/en/home/improve/tips-and-instruction/national/improve-your-tennis-game--court-positioning.html",
            source_updated_at="2018-07-02", tags=("recovery", "baseline", "positioning", "drill"), skill_level="Beginner",
            text="For a beginner rally, recover toward a usable home-base position after each shot rather than staying where the ball was hit. The USTA Ready, Rally and Recover concept uses repetition to connect shot recovery with the next-ball preparation. Start slowly, then add a directional target and a live-ball feed.",
        ),
        SourceDocument(
            title="Tennis: simple volley cue", sport="tennis", topic="volleys and net play",
            category="technical", skill="volley", situation="at net", source_type="coaching", source_name="USTA", authority_level=2,
            source_url="https://www.usta.com/en/home/improve/tips-and-instruction/national/learning-the-basics--volleys.html",
            source_updated_at="2017-01-01", tags=("volley", "continental grip", "common mistake", "net"), skill_level="Beginner",
            text="For beginner volleys, reduce the backswing and make a compact blocking action. The USTA cue 'squeeze and freeze' helps prevent the common mistake of swinging too much at the ball. Build confidence with cooperative feeds before using the volley in point play.",
        ),
        SourceDocument(
            title="Football: scan before and after receiving", sport="football", topic="passing and decision making",
            category="technical", skill="passing", situation="in possession", source_type="coaching", source_name="The FA Boot Room", authority_level=2,
            source_url="https://www.thefa.com/bootroom/resources/coaching/how-to-coach-passing-in-football", source_updated_at="2022-03-15",
            tags=("passing", "scanning", "decision making", "first touch", "common mistake"), skill_level="Beginner",
            text="Passing starts with information. Scan to find team-mates, space and pressure before receiving; then use a first touch that preserves the next pass. A common mistake is passing immediately without checking options. Use a small-sided directional game and award a bonus when the receiver opens their body and finds a forward option safely.",
        ),
        SourceDocument(
            title="Football: Laws of the Game", sport="football", topic="rules",
            category="rules", source_type="rulebook", source_name="The IFAB", authority_level=1,
            source_url="https://www.theifab.com/laws-of-the-game-documents/?language=en", source_updated_at="2026-07-01",
            tags=("laws", "offside", "fouls", "restart"),
            text="For decisions on offside, fouls, restarts and match procedure, use the current IFAB Laws of the Game. Local competitions may publish additional competition rules, but they do not replace the Laws unless the competition is authorised to make that modification.",
        ),
        SourceDocument(
            title="Cricket: starter skill practice", sport="cricket", topic="batting bowling fielding",
            category="drill", skill="fundamentals", situation="practice", source_type="coaching", source_name="International Cricket Council", authority_level=2,
            source_url="https://www.icc-cricket.com/criiio/skills-and-drills", source_updated_at="2023-11-12",
            tags=("batting", "bowling", "catching", "throwing", "drill", "beginner"), skill_level="Beginner",
            text="For a new player, separate batting, bowling, catching and throwing into simple, repeatable practices, then combine them in a small-sided game. Use a clear target for each attempt and give feedback on one cue at a time. Increase distance, speed or decision pressure only after the basic movement is controlled.",
        ),
        SourceDocument(
            title="Cricket: Laws and competition conditions", sport="cricket", topic="rules and match awareness",
            category="rules", source_type="rulebook", source_name="Marylebone Cricket Club", authority_level=1,
            source_url="https://www.lords.org/mcc/the-laws", source_updated_at="2022-10-01",
            tags=("laws", "wide", "no ball", "dismissal", "scoring"),
            text="MCC is the custodian of the Laws of Cricket. Use the current Laws for questions on dismissals, scoring, wides, no-balls and player conduct; higher-level matches may also use ICC or tournament playing conditions, which can change how a Law is applied in that competition.",
        ),
    ]

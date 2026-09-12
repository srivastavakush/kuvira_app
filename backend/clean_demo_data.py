"""Purge all demo/sample/seeded data from MongoDB collections.

Preserves all genuine onboarded users, user profiles, genuine bookings,
and organization memberships.
"""
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "kuvira")

DEMO_MOCK_IDS = [
    "fac-koramangala", "fac-indiranagar", "fac-whitefield", "fac-hitec-city",
    "player-vikram", "player-ananya", "player-rohit", "player-sneha", "player-kabir",
    "coach-marcus", "coach-priya",
    "event-blitz-cup", "event-sunday-mixer", "event-masterclass",
    "tourn-karnataka-state",
    "game-1", "game-2",
    "prod-pro-carbon-paddle", "prod-outdoor-balls-6pk", "prod-court-duffle",
    "post-1", "post-2",
]

async def clean_database():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Connecting to MongoDB database: {DB_NAME}")

    collections = [
        "facilities", "players", "coaches", "events", "tournaments",
        "games", "products", "posts", "facility_slots"
    ]

    for col in collections:
        count_before = await db[col].count_documents({})
        # Delete items with is_demo: True or matching known mock IDs
        r = await db[col].delete_many({
            "$or": [
                {"is_demo": True},
                {"id": {"$in": DEMO_MOCK_IDS}},
            ]
        })
        count_after = await db[col].count_documents({})
        print(f"Collection '{col}': deleted {r.deleted_count} demo records ({count_before} -> {count_after})")

    # Clean demo bookings/games references
    r_book = await db.bookings.delete_many({
        "$or": [
            {"is_demo": True},
            {"facility_id": {"$in": DEMO_MOCK_IDS}},
        ]
    })
    print(f"Bookings: removed {r_book.deleted_count} demo booking records.")

    # Check genuine users count
    real_users = await db.users.count_documents({"is_demo": {"$ne": True}})
    print(f"\nReal user accounts preserved: {real_users}")

    # Sports catalog
    sports_count = await db.sports.count_documents({})
    print(f"Reference sports catalog items: {sports_count}")

    client.close()
    print("\nDatabase cleanup complete!")

if __name__ == "__main__":
    asyncio.run(clean_database())

"""Delete all remaining legacy template demo records from the database."""
import asyncio, os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def purge_all_demo():
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
    db = client[os.environ.get("DB_NAME", "kuvira")]

    legacy_ids = {
        "facilities": ["fac-hsr", "fac-bandra", "fac-koramangala", "fac-indiranagar", "fac-whitefield", "fac-hitec-city"],
        "players": ["player-arjun", "player-priya", "player-rohan", "player-sara", "player-anaya", "player-vikram", "player-rohit", "player-sneha", "player-kabir"],
        "coaches": ["coach-vikram", "coach-neha", "coach-marcus", "coach-priya"],
        "events": ["event-monsoon-mixer", "event-womens-clinic", "event-blitz-cup", "event-sunday-mixer", "event-masterclass"],
        "tournaments": ["trn-bangalore-open", "trn-mumbai-championship", "tourn-karnataka-state"],
        "products": ["prod-paddle-pro", "prod-paddle-control", "prod-court-shoes", "prod-balls", "prod-bag", "prod-apparel", "prod-pro-carbon-paddle", "prod-outdoor-balls-6pk", "prod-court-duffle"],
        "posts": ["post-1", "post-2", "post-3"],
        "games": ["game-1", "game-2", "game-3", "game-4"],
    }

    for col, ids in legacy_ids.items():
        res1 = await db[col].delete_many({"id": {"$in": ids}})
        res2 = await db[col].delete_many({"is_demo": True})
        print(f"Purged {col}: {res1.deleted_count + res2.deleted_count} demo documents deleted.")

    print("\nVerification of remaining counts:")
    for col in ["facilities", "players", "coaches", "events", "tournaments", "products", "posts", "games", "users", "organizations"]:
        cnt = await db[col].count_documents({})
        print(f"  {col}: {cnt}")
    client.close()

if __name__ == "__main__":
    asyncio.run(purge_all_demo())

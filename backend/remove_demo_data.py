"""Delete only records created by the former demo seeders.

Run once against the configured database after deploying the no-demo build:
    python remove_demo_data.py

User accounts and user-owned collections are intentionally not touched.
"""
import asyncio

from deps import db, client, log

COLLECTIONS = (
    "sports", "facilities", "players", "coaches", "events", "tournaments",
    "games", "products", "posts",
)


async def remove_demo_data() -> None:
    for collection_name in COLLECTIONS:
        result = await db[collection_name].delete_many({"is_demo": True})
        log.info("Removed %s demo records from %s", result.deleted_count, collection_name)


if __name__ == "__main__":
    try:
        asyncio.run(remove_demo_data())
    finally:
        client.close()

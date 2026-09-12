import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "kuvira")

async def fix():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    r1 = await db.events.update_many({"status": {"$exists": False}}, {"$set": {"status": "published"}})
    r2 = await db.tournaments.update_many({"status": {"$exists": False}}, {"$set": {"status": "published"}})
    facs = await db.facilities.find({"lat": {"$exists": True}, "location": {"$exists": False}}, {"_id": 0, "id": 1, "lat": 1, "lng": 1}).to_list(100)
    for f in facs:
        if f.get("lat") and f.get("lng"):
            await db.facilities.update_one({"id": f["id"]}, {"$set": {"location": {"type": "Point", "coordinates": [f["lng"], f["lat"]]}}})
    ec = await db.events.count_documents({})
    pub_e = await db.events.count_documents({"status": "published"})
    tc = await db.tournaments.count_documents({})
    pub_t = await db.tournaments.count_documents({"status": "published"})
    fc = await db.facilities.count_documents({"location": {"$exists": True}})
    print("Events:", ec, "total,", pub_e, "published, patched:", r1.modified_count)
    print("Tournaments:", tc, "total,", pub_t, "published, patched:", r2.modified_count)
    print("Facilities with location:", fc, "patched:", len(facs))
    client.close()

asyncio.run(fix())

"""Audit known demo records; --apply archives and removes them from live catalogs."""
import argparse
import asyncio
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from demo_records import CATALOG_COLLECTIONS, demo_query

async def clean(apply=False):
    load_dotenv()
    if not os.environ.get('MONGO_URL') or not os.environ.get('DB_NAME'):
        raise SystemExit('Set MONGO_URL and DB_NAME explicitly; no database defaults are used.')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    try:
        print('Mode:', 'APPLY' if apply else 'DRY RUN', 'Database:', db.name)
        for collection in CATALOG_COLLECTIONS:
            query = demo_query(collection)
            print(collection, 'matched:', await db[collection].count_documents(query))
            if not apply: continue
            async for document in db[collection].find(query):
                # Archive first, using a stable key so interrupted runs are retryable.
                archive_id = collection + ':' + str(document['_id'])
                await db.demo_cleanup_archive.update_one({'_id': archive_id}, {'$setOnInsert': {
                    'collection': collection, 'document': document,
                    'archived_at': datetime.now(timezone.utc).isoformat(),
                }}, upsert=True)
                await db[collection].delete_one({'_id': document['_id'], **query})
        print('Financial collections and the sports reference catalog are preserved.')
        print('Unmarked custom test records need explicit IDs; names are never used for deletion.')
    finally:
        client.close()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Archive matches and remove them from active collections')
    args = parser.parse_args()
    asyncio.run(clean(args.apply))

if __name__ == '__main__': main()

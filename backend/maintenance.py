"""Run independently with python -m maintenance, or alongside the AI worker."""
import asyncio
import logging
from datetime import timedelta
from deps import db, utcnow, PAYMENT_PROVIDER
from payments import expire_holds
from reservations import atomic, release
from trust import process_deletions, deliver_ticket
from ai_coach.storage import ObjectStorage

async def maintenance_once():
    if PAYMENT_PROVIDER=='payu':await expire_holds(db,100)
    # Older pre-transaction releases may contain bookings without a checkout record.
    cutoff=(utcnow()-timedelta(minutes=20)).isoformat()
    for kind,col in [('booking',db.bookings),('coach_session',db.coach_sessions)]:
        rows=await col.find({'status':'pending_payment','created_at':{'$lt':cutoff}},{'_id':0}).limit(100).to_list(100)
        for row in rows:
            async def operation(session):
                resource={'kind':kind,'id':row['id']}
                if not await db.payment_transactions.find_one({'resource.kind':kind,'resource.id':row['id']},session=session):await release(db,resource,session)
            await atomic(db,operation)
    await process_deletions()
    tickets=await db.support_tickets.find({'email_status':{'$in':['pending','retry_pending']}}).limit(30).to_list(30)
    for ticket in tickets:await deliver_ticket(ticket['id'])
    videos=await db.ai_coach_videos.find({'source_deleted_at':{'$exists':False},'$or':[{'source_cleanup_pending':True},{'created_at':{'$lt':(utcnow()-timedelta(days=7)).isoformat()}}]}).limit(50).to_list(50)
    for video in videos:
        if await db.ai_coach_jobs.find_one({'video_id':video['id'],'status':{'$in':['queued','processing']}}):continue
        try:
            await asyncio.to_thread(ObjectStorage().delete,video['storage'])
            await db.ai_coach_videos.update_one({'id':video['id']},{'$set':{'source_deleted_at':utcnow().isoformat(),'source_cleanup_pending':False}})
        except Exception:logging.exception('Video cleanup will retry')

async def maintenance_loop():
    while True:
        try:await maintenance_once()
        except Exception:logging.exception('Maintenance will retry')
        await asyncio.sleep(30)

if __name__=='__main__':asyncio.run(maintenance_loop())

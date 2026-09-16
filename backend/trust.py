"""Support tickets, moderation and explicit account deletion requests."""
import asyncio
import os
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from deps import db, current_user, require_platform_admin, KuviraError, gen_id, utcnow

router=APIRouter(prefix='/api')
CONTACT='contact@kuvirasports.com'
POLICY_VERSION='2026-09-13'

class Ticket(BaseModel):
    category: str = 'general'
    resource_type: str | None = None
    resource_id: str | None = None
    message: str = Field(min_length=10,max_length=4000)
    email: str = Field(min_length=5,max_length=254)

def start_time(item):
    raw=str(item.get('date') or '')
    if len(raw)==10:
        slot=str(item.get('slot') or item.get('start_time') or '')
        if not slot: raise KuviraError(409,'TIME_UNAVAILABLE','Contact support directly; the start time is not available')
        raw += 'T'+slot.split('-')[0]
    try:
        value=datetime.fromisoformat(raw.replace('Z','+00:00'))
        return value.replace(tzinfo=timezone(timedelta(hours=5,minutes=30))) if value.tzinfo is None else value
    except ValueError: raise KuviraError(409,'TIME_UNAVAILABLE','Contact support directly; the start time is not available')

async def deliver_ticket(ticket_id):
    ticket=await db.support_tickets.find_one({'id':ticket_id,'email_status':{'$ne':'sent'}})
    if not ticket or not os.environ.get('SMTP_HOST'): return
    def send():
        msg=EmailMessage();msg['From']=os.environ['SMTP_FROM'];msg['To']=CONTACT
        msg['Message-ID']=f"<matchdrome-{ticket_id}@kuvirasports.com>"
        msg['Reply-To']=ticket['email'];msg['Subject']=f"MatchDrome support {ticket_id}: {ticket['category']}"
        msg.set_content(f"Ticket: {ticket_id}\nAccount: {ticket['user_id']}\nResource: {ticket.get('resource_type')} / {ticket.get('resource_id')}\n\n{ticket['message']}")
        with smtplib.SMTP(os.environ['SMTP_HOST'],int(os.environ.get('SMTP_PORT','587')),timeout=15) as smtp:
            smtp.starttls();smtp.login(os.environ['SMTP_USER'],os.environ['SMTP_PASSWORD']);smtp.send_message(msg)
    try:
        await asyncio.to_thread(send)
        await db.support_tickets.update_one({'id':ticket_id},{'$set':{'email_status':'sent'}})
    except Exception:
        await db.support_tickets.update_one({'id':ticket_id},{'$set':{'email_status':'retry_pending'}})

@router.post('/support/tickets')
async def create_ticket(body:Ticket,tasks:BackgroundTasks,user=Depends(current_user)):
    if '\n' in body.email or '\r' in body.email or '@' not in body.email:
        raise KuviraError(400,'INVALID_EMAIL','Enter a valid reply email')
    if body.category not in ('general','cancellation','privacy'):
        raise KuviraError(400,'INVALID_CATEGORY','Choose a supported category')
    if body.category=='cancellation':
        mapping={'booking':db.bookings,'coach_session':db.coach_sessions,'tournament_registration':db.tournament_registrations,'game':db.games}
        collection=mapping.get(body.resource_type)
        if collection is None: raise KuviraError(400,'INVALID_RESOURCE','Select a booking or registration')
        query={'id':body.resource_id,'user_id':user['id']}
        if body.resource_type=='game':query={'id':body.resource_id,'$or':[{'host_id':user['id']},{'current_players':user['id']}]}
        item=await collection.find_one(query)
        if not item: raise KuviraError(404,'BOOKING_NOT_FOUND','Booking not found')
        if body.resource_type=='tournament_registration':item=await db.tournaments.find_one({'id':item['tournament_id']}) or {}
        if start_time(item)-utcnow()<timedelta(hours=4):
            raise KuviraError(409,'CANCELLATION_WINDOW_CLOSED','Cancellation inquiries must be submitted at least 4 hours before the start. Contact support for other assistance.')
    recent=await db.support_tickets.count_documents({'user_id':user['id'],'created_at':{'$gt':(utcnow()-timedelta(hours=1)).isoformat()}})
    if recent>=10: raise KuviraError(429,'TICKET_LIMIT','Please wait before creating another ticket')
    ticket={'id':gen_id(),'user_id':user['id'],**body.model_dump(),'created_at':utcnow().isoformat(),'status':'open','email_status':'pending'}
    await db.support_tickets.insert_one(dict(ticket));tasks.add_task(deliver_ticket,ticket['id']);return ticket

@router.get('/support/tickets')
async def tickets(user=Depends(current_user)):
    return await db.support_tickets.find({'user_id':user['id']},{'_id':0}).sort('created_at',-1).to_list(100)

class Report(BaseModel):
    reason:str=Field(min_length=5,max_length=1000)

@router.post('/posts/{post_id}/report')
async def report_post(post_id:str,body:Report,user=Depends(current_user)):
    if not await db.posts.find_one({'id':post_id}):raise KuviraError(404,'POST_NOT_FOUND','Post unavailable')
    await db.community_reports.update_one({'post_id':post_id,'user_id':user['id']},{'$setOnInsert':{'id':gen_id(),'status':'open','created_at':utcnow().isoformat()},'$set':{'reason':body.reason}},upsert=True)
    return {'reported':True}

@router.post('/users/{target_id}/block')
async def block_user(target_id:str,user=Depends(current_user)):
    if target_id==user['id']:raise KuviraError(400,'INVALID_BLOCK','You cannot block yourself')
    await db.user_blocks.update_one({'user_id':user['id'],'target_id':target_id},{'$set':{'created_at':utcnow().isoformat()}},upsert=True)
    return {'blocked':True}

@router.delete('/users/{target_id}/block')
async def unblock_user(target_id:str,user=Depends(current_user)):
    await db.user_blocks.delete_many({'user_id':user['id'],'target_id':target_id});return {'unblocked':True}

@router.get('/users/me/blocked')
async def blocked_users(user=Depends(current_user)):
    return await db.user_blocks.find({'user_id':user['id']},{'_id':0}).to_list(500)

class Consent(BaseModel):
    version:str
@router.post('/community/consent')
async def consent(body:Consent,user=Depends(current_user)):
    if body.version!=POLICY_VERSION:raise KuviraError(409,'POLICY_UPDATED','Review the current community rules')
    await db.users.update_one({'id':user['id']},{'$set':{'community_policy_version':POLICY_VERSION}});return {'accepted':True}

@router.get('/admin/support-tickets')
async def admin_tickets(user=Depends(require_platform_admin())):
    return await db.support_tickets.find({},{'_id':0}).sort('created_at',-1).to_list(300)

@router.get('/admin/community-reports')
async def admin_reports(user=Depends(require_platform_admin())):
    reports=await db.community_reports.find({'status':'open'},{'_id':0}).sort('created_at',-1).to_list(300)
    for report in reports:report['post']=await db.posts.find_one({'id':report['post_id']},{'_id':0})
    return reports

class Moderation(BaseModel):
    action:str
@router.post('/admin/community-reports/{report_id}')
async def moderate(report_id:str,body:Moderation,user=Depends(require_platform_admin())):
    report=await db.community_reports.find_one({'id':report_id})
    if not report:raise KuviraError(404,'REPORT_NOT_FOUND','Report not found')
    if body.action not in ('dismiss','hide'):raise KuviraError(400,'INVALID_ACTION','Choose hide or dismiss')
    if body.action=='hide':await db.posts.update_one({'id':report['post_id']},{'$set':{'moderation_status':'hidden'}})
    await db.community_reports.update_one({'id':report_id},{'$set':{'status':'resolved','action':body.action,'resolved_by':user['id']}})
    return {'resolved':True}

class DeleteAccount(BaseModel):
    confirmation:str
@router.post('/account/deletion')
async def delete_account(body:DeleteAccount,user=Depends(current_user)):
    if body.confirmation!='DELETE':raise KuviraError(400,'CONFIRM_REQUIRED','Type DELETE to request deletion')
    # Preserve requests through external-provider outages; no false success on partial deletion.
    await db.account_deletions.update_one({'user_id':user['id']},{'$setOnInsert':{'id':gen_id(),'status':'pending','created_at':utcnow().isoformat()}},upsert=True)
    await db.users.update_one({'id':user['id']},{'$set':{'deletion_requested':True}})
    return {'status':'pending','message':'Your account is disabled. Personal data deletion will be processed; financial records required for bookings, disputes and legal obligations are retained.'}

async def process_deletions():
    from ai_coach.storage import ObjectStorage
    from profile_media import ProfileMediaStorage
    rows=await db.account_deletions.find({'status':'pending'}).to_list(20)
    for request in rows:
        uid=request['user_id'];user=await db.users.find_one({'id':uid})
        if not user or user.get('deleted'):
            await db.account_deletions.update_one({'user_id':uid},{'$set':{'status':'completed','completed_at':utcnow().isoformat()}})
            continue
        # Do not delete a source object while an analysis worker still uses it.
        if await db.ai_coach_jobs.find_one({'user_id':uid,'status':'processing'}):continue
        try:
            videos=await db.ai_coach_videos.find({'user_id':uid}).to_list(10000)
            for video in videos:
                if video.get('storage') and not video.get('source_deleted_at'):await asyncio.to_thread(ObjectStorage().delete,video['storage'])
            if user.get('avatar_storage'):await asyncio.to_thread(ProfileMediaStorage().delete,user['avatar_storage'])
            if os.environ.get('OTP_PROVIDER')=='firebase' and user.get('mobile'):
                from firebase_auth import _ensure_initialized
                from firebase_admin import auth
                _ensure_initialized()
                try:
                    account=await asyncio.to_thread(auth.get_user_by_phone_number,user['mobile']);await asyncio.to_thread(auth.delete_user,account.uid)
                except auth.UserNotFoundError:pass
            for name in ['players','carts','post_likes','user_blocks','ai_coach_matches','ai_coach_videos','ai_coach_jobs','ai_coach_analytics','ai_coach_reports','ai_coach_chat','ai_coach_coaching_states','ai_coach_goals','ai_coach_training_assignments','ai_coach_training','ai_coach_player_state','ai_coach_recommendations','ai_coach_coaching_events','training_plans','training_activity']:
                await db[name].delete_many({'$or':[{'user_id':uid},{'id':uid}]})
            await db.posts.delete_many({'author_id':uid})
            await db.organization_memberships.update_many({'user_id':uid},{'$set':{'status':'inactive'}})
            await db.users.replace_one({'id':uid},{'id':uid,'mobile':'deleted:'+uid,'name':'Deleted account','deleted':True})
            await db.account_deletions.update_one({'user_id':uid},{'$set':{'status':'completed','completed_at':utcnow().isoformat()}})
        except Exception:
            await db.account_deletions.update_one({'user_id':uid},{'$set':{'last_attempt_at':utcnow().isoformat()}})

@router.get('/support/resources')
async def support_resources(user=Depends(current_user)):
    result=[]
    for kind,collection in [('booking',db.bookings),('coach_session',db.coach_sessions),('tournament_registration',db.tournament_registrations)]:
        rows=await collection.find({'user_id':user['id']},{'_id':0}).sort('created_at',-1).to_list(100)
        for r in rows:result.append({'id':r['id'],'resource_type':kind,'label':f"{kind.replace('_',' ')} · {r.get('facility_name') or r.get('date') or r['id']}"})
    games=await db.games.find({'$or':[{'host_id':user['id']},{'current_players':user['id']}]},{'_id':0}).to_list(100)
    for g in games:result.append({'id':g['id'],'resource_type':'game','label':f"Game · {g.get('sport','Sport')} · {g.get('date','')}"})
    return result

class TicketUpdate(BaseModel):
    status:str
    response:str=Field(min_length=1,max_length=4000)
@router.patch('/admin/support-tickets/{ticket_id}')
async def update_ticket(ticket_id:str,body:TicketUpdate,user=Depends(require_platform_admin())):
    if body.status not in ('open','in_review','resolved'):raise KuviraError(400,'INVALID_STATUS','Choose a valid status')
    result=await db.support_tickets.update_one({'id':ticket_id},{'$set':{'status':body.status,'response':body.response,'updated_by':user['id'],'updated_at':utcnow().isoformat()}})
    if not result.matched_count:raise KuviraError(404,'TICKET_NOT_FOUND','Ticket not found')
    return {'updated':True}

@router.get('/registrations/mine')
async def my_registrations(user=Depends(current_user)):
    tournaments = await db.tournament_registrations.find({'user_id':user['id']},{'_id':0}).sort('created_at',-1).to_list(100)
    events = await db.event_registrations.find({'user_id':user['id']},{'_id':0}).sort('created_at',-1).to_list(100)
    result = []
    for registration in tournaments:
        item = dict(registration); item['resource_type'] = 'tournament_registration'; result.append(item)
    for registration in events:
        event = await db.events.find_one({'id': registration['event_id']}, {'_id': 0, 'name': 1, 'date': 1, 'venue': 1, 'image': 1, 'price': 1})
        item = dict(registration)
        item.update({'resource_type': 'event_registration', 'event_name': (event or {}).get('name', 'Event'), 'event_date': (event or {}).get('date'), 'event_venue': (event or {}).get('venue'), 'event_image': (event or {}).get('image', ''), 'price': (event or {}).get('price', 0)})
        result.append(item)
    return sorted(result, key=lambda item: item.get('created_at', ''), reverse=True)

"""Kuvira Sports — backend API.

MVP scope:
- Mobile+OTP auth (mock: any number, OTP=123456), JWT
- Users, Player profiles, Sports, Facilities, Courts, Bookings (mock payment)
- Games (open games), Player matching (rule-based scoring, upgradeable to ML)
- Community posts, Products, Cart, Orders (mock payment)
- AI Coach chat (Claude Sonnet 4.6 via emergentintegrations)
- Coaches, Events, Tournaments discovery
- Seeder for demo data
"""
import os
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pymongo.errors import DuplicateKeyError

from seed_data import SPORTS, SKILL_LEVELS, FACILITIES, PLAYERS, COACHES, EVENTS, TOURNAMENTS, GAMES, PRODUCTS, COMMUNITY_POSTS
from deps import db, client, gen_id, utcnow, strip_id, make_token, current_user, optional_user, current_capabilities, _load_capabilities, KuviraError, log, configure_logging, request_id_ctx, EMERGENT_LLM_KEY, CORS_ALLOWED_ORIGINS, APP_ENV, IS_PROD
import otp_service
import features
import org_admin

PLATFORM_ADMIN_MOBILES = [m.strip() for m in os.environ.get("PLATFORM_ADMIN_MOBILES", "").split(",") if m.strip()]
configure_logging()
app = FastAPI(title="Kuvira Sports API")
api = APIRouter(prefix="/api")

class OTPStart(BaseModel): mobile: str
class OTPVerify(BaseModel): mobile: str; otp: str
class OnboardingPayload(BaseModel):
    name: str; city: Optional[str] = "Bangalore"; area: Optional[str] = None; primary_sport: str = "sport-pickleball"; sports: List[str] = ["sport-pickleball"]; skill_level: str = "Beginner"; playing_frequency: Optional[str] = "1-2x per week"; competitive: Optional[str] = "Recreational"; preferred_times: Optional[List[str]] = None; radius_km: Optional[int] = 5; goals: Optional[List[str]] = None
class BookingCreate(BaseModel):
    facility_id: str; court_number: int = 1; date: str; slot: str; duration_min: int = 60
class GameCreate(BaseModel):
    sport: str = "sport-pickleball"; facility_id: str; date: str; duration_min: int = 60; skill_level: str; format: str = "Doubles"; max_players: int = 4; price_per_person: int = 200; notes: Optional[str] = ""
class PostCreate(BaseModel): content: str; image: Optional[str] = None
class CartAdd(BaseModel): product_id: str; qty: int = 1
class OrderCreate(BaseModel): address: Dict[str, str]
class ChatMessage(BaseModel): text: str; session_id: Optional[str] = None

async def seed_if_empty():
    if await db.sports.count_documents({}) == 0: await db.sports.insert_many([s.copy() for s in SPORTS])
    if await db.facilities.count_documents({}) == 0: await db.facilities.insert_many([f.copy() for f in FACILITIES])
    if await db.players.count_documents({}) == 0: await db.players.insert_many([p.copy() for p in PLAYERS])
    if await db.coaches.count_documents({}) == 0: await db.coaches.insert_many([c.copy() for c in COACHES])
    if await db.events.count_documents({}) == 0: await db.events.insert_many([e.copy() for e in EVENTS])
    if await db.tournaments.count_documents({}) == 0: await db.tournaments.insert_many([t.copy() for t in TOURNAMENTS])
    if await db.games.count_documents({}) == 0: await db.games.insert_many([g.copy() for g in GAMES])
    if await db.products.count_documents({}) == 0: await db.products.insert_many([p.copy() for p in PRODUCTS])
    if await db.posts.count_documents({}) == 0: await db.posts.insert_many([p.copy() for p in COMMUNITY_POSTS])
    log.info("Seed complete.")

async def ensure_indexes():
    await db.users.create_index("mobile", unique=True); await db.users.create_index("referral_code", sparse=True)
    await db.bookings.create_index([('facility_id',1),('court_number',1),('date',1),('slot',1)], unique=True, name='uniq_slot'); await db.bookings.create_index('user_id')
    await db.coach_sessions.create_index([('coach_id',1),('date',1),('slot',1)], unique=True, name='uniq_coach_slot'); await db.coach_sessions.create_index('user_id')
    await db.organization_memberships.create_index([('user_id',1),('org_id',1)], unique=True); await db.organization_memberships.create_index('org_id')
    await db.facilities.create_index('org_id', sparse=True); await db.facilities.create_index('city'); await db.games.create_index('facility_id'); await db.orders.create_index('user_id'); await db.posts.create_index('created_at'); await db.training_plans.create_index('user_id'); await db.training_activity.create_index([('user_id',1),('day',1)], unique=True)
    log.info('Indexes ensured.')

@app.on_event('startup')
async def _startup():
    await ensure_indexes();
    if not IS_PROD: await seed_if_empty()
    else: log.info('Production mode: demo seeding skipped.')

@app.on_event('shutdown')
async def _shutdown(): client.close()

@app.middleware('http')
async def add_request_id(request: Request, call_next):
    rid = request.headers.get('X-Request-ID') or gen_id(); request_id_ctx.set(rid); start = utcnow(); response = await call_next(request); ms = int((utcnow()-start).total_seconds()*1000); response.headers['X-Request-ID']=rid; log.info('%s %s -> %s (%dms)', request.method, request.url.path, response.status_code, ms); return response

@app.exception_handler(KuviraError)
async def kuvira_error_handler(request: Request, exc: KuviraError): return JSONResponse(status_code=exc.status_code, content={'error': {'code': exc.code, 'message': exc.message}, 'request_id': request_id_ctx.get()})
@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    detail=exc.detail; content={'error': detail if isinstance(detail,dict) and 'code' in detail else {'code':'HTTP_ERROR','message':str(detail)},'request_id':request_id_ctx.get()}; return JSONResponse(status_code=exc.status_code, content=content)
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError): return JSONResponse(status_code=422, content={'error': {'code':'VALIDATION_ERROR','message':'Invalid request','details':exc.errors()[:5]},'request_id':request_id_ctx.get()})

@api.get('/')
async def root(): return {'app':'Kuvira Sports','status':'ok','env':APP_ENV}
@api.get('/health')
async def health(): return {'status':'ok','time':utcnow().isoformat()}
@api.get('/readiness')
async def readiness():
    try: await db.command('ping'); return {'ready':True}
    except Exception: raise KuviraError(503,'NOT_READY','Database not reachable')

@api.post('/auth/otp/start')
async def otp_start(body: OTPStart):
    mobile=body.mobile.strip();
    if len(mobile)<6: raise KuviraError(400,'INVALID_MOBILE','Invalid mobile number')
    return await otp_service.send_otp(mobile)

@api.post('/auth/otp/verify')
async def otp_verify(body: OTPVerify):
    mobile=body.mobile.strip(); ok=await otp_service.verify_otp(mobile,body.otp)
    if not ok: raise KuviraError(400,'OTP_INVALID','Invalid or expired OTP')
    user=await db.users.find_one({'mobile':mobile},{'_id':0}); is_new=False
    if not user or user.get('invited'):
        if user and user.get('invited'):
            await db.users.update_one({'id':user['id']},{'$set':{'invited':False}}); user=await db.users.find_one({'id':user['id']},{'_id':0}); is_new=not user.get('onboarded')
        else:
            user={'id':gen_id(),'mobile':mobile,'name':None,'avatar':None,'city':None,'area':None,'primary_sport':None,'sports':[],'skill_level':None,'onboarded':False,'credits':0,'created_at':utcnow().isoformat()}; await db.users.insert_one(user.copy()); is_new=True
    if mobile in PLATFORM_ADMIN_MOBILES and not user.get('is_platform_admin'):
        await db.users.update_one({'id':user['id']},{'$set':{'is_platform_admin':True}}); user['is_platform_admin']=True
    token=make_token(user['id']); return {'token':token,'user':strip_id(user),'is_new':is_new}

@api.get('/me')
async def me(user=Depends(current_user)): return {**user,'capabilities':await _load_capabilities(user)}

@api.get('/capabilities')
async def capabilities(caps=Depends(current_capabilities)): return caps

@api.post('/onboarding')
async def onboarding(body: OnboardingPayload, user=Depends(current_user)):
    update=body.model_dump(); update['onboarded']=True; update['updated_at']=utcnow().isoformat();
    if not update.get('avatar'): update['avatar']=f"https://i.pravatar.cc/300?img={abs(hash(user['id']))%70}"
    await db.users.update_one({'id':user['id']},{'$set':update}); return await db.users.find_one({'id':user['id']},{'_id':0})

@api.get('/sports')
async def list_sports(): return await db.sports.find({}, {'_id':0}).sort('order',1).to_list(50)
@api.get('/skill-levels')
async def list_skills(): return SKILL_LEVELS

@api.get('/facilities')
async def list_facilities(city:Optional[str]=None,sport:Optional[str]=None):
    q={};
    if city:q['city']=city
    if sport:q['sports']=sport
    return await db.facilities.find(q,{'_id':0}).to_list(200)
@api.get('/facilities/{fid}')
async def get_facility(fid:str):
    f=await db.facilities.find_one({'id':fid},{'_id':0});
    if not f: raise HTTPException(404,'Facility not found')
    return f

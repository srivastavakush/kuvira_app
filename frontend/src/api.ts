import { sendVideoChunks } from './direct-upload';
import { notifySession } from './session-events';
import { friendlyError } from './errors';
// API client for the MatchDrome backend.
import Constants from 'expo-constants';
import { File as ExpoFile, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

function resolveBaseUrl(): string {
  // An explicit Expo value is the source of truth for every platform.  The
  // previous order preferred Expo Go's host IP and silently changed the port
  // to 8000, which made a correctly configured backend look offline.
  const configuredUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    const port = process.env.EXPO_PUBLIC_BACKEND_PORT?.trim() || '8000';
    return `http://${ip}:${port}`;
  }
  // A physical device cannot use localhost. Set EXPO_PUBLIC_BACKEND_URL in
  // frontend/.env when it is not started by Expo Go on the same LAN.
  return 'http://localhost:8000';
}

const BASE = resolveBaseUrl();
export const apiBaseUrl = BASE;
const TOKEN_KEY = 'kuvira_auth_token';
const uploadSessions=new Map<string,any>();
export async function getToken(): Promise<string|null>{return await storage.secureGet<string>(TOKEN_KEY,'');}
export async function setToken(token:string){const saved = await storage.secureSet(TOKEN_KEY,token);if (!saved) throw new Error('Could not save your session. Please allow storage and try again.');notifySession();} export async function clearToken(){uploadSessions.clear();await storage.secureRemove(TOKEN_KEY);notifySession();}
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; } }
export class ApiConnectionError extends Error {
  constructor() {
    super('Connection interrupted. Check your internet and try again.');
    this.name = 'ApiConnectionError';
  }
}

async function request<T=any>(path:string,opts:RequestInit={}):Promise<T>{
  const token=await getToken();
  const headers:Record<string,string>={'Content-Type':'application/json',...(opts.headers as Record<string,string>|undefined)};
  if(token)headers.Authorization=`Bearer ${token}`;
  let res: Response; let text: string;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try { res=await fetch(`${BASE}/api${path}`,{...opts,headers,signal:opts.signal || controller.signal}); text=await res.text(); }
  catch { throw new ApiConnectionError(); }
  finally { clearTimeout(timeout); }
  let data:any=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok)throw new ApiError(res.status, friendlyError(data?.error?.message||data?.detail||`HTTP ${res.status}`));return data as T;
}

/**
 * Expo SDK 57's fetch implementation only accepts standards-compliant Blob/File
 * parts. Use Expo FileSystem's native multipart uploader instead of the old
 * React Native `{ uri, name, type }` pseudo-file object.
 */
async function uploadMultipart<T=any>(path:string,fileUri:string,_fileName:string,mimeType:string,parameters:Record<string,string>={},onProgress?:(percent:number)=>void):Promise<T>{
  const token=await getToken();
  let result:{status:number;body:string};
  try{
    if (Platform.OS === 'web') {
      const selected = await fetch(fileUri);
      if (!selected.ok) throw new Error('Could not read the selected file. Please choose it again.');
      const blob = await selected.blob();
      const form = new FormData();
      form.append('file', blob, _fileName);
      Object.entries(parameters).forEach(([key,value]) => form.append(key,value));
      result = await new Promise<{ status:number; body:string }>((resolve,reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/api${path}`);
        xhr.timeout = 600000;
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = event => { if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(100, Math.round(event.loaded / event.total * 100))); };
        xhr.onerror = () => reject(new ApiConnectionError());
        xhr.ontimeout = () => reject(new ApiConnectionError());
        xhr.onabort = () => reject(new Error('Upload cancelled. Your selected file is ready to retry.'));
        xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
        xhr.send(form);
      });
    } else {
      const file=new ExpoFile(fileUri);
      result=await file.upload(`${BASE}/api${path}`,{
        httpMethod:'POST', uploadType:UploadType.MULTIPART, fieldName:'file', mimeType,
        parameters, sessionType:'foreground', headers:token?{Authorization:`Bearer ${token}`}:{},
        onProgress: ({ bytesSent, totalBytes }) => { if (totalBytes > 0) onProgress?.(Math.min(100, Math.round(bytesSent / totalBytes * 100))); },
      });
    }
  }catch(error:any){
    const message=String(error?.message||'');
    if(/network|connection|timed out|failed to fetch/i.test(message))throw new ApiConnectionError();
    throw new Error(friendlyError(message, 'Could not read the selected file. Please choose it again.'));
  }
  let data:any=null;try{data=result.body?JSON.parse(result.body):null}catch{data=result.body}
  if(result.status<200||result.status>=300)throw new Error(friendlyError((data?.error?.message||data?.detail)||`HTTP ${result.status}`));
  return data as T;
}
export const api={
  myRegistrations:()=>request('/registrations/mine'),
  supportResources:()=>request('/support/resources'),
  supportTickets:()=>request('/support/tickets'),
  createTicket:(p:any)=>request('/support/tickets',{method:'POST',body:JSON.stringify(p)}),
  deleteAccount:()=>request('/account/deletion',{method:'POST',body:JSON.stringify({confirmation:'DELETE'})}),
  reportPost:(id:string,reason:string)=>request(`/posts/${id}/report`,{method:'POST',body:JSON.stringify({reason})}),
  blockUser:(id:string)=>request(`/users/${id}/block`,{method:'POST'}),
  unblockUser:(id:string)=>request(`/users/${id}/block`,{method:'DELETE'}),
  blockedUsers:()=>request('/users/me/blocked'),
  communityConsent:()=>request('/community/consent',{method:'POST',body:JSON.stringify({version:'2026-09-13'})}),
  updateSupportTicket:(id:string,p:any)=>request(`/admin/support-tickets/${id}`,{method:'PATCH',body:JSON.stringify(p)}),
  adminSupportTickets:()=>request('/admin/support-tickets'),
  adminCommunityReports:()=>request('/admin/community-reports'),
  moderateReport:(id:string,action:string)=>request(`/admin/community-reports/${id}`,{method:'POST',body:JSON.stringify({action})}),
  adminOverview:()=>request('/admin/overview'), adminUsers:(q='')=>request(`/admin/users?q=${encodeURIComponent(q)}`), adminTransactions:()=>request('/admin/transactions'), adminSystemHealth:()=>request('/admin/system-health'),
  health:()=>request('/health'), otpStart:(mobile:string)=>request('/auth/otp/start',{method:'POST',body:JSON.stringify({mobile})}), otpVerify:(mobile:string,otp:string)=>request('/auth/otp/verify',{method:'POST',body:JSON.stringify({mobile,otp})}), me:()=>request('/me'), onboarding:(p:any)=>request('/onboarding',{method:'POST',body:JSON.stringify(p)}),
  sports:()=>request('/sports'), facilities:(p:any={})=>request(`/facilities${Object.keys(p).length?'?'+new URLSearchParams(p).toString():''}`), facility:(id:string)=>request(`/facilities/${id}`), availability:(id:string,date:string)=>request(`/facilities/${id}/availability?date=${date}`),
  facilitiesNearby:(lat:number,lng:number,radiusKm=25,sport?:string)=>request(`/facilities/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}${sport?'&sport='+sport:''}`),
  cities:()=>request('/cities'),
  updateMyLocation:(lat:number,lng:number,city?:string,state?:string,area?:string)=>request('/users/me/location',{method:'POST',body:JSON.stringify({lat,lng,city,state,area})}),
  uploadMyAvatar:(fileUri:string,fileName='profile.jpg',mimeType='image/jpeg',onProgress?:(percent:number)=>void)=>uploadMultipart('/users/me/avatar',fileUri,fileName,mimeType,{},onProgress),
  createBooking:(p:any)=>request('/bookings',{method:'POST',body:JSON.stringify(p)}),myBookings:()=>request('/bookings/mine'),games:(p:any={})=>request(`/games${Object.keys(p).length?'?'+new URLSearchParams(p).toString():''}`),game:(id:string)=>request(`/games/${id}`),createGame:(p:any)=>request('/games',{method:'POST',body:JSON.stringify(p)}),joinGame:(id:string)=>request(`/games/${id}/join`,{method:'POST'}),
  paymentStatus:(id:string)=>request(`/payments/${id}`),
  players:()=>request('/players'),player:(id:string)=>request(`/players/${id}`),posts:()=>request('/posts'),createPost:(p:any)=>request('/posts',{method:'POST',body:JSON.stringify(p)}),likePost:(id:string)=>request(`/posts/${id}/like`,{method:'POST'}),
  coaches:()=>request('/coaches'),coach:(id:string)=>request(`/coaches/${id}`),
  events:(p?:{city?:string,published_only?:boolean})=>request(`/events${p&&Object.keys(p).length?'?'+new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v])=>v!=null).map(([k,v])=>[k,String(v)]))).toString():''}`),
  event:(id:string)=>request(`/events/${id}`),
  registerEvent:(id:string,customer_email?:string)=>request(`/events/${id}/register`,{method:'POST',body:JSON.stringify({customer_email})}),
  tournaments:(p?:{city?:string,published_only?:boolean})=>request(`/tournaments${p&&Object.keys(p).length?'?'+new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v])=>v!=null).map(([k,v])=>[k,String(v)]))).toString():''}`),
  tournament:(id:string)=>request(`/tournaments/${id}`),
  registerTournament:(id:string,customer_email?:string)=>request(`/tournaments/${id}/register`,{method:'POST',body:JSON.stringify({customer_email})}),
  products:(p:any={})=>request(`/products${Object.keys(p).length?'?'+new URLSearchParams(p).toString():''}`),product:(id:string)=>request(`/products/${id}`),recommendedProducts:()=>request('/products/recommend/for-me'),cart:()=>request('/cart'),addToCart:(product_id:string,qty=1)=>request('/cart/add',{method:'POST',body:JSON.stringify({product_id,qty})}),removeFromCart:(product_id:string)=>request('/cart/remove',{method:'POST',body:JSON.stringify({product_id,qty:1})}),createOrder:(address:any,customer_email?:string)=>request('/orders',{method:'POST',body:JSON.stringify({address,customer_email})}),myOrders:()=>request('/orders/mine'),
  aiChat:(text:string,session_id?:string)=>request('/ai/coach/chat',{method:'POST',body:JSON.stringify({text,session_id})}),aiHistory:(session_id?:string)=>request(`/ai/coach/history${session_id?'?session_id='+session_id:''}`),aiInsights:()=>request('/ai/insights'),aiRecommendations:()=>request('/ai/recommendations'),
  aiCoach:{
    createMatch:(p:any)=>request('/ai-coach/matches',{method:'POST',body:JSON.stringify(p)}),listMatches:()=>request('/ai-coach/matches'),
    uploadConfig:()=>request('/ai-coach/upload-config'),
    uploadVideo:async(fileUri:string,matchId?:string,fileName='match.mp4',mimeType='video/mp4',onProgress?:(percent:number)=>void)=>{
      const config=await request('/ai-coach/upload-config');
      if(!config.direct)return uploadMultipart('/ai-coach/videos',fileUri,fileName,mimeType,matchId?{match_id:matchId}:{},onProgress);
      const size=Platform.OS==='web'?(await (await fetch(fileUri)).blob()).size:new ExpoFile(fileUri).size;
      if(size>config.max_bytes)throw new Error(`Choose a video under ${Math.floor(config.max_bytes/1024/1024)} MB`);
      const cacheKey=`${await getToken()}:${matchId}:${fileUri}:${size}`;
      const cached=uploadSessions.get(cacheKey);
      const session=cached||await request('/ai-coach/videos/upload-session',{method:'POST',body:JSON.stringify({match_id:matchId,filename:fileName,mime_type:mimeType,size_bytes:size})});
      uploadSessions.set(cacheKey,session);
      await sendVideoChunks(session.upload_url,fileUri,session.chunk_bytes,onProgress,!!cached);
      const result=await request(`/ai-coach/videos/${session.id}/complete`,{method:'POST'});
      uploadSessions.delete(cacheKey);return result;
    },
    startAnalysis:(match_id:string,video_id:string)=>request('/ai-coach/analyze',{method:'POST',body:JSON.stringify({match_id,video_id})}),analysisStatus:(job_id:string)=>request(`/ai-coach/analysis/${job_id}`),matchReport:(match_id:string,refresh=false)=>request(`/ai-coach/match/${match_id}/report${refresh?'?refresh=true':''}`),playerPerformance:()=>request('/ai-coach/player-performance'),
    chat:(text:string,opts:{session_id?:string;match_id?:string}={})=>request('/ai-coach/chat',{method:'POST',body:JSON.stringify({text,...opts})}),history:(session_id?:string)=>request(`/ai-coach/history${session_id?'?session_id='+session_id:''}`),seedKnowledge:()=>request('/ai-coach/knowledge/seed',{method:'POST'}),
    coachingState:()=>request('/ai-coach/coaching-state'),createGoal:(title:string,target?:string,due_at?:string)=>request('/ai-coach/goals',{method:'POST',body:JSON.stringify({title,target,due_at})}),updateGoal:(id:string,status:string)=>request(`/ai-coach/goals/${id}`,{method:'PATCH',body:JSON.stringify({status})}),training:()=>request('/ai-coach/training'),trainingOutcome:(id:string,status:string,outcome?:any)=>request(`/ai-coach/training/${id}/outcome`,{method:'POST',body:JSON.stringify({status,outcome})}),
  },
  capabilities:()=>request('/capabilities'),
  adminClubs:()=>request('/admin/clubs'),adminCreateClub:(p:any)=>request('/admin/clubs',{method:'POST',body:JSON.stringify(p)}),adminAssignOwner:(orgId:string,p:any)=>request(`/admin/clubs/${orgId}/owner`,{method:'POST',body:JSON.stringify(p)}),adminFacilities:(orgId:string)=>request(`/admin/clubs/${orgId}/facilities`),adminCreateFacility:(orgId:string,p:any)=>request(`/admin/clubs/${orgId}/facilities`,{method:'POST',body:JSON.stringify(p)}),adminUpdateFacility:(orgId:string,id:string,p:any)=>request(`/admin/clubs/${orgId}/facilities/${id}`,{method:'PATCH',body:JSON.stringify(p)}),adminDeleteFacility:(orgId:string,id:string)=>request(`/admin/clubs/${orgId}/facilities/${id}`,{method:'DELETE'}),
  adminEvents:()=>request('/admin/events'),adminCreateEvent:(p:any)=>request('/admin/events',{method:'POST',body:JSON.stringify(p)}),adminUpdateEvent:(id:string,p:any)=>request(`/admin/events/${id}`,{method:'PATCH',body:JSON.stringify(p)}),adminDeleteEvent:(id:string)=>request(`/admin/events/${id}`,{method:'DELETE'}),
  adminTournaments:()=>request('/admin/tournaments'),adminCreateTournament:(p:any)=>request('/admin/tournaments',{method:'POST',body:JSON.stringify(p)}),adminUpdateTournament:(id:string,p:any)=>request(`/admin/tournaments/${id}`,{method:'PATCH',body:JSON.stringify(p)}),adminDeleteTournament:(id:string)=>request(`/admin/tournaments/${id}`,{method:'DELETE'}),
  adminProducts:()=>request('/admin/products'),adminCreateProduct:(p:any)=>request('/admin/products',{method:'POST',body:JSON.stringify(p)}),adminUpdateProduct:(id:string,p:any)=>request(`/admin/products/${id}`,{method:'PATCH',body:JSON.stringify(p)}),adminDeleteProduct:(id:string)=>request(`/admin/products/${id}`,{method:'DELETE'}),
  coachAvailability:(id:string,date:string)=>request(`/coaches/${id}/availability?date=${date}`),bookCoachSession:(coach_id:string,date:string,slot:string)=>request('/coach-sessions',{method:'POST',body:JSON.stringify({coach_id,date,slot})}),myCoachSessions:()=>request('/coach-sessions/mine'),trainingPlans:()=>request('/training/plans'),createTrainingPlan:(goal:string,weeks=4)=>request('/training/plans',{method:'POST',body:JSON.stringify({goal,weeks})}),toggleDrill:(planId:string,drillId:string)=>request(`/training/plans/${planId}/drills/${drillId}/toggle`,{method:'POST'}),trainingStreak:()=>request('/training/streak'),rankings:(scope:'city'|'global'='city')=>request(`/rankings?scope=${scope}`),achievements:()=>request('/achievements'),myReferral:()=>request('/referrals/me'),applyReferral:(code:string)=>request('/referrals/apply',{method:'POST',body:JSON.stringify({code})}),
  // Org workspace — club management
  org:(id:string)=>request(`/orgs/${id}`),
  orgUpdate:(id:string,p:any)=>request(`/orgs/${id}`,{method:'PATCH',body:JSON.stringify(p)}),
  orgGames:(id:string)=>request(`/orgs/${id}/games`),
  orgIssues:(id:string)=>request(`/orgs/${id}/issues`),
  orgCreateIssue:(id:string,p:any)=>request(`/orgs/${id}/issues`,{method:'POST',body:JSON.stringify(p)}),
  orgResolveIssue:(id:string,issueId:string)=>request(`/orgs/${id}/issues/${issueId}/resolve`,{method:'POST'}),
  orgCheckIn:(id:string,bookingId:string)=>request(`/orgs/${id}/bookings/${bookingId}/check-in`,{method:'POST'}),
  adminGrantRole:(id:string)=>request(`/admin/users/${id}/platform-admin`,{method:'POST'}),
  adminIssues:()=>request('/admin/issues'),
  adminAudit:()=>request('/admin/audit-log'),
  orgAnalytics:(id:string)=>request(`/orgs/${id}/analytics`),
  orgBookings:(id:string)=>request(`/orgs/${id}/bookings`),
  orgConfirmBooking:(orgId:string,bookingId:string)=>request(`/orgs/${orgId}/bookings/${bookingId}/confirm`,{method:'POST'}),
  orgCancelBooking:(orgId:string,bookingId:string)=>request(`/orgs/${orgId}/bookings/${bookingId}/cancel`,{method:'POST'}),
  orgMembers:(id:string)=>request(`/orgs/${id}/members`),
  orgAddStaff:(id:string,p:any)=>request(`/orgs/${id}/staff`,{method:'POST',body:JSON.stringify(p)}),
  orgUpdateMemberRole:(orgId:string,userId:string,role:string)=>request(`/orgs/${orgId}/members/${userId}/role`,{method:'PATCH',body:JSON.stringify({role})}),
  orgRemoveMember:(orgId:string,userId:string)=>request(`/orgs/${orgId}/members/${userId}`,{method:'DELETE'}),
  orgTransferOwnership:(orgId:string,p:any)=>request(`/orgs/${orgId}/ownership/transfer`,{method:'POST',body:JSON.stringify(p)}),
  orgUpdateStatus:(orgId:string,status:string)=>request(`/orgs/${orgId}/status`,{method:'PATCH',body:JSON.stringify({status})}),
  orgUpdateLocation:(orgId:string,p:any)=>request(`/orgs/${orgId}/location`,{method:'PATCH',body:JSON.stringify(p)}),
  // Courts (facilities) — Owner + Admin
  orgFacilities:(orgId:string)=>request(`/orgs/${orgId}/facilities`),
  orgCreateFacility:(orgId:string,p:any)=>request(`/orgs/${orgId}/facilities`,{method:'POST',body:JSON.stringify(p)}),
  orgUpdateFacility:(orgId:string,fid:string,p:any)=>request(`/orgs/${orgId}/facilities/${fid}`,{method:'PATCH',body:JSON.stringify(p)}),
  orgDeleteFacility:(orgId:string,fid:string)=>request(`/orgs/${orgId}/facilities/${fid}`,{method:'DELETE'}),
  orgUpdatePricing:(orgId:string,fid:string,price_per_hour:number)=>request(`/orgs/${orgId}/facilities/${fid}/pricing`,{method:'PATCH',body:JSON.stringify({price_per_hour})}),
  // Slots — Owner + Admin + Manager
  orgListSlots:(orgId:string,fid:string,date?:string)=>request(`/orgs/${orgId}/facilities/${fid}/slots${date?'?date='+date:''}`),
  orgCreateSlots:(orgId:string,fid:string,p:any)=>request(`/orgs/${orgId}/facilities/${fid}/slots`,{method:'POST',body:JSON.stringify(p)}),
  orgUpdateSlot:(orgId:string,fid:string,slotId:string,status:string)=>request(`/orgs/${orgId}/facilities/${fid}/slots/${slotId}`,{method:'PATCH',body:JSON.stringify({status})}),
  orgDeleteSlot:(orgId:string,fid:string,slotId:string)=>request(`/orgs/${orgId}/facilities/${fid}/slots/${slotId}`,{method:'DELETE'}),
  // Events — Owner + Admin + Manager
  orgEvents:(orgId:string)=>request(`/orgs/${orgId}/events`),
  orgCreateEvent:(orgId:string,p:any)=>request(`/orgs/${orgId}/events`,{method:'POST',body:JSON.stringify(p)}),
  orgUpdateEvent:(orgId:string,eid:string,p:any)=>request(`/orgs/${orgId}/events/${eid}`,{method:'PATCH',body:JSON.stringify(p)}),
  orgDeleteEvent:(orgId:string,eid:string)=>request(`/orgs/${orgId}/events/${eid}`,{method:'DELETE'}),
  // Tournaments — Owner + Admin + Manager
  orgTournaments:(orgId:string)=>request(`/orgs/${orgId}/tournaments`),
  orgCreateTournament:(orgId:string,p:any)=>request(`/orgs/${orgId}/tournaments`,{method:'POST',body:JSON.stringify(p)}),
  orgUpdateTournament:(orgId:string,tid:string,p:any)=>request(`/orgs/${orgId}/tournaments/${tid}`,{method:'PATCH',body:JSON.stringify(p)}),
  orgDeleteTournament:(orgId:string,tid:string)=>request(`/orgs/${orgId}/tournaments/${tid}`,{method:'DELETE'}),
  // Audit log — Owner + Admin
  orgAuditLog:(orgId:string)=>request(`/orgs/${orgId}/audit-log`),
  orgExportBookings:(orgId:string)=>request(`/orgs/${orgId}/reports/bookings`),
  search:(q:string)=>request(`/search?q=${encodeURIComponent(q)}`),
};

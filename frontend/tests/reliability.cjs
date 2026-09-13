// Pure contract checks. Run after npm install: node tests/reliability.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function moduleAt(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => imports[name], console, ...globals });
  return exports;
}
(async () => {
  const auth = moduleAt('src/auth-gate.ts');
  const navigation = [];
  const router = { push: route => navigation.push(['push', route]), dismissTo: route => navigation.push(['dismissTo', route]) };
  auth.trackAuthOrigin('/game/test-game');
  auth.trackAuthOrigin('/login');
  let count = 0;
  assert.equal(auth.requireAuth(null, router, undefined, () => { count++; }), false);
  assert.equal(count, 0);
  assert.equal(navigation[0][1].pathname, '/(auth)/login');
  await auth.completeAuth(router);
  assert.equal(count, 1);
  assert.equal(navigation[1][1], '/game/test-game');
  await auth.completeAuth(router);
  assert.equal(count, 1, 'Pending actions execute once');
  auth.requireAuth(null, router, undefined, () => { count++; });
  auth.cancelPendingAuth();
  await auth.completeAuth(router);
  assert.equal(count, 1, 'Closing login cancels the action');
  assert.equal(auth.requireAuth({ id: 'player' }, router), true);
  await auth.completeAuth(router, 'https://example.org');
  assert.equal(navigation.at(-1)[1], '/game/test-game', 'Reject external next URLs');

  const errors = moduleAt('src/errors.ts');
  assert.ok(!errors.friendlyError('Failed to fetch').includes('Failed to fetch'));
  assert.ok(!errors.friendlyError('<html>Traceback MongoDB credentials</html>').includes('MongoDB'));
  const sports = moduleAt('src/sports.ts');
  assert.equal(sports.sportsLabel({ sports: ['sport-badminton', 'sport-cricket'] }), 'Badminton · Cricket');
  assert.equal(sports.dateLabel(undefined), 'Date to be announced');
  assert.equal(sports.money(undefined), 'Price on request');
  assert.equal(sports.sportsLabel({}), 'Sport not listed');
  const caps = moduleAt('src/capabilities.ts');
  const membership = { is_platform_admin: false, organizations: [{ org_id: 'a', role: 'CLUB_MANAGER' }], roles: ['CLUB_MANAGER'], permissions: [] };
  assert.equal(caps.canForOrg(membership, 'a', 'club.slots.manage'), true);
  for (const permission of ['club.staff.manage', 'club.ownership.transfer', 'club.pricing.manage', 'platform.users.manage']) assert.equal(caps.canForOrg(membership, 'a', permission), false);
  assert.equal(caps.canForOrg(membership, 'b', 'club.slots.manage'), false);

  let state = 'initiated';
  const opened = [];
  const payments = moduleAt('src/payments.ts', { 'expo-web-browser': { openBrowserAsync: url => opened.push(url) }, '@/src/api': { apiBaseUrl: 'https://api.example.test', api: { paymentStatus: async () => ({ payment: { status: state }, resource: { id: 'booking',status:'confirmed' } }) } } });
  await assert.rejects(payments.verifiedPayment('payment'));
  state = 'succeeded';
  assert.equal((await payments.verifiedPayment('payment')).id, 'booking');
  await payments.openCheckout({ payment: { id: 'p' }, checkout_url: '/api/payments/checkout/p?token=test' });
  assert.equal(opened.length, 1);
  await assert.rejects(payments.openCheckout({ payment: { id: 'p' }, checkout_url: 'https://example.org' }));
  const platform = { OS: 'web' };
  const transfers = [];
  class XHR {
    constructor() { this.upload = {}; this.status = 200; this.responseText = '{"id":"uploaded-video"}'; this.headers = {}; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(form) { transfers.push({ form, headers: this.headers, method: this.method, url: this.url }); this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 }); this.onload(); }
  }
  class NativeFile {
    constructor(uri) { this.uri = uri; }
    async upload(url, options) { transfers.push({ native: true, url, options }); options.onProgress({ bytesSent: 100, totalBytes: 100 }); return { status: 200, body: '{"id":"native-video"}' }; }
  }
  const apiModule = moduleAt('src/api.ts', {
    './session-events': { notifySession() {} }, './errors': errors, './direct-upload': {sendVideoChunks:async()=>{}},
    'expo-constants': { default: {} }, 'expo-file-system': { File: NativeFile, UploadType: { MULTIPART: 'multipart' } },
    'react-native': { Platform: platform },
    '@/src/utils/storage': { storage: { secureGet: async () => 'test-token', secureSet: async () => true, secureRemove: async () => true } },
  }, { process: { env: { EXPO_PUBLIC_BACKEND_URL: 'https://api.example.test' } }, fetch: async () => ({ ok: true, text:async()=>JSON.stringify({direct:false,max_bytes:500*1024*1024}), blob: async () => new Blob(['video']) }), XMLHttpRequest: XHR, FormData, AbortController, setTimeout, clearTimeout });
  let progress = 0;
  const webUpload = await apiModule.api.aiCoach.uploadVideo('blob:fixture', 'match-a', 'game.mp4', 'video/mp4', value => { progress = value; });
  assert.equal(webUpload.id, 'uploaded-video');
  assert.equal(progress, 50);
  assert.equal(transfers[0].form.get('match_id'), 'match-a');
  assert.equal(transfers[0].form.get('file').name, 'game.mp4');
  assert.equal(transfers[0].headers.Authorization, 'Bearer test-token');
  assert.equal(transfers[0].headers['Content-Type'], undefined, 'Browser must supply multipart boundary');
  platform.OS = 'ios';
  const nativeUpload = await apiModule.api.aiCoach.uploadVideo('file:///game.mp4', 'match-b', 'game.mp4', 'video/mp4', value => { progress = value; });
  assert.equal(nativeUpload.id, 'native-video');
  assert.equal(progress, 100);
  assert.equal(transfers[1].options.parameters.match_id, 'match-b');

  let chunks=0;let maximum=0;let completed=0;
  const direct=moduleAt('src/direct-upload.ts', {'react-native':{Platform:{OS:'web'}},'expo-file-system':{},'expo/fetch':{}}, {Blob,AbortController,setTimeout,clearTimeout,Uint8Array,fetch:async(url,options)=>{
    if(url==='blob:video')return {blob:async()=>new Blob([new Uint8Array(20)])};
    chunks++;maximum=Math.max(maximum,options.body.size);
    if(chunks===3)return {status:200};
    return {status:308,headers:{get:()=>`bytes=0-${chunks*8-1}`}};
  }});
  await direct.sendVideoChunks('https://storage.googleapis.com/upload/test','blob:video',8,n=>completed=n);
  assert.equal(chunks,3);assert.equal(maximum,8);assert.equal(completed,100);
  await assert.rejects(direct.sendVideoChunks('https://evil.example/upload','blob:video',8));
  console.log('PASS: auth continuation/cancel, next URL validation, errors, missing data, sports, role isolation, verified payments, browser/native multipart fields and upload progress');
})().catch(error => { console.error(error); process.exit(1); });

// Pure contract checks. Run after npm install: node tests/reliability.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function moduleAt(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => imports[name], console });
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
  const payments = moduleAt('src/payments.ts', { 'expo-web-browser': { openBrowserAsync: url => opened.push(url) }, '@/src/api': { apiBaseUrl: 'https://api.example.test', api: { paymentStatus: async () => ({ payment: { status: state }, resource: { id: 'booking' } }) } } });
  await assert.rejects(payments.verifiedPayment('payment'));
  state = 'succeeded';
  assert.equal((await payments.verifiedPayment('payment')).id, 'booking');
  await payments.openCheckout({ payment: { id: 'p' }, checkout_url: '/api/payments/checkout/p?token=test' });
  assert.equal(opened.length, 1);
  await assert.rejects(payments.openCheckout({ payment: { id: 'p' }, checkout_url: 'https://example.org' }));
  console.log('PASS: auth continuation/cancel, next URL validation, error sanitization, missing data, sports, role isolation and verified payment contracts');
})().catch(error => { console.error(error); process.exit(1); });

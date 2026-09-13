"""Atomic inventory reservations. MongoDB replica-set transactions are required."""
from datetime import datetime, timezone, timedelta
from deps import KuviraError, gen_id

HOLD_MINUTES = 20

def expires_at():
    return (datetime.now(timezone.utc) + timedelta(minutes=HOLD_MINUTES)).isoformat()

async def atomic(db, callback):
    async with await db.client.start_session() as session:
        return await session.with_transaction(callback)

async def release(db, resource, session):
    kind, rid = resource['kind'], resource['id']
    collection = {'booking': db.bookings, 'coach_session': db.coach_sessions,
                  'order': db.orders, 'tournament_registration': db.tournament_registrations}[kind]
    item = await collection.find_one({'id': rid}, session=session)
    if not item or item.get('status') != 'pending_payment':
        return
    await collection.update_one({'id': rid, 'status': 'pending_payment'}, {'$set': {
        'status': 'cancelled', 'slot_active': False, 'reservation_active': False,
        'cancellation_source': 'payment_expired'}}, session=session)
    if kind == 'order' and item.get('inventory_reserved'):
        for line in item['items']:
            await db.products.update_one({'id': line['product']['id']}, {'$inc': {'stock': line['qty']}}, session=session)
    if kind == 'tournament_registration' and item.get('inventory_reserved'):
        await db.tournaments.update_one({'id': item['tournament_id']}, {'$inc': {'reserved_count': -1}}, session=session)

async def reserve_order(db, user, address, email):
    from payments import create_checkout
    async def operation(session):
        cart = await db.carts.find_one({'user_id': user['id']}, session=session)
        if not cart or not cart.get('items'):
            raise KuviraError(400, 'EMPTY_CART', 'Your cart is empty')
        lines, total = [], 0
        for line in cart['items']:
            qty = line['qty']
            if not isinstance(qty, int) or qty < 1 or qty > 100:
                raise KuviraError(400, 'INVALID_QUANTITY', 'Choose a quantity between 1 and 100')
            product = await db.products.find_one({'id': line['product_id'], 'status': 'active'}, {'_id': 0}, session=session)
            if not product:
                raise KuviraError(409, 'PRODUCT_UNAVAILABLE', 'An item is no longer available')
            result = await db.products.update_one({'id': product['id'], 'stock': {'$gte': qty}}, {'$inc': {'stock': -qty}}, session=session)
            if not result.modified_count:
                raise KuviraError(409, 'OUT_OF_STOCK', f"Not enough stock for {product['name']}")
            subtotal = product['price'] * qty
            lines.append({'product': product, 'qty': qty, 'subtotal': subtotal}); total += subtotal
        order = {'id': gen_id(), 'user_id': user['id'], 'items': lines, 'total': total,
                 'address': address, 'status': 'pending_payment', 'inventory_reserved': True,
                 'created_at': datetime.now(timezone.utc).isoformat(), 'expires_at': expires_at()}
        await db.orders.insert_one(dict(order), session=session)
        checkout = await create_checkout(db, user=user, resource={'kind':'order','id':order['id']}, amount=total,
                                         productinfo='MatchDrome shop order', customer_email=email, session=session)
        await db.orders.update_one({'id':order['id']}, {'$set':{'payment':checkout['payment']}}, session=session)
        return {'order': order, **checkout}
    return await atomic(db, operation)

async def reserve_tournament(db, tid, user, email):
    from payments import create_checkout
    async def operation(session):
        t = await db.tournaments.find_one({'id':tid, 'status':'published'}, session=session)
        if not t:
            raise KuviraError(404,'TOURNAMENT_UNAVAILABLE','Tournament is not open for registration')
        existing = await db.tournament_registrations.find_one({'tournament_id':tid,'user_id':user['id'], 'status':{'$in':['confirmed','pending_payment']}}, session=session)
        if existing:
            raise KuviraError(409,'ALREADY_REGISTERED','You already have a registration; check Activity')
        # Existing registrations are counted too, including pre-migration payments.
        occupied = await db.tournament_registrations.count_documents({'tournament_id':tid,'status':{'$in':['confirmed','pending_payment']}}, session=session)
        if occupied >= t.get('max_participants', 0):
            raise KuviraError(409,'TOURNAMENT_FULL','This tournament is full')
        # Serialize concurrent registrations by writing the shared tournament document.
        await db.tournaments.update_one({'id':tid}, {'$inc':{'reserved_count':1}}, session=session)
        reg = {'id':gen_id(),'tournament_id':tid,'user_id':user['id'],'status':'pending_payment',
               'reservation_active':True,'inventory_reserved':True,'created_at':datetime.now(timezone.utc).isoformat(),'expires_at':expires_at()}
        await db.tournament_registrations.insert_one(dict(reg),session=session)
        if not t.get('entry_fee'):
            await db.tournament_registrations.update_one({'id':reg['id']},{'$set':{'status':'confirmed'}},session=session)
            await db.tournaments.update_one({'id':tid},{'$inc':{'reserved_count':-1,'participants_count':1}},session=session)
            reg['status']='confirmed';return reg
        checkout = await create_checkout(db,user=user,resource={'kind':'tournament_registration','id':reg['id']},amount=t['entry_fee'],productinfo='Tournament registration',customer_email=email,session=session)
        await db.tournament_registrations.update_one({'id':reg['id']},{'$set':{'payment':checkout['payment']}},session=session)
        return {'registration':reg,**checkout}
    return await atomic(db,operation)

async def reserve_booking(db, body, user):
    from payments import create_checkout
    from deps import PAYMENT_PROVIDER
    from trust import start_time
    if start_time({'date':body.date,'slot':body.slot}) <= datetime.now(timezone.utc):
        raise KuviraError(400,'PAST_BOOKING','Choose a future slot')
    if body.slot not in [f'{h:02d}:00-{h+1:02d}:00' for h in range(6,23)] or body.duration_min!=60:
        raise KuviraError(400,'INVALID_SLOT','Choose an available one-hour slot')
    async def operation(session):
        f=await db.facilities.find_one({'id':body.facility_id,'status':{'$ne':'inactive'}},session=session)
        if not f:raise KuviraError(404,'FACILITY_NOT_FOUND','Facility unavailable')
        if f.get('org_id') and await db.organizations.find_one({'id':f['org_id'],'status':'inactive'},session=session):
            raise KuviraError(409,'CLUB_UNAVAILABLE','Club is not accepting bookings')
        if body.court_number<1 or body.court_number>f.get('courts_count',1):raise KuviraError(400,'INVALID_COURT','Choose a valid court')
        if await db.facility_slots.find_one({'facility_id':f['id'],'court_number':body.court_number,'date':{'$in':[body.date,'*']},'slot':body.slot,'status':'blocked'},session=session):
            raise KuviraError(409,'SLOT_BLOCKED','This slot is closed')
        price=f['price_per_hour'];paid=PAYMENT_PROVIDER=='payu' and price>0
        booking={'id':gen_id(),'user_id':user['id'],'facility_id':f['id'],'facility_name':f['name'],'facility_image':f.get('image',''),'court_number':body.court_number,'date':body.date,'slot':body.slot,'duration_min':60,'price':price,'slot_active':True,'status':'pending_payment' if paid else 'confirmed','created_at':datetime.now(timezone.utc).isoformat(),'expires_at':expires_at()}
        await db.bookings.insert_one(dict(booking),session=session)
        if not paid:return booking
        checkout=await create_checkout(db,user=user,resource={'kind':'booking','id':booking['id']},amount=price,productinfo='MatchDrome court booking',customer_email=body.customer_email,session=session)
        await db.bookings.update_one({'id':booking['id']},{'$set':{'payment':checkout['payment']}},session=session)
        return {'booking':booking,**checkout}
    from pymongo.errors import DuplicateKeyError
    try:return await atomic(db,operation)
    except DuplicateKeyError:raise KuviraError(409,'BOOKING_SLOT_UNAVAILABLE','This slot is no longer available')

"""Financial state and permission regressions; never calls a real provider."""
import asyncio
import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
import pytest
import payments
import reservations
import trust
from fastapi import BackgroundTasks


def run(value):return asyncio.run(value)

@pytest.fixture
def gateway(monkeypatch):
    p=payments.PayU.__new__(payments.PayU);p.key='test-key';p.salt='test-salt';p.verify=AsyncMock()
    monkeypatch.setattr(payments,'_payu',lambda:p)
    async def atomic(db,operation):return await operation('test-session')
    monkeypatch.setattr(reservations,'atomic',atomic)
    return p


def test_request_hash_matches_payu_published_sequence(gateway):
    fields=dict(txnid='txn',amount='100.00',productinfo='Court',firstname='Player',email='test@example.test',udf1='a',udf2='b',udf3='c',udf4='d',udf5='e')
    expected=hashlib.sha512(b'test-key|txn|100.00|Court|Player|test@example.test|a|b|c|d|e||||||test-salt').hexdigest()
    assert gateway.request_hash(fields)==expected


def test_invalid_callback_cannot_corrupt_success(gateway):
    db=MagicMock();db.payment_transactions.find_one=AsyncMock(return_value={'id':'p','status':'succeeded'})
    with pytest.raises(Exception):run(payments.process_callback(db,{'txnid':'t','hash':'invalid'}))
    db.payment_transactions.update_one.assert_not_called();gateway.verify.assert_not_awaited()


def test_verified_failure_cannot_downgrade_success(gateway):
    gateway.verify.return_value={'status':'failure'}
    db=MagicMock();db.payment_transactions.find_one=AsyncMock(return_value={'id':'p','status':'succeeded'})
    assert run(payments.reconcile_payment(db,{'id':'p','txnid':'t'}))['payment']['status']=='succeeded'
    db.payment_transactions.update_one.assert_not_called()


def test_verified_amount_must_match(gateway):
    gateway.verify.return_value={'status':'success','amt':'1.00'}
    db=MagicMock()
    with pytest.raises(Exception):run(payments.reconcile_payment(db,{'id':'p','txnid':'t','amount':'100.00'}))
    db.payment_transactions.update_one.assert_not_called()


def test_late_success_marks_refund_review_without_rebooking(gateway):
    txn={'id':'p','txnid':'t','amount':'100.00','status':'expired','resource':{'kind':'booking','id':'b'}}
    gateway.verify.return_value={'status':'success','amt':'100.00'}
    db=MagicMock();db.payment_transactions.find_one=AsyncMock(return_value=txn);db.payment_transactions.update_one=AsyncMock()
    db.bookings.find_one=AsyncMock(return_value={'id':'b','status':'cancelled'})
    result=run(payments.reconcile_payment(db,txn))
    assert result['payment']['status']=='succeeded' and result['resource'] is None
    assert db.payment_transactions.update_one.call_args.args[1]['$set']['refund_status']=='review_required'
    db.bookings.update_one.assert_not_called()


def test_missing_callback_recovers_confirmed_booking(gateway):
    txn={'id':'p','txnid':'t','amount':'100.00','status':'initiated','resource':{'kind':'booking','id':'b'}}
    gateway.verify.return_value={'status':'success','amt':'100.00'}
    db=MagicMock();db.payment_transactions.find_one=AsyncMock(return_value=txn);db.payment_transactions.update_one=AsyncMock()
    db.bookings.find_one=AsyncMock(return_value={'id':'b','status':'pending_payment'});db.bookings.update_one=AsyncMock()
    assert run(payments.reconcile_payment(db,txn))['resource']['status']=='confirmed'
    assert db.bookings.update_one.call_args.kwargs['session']=='test-session'


def test_expiry_returns_reserved_stock_once():
    db=MagicMock();item={'id':'o','status':'pending_payment','inventory_reserved':True,'items':[{'product':{'id':'sku'},'qty':2}]}
    db.orders.find_one=AsyncMock(return_value=item);db.orders.update_one=AsyncMock();db.products.update_one=AsyncMock()
    run(reservations.release(db,{'kind':'order','id':'o'},'session'))
    assert db.products.update_one.call_args.args[1]=={'$inc':{'stock':2}}
    item['status']='cancelled'
    run(reservations.release(db,{'kind':'order','id':'o'},'session'))
    assert db.products.update_one.await_count==1


def test_sold_out_product_never_creates_payment(gateway):
    db=MagicMock();db.carts.find_one=AsyncMock(return_value={'items':[{'product_id':'sku','qty':2}]})
    db.products.find_one=AsyncMock(return_value={'id':'sku','name':'Racket','price':100})
    db.products.update_one=AsyncMock(return_value=MagicMock(modified_count=0))
    with pytest.raises(Exception):run(reservations.reserve_order(db,{'id':'u'},{},'user@example.test'))
    db.orders.insert_one.assert_not_called();db.payment_transactions.insert_one.assert_not_called()


def test_full_tournament_rejects_registration(gateway):
    db=MagicMock();db.tournaments.find_one=AsyncMock(return_value={'id':'t','max_participants':2})
    db.tournament_registrations.find_one=AsyncMock(return_value=None);db.tournament_registrations.count_documents=AsyncMock(return_value=2)
    with pytest.raises(Exception):run(reservations.reserve_tournament(db,'t',{'id':'u'},None))
    db.tournament_registrations.insert_one.assert_not_called()


def test_existing_registration_rejects_duplicate(gateway):
    db=MagicMock();db.tournaments.find_one=AsyncMock(return_value={'id':'t','max_participants':2})
    db.tournament_registrations.find_one=AsyncMock(return_value={'id':'r'})
    with pytest.raises(Exception):run(reservations.reserve_tournament(db,'t',{'id':'u'},None))
    db.tournament_registrations.insert_one.assert_not_called()

@pytest.mark.parametrize('hours,accepted',[(4,True),(3.99,False),(5,True)])
def test_cancellation_cutoff_is_server_enforced(monkeypatch,hours,accepted):
    now=datetime(2026,9,13,0,tzinfo=timezone.utc);monkeypatch.setattr(trust,'utcnow',lambda:now)
    db=MagicMock();db.bookings.find_one=AsyncMock(return_value={'date':(now+timedelta(hours=hours)).isoformat()})
    db.support_tickets.count_documents=AsyncMock(return_value=0);db.support_tickets.insert_one=AsyncMock();monkeypatch.setattr(trust,'db',db)
    body=trust.Ticket(category='cancellation',resource_type='booking',resource_id='b',message='Please cancel my booking',email='user@example.test')
    if accepted:
        result=run(trust.create_ticket(body,BackgroundTasks(),{'id':'u'}));assert result['status']=='open'
    else:
        with pytest.raises(Exception):run(trust.create_ticket(body,BackgroundTasks(),{'id':'u'}))
        db.support_tickets.insert_one.assert_not_called()
    assert db.bookings.find_one.call_args.args[0]=={'id':'b','user_id':'u'}


def test_date_and_slot_use_india_timezone():
    assert trust.start_time({'date':'2026-09-13','slot':'10:00-11:00'}).astimezone(timezone.utc).hour==4


def test_deletion_disables_access_without_claiming_data_is_erased(monkeypatch):
    db=MagicMock();db.users.update_one=AsyncMock();db.account_deletions.update_one=AsyncMock();monkeypatch.setattr(trust,'db',db)
    result=run(trust.delete_account(trust.DeleteAccount(confirmation='DELETE'),{'id':'u'}))
    assert result['status']=='pending'
    assert db.users.update_one.call_args.args[1]['$set']['deletion_requested'] is True


def test_direct_upload_size_mismatch_deletes_object():
    from ai_coach.storage import ObjectStorage
    storage=ObjectStorage.__new__(ObjectStorage);storage._bucket=MagicMock()
    blob=storage._bucket.blob.return_value;blob.size=999;blob.generation=3
    with pytest.raises(ValueError):storage.verify_upload({'object_key':'videos/test'},100)
    blob.delete.assert_called_once_with(if_generation_match=3)


@pytest.mark.parametrize('verification', [{}, {'status': 'Not Found', 'mihpayid': 'Not Found'}])
def test_abandoned_checkout_releases_hold_after_verification(gateway, verification):
    txn = {'id': 'p', 'txnid': 't', 'status': 'initiated', 'expires_at': '2020-01-01T00:00:00+00:00', 'resource': {'kind': 'booking', 'id': 'b'}}
    gateway.verify.return_value = verification
    db = MagicMock()
    db.payment_transactions.find_one = AsyncMock(return_value=txn)
    db.payment_transactions.update_one = AsyncMock()
    db.bookings.find_one = AsyncMock(return_value={'id': 'b', 'status': 'pending_payment'})
    db.bookings.update_one = AsyncMock()
    assert run(payments.reconcile_payment(db, txn))['payment']['status'] == 'expired'
    assert db.bookings.update_one.call_args.args[1]['$set']['slot_active'] is False

"""One-time platform-admin catalog seeder for production.

This intentionally does NOT seed users, bookings, orders, memberships, or AI
state. Catalog records are keyed by their stable `id` and upserted so running
the operation repeatedly is safe.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable

from fastapi import APIRouter, Depends
from pymongo import UpdateOne

from deps import db, require_platform_admin, KuviraError, log
from seed_data import SPORTS, FACILITIES, PLAYERS, COACHES, EVENTS, TOURNAMENTS, GAMES, PRODUCTS

router = APIRouter(prefix="/api/admin/catalog", tags=["admin-catalog"])

CATALOGS: Dict[str, tuple[str, Iterable[dict[str, Any]]]] = {
    "sports": ("sports", SPORTS),
    "facilities": ("facilities", FACILITIES),
    "players": ("players", PLAYERS),
    "coaches": ("coaches", COACHES),
    "events": ("events", EVENTS),
    "tournaments": ("tournaments", TOURNAMENTS),
    "games": ("games", GAMES),
    "products": ("products", PRODUCTS),
}

PROTECTED_COLLECTIONS = {
    "users", "bookings", "orders", "carts", "organization_memberships",
    "organizations", "ai_chat", "ai_coach_player_state", "ai_coach_training",
    "ai_coach_recommendations", "ai_coach_coaching_events",
}


def _clean_document(doc: dict[str, Any]) -> dict[str, Any]:
    clean = dict(doc)
    clean.pop("_id", None)
    return clean


def _operations(items: Iterable[dict[str, Any]], *, dry_run: bool) -> list[UpdateOne]:
    ops: list[UpdateOne] = []
    for raw in items:
        doc = _clean_document(raw)
        stable_id = doc.get("id")
        if not stable_id:
            raise KuviraError(500, "CATALOG_INVALID", "Catalog record is missing a stable id")
        if dry_run:
            continue
        # $setOnInsert preserves generated/operational fields on records that
        # already exist; $set refreshes the canonical catalog content (including
        # image URLs) from source-controlled seed data.
        ops.append(
            UpdateOne(
                {"id": stable_id},
                {"$set": doc},
                upsert=True,
            )
        )
    return ops


@router.get("/preview")
async def preview_catalog(admin=Depends(require_platform_admin())):
    """Show catalog counts without mutating production data."""
    result: Dict[str, Any] = {"protected_collections": sorted(PROTECTED_COLLECTIONS), "catalogs": {}}
    for key, (collection_name, items) in CATALOGS.items():
        ids = [x.get("id") for x in items if x.get("id")]
        existing = await db[collection_name].count_documents({"id": {"$in": ids}}) if ids else 0
        result["catalogs"][key] = {
            "collection": collection_name,
            "source_records": len(ids),
            "existing_records": existing,
            "would_upsert": max(0, len(ids) - existing),
        }
    return result


@router.post("/seed")
async def seed_catalog(
    dry_run: bool = False,
    catalogs: str = "sports,facilities,players,coaches,events,tournaments,games,products",
    admin=Depends(require_platform_admin()),
):
    """Upsert source-controlled catalog data into production.

    Example:
      POST /api/admin/catalog/seed?catalogs=sports,facilities,events,products

    `dry_run=true` performs no writes and only validates the selected catalogs.
    """
    requested = [x.strip() for x in catalogs.split(",") if x.strip()]
    unknown = [x for x in requested if x not in CATALOGS]
    if unknown:
        raise KuviraError(400, "CATALOG_UNKNOWN", f"Unknown catalogs: {', '.join(unknown)}")

    summary: Dict[str, Any] = {
        "dry_run": dry_run,
        "requested": requested,
        "collections": {},
        "protected_collections": sorted(PROTECTED_COLLECTIONS),
    }

    for key in requested:
        collection_name, items = CATALOGS[key]
        records = [_clean_document(x) for x in items]
        ids = [x.get("id") for x in records]
        if any(not x for x in ids):
            raise KuviraError(500, "CATALOG_INVALID", f"Catalog '{key}' contains a record without id")

        existing = await db[collection_name].count_documents({"id": {"$in": ids}}) if ids else 0
        summary["collections"][key] = {
            "collection": collection_name,
            "source_records": len(records),
            "existing_before": existing,
            "to_upsert": len(records),
            "dry_run": dry_run,
        }

        if dry_run:
            continue

        ops = _operations(records, dry_run=False)
        result = await db[collection_name].bulk_write(ops, ordered=False)
        summary["collections"][key].update({
            "matched": result.matched_count,
            "modified": result.modified_count,
            "upserted": result.upserted_count,
        })

    log.info("Catalog seed complete dry_run=%s catalogs=%s", dry_run, requested)
    return summary

# Production Catalog Seed

GCP production intentionally skips development demo seeding. Use the platform-admin catalog endpoint once after deployment to populate source-controlled public catalog data (including image URLs).

## Safe behavior

The endpoint only upserts these catalog collections:

- `sports`
- `facilities`
- `players`
- `coaches`
- `events`
- `tournaments`
- `games`
- `products`

It never writes users, bookings, orders, carts, memberships, organizations, or AI coaching state.

## 1. Deploy backend

Deploy the latest `main` backend to Cloud Run first.

## 2. Preview production

With a platform-admin bearer token:

```bash
curl -H "Authorization: Bearer $KUVIRA_ADMIN_TOKEN" \
  "https://kuvira-api-13914469738.asia-south1.run.app/api/admin/catalog/preview"
```

Expected response includes each catalog's `source_records`, `existing_records`, and `would_upsert` values.

## 3. Dry run

```bash
curl -X POST \
  -H "Authorization: Bearer $KUVIRA_ADMIN_TOKEN" \
  "https://kuvira-api-13914469738.asia-south1.run.app/api/admin/catalog/seed?dry_run=true&catalogs=sports,facilities,coaches,events,tournaments,products"
```

No database writes occur in a dry run.

## 4. Seed public catalog

```bash
curl -X POST \
  -H "Authorization: Bearer $KUVIRA_ADMIN_TOKEN" \
  "https://kuvira-api-13914469738.asia-south1.run.app/api/admin/catalog/seed?catalogs=sports,facilities,players,coaches,events,tournaments,games,products"
```

The response reports matched, modified, and upserted counts per collection.

## 5. Verify images

```bash
curl -s \
  "https://kuvira-api-13914469738.asia-south1.run.app/api/facilities"
```

Facility records should contain public `https://` image URLs. The Expo frontend renders those URLs with `expo-image`.

## Security

All catalog endpoints require `PLATFORM_ADMIN`. Do not expose the admin bearer token in the frontend bundle or source control.

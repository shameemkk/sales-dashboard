# Backend API Documentation

Base URL: `/api`

---

## Accounts

### `GET /api/accounts`

List sender accounts from Supabase with pagination and filtering.

**Auth:** Supabase session (server-side)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: `1`) |
| `search` | string | No | Filter by email (partial match) |
| `status` | string | No | `connected` or `not_connected` |
| `tag_ids[]` | number[] | No | Include accounts with any of these tag IDs |
| `excluded_tag_ids[]` | number[] | No | Exclude accounts with any of these tag IDs |
| `without_tags` | boolean | No | `true` to return only accounts with no tags |

**Response `200`**
```json
{
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "status": "Connected",
      "tags": [{ "id": 3, "name": "Tag A" }]
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 72,
    "from": 1,
    "to": 15
  }
}
```

---

## Account Stats

### `GET /api/account-stats`

Fetch daily stats for specific accounts over a date range from the `account_daily_stats` table.

**Auth:** Supabase session (server-side)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `ids` | string | Yes | Comma-separated sender IDs e.g. `1,2,3` |
| `start_date` | string | Yes | Start date `YYYY-MM-DD` |
| `end_date` | string | Yes | End date `YYYY-MM-DD` |

**Response `200`**
```json
{
  "data": [
    {
      "sender_id": "1",
      "stat_date": "2026-03-01",
      "sent": 120,
      "replied": 15,
      "total_opens": 80,
      "unique_opens": 60,
      "unsubscribed": 2,
      "bounced": 1,
      "interested": 5
    }
  ]
}
```

**Error `400`** — missing `ids`, `start_date`, or `end_date`

---

## Sender Emails

### `GET /api/sender-emails`

Proxy to upstream `send.uparrowagency.com/api/sender-emails` — returns paginated sender email list.

**Auth:** `SEND_API_TOKEN` env var (server-side, transparent to client)

**Query Parameters** _(forwarded to upstream)_

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: `1`) |
| `search` | string | No | Filter by email |
| `status` | string | No | Account status filter |
| `tag_ids[]` | number[] | No | Include accounts with these tag IDs |
| `excluded_tag_ids[]` | number[] | No | Exclude accounts with these tag IDs |
| `without_tags` | boolean | No | `true` for accounts with no tags |

**Response `200`** — upstream paginated response (unwrapped from outer array)

---

## Tags

### `GET /api/tags`

Proxy to upstream `send.uparrowagency.com/api/tags` — returns all available tags.

**Auth:** `SEND_API_TOKEN` env var (server-side)

**Query Parameters:** None

**Response `200`** — upstream tags response (passed through as-is)

---

## Warmup

### `GET /api/warmup/[id]`

Fetch warmup stats for a specific sender email for today's date.

**Auth:** `SEND_API_TOKEN` env var (server-side)

**Path Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Sender email ID |

**Query Parameters:** None (date range is always today → today)

**Response `200`** — upstream warmup stats for the sender

---

## Account Sync

### `POST /api/account-sync`

Trigger a background sync job. **Requires secret header.**

**Auth:** `x-sync-secret` header must match `SYNC_SECRET` env var

**Request Headers**

| Header | Required | Description |
|---|---|---|
| `x-sync-secret` | Yes | Secret token |

**Request Body**
```json
{
  "stat_date": "2026-03-08"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `stat_date` | string | No | Date to sync `YYYY-MM-DD` (defaults to today) |

**Response `200`**
```json
{
  "job_id": 42,
  "status": "started",
  "stat_date": "2026-03-08"
}
```

**Error `401`** — missing or invalid secret

---

### `POST /api/account-sync/manual`

Trigger a sync job from the UI. Protected by Supabase session instead of secret.

**Auth:** Supabase session required

**Request Body**
```json
{
  "stat_date": "2026-03-08"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `stat_date` | string | No | Date to sync `YYYY-MM-DD` (defaults to today) |

**Response `200`**
```json
{
  "job_id": 42,
  "status": "started",
  "stat_date": "2026-03-08"
}
```

**Error `401`** — not authenticated

---

### `GET /api/account-sync/status`

Get the most recent sync job status.

**Auth:** Supabase session (server-side)

**Query Parameters:** None

**Response `200`**
```json
{
  "id": 42,
  "statDate": "2026-03-08",
  "status": "completed",
  "totalPages": 10,
  "completedPages": 10,
  "failedPages": [],
  "startedAt": "2026-03-08T10:00:00Z",
  "completedAt": "2026-03-08T10:05:00Z"
}
```

Returns `null` if no sync jobs exist.

**`status` values:** `running` | `completed` | `failed`

---

### `GET /api/account-sync/history`

Get the last 10 sync jobs.

**Auth:** Supabase session (server-side)

**Query Parameters:** None

**Response `200`** — array of sync job objects (same shape as `/api/account-sync/status`)
```json
[
  {
    "id": 42,
    "statDate": "2026-03-08",
    "status": "completed",
    "totalPages": 10,
    "completedPages": 10,
    "failedPages": [],
    "startedAt": "2026-03-08T10:00:00Z",
    "completedAt": "2026-03-08T10:05:00Z"
  }
]
```

---

### `POST /api/account-sync/retry`

Retry only the failed pages of an existing sync job.

**Auth:** Supabase session (server-side)

**Request Body**
```json
{
  "job_id": 42
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `job_id` | number | Yes | ID of the sync job to retry |

**Response `200`**
```json
{
  "job_id": 42,
  "pages_retrying": [3, 7]
}
```

If no failed pages exist:
```json
{ "message": "No failed pages to retry" }
```

**Error `400`** — missing `job_id`
**Error `404`** — job not found
**Error `409`** — job is already running

---

## Performance Sync

### `POST /api/performance-sync`

Sync performance data for a date range. **Requires secret header.**

**Auth:** `x-sync-secret` header must match `SYNC_SECRET` env var

**Request Headers**

| Header | Required | Description |
|---|---|---|
| `x-sync-secret` | Yes | Secret token |

**Request Body**
```json
{
  "start_date": "2026-03-01",
  "end_date": "2026-03-08"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `start_date` | string | No | Start date `YYYY-MM-DD` (also accepts `date` as alias). Defaults to today |
| `end_date` | string | No | End date `YYYY-MM-DD`. Defaults to `start_date` |

**Response `200`**
```json
{
  "ok": true,
  "rows": 42
}
```

**Error `401`** — missing or invalid secret
**Error `500`** — sync failed

---

## Leads

### `GET /api/leads`

List leads from Supabase with pagination, search, and date filtering.

**Auth:** Supabase session (server-side)

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: `1`) |
| `pageSize` | number | No | Results per page (default: `50`, max: `250`) |
| `search` | string | No | Filter by first name, last name, company, email, or phone (partial match) |
| `dateFrom` | string | No | Filter leads added on or after this date |
| `dateTo` | string | No | Filter leads added on or before this date |

**Response `200`**
```json
{
  "data": [
    {
      "id": "abc123",
      "first_name": "John",
      "last_name": "Doe",
      "company_name": "Acme Inc",
      "email": "john@acme.com",
      "phone": "+15551234567",
      "tags": ["tag1"],
      "date_added": "2026-03-01T10:00:00Z",
      "opportunity_id": "opp_123",
      "enriched": true,
      "first_dial_time": "2026-03-01T10:05:00Z",
      "first_text_time": "2026-03-01T10:03:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 50,
    "total": 230
  },
  "stats": {
    "avgSpeedToDial": 12,
    "avgSpeedToText": 8
  }
}
```

`avgSpeedToDial` / `avgSpeedToText` are in minutes, computed across the filtered result set. `null` if no data.

**Error `401`** — not authenticated

---

## Leads Sync

### `POST /api/leads-sync`

Trigger a full leads sync from GoHighLevel (all contacts, no date filter). Runs in background.

**Auth:** Supabase session required

**Request Body:** None

**Response `200`**
```json
{ "ok": true, "status": "started" }
```

**Error `401`** — not authenticated
**Error `409`** — sync already in progress

---

### `GET /api/leads-sync`

Poll current leads sync status.

**Auth:** Supabase session required

**Query Parameters:** None

**Response `200`**
```json
{
  "status": "completed",
  "upserted": 450,
  "pages": 2,
  "total": 450,
  "dbCount": 1200
}
```

**`status` values:** `idle` | `running` | `completed` | `failed`

---

## Leads Enrich

### `POST /api/leads-enrich`

Enrich leads with first dial/text times from GoHighLevel conversations. Runs in background.

**Auth:** Supabase session required

**Request Body**
```json
{
  "leadIds": ["id1", "id2"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `leadIds` | string[] | No | Specific lead IDs to enrich. Omit to enrich all un-enriched leads |

**Response `200`**
```json
{ "ok": true, "status": "started", "total": 50 }
```

**Error `401`** — not authenticated
**Error `409`** — enrichment already in progress

---

### `GET /api/leads-enrich`

Poll current enrichment status.

**Auth:** Supabase session required

**Query Parameters:** None

**Response `200`**
```json
{
  "status": "completed",
  "processed": 50,
  "total": 50,
  "enrichedCount": 200,
  "totalCount": 1200
}
```

**`status` values:** `idle` | `running` | `completed` | `failed`

---

## Contact Sync (Scheduled)

Scheduled sync that fetches contacts added in the last 5 days from GoHighLevel. Independent from the full leads sync above.

### `POST /api/contact-sync`

Trigger a scheduled contact sync. Supports dual authentication.

**Auth:** Supabase session (UI) **OR** `x-sync-secret` header (external cron)

When called via `x-sync-secret`, the endpoint checks the `contact_sync_schedule` table — if scheduling is disabled, it returns `{ "skipped": true }` without running.

**Request Headers** _(for cron/external triggers)_

| Header | Required | Description |
|---|---|---|
| `x-sync-secret` | Conditional | Required when not using session auth |

**Request Body:** None

**Response `200`**
```json
{ "ok": true, "status": "started", "jobId": 1 }
```

**Response `200` (skipped)**
```json
{ "skipped": true, "reason": "Schedule disabled" }
```

**Error `401`** — not authenticated (no session and no valid secret)
**Error `409`** — contact sync already in progress
**Error `500`** — failed to create sync job

---

### `GET /api/contact-sync`

Poll current contact sync status.

**Auth:** Supabase session required

**Query Parameters:** None

**Response `200`**
```json
{
  "status": "completed",
  "jobId": 1,
  "contactsFetched": 47,
  "contactsUpserted": 47
}
```

**`status` values:** `idle` | `running` | `completed` | `failed`

---

### `GET /api/contact-sync/history`

Get recent contact sync job history.

**Auth:** Supabase session required

**Query Parameters:** None

**Response `200`**
```json
{
  "jobs": [
    {
      "id": 1,
      "status": "completed",
      "errorMessage": null,
      "contactsFetched": 47,
      "contactsUpserted": 47,
      "retryCount": 0,
      "startedAt": "2026-04-02T06:00:00Z",
      "completedAt": "2026-04-02T06:00:12Z"
    }
  ]
}
```

Returns the last 20 jobs ordered by `startedAt` descending.

**`status` values:** `running` | `completed` | `failed`

---

### `POST /api/contact-sync/retry`

Retry a failed contact sync job. Creates a new job with incremented `retryCount`.

**Auth:** Supabase session required

**Request Body**
```json
{
  "job_id": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `job_id` | number | Yes | ID of the failed job to retry |

**Response `200`**
```json
{ "ok": true, "jobId": 2 }
```

**Error `400`** — missing `job_id` or job is not in `failed` status
**Error `404`** — job not found

---

### `GET /api/contact-sync/schedule`

Get the current schedule configuration.

**Auth:** Supabase session required

**Query Parameters:** None

**Response `200`**
```json
{
  "enabled": false,
  "timeUtc": "06:00",
  "updatedAt": "2026-04-01T12:00:00Z"
}
```

> **Note:** `timeUtc` is always stored and returned in UTC. The frontend converts to/from IST (UTC+5:30) for display. For example, `"06:00"` UTC is shown as `"11:30"` IST in the Settings UI.

---

### `PUT /api/contact-sync/schedule`

Update the schedule configuration.

**Auth:** Supabase session required

**Request Body**
```json
{
  "enabled": true,
  "timeUtc": "06:00"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | boolean | No | Enable or disable the scheduled sync |
| `timeUtc` | string | No | Time to run in `HH:MM` format (**UTC**). The frontend converts IST → UTC before sending |

**Response `200`**
```json
{ "ok": true }
```

**Error `400`** — invalid `timeUtc` format (must be `HH:MM` with valid hour/minute)

---

## Error Format

All error responses follow this shape:

```json
{ "error": "Error message here" }
```

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

## Error Format

All error responses follow this shape:

```json
{ "error": "Error message here" }
```

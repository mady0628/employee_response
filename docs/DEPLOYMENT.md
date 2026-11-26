# Deployment and operational notes

## Compose setup

1. PostgreSQL is external to Docker Compose. Copy `.env.docker.example` to `.env`, set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SSL` for the existing PostgreSQL server, and replace every `REPLACE_*` value with a unique secret. The database must be reachable from the Compose containers. Do not reuse API keys between services. Keep `.env` out of version control. Keep `TELEGRAM_CREDENTIALS_ENCRYPTION_KEY` stable and back it up: Telegram bot tokens stored in the database cannot be decrypted if this key is lost. For local `npm run dev:*`, use `.env.example`; PostgreSQL and RabbitMQ must be available on `127.0.0.1` (Compose only provides RabbitMQ).
2. Set the real HTTPS Telegram webhook URL and configure the Lark app credentials and webhook verification settings.
3. Ensure the external PostgreSQL server already has the schema from `database/schema.sql`; services also run the shared schema initializer during startup. Start the core stack with `docker compose up --build -d --remove-orphans`. The gateway is published on host loopback at port 3003; place a TLS reverse proxy in front of it and expose only the webhook routes publicly. RabbitMQ management is loopback-bound for local administration.
4. Configure a unique `ADMIN_DASHBOARD_USERNAME`, a strong `ADMIN_DASHBOARD_PASSWORD` (at least 32 characters in production), and a unique `ADMIN_DASHBOARD_SESSION_SECRET`. The dashboard uses an HttpOnly, SameSite=Strict session cookie. Serve it over HTTPS and expose `/api/admin/*` only through the trusted dashboard origin or VPN; do not expose the gateway admin API directly to the public internet.
5. WhatsApp sessions run inside `channel-gateway`; there is no separate Compose profile. Persist its `whatsapp_auth` volume. Pair the account through a controlled local setup before moving that volume to the host. QR output is disabled by default; never enable QR logging in production.

The Compose file is a single-host deployment baseline. It does not provide a public TLS proxy, managed secrets, database backups, high availability, or distributed rate limiting. The in-memory rate limiter is per process, so deployments with multiple replicas need a shared limiter store. Configure `TRUST_PROXY_HOPS` only for a known proxy chain (usually `1` behind one trusted proxy); leave it at `0` when requests connect directly.

In `NODE_ENV=production`, services refuse startup when required secrets are missing, use a `REPLACE_*` placeholder, or are shorter than 32 characters. Create unique random values for every key.

Telegram bots can be added from **Admin → Quản lý kết nối → Thêm Telegram Bot**. Each bot gets its own `channel_connections` row and webhook URL under `/webhooks/telegram/<connection-id>`. Set `TELEGRAM_WEBHOOK_URL` to the public HTTPS base ending in `/webhooks/telegram`; the gateway appends the bot connection ID. If no base URL is configured, the bot is stored as pending until its webhook can be configured. Bot tokens and webhook secrets are encrypted in PostgreSQL with `TELEGRAM_CREDENTIALS_ENCRYPTION_KEY`; keep this key stable and backed up.

For a managed PostgreSQL service, set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SSL=true`. TLS verification remains enabled when DB SSL is enabled.

## Logs

Applications write one JSON object per line to standard output and to `LOG_DIR` (default: `./logs`). In Compose, files are written under the persistent `service_logs` volume, partitioned by service. Each service writes up to five 10 MiB files per day by default; files older than `LOG_RETENTION_DAYS` (default 14 days) are removed. After the daily file cap is reached, logging continues to stdout. Docker stdout logs also rotate at 10 MiB with five files retained. Restrict access to both log locations and include them in the organization's retention/deletion policy.

The logger redacts fields that can contain credentials, message text, contact details, and platform identifiers. Event IDs in logs are hashed for correlation. Do not add raw webhook payloads, QR codes, access tokens, or message text to log statements. Log retention is local to a host/volume; export logs to a protected centralized logging service if cross-host search or alerting is required.

## Shared event format

Telegram, WhatsApp, and Lark message adapters emit schema version 1 with the same envelope: `eventId`, `eventType`, `schemaVersion`, `platform`, `connectionId`, `conversation`, `sender`, and `message`. Conversation types normalize to `GROUP`; sender objects use `externalId`, `displayName`, `username`, `isBot`, and `isMonitor`; message objects use `externalId`, `replyToExternalMessageId`, `type`, `content`, and UTC `sentAt`. Missing optional fields are `null` where applicable. Lark attachments and rich content are not yet represented in `content`; current parsing extracts text only.

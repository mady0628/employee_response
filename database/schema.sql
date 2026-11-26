-- Complete schema for a Sales Reminder System database.
-- Safe to execute repeatedly; explicit ALTER/DROP statements handle selected schema upgrades.

CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(150),
    email VARCHAR(255) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_employees_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS employee_channel_accounts (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    platform VARCHAR(30) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    telegram_username VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_platform_user UNIQUE (platform, platform_user_id),
    CONSTRAINT uq_employee_platform UNIQUE (employee_id, platform),
    CONSTRAINT chk_account_status
        CHECK (status IN ('VERIFIED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS employee_verification_codes (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT REFERENCES employees(id),
    code_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_accounts_employee
    ON employee_channel_accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_employee
    ON employee_verification_codes(employee_id);

CREATE TABLE IF NOT EXISTS channel_connections (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(30) NOT NULL,
    external_account_id VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    account_username VARCHAR(150),
    credential_reference VARCHAR(150),
    display_name VARCHAR(150),
    connection_status VARCHAR(30) NOT NULL DEFAULT 'DISCONNECTED',
    connected_account_id VARCHAR(255),
    connected_phone VARCHAR(30),
    session_generation INTEGER NOT NULL DEFAULT 1,
    runtime_instance_id UUID,
    runtime_heartbeat_at TIMESTAMPTZ,
    desired_state VARCHAR(20) NOT NULL DEFAULT 'STOPPED',
    account_changed_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ,
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    last_error TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_channel_account UNIQUE (platform, external_account_id),
    CONSTRAINT chk_channel_platform CHECK (
        platform IN ('TELEGRAM', 'WHATSAPP', 'ZALO', 'LARK', 'MESSENGER')
    ),
    CONSTRAINT chk_channel_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_channel_platform_status
    ON channel_connections(platform, status);

INSERT INTO channel_connections (
    platform, external_account_id, name, display_name, credential_reference, status
)
VALUES (
    'WHATSAPP', 'sales-monitor-01', 'WhatsApp Sales Monitor', 'WhatsApp Sales Monitor',
    'WHATSAPP_WEB_LOCAL', 'ACTIVE'
)
ON CONFLICT (platform, external_account_id) DO UPDATE SET
    display_name = COALESCE(channel_connections.display_name, EXCLUDED.display_name);

CREATE TABLE IF NOT EXISTS telegram_bots (
    id BIGSERIAL PRIMARY KEY,
    channel_connection_id BIGINT NOT NULL UNIQUE
        REFERENCES channel_connections(id) ON DELETE CASCADE,
    bot_id VARCHAR(40) NOT NULL UNIQUE,
    bot_username VARCHAR(255),
    bot_token_fingerprint CHAR(64) NOT NULL UNIQUE,
    bot_token_ciphertext TEXT NOT NULL,
    webhook_secret_ciphertext TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONNECTED', 'ERROR')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    channel_connection_id BIGINT NOT NULL REFERENCES channel_connections(id),
    platform VARCHAR(30) NOT NULL,
    external_chat_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    chat_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    monitoring_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conversation
        UNIQUE (channel_connection_id, external_chat_id),
    CONSTRAINT chk_conversation_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    platform_message_id VARCHAR(255) NOT NULL,
    sender_platform_id VARCHAR(255),
    sender_display_name TEXT,
    sender_username VARCHAR(255),
    sender_type VARCHAR(20) NOT NULL,
    employee_id BIGINT REFERENCES employees(id),
    reply_to_platform_message_id VARCHAR(255),
    message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT',
    content TEXT,
    sent_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conversation_message
        UNIQUE (conversation_id, platform_message_id),
    CONSTRAINT chk_message_sender_type CHECK (
        sender_type IN ('EMPLOYEE', 'CUSTOMER', 'BOT', 'SYSTEM', 'UNKNOWN')
    )
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_time
    ON messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages(conversation_id, sender_platform_id);

CREATE TABLE IF NOT EXISTS conversation_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_outbox_pending
    ON conversation_outbox(id) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS sla_trackings (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    customer_platform_id VARCHAR(255) NOT NULL,
    first_message_id BIGINT NOT NULL REFERENCES messages(id),
    waiting_started_at TIMESTAMPTZ NOT NULL,
    first_deadline_at TIMESTAMPTZ NOT NULL,
    next_reminder_at TIMESTAMPTZ,
    requires_explicit_reply BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    responded_at TIMESTAMPTZ,
    response_employee_id BIGINT,
    response_message_id BIGINT,
    response_method VARCHAR(40),
    reminder_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sla_status
        CHECK (status IN ('WAITING', 'RESPONDED', 'CANCELLED')),
    CONSTRAINT chk_response_method CHECK (
        response_method IS NULL OR response_method IN (
            'DIRECT_REPLY', 'SINGLE_WAITING_CUSTOMER',
            'REACTION_HEART', 'REACTION'
        )
    )
);

DROP INDEX IF EXISTS uq_waiting_customer;
CREATE INDEX IF NOT EXISTS idx_waiting_customer
    ON sla_trackings(conversation_id, customer_platform_id)
    WHERE status = 'WAITING';
CREATE INDEX IF NOT EXISTS idx_sla_reminder_due
    ON sla_trackings(next_reminder_at) WHERE status = 'WAITING';

CREATE TABLE IF NOT EXISTS sla_message_links (
    sla_id BIGINT NOT NULL REFERENCES sla_trackings(id),
    message_id BIGINT NOT NULL REFERENCES messages(id),
    PRIMARY KEY (sla_id, message_id),
    UNIQUE (message_id)
);

CREATE TABLE IF NOT EXISTS sla_processed_events (
    event_id VARCHAR(255) PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_event_inbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    platform_message_id BIGINT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT chk_sla_inbox_status
        CHECK (status IN ('PENDING', 'PROCESSED', 'LATE')),
    CONSTRAINT chk_platform_message_id CHECK (platform_message_id > 0),
    CONSTRAINT uq_sla_inbox_message
        UNIQUE (conversation_id, platform_message_id)
);

CREATE INDEX IF NOT EXISTS idx_sla_inbox_pending
    ON sla_event_inbox(conversation_id, platform_message_id)
    WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS sla_conversation_processing (
    conversation_id BIGINT PRIMARY KEY REFERENCES conversations(id),
    last_message_id BIGINT NOT NULL DEFAULT 0,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lark_sla_inbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    platform_message_id VARCHAR(255) NOT NULL,
    message_sent_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT chk_lark_inbox_status
        CHECK (status IN ('PENDING', 'PROCESSED', 'LATE')),
    CONSTRAINT uq_lark_inbox_message
        UNIQUE (conversation_id, platform_message_id)
);

CREATE INDEX IF NOT EXISTS idx_lark_inbox_pending
    ON lark_sla_inbox(conversation_id, message_sent_at, id)
    WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS lark_sla_processing (
    conversation_id BIGINT PRIMARY KEY REFERENCES conversations(id),
    last_sent_at TIMESTAMPTZ,
    last_message_id VARCHAR(255),
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_sla_inbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    platform_message_id VARCHAR(255) NOT NULL,
    message_sent_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSED', 'REVIEW', 'IGNORED')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT uq_whatsapp_sla_inbox_message
        UNIQUE (conversation_id, platform_message_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_sla_pending
    ON whatsapp_sla_inbox(conversation_id, message_sent_at, id)
    WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS whatsapp_sla_processing (
    conversation_id BIGINT PRIMARY KEY REFERENCES conversations(id),
    last_sent_at TIMESTAMPTZ,
    last_inbox_id BIGINT,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_reaction_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    channel_connection_id BIGINT NOT NULL REFERENCES channel_connections(id),
    external_chat_id VARCHAR(255) NOT NULL,
    target_message_id VARCHAR(255) NOT NULL,
    actor_platform_id VARCHAR(255) NOT NULL,
    reaction_type VARCHAR(30) NOT NULL,
    reacted_at TIMESTAMPTZ NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    processing_result VARCHAR(50),
    sla_id BIGINT REFERENCES sla_trackings(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT chk_reaction_processing_status
        CHECK (processing_status IN ('PENDING', 'PROCESSED', 'REVIEW'))
);

CREATE INDEX IF NOT EXISTS idx_reaction_pending
    ON message_reaction_events(id) WHERE processing_status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_reaction_target
    ON message_reaction_events(
        channel_connection_id, external_chat_id, target_message_id
    );

CREATE TABLE IF NOT EXISTS lark_reaction_inbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    channel_connection_id BIGINT NOT NULL REFERENCES channel_connections(id),
    target_message_id VARCHAR(255) NOT NULL,
    actor_open_id VARCHAR(255) NOT NULL,
    emoji_type VARCHAR(50) NOT NULL,
    reacted_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSED', 'REVIEW')),
    processing_result VARCHAR(80),
    sla_id BIGINT REFERENCES sla_trackings(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lark_reaction_pending
    ON lark_reaction_inbox(received_at, id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_lark_reaction_target
    ON lark_reaction_inbox(channel_connection_id, target_message_id);

CREATE TABLE IF NOT EXISTS whatsapp_reaction_inbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    channel_connection_id BIGINT NOT NULL REFERENCES channel_connections(id),
    target_message_id VARCHAR(255) NOT NULL,
    actor_platform_id VARCHAR(255) NOT NULL,
    reaction_type VARCHAR(30) NOT NULL,
    reacted_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSED', 'REVIEW')),
    processing_result VARCHAR(100),
    sla_id BIGINT REFERENCES sla_trackings(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_wa_reaction_pending
    ON whatsapp_reaction_inbox(received_at, id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_wa_reaction_target
    ON whatsapp_reaction_inbox(channel_connection_id, target_message_id);

CREATE TABLE IF NOT EXISTS whatsapp_identity_observations (
    id BIGSERIAL PRIMARY KEY,
    channel_connection_id BIGINT NOT NULL REFERENCES channel_connections(id),
    platform_user_id VARCHAR(255) NOT NULL,
    id_type VARCHAR(20) NOT NULL CHECK (id_type IN ('PHONE_JID', 'LID', 'OTHER')),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_whatsapp_observation
        UNIQUE (channel_connection_id, platform_user_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_identity_aliases (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    platform_user_id VARCHAR(255) NOT NULL UNIQUE,
    identity_type VARCHAR(20) NOT NULL CHECK (identity_type IN ('PHONE_JID', 'LID')),
    verification_method VARCHAR(30) NOT NULL
        CHECK (verification_method IN ('PRIVATE_CODE', 'ADMIN_APPROVED')),
    status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED'
        CHECK (status IN ('VERIFIED', 'REVOKED')),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_alias_employee
    ON whatsapp_identity_aliases(employee_id, status);

DROP TABLE IF EXISTS whatsapp_group_participants;

CREATE TABLE IF NOT EXISTS reminder_jobs (
    id BIGSERIAL PRIMARY KEY,
    sla_id BIGINT NOT NULL REFERENCES sla_trackings(id),
    reminder_number INTEGER NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ,
    last_error TEXT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sla_reminder_number UNIQUE (sla_id, reminder_number),
    CONSTRAINT chk_reminder_number CHECK (reminder_number > 0),
    CONSTRAINT chk_reminder_status CHECK (
        status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED')
    )
);

CREATE INDEX IF NOT EXISTS idx_reminder_jobs_pending
    ON reminder_jobs(scheduled_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_available
    ON reminder_jobs(available_at, id) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS reminder_deliveries (
    id BIGSERIAL PRIMARY KEY,
    reminder_job_id BIGINT NOT NULL REFERENCES reminder_jobs(id),
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    telegram_user_id VARCHAR(255),
    platform VARCHAR(30) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    external_message_id VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reminder_employee UNIQUE (reminder_job_id, employee_id),
    CONSTRAINT chk_delivery_status
        CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    CONSTRAINT chk_reminder_delivery_platform
        CHECK (platform IN ('TELEGRAM', 'LARK', 'WHATSAPP'))
);

CREATE TABLE IF NOT EXISTS sla_policy_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    first_response_minutes INTEGER NOT NULL DEFAULT 10
        CHECK (first_response_minutes BETWEEN 1 AND 240),
    reminder_interval_minutes INTEGER NOT NULL DEFAULT 10
        CHECK (reminder_interval_minutes BETWEEN 1 AND 240),
    new_sla_gap_minutes INTEGER NOT NULL DEFAULT 5
        CHECK (new_sla_gap_minutes BETWEEN 1 AND 240),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sla_policy_settings
    ADD COLUMN IF NOT EXISTS new_sla_gap_minutes INTEGER NOT NULL DEFAULT 5
        CHECK (new_sla_gap_minutes BETWEEN 1 AND 240);

CREATE TABLE IF NOT EXISTS monitored_groups (
    id BIGSERIAL PRIMARY KEY,
    channel_connection_id BIGINT NOT NULL REFERENCES channel_connections(id),
    external_group_id VARCHAR(255) NOT NULL,
    group_name VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    monitoring_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_monitored_group UNIQUE (channel_connection_id, external_group_id),
    CONSTRAINT chk_monitored_group_status CHECK (status IN ('ACTIVE', 'PAUSED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_monitored_groups_connection ON monitored_groups(channel_connection_id);
CREATE INDEX IF NOT EXISTS idx_monitored_groups_status ON monitored_groups(status);



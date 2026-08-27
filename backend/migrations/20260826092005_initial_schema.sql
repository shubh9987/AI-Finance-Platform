-- Add migration script here
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE transaction_type AS ENUM (
    'INCOME',
    'EXPENSE'
);

CREATE TYPE account_type AS ENUM (
    'CURRENT',
    'SAVINGS'
);

CREATE TYPE transaction_status AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED'
);

CREATE TYPE recurring_interval AS ENUM (
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'YEARLY'
);


CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    name VARCHAR(255),

    image_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    type account_type NOT NULL,

    balance NUMERIC(19, 4) NOT NULL DEFAULT 0,

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    user_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_accounts_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE INDEX idx_accounts_user_id
ON accounts(user_id);


CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type transaction_type NOT NULL,

    amount NUMERIC(19, 4) NOT NULL,

    description TEXT,

    date TIMESTAMPTZ NOT NULL,

    category VARCHAR(100) NOT NULL,

    receipt_url TEXT,

    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,

    recurring_interval recurring_interval,

    next_recurring_date TIMESTAMPTZ,

    last_processed TIMESTAMPTZ,

    status transaction_status NOT NULL DEFAULT 'COMPLETED',

    user_id UUID NOT NULL,

    account_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_transactions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_transactions_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE CASCADE
);


CREATE INDEX idx_transactions_user_id
ON transactions(user_id);


CREATE INDEX idx_transactions_account_id
ON transactions(account_id);


CREATE INDEX idx_transactions_date
ON transactions(date);


CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    amount NUMERIC(19, 4) NOT NULL,

    last_alert_sent TIMESTAMPTZ,

    user_id UUID NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_budgets_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


CREATE INDEX idx_budgets_user_id
ON budgets(user_id);
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    ticket_date TEXT,
    interaction_date TEXT,
    sub_category TEXT,
    detail_category TEXT,
    is_escalated INTEGER,
    status_name TEXT,
    channel TEXT,
    payload TEXT NOT NULL,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_interaction_date ON tickets(interaction_date);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_date ON tickets(ticket_date);

CREATE TABLE IF NOT EXISTS instructions (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO instructions (message)
VALUES ('Mon projet Docker Compose fonctionne !');
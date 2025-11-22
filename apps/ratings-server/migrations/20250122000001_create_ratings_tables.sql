-- Create ratings tables for community trust/bias system

-- Main ratings table
CREATE TABLE domain_ratings (
    id BIGSERIAL PRIMARY KEY,
    domain_url VARCHAR(255) NOT NULL,
    user_hash VARCHAR(64) NOT NULL,  -- SHA256 of user identifier
    trust_level INTEGER NOT NULL CHECK (trust_level BETWEEN 1 AND 5),
    bias_level INTEGER NOT NULL CHECK (bias_level BETWEEN 1 AND 4),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(domain_url, user_hash)
);

-- Aggregated ratings for quick lookups
CREATE TABLE domain_rating_aggregates (
    domain_url VARCHAR(255) PRIMARY KEY,
    avg_trust_level FLOAT NOT NULL DEFAULT 0,
    avg_bias_level FLOAT NOT NULL DEFAULT 0,
    total_ratings BIGINT NOT NULL DEFAULT 0,
    trust_distribution JSONB NOT NULL DEFAULT '{}',
    bias_distribution JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes on individual ratings (helpful/not helpful)
CREATE TABLE rating_votes (
    id BIGSERIAL PRIMARY KEY,
    rating_id BIGINT NOT NULL REFERENCES domain_ratings(id) ON DELETE CASCADE,
    voter_hash VARCHAR(64) NOT NULL,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rating_id, voter_hash)
);

-- Reports for moderation
CREATE TABLE rating_reports (
    id BIGSERIAL PRIMARY KEY,
    rating_id BIGINT NOT NULL REFERENCES domain_ratings(id) ON DELETE CASCADE,
    reporter_hash VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_domain_ratings_domain ON domain_ratings(domain_url);
CREATE INDEX idx_domain_ratings_user ON domain_ratings(user_hash);
CREATE INDEX idx_domain_ratings_created ON domain_ratings(created_at DESC);
CREATE INDEX idx_rating_votes_rating ON rating_votes(rating_id);
CREATE INDEX idx_rating_reports_rating ON rating_reports(rating_id);
CREATE INDEX idx_rating_reports_status ON rating_reports(status);

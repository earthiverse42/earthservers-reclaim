-- Immutable audit log - NEVER DELETE FROM THIS TABLE
CREATE TABLE rating_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    rating_id BIGINT,
    domain_url TEXT NOT NULL,
    user_hash TEXT NOT NULL,
    trust_level INTEGER,
    bias_level INTEGER,
    comment TEXT,
    previous_trust_level INTEGER,
    previous_bias_level INTEGER,
    previous_comment TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_hash TEXT NOT NULL -- SHA256 hash of the change
);

-- Never allow updates or deletes on audit log
CREATE RULE no_update_audit AS ON UPDATE TO rating_audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO rating_audit_log DO INSTEAD NOTHING;

-- Index for fast lookups
CREATE INDEX idx_audit_rating ON rating_audit_log(rating_id);
CREATE INDEX idx_audit_domain ON rating_audit_log(domain_url);
CREATE INDEX idx_audit_time ON rating_audit_log(changed_at DESC);

-- Trigger to automatically log all changes
CREATE OR REPLACE FUNCTION log_rating_change()
RETURNS TRIGGER AS $$
DECLARE
    change_data TEXT;
    change_hash TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        change_data := NEW.id || '|' || NEW.domain_url || '|' || NEW.user_hash || '|' ||
                      NEW.trust_level || '|' || NEW.bias_level || '|' || COALESCE(NEW.comment, '');
        change_hash := encode(digest(change_data, 'sha256'), 'hex');

        INSERT INTO rating_audit_log (
            action_type, rating_id, domain_url, user_hash,
            trust_level, bias_level, comment, change_hash
        ) VALUES (
            'INSERT', NEW.id, NEW.domain_url, NEW.user_hash,
            NEW.trust_level, NEW.bias_level, NEW.comment, change_hash
        );

    ELSIF TG_OP = 'UPDATE' THEN
        change_data := NEW.id || '|' || NEW.domain_url || '|' || NEW.user_hash || '|' ||
                      NEW.trust_level || '|' || NEW.bias_level || '|' || COALESCE(NEW.comment, '') || '|' ||
                      OLD.trust_level || '|' || OLD.bias_level || '|' || COALESCE(OLD.comment, '');
        change_hash := encode(digest(change_data, 'sha256'), 'hex');

        INSERT INTO rating_audit_log (
            action_type, rating_id, domain_url, user_hash,
            trust_level, bias_level, comment,
            previous_trust_level, previous_bias_level, previous_comment,
            change_hash
        ) VALUES (
            'UPDATE', NEW.id, NEW.domain_url, NEW.user_hash,
            NEW.trust_level, NEW.bias_level, NEW.comment,
            OLD.trust_level, OLD.bias_level, OLD.comment,
            change_hash
        );

    ELSIF TG_OP = 'DELETE' THEN
        change_data := OLD.id || '|' || OLD.domain_url || '|' || OLD.user_hash || '|' ||
                      OLD.trust_level || '|' || OLD.bias_level || '|' || COALESCE(OLD.comment, '');
        change_hash := encode(digest(change_data, 'sha256'), 'hex');

        INSERT INTO rating_audit_log (
            action_type, rating_id, domain_url, user_hash,
            previous_trust_level, previous_bias_level, previous_comment,
            change_hash
        ) VALUES (
            'DELETE', OLD.id, OLD.domain_url, OLD.user_hash,
            OLD.trust_level, OLD.bias_level, OLD.comment,
            change_hash
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to ratings table
CREATE TRIGGER rating_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON domain_ratings
FOR EACH ROW EXECUTE FUNCTION log_rating_change();

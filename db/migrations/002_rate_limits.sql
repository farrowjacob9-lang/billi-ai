-- Fixed-window counters for abuse limits that are not tenant data: sign-ups and sign-ins per
-- client IP, and the deployment-wide daily AI cap. Keys look like "signup:ip:203.0.113.9".
CREATE TABLE rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX rate_limits_window ON rate_limits (window_start);

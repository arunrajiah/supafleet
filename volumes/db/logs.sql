\set pguser `echo "$POSTGRES_USER"`

\c _supabase
CREATE SCHEMA IF NOT EXISTS _analytics;
ALTER SCHEMA _analytics OWNER TO :pguser;
\c postgres

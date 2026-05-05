\set pguser `echo "$POSTGRES_USER"`

\c _supabase
CREATE SCHEMA IF NOT EXISTS _supavisor;
ALTER SCHEMA _supavisor OWNER TO :pguser;
\c postgres

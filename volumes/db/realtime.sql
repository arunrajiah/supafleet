\set pguser `echo "$POSTGRES_USER"`

CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO :pguser;

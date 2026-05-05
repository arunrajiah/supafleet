-- Tenant database initialisation
-- Placeholders replaced by add-tenant.sh before execution:
--   {{JWT_SECRET}}  {{JWT_EXP}}

-- 1. Extensions (roles already exist at cluster level from supabase/postgres image)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt"      WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net"     WITH SCHEMA extensions;

-- 2. Additional schemas
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO supabase_admin;

-- 3. Realtime publication (empty — users add tables)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- 4. supabase_functions schema (needed for webhook triggers)
BEGIN;
  CREATE SCHEMA IF NOT EXISTS supabase_functions;
  GRANT USAGE ON SCHEMA supabase_functions TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_functions GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

  CREATE TABLE IF NOT EXISTS supabase_functions.migrations (
    version     text PRIMARY KEY,
    inserted_at timestamptz NOT NULL DEFAULT NOW()
  );
  INSERT INTO supabase_functions.migrations (version) VALUES ('initial') ON CONFLICT DO NOTHING;

  CREATE TABLE IF NOT EXISTS supabase_functions.hooks (
    id            bigserial PRIMARY KEY,
    hook_table_id integer NOT NULL,
    hook_name     text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT NOW(),
    request_id    bigint
  );

  ALTER TABLE supabase_functions.migrations OWNER TO supabase_functions_admin;
  ALTER TABLE supabase_functions.hooks      OWNER TO supabase_functions_admin;
  GRANT ALL PRIVILEGES ON SCHEMA supabase_functions         TO supabase_functions_admin;
  GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA supabase_functions TO supabase_functions_admin;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA supabase_functions TO supabase_functions_admin;
COMMIT;

-- 5. Public schema grants
GRANT USAGE  ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL    ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL    ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL    ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL    ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES    TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- 6. pgbouncer auth helper (used by Supavisor)
CREATE OR REPLACE FUNCTION pgbouncer.get_auth(p_usename text)
RETURNS TABLE(username text, password text) AS
$$
  SELECT usename::text, passwd::text FROM pg_catalog.pg_shadow WHERE usename = p_usename;
$$ LANGUAGE sql SECURITY DEFINER;

-- 7. JWT settings (per-database, used by PostgREST & triggers)
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET "app.settings.jwt_secret" TO %L',
    current_database(), '{{JWT_SECRET}}'
  );
  EXECUTE format(
    'ALTER DATABASE %I SET "app.settings.jwt_exp" TO %L',
    current_database(), '{{JWT_EXP}}'
  );
END $$;

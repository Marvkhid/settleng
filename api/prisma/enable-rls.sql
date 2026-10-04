-- Run ONCE in the Supabase SQL editor after the first migration.
-- SettleNG talks to Postgres only through the NestJS API (Prisma). It never uses Supabase's
-- auto-generated REST/GraphQL API, so lock every table down: with RLS enabled and no policies,
-- the anon/authenticated roles can read nothing. Prisma's own role is unaffected.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

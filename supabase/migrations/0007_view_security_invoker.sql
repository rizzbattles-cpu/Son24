-- 0007 — Supabase Advisor fix: views ran with their owner's privileges
-- (SECURITY DEFINER semantics), bypassing RLS on the underlying tables.
-- Underlying tables are public-read by design, so nothing was exposed, but
-- security_invoker makes the views respect the caller's RLS — best practice
-- and clears the two CRITICAL advisor findings.

alter view public.event_importance set (security_invoker = true);
alter view public.top_24_events set (security_invoker = true);

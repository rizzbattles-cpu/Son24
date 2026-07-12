-- Timeline steps produced by the LLM. Stored as JSON so we can iterate on the
-- shape without schema churn. Expected item shape (see scripts/llm/summarize.mjs):
--   { "relative": "3 gün önce", "headline": "kısa başlık", "detail": "1-2 cümle" }

alter table events add column if not exists story jsonb default '[]'::jsonb;

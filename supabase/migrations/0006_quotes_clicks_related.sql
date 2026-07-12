-- 0006 — source quotes, link-click analytics, related-event background links.
--
-- source_quotes: verbatim short quotes the LLM extracts from each source's own
--   text, keyed by raw_item id: { "<raw_item_id>": "alıntı cümlesi", ... }
--   Shown in the Kaynaklar tab so every outlet speaks in its own words.
--
-- related_event_ids: older events (same storyline, found via embedding
--   similarity) fed to the LLM as real, dated background for story/how_we_got_here.
--
-- link_clicks: append-only analytics for "HABERE GİT" taps. Anon clients may
--   INSERT only — no reads (keeps the table write-only from the app's view).

alter table events add column if not exists source_quotes jsonb default '{}'::jsonb;
alter table events add column if not exists related_event_ids uuid[] default '{}';

create table if not exists link_clicks (
  id           bigserial primary key,
  event_id     uuid,                -- no FK: clicks must survive event deletion/merging
  url          text not null,
  source_name  text,
  clicked_at   timestamptz not null default now()
);

create index if not exists link_clicks_event_idx on link_clicks(event_id);
create index if not exists link_clicks_time_idx on link_clicks(clicked_at desc);

alter table link_clicks enable row level security;

-- App (anon key) may record clicks but never read them back.
drop policy if exists "anon insert link_clicks" on link_clicks;
create policy "anon insert link_clicks" on link_clicks for insert with check (true);

-- Gündem — initial schema
-- Postgres 15+. Designed for Supabase but usable on any Postgres.
--
-- Conceptual model:
--   sources     — the registered outlets we monitor (parties, ministries, agencies…)
--   raw_items   — every scraped statement / RSS item / API record from any source
--   events      — grouped events (Stage 3: 1 raw_item ↔ 1 event; Stage 4 LLM will cluster)
--   event_sources — many-to-many raw_items linked to their event(s)
--   event_importance — importance score + top-24 rank (materialised view refresh)
--
-- All timestamps are TIMESTAMPTZ. UTC in DB, formatted client-side.

create extension if not exists pg_trgm;      -- fuzzy title matching
create extension if not exists vector;       -- reserved for Stage 4 embeddings; harmless if unused

--------------------------------------------------------------------
-- sources: the outlets we ingest from
--------------------------------------------------------------------
create type source_tier as enum (
  'primary_gov',        -- Cumhurbaşkanlığı, bakanlık, TBMM, AFAD, TCMB, YSK, TÜİK
  'primary_party',      -- Parti basın açıklamaları (iktidar + muhalefet)
  'agency',             -- AA, İHA
  'international'       -- BM, AB, IMF etc.
);

create type political_lean as enum (
  'iktidar',
  'muhalefet',
  'devlet_kurumu',      -- non-partisan state institutions
  'ajans',              -- agencies self-styled neutral; treat with caution
  'yabanci'
);

create table sources (
  id            text primary key,           -- stable slug e.g. 'afad', 'chp-press', 'aa-politika'
  name          text not null,              -- 'AFAD', 'CHP Basın', 'Anadolu Ajansı — Politika'
  tier          source_tier not null,
  lean          political_lean not null,
  base_url      text not null,              -- root URL for the site
  fetch_url     text,                       -- specific endpoint/RSS/scrape URL
  fetch_kind    text not null,              -- 'rss' | 'api_json' | 'scrape_html'
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now()
);

create index sources_active_idx on sources(active);
create index sources_tier_idx on sources(tier);

--------------------------------------------------------------------
-- raw_items: every scraped record. One row per item per source per run.
--------------------------------------------------------------------
create table raw_items (
  id                 bigserial primary key,
  source_id          text not null references sources(id) on delete cascade,
  external_id        text not null,               -- source's own id (event id, guid, url hash)
  title              text not null,
  body               text,                         -- summary/description or full text
  url                text,                         -- link to the original public page
  published_at       timestamptz not null,
  fetched_at         timestamptz not null default now(),
  raw_payload        jsonb,                        -- entire original record for reprocessing
  entities           text[] default '{}',          -- lowercased key entities (people/orgs/places)
  keywords           text[] default '{}',          -- extracted keywords
  category           text,                         -- our category enum as text ('Siyaset', 'Ekonomi'…)
  embedding          vector(768),                  -- Stage 4: semantic embedding (nullable for now)
  unique (source_id, external_id)
);

create index raw_items_published_idx on raw_items(published_at desc);
create index raw_items_category_idx on raw_items(category);
create index raw_items_source_idx on raw_items(source_id);
create index raw_items_entities_gin on raw_items using gin(entities);
create index raw_items_title_trgm on raw_items using gin(title gin_trgm_ops);
-- vector index intentionally omitted until embeddings actually populated

--------------------------------------------------------------------
-- events: grouped units of gündem. Stage 3 = 1:1 with raw_items;
-- Stage 4 = LLM/embedding clustering produces true grouping.
--------------------------------------------------------------------
create table events (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  summary            text not null,          -- neutral summary (Stage 4 LLM-generated; Stage 3 = raw item body)
  category           text not null,
  kicker             text,                    -- short section label shown on card
  first_seen_at      timestamptz not null,
  last_updated_at    timestamptz not null,
  read_seconds       int not null default 20,
  actors             text[] default '{}',
  next_date          text,                    -- free-text upcoming date/milestone
  current_status     text,                    -- "Şu an" one-liner
  how_we_got_here    text,                    -- "Buraya nasıl geldik" one-liner
  llm_processed_at   timestamptz              -- null until Stage 4 has touched this event
);

create index events_last_updated_idx on events(last_updated_at desc);
create index events_category_idx on events(category);

--------------------------------------------------------------------
-- event_sources: raw items attached to an event.
-- Stage 3 populates one row per event; Stage 4 clusters multiple.
--------------------------------------------------------------------
create table event_sources (
  event_id     uuid not null references events(id) on delete cascade,
  raw_item_id  bigint not null references raw_items(id) on delete cascade,
  role_in_event text,                          -- 'primary', 'response', 'context', 'context_gov', 'context_opposition'
  ordering     int not null default 0,
  primary key (event_id, raw_item_id)
);

create index event_sources_event_idx on event_sources(event_id);

--------------------------------------------------------------------
-- Importance score. A view + a scheduled refresh keeps it fresh.
--
-- Score components (Stage 3 heuristic, tunable):
--   category_weight    Siyaset 1.0, Ekonomi 1.0, Dış Politika 0.95, Afet 1.0,
--                      Güvenlik 0.9, Sağlık 0.7, Çevre 0.6, Eğitim 0.6,
--                      Teknoloji 0.4, Spor 0.2
--   source_tier_weight primary_gov/party 1.0, agency 0.5, international 0.9
--   multi_source       number of distinct source outlets referencing this event, log-scaled
--   recency            exp(-hours_old / 12)
--   final = category * tier * recency * (1 + 0.4*log(1+multi_source))
--------------------------------------------------------------------
create or replace view event_importance as
with per_event as (
  select
    e.id as event_id,
    e.category,
    e.last_updated_at,
    count(distinct r.source_id)::int as source_count,
    max(s.tier)::text as top_tier,
    extract(epoch from (now() - e.last_updated_at)) / 3600.0 as hours_old
  from events e
  join event_sources es on es.event_id = e.id
  join raw_items r on r.id = es.raw_item_id
  join sources s on s.id = r.source_id
  group by e.id
),
weights as (
  select
    event_id,
    category,
    hours_old,
    source_count,
    top_tier,
    (case category
        when 'Siyaset' then 1.0
        when 'Ekonomi' then 1.0
        when 'Afet' then 1.0
        when 'Dış Politika' then 0.95
        when 'Güvenlik' then 0.9
        when 'Sağlık' then 0.7
        when 'Çevre' then 0.6
        when 'Eğitim' then 0.6
        when 'Teknoloji' then 0.4
        when 'Spor' then 0.2
        else 0.5
     end) as category_w,
    (case top_tier
        when 'primary_gov' then 1.0
        when 'primary_party' then 1.0
        when 'international' then 0.9
        when 'agency' then 0.5
        else 0.4
     end) as tier_w,
    exp(- greatest(hours_old, 0) / 12.0) as recency_w,
    (1.0 + 0.4 * ln(1 + source_count)) as multi_w
  from per_event
)
select
  event_id,
  category,
  category_w * tier_w * recency_w * multi_w as importance,
  source_count,
  hours_old,
  category_w, tier_w, recency_w, multi_w
from weights;

-- top-24 view: category-diversified. Take top per category, then fill remainder by pure score.
create or replace view top_24_events as
with ranked as (
  select
    ei.*,
    row_number() over (partition by ei.category order by ei.importance desc) as cat_rank,
    row_number() over (order by ei.importance desc) as overall_rank
  from event_importance ei
),
picked as (
  -- guarantee at least top-2 from every category with any items
  select event_id, importance, category, overall_rank from ranked where cat_rank <= 2
  union
  -- fill remainder by pure score
  select event_id, importance, category, overall_rank from ranked
),
deduped as (
  select distinct on (event_id) event_id, importance, category, overall_rank
  from picked
  order by event_id, overall_rank
)
select event_id, importance, category
from deduped
order by importance desc
limit 24;

--------------------------------------------------------------------
-- Row-Level Security: MVP posture — public read, no anon writes.
-- Writes come from the scraper using the service role key.
--------------------------------------------------------------------
alter table sources        enable row level security;
alter table raw_items      enable row level security;
alter table events         enable row level security;
alter table event_sources  enable row level security;

create policy "public read sources"       on sources       for select using (true);
create policy "public read raw_items"     on raw_items     for select using (true);
create policy "public read events"        on events        for select using (true);
create policy "public read event_sources" on event_sources for select using (true);

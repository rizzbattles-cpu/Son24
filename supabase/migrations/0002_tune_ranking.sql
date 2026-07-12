-- Ranking overhaul.
--
-- Product intent (locked in July 2026):
--   - Siyaset / Ekonomi / Dış Politika / Afet are ALWAYS the top-24 backbone.
--   - Spor / Teknoloji / Sağlık / Eğitim only appear if they crack a high
--     importance threshold — otherwise the feed stays lean.
--   - No "at least 2 per category" spread. Diversification is opinionated:
--     backbone categories yes, low-signal categories no.
--   - Turkey-only bias is enforced upstream by scrapers; this view doesn't
--     re-check locale.

drop view if exists top_24_events;
drop view if exists event_importance;

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
        when 'Siyaset' then 1.2
        when 'Ekonomi' then 1.2
        when 'Dış Politika' then 1.2
        when 'Afet' then 1.15
        when 'Güvenlik' then 1.0
        when 'Sağlık' then 0.6
        when 'Çevre' then 0.55
        when 'Eğitim' then 0.5
        when 'Teknoloji' then 0.35
        when 'Spor' then 0.15
        else 0.5
     end) as category_w,
    (case top_tier
        when 'primary_gov' then 1.0
        when 'primary_party' then 1.0
        when 'international' then 0.9
        when 'agency' then 0.55
        else 0.4
     end) as tier_w,
    exp(- greatest(hours_old, 0) / 12.0) as recency_w,
    (1.0 + 0.5 * ln(1 + source_count)) as multi_w
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

-- Backbone categories that always try to reach top-24 first.
-- Others only enter by pure score after backbone slots are filled.
create or replace view top_24_events as
with backbone as (
  select event_id, importance, category,
         row_number() over (order by importance desc) as rn
  from event_importance
  where category in ('Siyaset', 'Ekonomi', 'Dış Politika', 'Afet', 'Güvenlik')
),
filler as (
  select event_id, importance, category
  from event_importance
  where category not in ('Siyaset', 'Ekonomi', 'Dış Politika', 'Afet', 'Güvenlik')
    and importance > 0.5   -- low-signal categories need to earn their spot
),
picked as (
  select event_id, importance, category from backbone where rn <= 20
  union all
  select event_id, importance, category from filler
),
deduped as (
  select distinct on (event_id) event_id, importance, category
  from picked
  order by event_id, importance desc
)
select event_id, importance, category
from deduped
order by importance desc
limit 24;

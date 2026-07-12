-- New agency-tier sources. Politically-filtered, paraphrase-only display.
insert into sources (id, name, tier, lean, base_url, fetch_url, fetch_kind, notes) values
('euronews-tr', 'Euronews Türkçe', 'agency', 'yabanci',
 'https://tr.euronews.com',
 'https://tr.euronews.com/rss',
 'rss',
 'Only Türkiye+politics items are kept; body is paraphrased, no verbatim.'),

('sputnik-tr', 'Sputnik Türkiye', 'agency', 'yabanci',
 'https://anlatilaninotesi.com.tr',
 'https://anlatilaninotesi.com.tr',
 'scrape_html',
 'Only Türkiye+politics items; body paraphrased.'),

('gazete-oksijen', 'Gazete Oksijen', 'agency', 'ajans',
 'https://gazeteoksijen.com',
 'https://gazeteoksijen.com/politika',
 'scrape_html',
 'DEFERRED — SPA-only, needs Playwright.')
on conflict (id) do update
  set name = excluded.name,
      base_url = excluded.base_url,
      fetch_url = excluded.fetch_url,
      fetch_kind = excluded.fetch_kind,
      notes = excluded.notes;

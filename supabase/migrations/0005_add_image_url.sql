-- Image URL scraped from each item's og:image (or RSS media enclosure).
-- Displayed on the card if present.

alter table raw_items add column if not exists image_url text;

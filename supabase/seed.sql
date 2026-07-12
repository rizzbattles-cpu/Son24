-- Kaynak sicili — Gündem'in izlediği resmi ve yarı-resmi kaynaklar.
-- Bu liste sürekli genişleyecek. Her satır bir "source" — scraper'lar id üzerinden yazar.

insert into sources (id, name, tier, lean, base_url, fetch_url, fetch_kind, notes) values

-- === DEVLET KURUMLARI (birincil, taraf üstü) ===
('afad',                'AFAD',                        'primary_gov', 'devlet_kurumu',
 'https://deprem.afad.gov.tr',
 'https://deprem.afad.gov.tr/apiv2/event/filter',
 'api_json',
 'Deprem verileri, son 24 saat, minmag=3'),

('cumhurbaskanligi',    'Cumhurbaşkanlığı',            'primary_gov', 'iktidar',
 'https://www.tccb.gov.tr',
 'https://www.tccb.gov.tr/haberler',
 'scrape_html',
 'Başkanlık haber/konuşma sayfası'),

('disisleri',           'Dışişleri Bakanlığı',         'primary_gov', 'devlet_kurumu',
 'https://www.mfa.gov.tr',
 'https://www.mfa.gov.tr/basin-aciklamalari.tr.mfa',
 'scrape_html',
 'Basın açıklamaları'),

('milli-savunma',       'Milli Savunma Bakanlığı',     'primary_gov', 'devlet_kurumu',
 'https://www.msb.gov.tr',
 'https://www.msb.gov.tr/SlaytHaber',
 'scrape_html',
 null),

('hazine-maliye',       'Hazine ve Maliye Bakanlığı',  'primary_gov', 'iktidar',
 'https://www.hmb.gov.tr',
 'https://www.hmb.gov.tr/duyurular',
 'scrape_html',
 null),

('tbmm',                'TBMM',                        'primary_gov', 'devlet_kurumu',
 'https://www.tbmm.gov.tr',
 'https://www.tbmm.gov.tr/HaberListesi',
 'scrape_html',
 'Gündem, genel kurul, komisyon haberleri'),

('tcmb',                'TCMB',                        'primary_gov', 'devlet_kurumu',
 'https://www.tcmb.gov.tr',
 'https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+menu/duyurular',
 'scrape_html',
 'Duyurular ve PPK kararları'),

('tuik',                'TÜİK',                        'primary_gov', 'devlet_kurumu',
 'https://www.tuik.gov.tr',
 'https://data.tuik.gov.tr/Kategori/GetKategori?p=Haber+Bulteni',
 'scrape_html',
 'Haber bültenleri'),

-- === İKTİDAR PARTİLERİ ===
('akp-basin',           'AKP Basın',                   'primary_party', 'iktidar',
 'https://www.akparti.org.tr',
 'https://www.akparti.org.tr/haberler',
 'scrape_html',
 null),

('mhp-basin',           'MHP Basın',                   'primary_party', 'iktidar',
 'https://www.mhp.org.tr',
 'https://www.mhp.org.tr/htmldocs/genel_baskan/konusmalari.html',
 'scrape_html',
 null),

-- === MUHALEFET PARTİLERİ ===
('chp-basin',           'CHP Basın',                   'primary_party', 'muhalefet',
 'https://www.chp.org.tr',
 'https://www.chp.org.tr/haberler',
 'scrape_html',
 null),

('iyi-parti-basin',     'İYİ Parti Basın',             'primary_party', 'muhalefet',
 'https://iyiparti.org.tr',
 'https://iyiparti.org.tr/haberler',
 'scrape_html',
 null),

('dem-parti-basin',     'DEM Parti Basın',             'primary_party', 'muhalefet',
 'https://demparti.org.tr',
 'https://demparti.org.tr/haberler',
 'scrape_html',
 null),

('zafer-basin',         'Zafer Partisi Basın',         'primary_party', 'muhalefet',
 'https://www.zaferpartisi.org.tr',
 'https://www.zaferpartisi.org.tr/haberler',
 'scrape_html',
 null),

('saadet-basin',        'Saadet Partisi Basın',        'primary_party', 'muhalefet',
 'https://www.saadet.org.tr',
 'https://www.saadet.org.tr/kategori/basin-aciklamalari',
 'scrape_html',
 null),

-- === HABER AJANSLARI (bilgi için, tier=agency ile downweight) ===
('aa-politika',         'Anadolu Ajansı — Politika',   'agency', 'ajans',
 'https://www.aa.com.tr',
 'https://www.aa.com.tr/tr/rss/default?cat=politika',
 'rss',
 null),

('aa-ekonomi',          'Anadolu Ajansı — Ekonomi',    'agency', 'ajans',
 'https://www.aa.com.tr',
 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi',
 'rss',
 null),

('aa-dunya',            'Anadolu Ajansı — Dünya',      'agency', 'ajans',
 'https://www.aa.com.tr',
 'https://www.aa.com.tr/tr/rss/default?cat=dunya',
 'rss',
 null),

('aa-guncel',           'Anadolu Ajansı — Güncel',     'agency', 'ajans',
 'https://www.aa.com.tr',
 'https://www.aa.com.tr/tr/rss/default?cat=guncel',
 'rss',
 null);

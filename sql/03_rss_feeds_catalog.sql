truncate table rss_feeds;

insert into rss_feeds (url, name, topics, language) values

-- ── TECNOLOGIA + INOVAÇÃO ─────────────────────────────────────
('https://techcrunch.com/feed/', 'TechCrunch', '{"Tecnologia","Inovação","Empreendedorismo"}', 'en'),
('https://feeds.arstechnica.com/arstechnica/index', 'Ars Technica', '{"Tecnologia","Ciência","Inovação"}', 'en'),
('https://www.theverge.com/rss/index.xml', 'The Verge', '{"Tecnologia","Smartphones","Inovação"}', 'en'),
('https://www.wired.com/feed/rss', 'Wired', '{"Tecnologia","Inovação","Ciência","Smartphones"}', 'en'),
('https://feeds.feedburner.com/venturebeat/SZYF', 'VentureBeat', '{"Tecnologia","Inovação"}', 'en'),
('https://thenextweb.com/feed/', 'The Next Web', '{"Tecnologia","Inovação"}', 'en'),
('https://www.pcworld.com/feed', 'PCWorld', '{"Tecnologia","Smartphones"}', 'en'),
('https://feeds.pcmag.com/rss/pcmag-latest', 'PCMag', '{"Tecnologia","Smartphones"}', 'en'),
('https://www.cnet.com/rss/all/', 'CNET', '{"Tecnologia","Smartphones"}', 'en'),
('https://olhardigital.com.br/feed/', 'Olhar Digital', '{"Tecnologia","Smartphones"}', 'pt'),
('https://rss.tecmundo.com.br/feed', 'TecMundo', '{"Tecnologia","Smartphones","Games"}', 'pt'),
('https://canaltech.com.br/rss/', 'Canaltech', '{"Tecnologia","Smartphones"}', 'pt'),

-- ── SMARTPHONES ───────────────────────────────────────────────
('https://www.gsmarena.com/rss-news-reviews.php3', 'GSMArena', '{"Smartphones"}', 'en'),
('https://9to5mac.com/feed/', '9to5Mac', '{"Smartphones","Tecnologia"}', 'en'),
('https://9to5google.com/feed/', '9to5Google', '{"Smartphones","Tecnologia"}', 'en'),
('https://www.androidauthority.com/feed/', 'Android Authority', '{"Smartphones"}', 'en'),
('https://www.macrumors.com/macrumors.xml', 'MacRumors', '{"Smartphones","Tecnologia"}', 'en'),

-- ── CIÊNCIA ───────────────────────────────────────────────────
('https://www.sciencedaily.com/rss/all.xml', 'Science Daily', '{"Ciência"}', 'en'),
('https://feeds.newscientist.com/science-news', 'New Scientist', '{"Ciência"}', 'en'),
('https://www.nature.com/nature.rss', 'Nature', '{"Ciência"}', 'en'),
('https://rss.sciam.com/ScientificAmerican-Global', 'Scientific American', '{"Ciência"}', 'en'),
('https://super.abril.com.br/feed/', 'Superinteressante', '{"Ciência","Cultura","Tecnologia"}', 'pt'),

-- ── NEGÓCIOS + ECONOMIA + FINANÇAS ────────────────────────────
('https://feeds.bloomberg.com/technology/news.rss', 'Bloomberg Tech', '{"Negócios","Tecnologia","Finanças"}', 'en'),
('https://www.ft.com/?format=rss', 'Financial Times', '{"Negócios","Economia","Finanças"}', 'en'),
('https://feeds.reuters.com/reuters/businessNews', 'Reuters Business', '{"Negócios","Economia","Mundo"}', 'en'),
('https://feeds.reuters.com/reuters/technologyNews', 'Reuters Tech', '{"Tecnologia","Negócios"}', 'en'),
('https://www.infomoney.com.br/feed/', 'InfoMoney', '{"Finanças","Economia","Negócios"}', 'pt'),
('https://valoreconomico.com.br/rss', 'Valor Econômico', '{"Economia","Negócios","Finanças"}', 'pt'),
('https://exame.com/feed/', 'Exame', '{"Negócios","Economia","Empreendedorismo"}', 'pt'),
('https://www.startups.com.br/feed/', 'Startups.com.br', '{"Empreendedorismo","Inovação","Negócios"}', 'pt'),
('https://startupi.com.br/feed/', 'Startupi', '{"Empreendedorismo","Inovação"}', 'pt'),
('https://forbes.com.br/feed/', 'Forbes Brasil', '{"Negócios","Empreendedorismo","Finanças"}', 'pt'),

-- ── EMPREENDEDORISMO + INOVAÇÃO ───────────────────────────────
('https://hbr.org/stories.rss', 'Harvard Business Review', '{"Empreendedorismo","Trabalho e Carreira","Negócios"}', 'en'),
('https://mitsloan.mit.edu/rss/ideas-made-to-matter', 'MIT Sloan', '{"Inovação","Negócios","Educação"}', 'en'),

-- ── GAMES ─────────────────────────────────────────────────────
('https://feeds.ign.com/ign/all', 'IGN', '{"Games","Filmes","Séries"}', 'en'),
('https://gamerant.com/feed/', 'Game Rant', '{"Games","E-sports"}', 'en'),
('https://kotaku.com/rss', 'Kotaku', '{"Games"}', 'en'),
('https://www.polygon.com/rss/index.xml', 'Polygon', '{"Games","Entretenimento"}', 'en'),
('https://www.eurogamer.net/?format=rss', 'Eurogamer', '{"Games"}', 'en'),
('https://www.gamespot.com/feeds/news/', 'GameSpot', '{"Games"}', 'en'),
('https://br.ign.com/feed.xml', 'IGN Brasil', '{"Games","Filmes","Séries"}', 'pt'),
('https://www.gamesradar.com/rss/', 'GamesRadar', '{"Games"}', 'en'),

-- ── E-SPORTS ──────────────────────────────────────────────────
('https://dotesports.com/feed', 'Dot Esports', '{"E-sports","Games"}', 'en'),
('https://www.oneesports.gg/feed/', 'ONE Esports', '{"E-sports","Games"}', 'en'),
('https://www.esportstalk.com/feed/', 'Esports Talk', '{"E-sports"}', 'en'),
('https://www.necessario.com.br/feed/', 'Necessary', '{"E-sports","Games"}', 'pt'),

-- ── CINEMA + FILMES + SÉRIES ──────────────────────────────────
('https://deadline.com/feed/', 'Deadline', '{"Cinema","Filmes","Séries","Entretenimento"}', 'en'),
('https://variety.com/feed/', 'Variety', '{"Cinema","Filmes","Séries","Música"}', 'en'),
('https://www.hollywoodreporter.com/feed/', 'Hollywood Reporter', '{"Cinema","Filmes","Séries"}', 'en'),
('https://collider.com/feed/', 'Collider', '{"Cinema","Filmes","Séries"}', 'en'),
('https://screenrant.com/feed/', 'Screen Rant', '{"Filmes","Séries","Games"}', 'en'),
('https://www.empireonline.com/movies/news/rss/', 'Empire', '{"Cinema","Filmes"}', 'en'),
('https://www.cinemablend.com/rss/news', 'CinemaBlend', '{"Cinema","Filmes","Séries"}', 'en'),
('https://www.adorocinema.com/rss/news/', 'AdoroCinema', '{"Cinema","Filmes"}', 'pt'),
('https://www.omelete.com.br/rss/tudo', 'Omelete', '{"Cinema","Filmes","Séries","Games","E-sports"}', 'pt'),

-- ── ENTRETENIMENTO + POP + MÚSICA ─────────────────────────────
('https://www.billboard.com/feed/', 'Billboard', '{"Música","Pop","Entretenimento"}', 'en'),
('https://www.rollingstone.com/music/feed/', 'Rolling Stone', '{"Música","Pop","Entretenimento"}', 'en'),
('https://consequence.net/feed/', 'Consequence of Sound', '{"Música"}', 'en'),
('https://www.nme.com/feed', 'NME', '{"Música","Pop","Cultura"}', 'en'),
('https://g1.globo.com/rss/g1/pop-arte/musica/', 'G1 Música', '{"Música","Pop"}', 'pt'),
('https://ew.com/feed/', 'Entertainment Weekly', '{"Entretenimento","Pop","Filmes","Séries"}', 'en'),
('https://people.com/feed/', 'People', '{"Entretenimento","Pop"}', 'en'),
('https://ego.globo.com/rss/ego/', 'Gshow', '{"Entretenimento","Pop","Cultura"}', 'pt'),
('https://g1.globo.com/rss/g1/pop-arte/', 'G1 Pop & Arte', '{"Entretenimento","Pop","Cultura"}', 'pt'),
('https://www.papelpop.com/feed/', 'Papel Pop', '{"Pop","Música","Entretenimento"}', 'pt'),

-- ── ARTE + CULTURA ────────────────────────────────────────────
('https://hyperallergic.com/feed/', 'Hyperallergic', '{"Arte","Cultura"}', 'en'),
('https://www.artsy.net/rss/news', 'Artsy', '{"Arte"}', 'en'),
('https://www.theguardian.com/culture/rss', 'The Guardian Culture', '{"Cultura","Arte","Música"}', 'en'),
('https://www.theguardian.com/artanddesign/rss', 'The Guardian Art', '{"Arte"}', 'en'),
('https://revista.cultura.gov.br/feed/', 'Revista Cultura BR', '{"Cultura","Arte"}', 'pt'),

-- ── ESPORTES ──────────────────────────────────────────────────
('https://feeds.bbci.co.uk/sport/rss.xml', 'BBC Sport', '{"Esportes"}', 'en'),
('https://www.espn.com/espn/rss/news', 'ESPN', '{"Esportes"}', 'en'),
('https://ge.globo.com/rss/ge.xml', 'GE Globo', '{"Esportes"}', 'pt'),
('https://www.uol.com.br/esporte/futebol/rss.xml', 'UOL Esporte', '{"Esportes"}', 'pt'),
('https://www.lance.com.br/feed.xml', 'Lance!', '{"Esportes"}', 'pt'),

-- ── POLÍTICA + MUNDO + BRASIL ─────────────────────────────────
('https://feeds.reuters.com/Reuters/worldNews', 'Reuters World', '{"Mundo","Política"}', 'en'),
('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC World', '{"Mundo","Política"}', 'en'),
('https://www.theguardian.com/world/rss', 'The Guardian World', '{"Mundo","Política"}', 'en'),
('https://g1.globo.com/rss/g1/', 'G1', '{"Política","Brasil","Mundo","Economia"}', 'pt'),
('https://feeds.folha.uol.com.br/folha/brasil/rss091.xml', 'Folha Brasil', '{"Política","Brasil"}', 'pt'),
('https://feeds.folha.uol.com.br/folha/mundo/rss091.xml', 'Folha Mundo', '{"Mundo","Política"}', 'pt'),
('https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', 'Agência Brasil', '{"Brasil","Política"}', 'pt'),
('https://noticias.uol.com.br/rss.xml', 'UOL Notícias', '{"Brasil","Política","Economia"}', 'pt'),

-- ── MEIO AMBIENTE ─────────────────────────────────────────────
('https://www.theguardian.com/environment/rss', 'The Guardian Environment', '{"Meio Ambiente","Ciência"}', 'en'),
('https://grist.org/feed/', 'Grist', '{"Meio Ambiente"}', 'en'),
('https://www.nationalgeographic.com/pages/topic/latest-stories.rss', 'National Geographic', '{"Meio Ambiente","Ciência"}', 'en'),
('https://oeco.org.br/feed/', 'O Eco', '{"Meio Ambiente"}', 'pt'),

-- ── EDUCAÇÃO ──────────────────────────────────────────────────
('https://porvir.org/feed/', 'Porvir', '{"Educação"}', 'pt'),
('https://www.nexojornal.com.br/feed.xml', 'Nexo Jornal', '{"Educação","Política","Cultura"}', 'pt'),
('https://educacao.uol.com.br/rss.xml', 'UOL Educação', '{"Educação"}', 'pt'),

-- ── TRABALHO E CARREIRA ───────────────────────────────────────
('https://exame.com/carreira/feed/', 'Exame Carreira', '{"Trabalho e Carreira"}', 'pt'),
('https://forbes.com.br/carreira/feed/', 'Forbes Carreira', '{"Trabalho e Carreira","Empreendedorismo"}', 'pt'),

-- ── TURISMO + VIAGEM ──────────────────────────────────────────
('https://www.cntraveler.com/feed/rss', 'Condé Nast Traveler', '{"Turismo","Viagem"}', 'en'),
('https://www.lonelyplanet.com/news/feed', 'Lonely Planet', '{"Turismo","Viagem"}', 'en'),
('https://www.mochileiros.com/feed/', 'Mochileiros', '{"Turismo","Viagem"}', 'pt'),
('https://viagem.uol.com.br/rss.xml', 'UOL Viagem', '{"Turismo","Viagem"}', 'pt'),
('https://www.panrotas.com.br/rss/geral.xml', 'Panrotas', '{"Turismo","Viagem"}', 'pt'),
('https://viagem.abril.com.br/feed/', 'Abril Viagem', '{"Turismo","Viagem"}', 'pt'),
('https://g1.globo.com/rss/g1/turismo-e-viagem/', 'G1 Turismo', '{"Turismo","Viagem"}', 'pt'),
('https://edition.cnn.com/services/rss/travel.rss', 'CNN Travel', '{"Turismo","Viagem","Mundo"}', 'en'),
('https://skift.com/feed/', 'Skift', '{"Turismo","Viagem","Negócios"}', 'en'),
('https://www.frommers.com/rss/news', 'Frommers', '{"Turismo","Viagem"}', 'en')

on conflict (url) do nothing;

select count(*) as total_feeds from rss_feeds;

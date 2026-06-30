import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from autocomplete_trie import AutocompleteTrie
import re

trie = AutocompleteTrie()

# 500 seeded search terms across tech, music, education, news, and wildlife domains
SEARCH_TERMS: list[tuple[str, int]] = [
    ("python",                    9800), ("javascript",               9600),
    ("react",                     9400), ("machine learning",         9200),
    ("docker",                    8900), ("typescript",               8700),
    ("kubernetes",                8500), ("nodejs",                   8300),
    ("fastapi",                   8100), ("deep learning",            7900),
    ("neural network",            7700), ("tensorflow",               7500),
    ("pytorch",                   7300), ("artificial intelligence",  7100),
    ("data science",              6900), ("aws",                      6700),
    ("django",                    6600), ("flask",                    6400),
    ("postgresql",                6200), ("mongodb",                  6000),
    ("redis",                     5900), ("graphql",                  5700),
    ("apollo client",             1200), ("nextjs",                   5500),
    ("tailwindcss",               5300), ("bootstrap",                5100),
    ("sass",                      4900), ("webpack",                  4700),
    ("vite",                      4600), ("git",                      4500),
    ("github",                    4400), ("gitlab",                   2100),
    ("bitbucket",                 1100), ("linux",                    4300),
    ("ubuntu",                    3900), ("debian",                   1800),
    ("arch linux",                1500), ("macos",                    4100),
    ("windows",                   4000), ("android",                  3800),
    ("ios",                       3700), ("flutter",                  3600),
    ("react native",              3500), ("swift",                    3400),
    ("kotlin",                    3300), ("java",                     3200),
    ("spring boot",               2900), ("c++",                      3100),
    ("c#",                        3000), (".net core",                2400),
    ("rust",                      2800), ("golang",                   2700),
    ("ruby on rails",             2300), ("php",                      2500),
    ("laravel",                   2200), ("html5",                    2000),
    ("css3",                      1900), ("sql",                      1700),
    ("mysql",                     1600), ("sqlite",                   1400),
    ("firebase",                  1300), ("supabase",                 1150),
    ("prisma",                    1050), ("sequelize",                950),
    ("cybersecurity",             3400), ("cryptography",             2200),
    ("blockchain",                3200), ("ethereum",                 2500),
    ("bitcoin",                   2800), ("smart contract",           1900),
    ("web3",                      2100), ("solidity",                 1500),
    ("devops",                    3300), ("ci/cd pipeline",           2600),
    ("jenkins",                   2400), ("github actions",           2700),
    ("terraform",                 2500), ("ansible",                  2100),
    ("prometheus",                1900), ("grafana",                  2000),
    ("elk stack",                 1800), ("nginx",                    2300),
    ("apache web server",         1400), ("serverless architecture",  2200),
    ("aws lambda",                2400), ("google cloud platform",    2100),
    ("microsoft azure",           2200), ("cloudflare",               2300),
    ("digitalocean",              1700), ("heroku",                   1500),
    ("vercel",                    2600), ("netlify",                  1900),
    ("microservices",             2800), ("rest api",                 2900),
    ("grpc",                      1600), ("websockets",               2100),
    ("postman",                   2000), ("swagger openapi",          1700),
    ("agile methodology",         2500), ("scrum framework",          2200),

    # ── MUSIC (100) ───────────────────────────────────────────────────
    ("acoustic guitar",           5400), ("electric piano",           4100),
    ("synthesizer",               4800), ("drum kit",                 4600),
    ("bass guitar",               4300), ("saxophone",                3200),
    ("trumpet",                   2800), ("violin concert",           3500),
    ("cello suite",               2900), ("flute orchestra",          2400),
    ("microphone condensator",    3100), ("audio interface",          3600),
    ("studio monitors",           3300), ("headphones studio",        3900),
    ("digital audio workstation", 2900), ("ableton live",             3400),
    ("logic pro x",               2800), ("fl studio",                3500),
    ("pro tools",                 2600), ("reaper daw",               1900),
    ("music production",          4500), ("mixing and mastering",     3800),
    ("equalizer eq",              3100), ("compressor audio",         2700),
    ("reverb plugin",             2500), ("delay pedal",              2300),
    ("music streaming",           6200), ("spotify playlist",         7800),
    ("apple music",               5900), ("soundcloud artists",       4900),
    ("vinyl record tracking",     3200), ("turntable scratching",     2400),
    ("music festival line",       4800), ("live concert tour",        5100),
    ("indie rock band",           3900), ("hip hop beats",            6700),
    ("electronic dance music",    5800), ("techno underground",       3400),
    ("house music progressive",   4100), ("ambient soundscapes",      3700),
    ("classical symphony",        4200), ("jazz improvisation",       4400),
    ("blues guitar solo",         3600), ("reggae riddims",           2900),
    ("heavy metal riffs",         3800), ("pop music charts",         6900),
    ("rhythm and blues rnb",      4600), ("folk songwriting",         3100),
    ("song lyrics searching",     7200), ("vocal warmups",            2500),
    ("choir harmony arrangement", 2100), ("music theory harmony",     3900),
    ("sheet music notes",         4300), ("guitar chords tabs",       6400),
    ("piano scales patterns",     3500), ("metronome tempo click",    2800),
    ("karaoke singing tracks",    4100), ("musical theatre broadway", 3700),
    ("opera singing aria",        2300), ("marching band drums",      2600),
    ("ukulele tutorial easy",     3900), ("harmonica blues harp",     1900),
    ("accordion folk tunes",      1400), ("banjo bluegrass picking",  1800),
    ("mandolin chords standard",  1300), ("harp classical solo",      1700),
    ("synthesizer patch design",  2200), ("midi controller keyboard", 3400),
    ("sampling drum loops",       2900), ("lofi hip hop radio",       5600),
    ("podcast background music",  4200), ("jingle composition",       1600),
    ("film score soundtrack",     4800), ("orchestration tutorial",   2100),
    ("dj mixer decks",            3300), ("sound effects sfx",        4900),
    ("foley sound artist",        1900), ("acoustic panels studio",   2700),
    ("bass trap isolation",       1800), ("vocal booth vocal",        2100),
    ("gig bags instruments",      2300), ("guitar strings nylon",     3100),
    ("drumsticks signature",      2200), ("amplifier tube combo",     3200),
    ("guitar pick plectrum",      1500), ("capo guitar key",          2600),
    ("music copyright library",   2400), ("ascap bmi licensing",      1900),
    ("music distribution distrokid", 3100), ("bandcamp records",      3500),
    ("album cover design",        4100), ("merchandise band tshirts", 2900),
    ("busking street music",      2200), ("open mic night roster",    2600),
    ("vocal range test singer",   3400), ("pitch perfect tuning",     2800),
    ("ear training intervals",    3200), ("sight reading rhythm",     2700),

    # ── EDUCATION (100) ───────────────────────────────────────────────
    ("online courses university", 6800), ("distance learning adult",  4900),
    ("khan academy math",         5900), ("coursera certificate",     5400),
    ("edx professional certificates", 4100), ("udemy programming development", 5800),
    ("higher education policy",   3900), ("scholarship application international", 5200),
    ("financial aid fafsa",       6100), ("student loan repayment",   5400),
    ("tuition fees calculator",   3400), ("university ranking global", 5700),
    ("college admissions essay",  4800), ("sat exam preparation",     4600),
    ("act test registration",     3800), ("gre vocabulary list",      3900),
    ("gmat business school",      3500), ("toefl english test",       4200),
    ("ielts band score 8",        4900), ("curriculum design matrix", 2400),
    ("lesson planning templates", 3600), ("classroom management active", 3300),
    ("educational technology tools", 4500), ("learning management system lms", 4100),
    ("canvas lms login",          6400), ("blackboard student portal", 5800),
    ("google classroom assignments", 7100), ("stem education grants", 3900),
    ("coding for kids scratch",   4200), ("montessori teaching method", 3700),
    ("homeschooling curriculum free", 4600), ("special education iep", 3500),
    ("autism classroom strategies", 2900), ("dyslexia reading aids",  2800),
    ("adult literacy programs",   2200), ("language learning apps",   5900),
    ("duolingo spanish streak",   6800), ("rosetta stone immersion",  3100),
    ("bilingual child development", 2700), ("study tips memory",      5400),
    ("pomodoro technique focus",  4900), ("speed reading exercise",   3200),
    ("mind mapping software",     3800), ("flashcards spaced repetition", 3600),
    ("ankidroid deck sync",       2900), ("academic writing structure", 4300),
    ("apa citation guidelines",   5800), ("mla format handbook",      5200),
    ("chicago manual style",      3400), ("plagiarism checker turnitin", 4900),
    ("thesis defense preparation", 3100), ("peer reviewed journals",  4600),
    ("google scholar citations",  6300), ("open access textbook",     3900),
    ("wikipedia reference links", 7600), ("encyclopedia britannica",  3200),
    ("public library catalogs",   3700), ("literacy rate stats",      2100),
    ("early childhood daycare",   4800), ("kindergarten phonics worksheets", 4300),
    ("primary school arithmetic", 3100), ("high school biology lab",  3600),
    ("geometry proofs shapes",    2900), ("calculus derivatives integral", 3800),
    ("physics thermodynamics energy", 3400), ("chemistry periodic table", 4200),
    ("world history timeline",     4500), ("geography map quiz",      4100),
    ("english literature classics", 3900), ("creative writing prompts", 4300),
    ("public speaking anxiety",   3800), ("debate club topics",       2700),
    ("critical thinking puzzles", 3400), ("emotional intelligence kids", 3200),
    ("school counseling resources", 2900), ("teacher certification test", 3500),
    ("pedagogy teaching styles",  2400), ("project based learning",   3300),
    ("flipped classroom model",    2600), ("gamification education",   3100),
    ("virtual reality education", 2800), ("artificial intelligence tutoring", 3600),
    ("student exchange rotary",   2900), ("study abroad scholarships", 4700),
    ("gap year volunteer opportunities", 3400), ("vocational training trade school", 3900),
    ("apprenticeship electric plumber", 3200), ("continuing professional development", 2800),
    ("executive mba programs",    3700), ("phd research proposal",    3300),
    ("postdoctoral fellowship positions", 2900), ("grant writing non profit", 3100),
    ("science fair project ideas", 4200), ("spelling bee word lists",  2800),
    ("mental math tricks rapid",  3400), ("sudoku puzzles printable", 4600),
    ("rubiks cube 3x3 solution",  3900), ("chess strategies openings", 4800),

    # ── NEWS & CURRENT EVENTS (100) ───────────────────────────────────
    ("breaking news alerts",      8900), ("world news headlines",     8200),
    ("local weather forecast",    9600), ("investigative journalism",  4100),
    ("freedom of the press",      3400), ("pulitzer prize winners",   2600),
    ("associated press live",     6400), ("reuters global reports",   6200),
    ("international relations",   3900), ("united nations assembly",   4300),
    ("peace treaty negotiations", 2800), ("geopolitical conflict map", 4900),
    ("climate change global action", 5800), ("carbon neutrality goals", 3900),
    ("renewable energy transition", 4600), ("cop climate conference", 3500),
    ("g20 summit schedule",       3700), ("world economic forum davos", 3900),
    ("inflation rates percentage", 5400), ("central bank interest rates", 4800),
    ("federal reserve announcements", 5900), ("stock market market indexes", 7800),
    ("dow jones industrial average", 6200), ("nasdaq tech composite",  6100),
    ("s&p 500 company charts",    6400), ("cryptocurrency regulatory bills", 4300),
    ("global supply chain shipping", 4500), ("trade tariff economics", 3400),
    ("employment statistics labor", 4100), ("unemployment benefit claims", 4600),
    ("minimum wage legislation",  3900), ("labor union strikes airport", 4300),
    ("presidential election results", 8400), ("midterm elections voting", 6200),
    ("voter registration status",  5900), ("polling places near me",   6800),
    ("supreme court landmark rulings", 5100), ("senate bill tracking",  4200),
    ("house of representatives live", 3900), ("parliamentary debate prime", 3400),
    ("prime minister press statement", 4100), ("political scandal leaks", 5200),
    ("public healthcare spending", 3700), ("universal basic income trial", 3400),
    ("immigration reform policies", 4500), ("refugee asylum processing", 3600),
    ("border security surveillance", 3800), ("human rights international law", 4100),
    ("amnesty international reports", 3200), ("disaster relief red cross", 4600),
    ("earthquake warning network", 5400), ("hurricane tracker warning", 6200),
    ("wildfire evacuation status", 4900), ("flooding rainfall advisory", 4700),
    ("space exploration nasa launches", 5600), ("mars rover mission sample", 4300),
    ("james webb space telescope", 5200), ("spacex starship flight tracking", 5800),
    ("satellite communication orbit", 3600), ("epidemic outbreak prevention", 4100),
    ("world health organization guidelines", 5400), ("medical breakthrough trial", 4800),
    ("fda drug approval notices", 3900), ("pharmaceutical market competition", 3400),
    ("tech antitrust investigation", 4600), ("social media censorship debate", 4300),
    ("data privacy GDPR violations", 3900), ("cyber attack corporate bank", 4800),
    ("ransomware protection alerts", 3700), ("artificial intelligence ethics bill", 4900),
    ("autonomous vehicle regulations", 3500), ("quantum computing milestone", 3100),
    ("nuclear non proliferation npt", 2700), ("military defense budget country", 4100),
    ("nato joint military exercises", 3800), ("peacekeeping forces mandate", 2900),
    ("aviation safety flight crash", 4200), ("maritime shipping piracy alerts", 2800),
    ("high speed rail funding",    3400), ("infrastructure spending roads", 3900),
    ("olympic games host city",   5800), ("world cup tournament matches", 6900),
    ("championship final live score", 7200), ("sports transfer rumor window", 5400),
    ("entertainment awards oscars",  4800), ("film festival award winners", 3600),
    ("celebrity endorsement contract", 3900), ("royal family coronation announcement", 4200),
    ("nobel prize winners list",   3800), ("philanthropy foundation donation", 3100),
    ("social movement protest capital", 4700), ("environmental activism boycott", 3600),
    ("fake news verification tools", 3800), ("fact checking statistics agency", 4200),

    # ── WILDLIFE & NATURE (100) ───────────────────────────────────────
    ("african elephant migration", 4200), ("bengal tiger tracking wildlife", 3800),
    ("giant panda breeding reserve", 3900), ("humpback whale singing sounds", 4500),
    ("bald eagle nest monitoring", 4100), ("monarch butterfly map path", 3600),
    ("galapagos tortoise sanctuary", 3400), ("polar bear ice hunting",   4300),
    ("snow leopard camera trap",   3500), ("emperor penguin colony colony", 3800),
    ("amazon rainforest ecosystem", 5400), ("great barrier reef bleaching", 4900),
    ("serengeti national park safari", 4600), ("yellowstone national park wolves", 4800),
    ("madagascar lemurs natural",  3400), ("boreal forest biomes animals", 2900),
    ("savannah watering hole camera", 4100), ("coral reef diving ocean", 4500),
    ("mangrove swamp ecosystem benefits", 3200), ("arctic tundra wilderness survival", 3100),
    ("endangered species red list", 4800), ("wildlife poaching tracking network", 3600),
    ("habitat fragmentation impacts", 2900), ("deforestation logging maps", 3900),
    ("national park rangers career", 3100), ("marine protected area boundary", 3400),
    ("ecotourism tours guidelines", 3500), ("nature photography lighting tips", 4200),
    ("bird watching binocular gear", 3800), ("audubon bird identification guide", 4100),
    ("insect adaptation extreme desert", 2800), ("reptile thermoregulation sun", 2700),
    ("amphibian mutation clean water", 2600), ("deep sea hydrothermal vents", 3900),
    ("bioluminescence glowing plankton", 4300), ("migration routes waterfowl flyway", 3200),
    ("predator prey relationship graph", 3400), ("keystone species wolf sea otter", 3700),
    ("invasive species eradication plan", 3500), ("native plants gardening backyard", 4600),
    ("pollinator friendly garden seeds", 4100), ("honeybee hive collapse disorder", 3900),
    ("wildflower superbloom tracking", 4300), ("old growth forest protection", 3800),
    ("wetlands conservation treaty", 3400), ("desertification green wall trees", 3100),
    ("glacier melting tracking timeline", 4500), ("ocean acidification pH impact", 4200),
    ("plastic pollution beach cleanup", 4800), ("oil spill cleanup microbes", 3400),
    ("renewable timber sustainability", 2900), ("sustainable fishing catch limits", 3600),
    ("urban wildlife raccoons coyotes", 3900), ("backyard dynamic trail cam captures", 4300),
    ("national geographic explorers",  5200), ("bbc earth documentary episodes", 5600),
    ("david attenborough narration", 4900), ("charles darwin evolution finches", 3800),
    ("natural selection theory adaptation", 3600), ("dna barcoding taxonomy catalog", 3100),
    ("fossils digging excavation paleontology", 3500), ("dinosaur skeleton museum exhibit", 4200),
    ("geological time scale epochs", 3400), ("volcanic eruption lava warning", 4800),
    ("tsunami wave physics velocity", 3900), ("avalanche danger rating mountain", 3200),
    ("northern lights aurora forecasting", 5900), ("milky way astrophotography camera", 4900),
    ("meteor shower calendar peak", 5400), ("solar eclipse totality sunglasses", 6200),
    ("lunar cycle moon phase calendar", 4600), ("stargazing astronomy constellations", 4300),
    ("hiking trail mapping app",   5100), ("backcountry camping packing checklist", 4600),
    ("leave no trace principles rules", 3900), ("wilderness first aid training", 3500),
    ("mountain climbing k2 mountaineering", 3800), ("rock climbing bouldering technique", 4200),
    ("kayaking rapids river path", 3400), ("scuba diving certification open", 4100),
    ("whale watching boat schedule", 4300), ("safari lodge booking luxury", 3700),
    ("botanical gardens orchid greenhouse", 3900), ("zoo animal enrichment toys", 3400),
    ("animal rehabilitation center vet", 3800), ("veterinary medicine domestic farm", 4100),
    ("marine biology undergraduate degree", 3600), ("zoology field research jobs",  3400),
    ("ecology sampling quadrant method", 2800), ("carbon cycle process diagram",   3500),
    ("nitrogen cycle soil bacteria",  3100), ("water cycle evaporation cloud",  4200),
    ("photosynthesis light reactions ATP", 3900), ("mycorrhizal fungi network root", 3600),
    ("forest bathing shinrin yoku",  3400), ("composting soil organic organic", 4100),
    ("organic farming pest control",   3900), ("permaculture design principles bill", 3700)
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed data into the shared in-memory Trie structure during server initialization
    for word, freq in SEARCH_TERMS:
        trie.insert(word, freq)
    yield

# Build the system backend using environment variables for decoupled deployment origins
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(
    title="Autocomplete Search Engine Backend", 
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://autocomplete-search.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Suggestion(BaseModel):
    word: str
    frequency: int

class SearchResponse(BaseModel):
    query: str
    suggestions: list[Suggestion]
    source: str
    cached_prefixes: int

@app.get("/api/search", response_model=SearchResponse)
def get_suggestions(q: str = Query("", min_length=0, max_length=50)):
    query_clean = q.strip().lower()
    if not query_clean:
        return SearchResponse(
            query=q, 
            suggestions=[], 
            source="trie", 
            cached_prefixes=len(trie._cache)
        )

    stats_before = trie.cache_stats
    hits_before = stats_before["cache_hits"]

    results = trie.get_top_k_suggestions(query_clean, k=5)

    stats_after = trie.cache_stats
    hits_after = stats_after["cache_hits"]
    source = "cache" if hits_after > hits_before else "trie"

    return SearchResponse(
        query=q,
        suggestions=[Suggestion(word=word, frequency=freq) for freq, word in results],
        source=source,
        cached_prefixes=stats_after["cached_prefixes"],
    )

class RecordRequest(BaseModel):
    query: str

@app.post("/api/search/record")
def record_search(payload: RecordRequest):
    query_clean = payload.query.strip().lower()
    if not query_clean:
        return {"status": "ignored", "reason": "empty query"}

    # Dynamic frequency booster; triggers targeted local cache validation sweep
    result = trie.record_search(query_clean, increment=15, base_frequency=50)

    return {
        "status": "success", 
        "recorded_query": query_clean, 
        "new_frequency": result["frequency"]
    }

@app.get("/api/cache/stats")
def get_cache_stats():
    return trie.cache_stats

@app.delete("/api/cache")
def clear_cache():
    trie.clear_cache()
    return {"status": "success", "message": "Prefix suggestion cache flushed completely."}

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const HISTORY_KEY = "search_history";
const MAX_HISTORY = 50;

/* ────────────────────────────────────────────────────────────────────────
   useSearchHistory
   ──────────────────────────────────────────────────────────────────────── */
function useSearchHistory() {
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  const addSearch = useCallback((term) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.toLowerCase() !== trimmed.toLowerCase()
      );
      const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // swallow storage errors
      }
      return next;
    });
  }, []);

  const getHistoryMatches = useCallback(
    (prefix, limit = 3) => {
      if (!prefix.trim()) return [];
      const lower = prefix.toLowerCase();
      return history
        .filter((item) => item.toLowerCase().startsWith(lower))
        .slice(0, limit);
    },
    [history]
  );

  return { history, addSearch, getHistoryMatches };
}

/* ────────────────────────────────────────────────────────────────────────
   useDebounce
   ──────────────────────────────────────────────────────────────────────── */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/* ────────────────────────────────────────────────────────────────────────
   TrieField
   The signature element. A small constellation of nodes representing a
   prefix tree. Idle, it drifts gently. As the user types, the path
   matching their current query lights up violet, edge by edge — a literal
   picture of the traversal the backend is doing under the hood.
   ──────────────────────────────────────────────────────────────────────── */
function TrieField({ query }) {
  // Fixed layout: a small tree, 4 levels deep, generated once.
  const nodes = useMemo(() => {
    const levels = [1, 3, 6, 9]; // node count per depth
    const spread = 760;
    const result = [];

    let id = 0;
    let levelStart = 0; // index of first node in the previous level

    levels.forEach((count, depth) => {
      const prevCount = depth === 0 ? 1 : levels[depth - 1];
      const childrenPerParent = count / prevCount;

      for (let i = 0; i < count; i++) {
        const jitter = Math.abs(Math.sin((id + 1) * 12.9898)) % 1;
        result.push({
          id,
          depth,
          x: (i + 0.5) * (spread / count) + jitter * 14 - 7,
          y: 40 + depth * 78,
          parent: depth === 0 ? null : levelStart + Math.floor(i / childrenPerParent),
        });
        id++;
      }

      if (depth > 0) levelStart += prevCount;
    });

    return result;
  }, []);

  // Determine an "active path" length from query length, capped to tree depth.
  const activeDepth = Math.min(query.trim().length, 4);

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 760 380"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Edges */}
      {nodes.map((n) =>
        n.parent !== null && nodes[n.parent] ? (
          <line
            key={`e-${n.id}`}
            x1={nodes[n.parent].x}
            y1={nodes[n.parent].y}
            x2={n.x}
            y2={n.y}
            stroke={n.depth <= activeDepth ? "#7C5CFF" : "#1E2540"}
            strokeWidth={n.depth <= activeDepth ? 1.4 : 1}
            className="transition-all duration-500 ease-out"
            style={{ opacity: n.depth <= activeDepth ? 0.7 : 0.35 }}
          />
        ) : null
      )}

      {/* Nodes */}
      {nodes.map((n) => {
        const lit = n.depth <= activeDepth;
        return (
          <g key={n.id} className="trie-node" style={{ animationDelay: `${n.id * 0.15}s` }}>
            {lit && (
              <circle cx={n.x} cy={n.y} r="14" fill="url(#nodeGlow)" className="transition-opacity duration-500" />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={lit ? 3.4 : 2.2}
              fill={lit ? "#A78BFA" : "#2A3252"}
              className="transition-all duration-500 ease-out"
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   FrequencyBar
   ──────────────────────────────────────────────────────────────────────── */
function FrequencyBar({ frequency, maxFrequency }) {
  const pct = Math.max(6, Math.round((frequency / maxFrequency) * 100));
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[11px] font-mono text-[#5B6485] w-12 text-right tabular-nums">
        {frequency.toLocaleString()}
      </span>
      <div className="w-14 h-1 bg-[#1E2540] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[#7C5CFF] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   SourceBadge
   ──────────────────────────────────────────────────────────────────────── */
function SourceBadge({ source, cachedPrefixes }) {
  if (!source) return null;
  const isCache = source === "cache";
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1E2540]">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isCache ? "bg-[#34D399]" : "bg-[#7C5CFF]"
          }`}
        />
        <span className="text-[11px] font-mono text-[#5B6485] tracking-tight">
          {isCache ? "cache hit · O(1)" : "trie traversal · O(p + W·log k)"}
        </span>
      </div>
      <span className="text-[11px] font-mono text-[#3E4566]">
        {cachedPrefixes} cached
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   SearchEngine  (default export)
   ──────────────────────────────────────────────────────────────────────── */
export default function SearchEngine() {
  const { history, addSearch, getHistoryMatches } = useSearchHistory();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [source, setSource] = useState(null);
  const [cachedPrefixes, setCachedPrefixes] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const debouncedQuery = useDebounce(query, 300);

  /* Fetch suggestions */
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      setNoResults(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);

      const rawHistoryMatches = getHistoryMatches(debouncedQuery, 3);
      const localMatches = rawHistoryMatches.map((word) => ({
        word,
        frequency: null,
        isHistory: true,
      }));
      const historyWordSet = new Set(localMatches.map((m) => m.word));

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Server is unreachable");

        const data = await res.json();

        const filteredGlobalSuggestions = data.suggestions.filter(
          (s) => !historyWordSet.has(s.word)
        );

        setSuggestions([...localMatches, ...filteredGlobalSuggestions]);
        setError(null);
        setSource(data.source);
        setCachedPrefixes(data.cached_prefixes);
        setNoResults(localMatches.length === 0 && filteredGlobalSuggestions.length === 0);
        if (document.activeElement === inputRef.current) {
          setShowDropdown(true);
        }
        setActiveIndex(-1);
      } catch (err) {
        if (err.name === "AbortError") return;

        setSuggestions(localMatches);
        setError("Can't reach the search service right now.");
        setNoResults(false);
        setShowDropdown(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
    return () => controller.abort();
  }, [debouncedQuery]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Keyboard navigation */
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const termToSearch =
        activeIndex >= 0 && suggestions[activeIndex]
          ? suggestions[activeIndex].word
          : query;
      executeSearch(termToSearch);
      return;
    }

    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        break;
      case "Escape":
        setShowDropdown(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  };

  const executeSearch = async (searchTerm) => {
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) return;
    setQuery("");
    setShowDropdown(false);
    setActiveIndex(-1);
    addSearch(cleanTerm);
    try {
      await fetch(`${API_BASE_URL}/api/search/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanTerm }),
      });
    } catch (err) {
      console.error("Error committing final search query:", err);
    }
  };

  const handleSelect = (word) => {
    executeSearch(word);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    setSource(null);
    setNoResults(false);
    setError(null);
    inputRef.current?.focus();
  };

  const globalSuggestions = suggestions.filter((s) => !s.isHistory);
  const maxFreq = globalSuggestions.length > 0 ? globalSuggestions[0].frequency : 1;
  const isOpen = showDropdown && (suggestions.length > 0 || noResults || !!error);
  const prefixLength = Math.min(debouncedQuery.length, 50);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center px-4 relative overflow-hidden font-[Inter,system-ui,sans-serif]">
      {/* Embedded fonts + bespoke keyframes Tailwind can't express */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

        @keyframes nodePulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .trie-node {
          animation: nodePulse 3.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .trie-node { animation: none; }
        }
        .font-display { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      `}</style>

      {/* Ambient background field */}
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <TrieField query={query} />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 35%, transparent 0%, #0A0E1A 75%)",
        }}
      />

      {/* Hero */}
      <div className="relative mb-10 text-center select-none max-w-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1E2540] bg-[#12182B]/80 backdrop-blur-sm mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
          <span className="text-[11px] font-mono text-[#8089AD] tracking-wide">
            500 terms · trie-indexed
          </span>
        </div>

        <h1 className="font-display text-[2.1rem] sm:text-[2.5rem] font-medium tracking-tight text-[#E2E5F0] leading-[1.15]">
          Type a prefix.
          <br />
          <span className="text-[#7C5CFF]">Watch the tree light up.</span>
        </h1>
        <p className="mt-3.5 text-[0.925rem] text-[#5B6485] leading-relaxed">
          Every keystroke walks a live trie — frequency-ranked results,
          accelerated by an LRU cache underneath.
        </p>
      </div>

      {/* Search container */}
      <div ref={containerRef} className="relative w-full max-w-xl z-10">
        {/* Input bar */}
        <div
          className={[
            "flex items-center gap-3 px-4 py-3.5 bg-[#12182B]/95 backdrop-blur-sm",
            "border transition-all duration-200",
            isOpen
              ? "rounded-t-2xl border-b-transparent border-[#7C5CFF]/50 shadow-[0_0_0_4px_rgba(124,92,255,0.08)]"
              : "rounded-2xl shadow-lg shadow-black/20",
            !isOpen && query
              ? "border-[#7C5CFF]/40"
              : !isOpen
              ? "border-[#1E2540] hover:border-[#2A3252]"
              : "",
          ].join(" ")}
        >
          <svg
            className="w-4 h-4 text-[#5B6485] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0 || noResults) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Start typing — try “pop” or “qua”…"
            autoComplete="off"
            spellCheck="false"
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            className="flex-1 bg-transparent text-[#E2E5F0] placeholder-[#3E4566]
                       text-[0.925rem] outline-none caret-[#7C5CFF]"
          />

          {isLoading ? (
            <svg className="w-4 h-4 text-[#7C5CFF] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : query ? (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="text-[#3E4566] hover:text-[#8089AD] transition-colors shrink-0 p-0.5 rounded focus-visible:outline-2 focus-visible:outline-[#7C5CFF] focus-visible:outline-offset-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-[#3E4566] border border-[#1E2540] rounded px-1.5 py-0.5">
              /
            </kbd>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div
            role="listbox"
            className="absolute top-full left-0 right-0 z-50
                       bg-[#12182B]/98 backdrop-blur-sm border border-t-0 border-[#1E2540]
                       rounded-b-2xl overflow-hidden
                       shadow-2xl shadow-black/60"
          >
            {suggestions.length > 0 && (
              <ul>
                {suggestions.map((s, i) => (
                  <li
                    key={s.word}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(-1)}
                    onClick={() => handleSelect(s.word)}
                    className={[
                      "flex items-center justify-between px-4 py-2.5 cursor-pointer",
                      "transition-colors duration-100",
                      i < suggestions.length - 1 ? "border-b border-[#1E2540]/70" : "",
                      i === activeIndex ? "bg-[#1A2138]" : "hover:bg-[#161D33]",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2 text-sm truncate mr-4 min-w-0">
                      {s.isHistory ? (
                        <svg
                          className="w-3.5 h-3.5 text-[#5B6485] shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path strokeLinecap="round" d="M12 7v5l3 3" />
                        </svg>
                      ) : (
                        <span className="w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">
                        <span className="text-[#A78BFA] font-medium">
                          {s.word.slice(0, prefixLength)}
                        </span>
                        <span className="text-[#C5C9DC]">{s.word.slice(prefixLength)}</span>
                      </span>
                    </span>

                    {!s.isHistory && <FrequencyBar frequency={s.frequency} maxFrequency={maxFreq} />}
                  </li>
                ))}
              </ul>
            )}

            {/* No results */}
            {noResults && !error && (
              <div className="px-4 py-7 text-center">
                <p className="text-[#8089AD] text-sm">
                  Nothing under{" "}
                  <span className="text-[#C5C9DC] font-medium">
                    "{debouncedQuery}"
                  </span>
                </p>
                <p className="text-[#3E4566] text-xs mt-1.5">
                  Try a shorter prefix — the tree narrows fast
                </p>
              </div>
            )}

            {/* Network / server error */}
            {error && (
              <div className="px-4 py-7 text-center">
                <p className="text-[#F87171] text-sm font-medium">{error}</p>
                <p className="text-[#5B6485] text-xs mt-1.5">
                  Check that the search service is up, then try again.
                </p>
              </div>
            )}

            {suggestions.length > 0 && (
              <SourceBadge source={source} cachedPrefixes={cachedPrefixes} />
            )}
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="relative mt-6 text-xs text-[#3E4566] select-none tracking-wide font-mono">
        ↑↓ navigate &nbsp;·&nbsp; ↵ select &nbsp;·&nbsp; esc close
      </p>
    </div>
  );
}

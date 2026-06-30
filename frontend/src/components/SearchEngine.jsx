import { useState, useEffect, useRef, useCallback } from "react";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

const HISTORY_KEY = "search_history";
const MAX_HISTORY = 50;

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
      // Remove existing occurrence, then prepend
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
/* 
useDebounce
Returns a value that only updates after the user has stopped changing it
for `delay` ms.
Time complexity: O(1).
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer); // ← cancels on next keystroke
  }, [value, delay]);

  return debouncedValue;
}

/* 
   FrequencyBar
   Renders a thin bar whose width is proportional to the suggestion's
   frequency relative to the top result (always 100 %).
 */
function FrequencyBar({ frequency, maxFrequency }) {
  const pct = Math.max(6, Math.round((frequency / maxFrequency) * 100));
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-mono text-slate-500 w-12 text-right tabular-nums">
        {frequency.toLocaleString()}
      </span>
      <div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* 
   SourceBadge
   Shows whether the result came from the O(1) cache or a full Trie DFS.
 */
function SourceBadge({ source, cachedPrefixes }) {
  if (!source) return null;
  const isCache = source === "cache";
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/70">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isCache ? "bg-emerald-400" : "bg-violet-400"
          }`}
        />
        <span className="text-xs font-mono text-slate-500">
          {isCache ? "cache hit · O(1)" : "trie search · O(p + W·log k)"}
        </span>
      </div>
      <span className="text-xs font-mono text-slate-600">
        {cachedPrefixes} cached
      </span>
    </div>
  );
}

/* 
   SearchEngine  (default export)
 */
export default function SearchEngine() {

  const { history, addSearch, getHistoryMatches } = useSearchHistory();
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults]       = useState(false);
  const [source, setSource]             = useState(null);
  const [cachedPrefixes, setCachedPrefixes] = useState(0);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const [error, setError]               = useState(null);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);

  const debouncedQuery = useDebounce(query, 300);

  /* Fetch suggestions */
  useEffect(() => {
    // Edge case: empty input — wipe everything immediately
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
        // Fetch global suggestions exactly as before
        const res = await fetch(
          `${API_BASE_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Server is Unreachable");

        const data = await res.json();

        // Remove any backend suggestions whose word already appears in local history
        const filteredGlobalSuggestions = data.suggestions.filter(
          (s) => !historyWordSet.has(s.word)
        );

        // Merge
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

        // On error, still show whatever history matches we found
        setSuggestions(localMatches);
        setError("Could not reach the server.");
        setNoResults(false);
        setShowDropdown(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
    return () => controller.abort(); // cancel on next keystroke
  }, [debouncedQuery]);

  /*Close dropdown on outside click  */
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

  
  //Keyboard navigation 
  const handleKeyDown =(e)=>{
    // Catch Enter key anywhere (even if dropdown is hidden)
    if (e.key === "Enter"){
      e.preventDefault();
      // If user highlighted a suggestion with arrow keys, search that. Otherwise, search what they typed.
      const termToSearch = (activeIndex >= 0 && suggestions[activeIndex])
        ? suggestions[activeIndex].word
        : query;
        
      executeSearch(termToSearch);
      return;
    }

    if(!showDropdown) return;

    switch(e.key){
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



  /* Handlers*/
  const handleSelect = (word) => {
  executeSearch(word); // immediately posts to increase frequency
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

  // Derived values
  const globalSuggestions = suggestions.filter((s) => !s.isHistory);
  const maxFreq = globalSuggestions.length > 0 ? globalSuggestions[0].frequency : 1;
  const isOpen       = showDropdown && (suggestions.length > 0 || noResults || !!error);
  const prefixLength = Math.min(debouncedQuery.length, 50); // guard against very long queries

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">

      {/*Heading */}
      <div className="mb-8 text-center select-none">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
          Autocomplete Search
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          500 curated terms · frequency-ranked · cache-accelerated
        </p>
      </div>

      {/*Search container*/}
      <div ref={containerRef} className="w-full max-w-xl relative">

        {/* Input bar */}
        <div
          className={[
            "flex items-center gap-3 px-4 py-3 bg-slate-900",
            "border transition-all duration-200",
            isOpen
              ? "rounded-t-xl border-b-slate-800/40 border-violet-500/40"
              : "rounded-xl",
            !isOpen && query
              ? "border-violet-500/40"
              : !isOpen
              ? "border-slate-800 hover:border-slate-700"
              : "",
          ].join(" ")}
        >
          {/* Search icon */}
          <svg
            className="w-4 h-4 text-slate-500 shrink-0"
            fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0 || noResults) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search terms…"
            autoComplete="off"
            spellCheck="false"
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-600
                       text-sm outline-none caret-violet-400"
          />

          {isLoading ? (
            <svg
              className="w-4 h-4 text-violet-400 animate-spin shrink-0"
              fill="none" viewBox="0 0 24 24"
            >
              <circle className="opacity-20" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" />
              <path className="opacity-80" fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : query ? (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="text-slate-600 hover:text-slate-300 transition-colors shrink-0 p-0.5 rounded"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>

        {/*  Dropdown  */}
        {isOpen && (
          <div
            role="listbox"
            className="absolute top-full left-0 right-0 z-50
                       bg-slate-900 border border-t-0 border-slate-800
                       rounded-b-xl overflow-hidden
                       shadow-2xl shadow-black/60"
          >
            {/* Suggestion rows */}
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
                      i < suggestions.length - 1 ? "border-b border-slate-800/50" : "",
                      i === activeIndex ? "bg-slate-800" : "hover:bg-slate-800/40",
                    ].join(" ")}
                  >
                    {/* Left side: clock icon (history only) + word with highlighted prefix */}
                    <span className="flex items-center gap-2 text-sm truncate mr-4 min-w-0">
                      {s.isHistory ? (
                        <svg
                          className="w-3.5 h-3.5 text-slate-500 shrink-0"
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
                        <span className="text-violet-400 font-medium">
                          {s.word.slice(0, prefixLength)}
                        </span>
                        <span className="text-slate-300">
                          {s.word.slice(prefixLength)}
                        </span>
                      </span>
                    </span>

                    {!s.isHistory && (
                      <FrequencyBar frequency={s.frequency} maxFrequency={maxFreq} />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* No results */}
            {noResults && !error && (
              <div className="px-4 py-6 text-center">
                <p className="text-slate-400 text-sm">
                  No results for{" "}
                  <span className="text-slate-200 font-medium">"{debouncedQuery}"</span>
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  Try a shorter prefix — suggestions appear as you type
                </p>
              </div>
            )}

            {/* Network / server error */}
            {error && (
              <div className="px-4 py-6 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <p className="text-slate-600 text-xs mt-1.5">
                  Make sure <code className="text-slate-500">uvicorn main:app --reload</code> is running
                </p>
              </div>
            )}

            
            {suggestions.length > 0 && (
              <SourceBadge source={source} cachedPrefixes={cachedPrefixes} />
            )}
          </div>
        )}
      </div>

      {/* ── Keyboard hint ───────────────────────────────────────────────── */}
      <p className="mt-5 text-xs text-slate-700 select-none tracking-wide">
        ↑ ↓ &nbsp;navigate &nbsp;·&nbsp; Enter &nbsp;select &nbsp;·&nbsp; Esc &nbsp;close
      </p>
    </div>
  );
}

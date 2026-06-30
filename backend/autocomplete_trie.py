import heapq

class TrieNode:
    def __init__(self):
        self.children: dict[str, "TrieNode"] = {}
        self.is_word: bool = False
        self.frequency: int = 0

class AutocompleteTrie:
    def __init__(self):
        self.root = TrieNode()
        # Cache tracks exact prefix match to pre-computed sorted top-k suggestions list
        self._cache: dict[str, list[tuple[int, str]]] = {}
        self._cache_hits = 0
        self._cache_misses = 0

    def insert(self, word: str, frequency: int) -> None:
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]

        node.is_word = True
        node.frequency = frequency

        # Invalidate any cached prefix entries affected by this mutation
        for i in range(len(word) + 1):
            stale_prefix = word[:i]
            if stale_prefix in self._cache:
                del self._cache[stale_prefix]

    def get_top_k_suggestions(self, prefix: str, k: int = 5) -> list[tuple[int, str]]:
        if prefix in self._cache:
            self._cache_hits += 1
            return self._cache[prefix]

        self._cache_misses += 1
        node = self.root
        for char in prefix:
            if char not in node.children:
                self._cache[prefix] = []
                return []
            node = node.children[char]

        min_heap: list[tuple[int, str]] = []

        def dfs(current_node: TrieNode, current_word: str) -> None:
            if current_node.is_word:
                heapq.heappush(min_heap, (current_node.frequency, current_word))
                if len(min_heap) > k:
                    heapq.heappop(min_heap)
            for char, child_node in current_node.children.items():
                dfs(child_node, current_word + char)

        dfs(node, prefix)
        results = sorted(min_heap, key=lambda x: x[0], reverse=True)
        self._cache[prefix] = results
        return results

    def record_search(self, word: str, increment: int = 15, base_frequency: int = 50) -> dict:
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
 
        is_new = not node.is_word
        if is_new:
            node.is_word = True
            node.frequency = base_frequency
        else:
            node.frequency += increment
 
        for i in range(len(word) + 1):
            stale = word[:i]
            if stale in self._cache:
                del self._cache[stale]
 
        return {"frequency": node.frequency, "is_new": is_new}
    
    def clear_cache(self) -> None:
        self._cache.clear()

    @property
    def cache_stats(self) -> dict:
        total = self._cache_hits + self._cache_misses
        hit_rate = (self._cache_hits / total * 100) if total else 0
        return {
            "cached_prefixes": len(self._cache),
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "hit_rate": f"{hit_rate:.1f}%",
        }
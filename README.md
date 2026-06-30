# ⚡ High-Performance Autocomplete Search Engine

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render" />
</div>

<br />

A decoupled, real-time autocomplete engine engineered for sub-millisecond query responses. This project replaces traditional database text-scanning with a custom in-memory **Trie data structure**, combining global frequency trends with personalized user history.

### 🔗 Live Demo
* **Frontend (Vercel):** [https://autocomplete-search-mu.vercel.app/](https://autocomplete-search-mu.vercel.app/)
* **Note:** The backend will take 30-40 seconds to wake up at first use , please wait for it. 
---

## ✨ Key Features

* **Algorithmic Efficiency:** Utilizes a custom Python Trie to guarantee prefix lookup times of $O(k)$ (where $k$ is the length of the prefix), scaling flawlessly regardless of the total dataset size.
* **$O(1)$ In-Memory Caching:** Repeats and hot queries are instantly served from an active prefix cache, bypassing tree traversal entirely and reducing latency by ~90%.
* **Smart Cache Invalidation:** Implements an automated, write-back invalidation strategy that instantly flushes stale cache entries the moment a user commits a new search.
* **Personalized History (Local-First):** Integrates browser `localStorage` to seamlessly merge a user's private recent searches with global frequency trends, preventing duplicates without polluting backend analytics.
* **Network Optimization:** The React frontend utilizes a custom `useDebounce` hook (300ms) to eliminate API network throttling and reduce backend load during rapid user input.

---

## 🛠️ Tech Stack

**Frontend:**
* React 19 (via Vite)
* Tailwind CSS 4 (Glassmorphism & custom animations)
* `localStorage` for private history state management

**Backend:**
* Python 3
* FastAPI & Uvicorn (Asynchronous API delivery)
* Pydantic (Strict request/response type validation)

---

## 🏗️ Detailed Architecture

This system relies on a **Decoupled Client-Server Architecture** to optimize state retention and global delivery:

1. **The Backend (Stateful Engine):** The FastAPI server initializes a persistent, in-memory Trie upon startup, seeded with 500 domain-specific terms. When a search is explicitly submitted, the backend dynamically applies a **15x weighted frequency increment**, instantly updating global rankings and evicting only the affected branches of the $O(1)$ cache.
2. **The Frontend (Reactive Client):** The React client handles UX optimizations locally. It manages its own `AbortController` to cancel stale in-flight requests during rapid typing.
3. **The Data Merge Layer:** User privacy is maintained by keeping history isolated to the browser. Upon receiving global suggestions from the backend, the frontend executes an $O(N)$ filter using a `Set` to remove any global terms that already exist in the user's local history, seamlessly merging them to the top of the UI.

---

## 📂 Folder Structure

```text
autocomplete-search/
├── backend/
│   ├── autocomplete_trie.py   # Core Trie data structure & Caching logic
│   ├── main.py                # FastAPI server, Routes, & CORS config
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── SearchEngine.jsx # Main React UI, debouncing, & API integration
│   │   ├── App.jsx            # Component root
│   │   ├── index.css          # Tailwind imports & custom animation keyframes
│   │   └── main.jsx           # React DOM rendering
│   ├── package.json           # Node dependencies
│   ├── vite.config.js         # Vite bundler configuration
│   └── eslint.config.js       # Linting rules
│
├── .gitignore                 # Blocks node_modules, __pycache__, & .env
└── README.md                  # Project documentation

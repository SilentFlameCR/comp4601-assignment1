# COMP 4601A Assignment 1 - Search Engine

**Student Names:** Rahul Rodrigues and Emily Amos
**Student IDs:** 101145082 and 101311817

**Video Demo URL:** [Youtube unlisted video link](https://youtu.be/ZOokIyWtnps)

## Deployment URL (Hosted on openstack)

**OpenStack URL:** http://134.117.133.107:3000

Example query:
```
http://134.117.133.107:3000/fruitsA?q=banana&limit=10&boost=false
http://134.117.133.107:3000/personal?q=alchemy&limit=10&boost=true
```

## Assignment Summary

This project implements a complete search engine with web crawling, PageRank calculation, TF-IDF indexing, and a RESTful API with browser-based interface.
For the personal dataset we decided to crawl MyAnimeList anime pages, as it was a rich text content in descriptions and reviews, well-structured HTML with clear paragraph tags, interesting link structure between related anime, and challenging due to some deleted pages (404 errors) and rate limiting.

### Completed Features

#### Web Crawler
- Crawls fruitsA dataset (100 pages total: 50 fruitsA + 50 fruitsB)
  - Starts at https://people.scs.carleton.ca/~avamckenney/fruitsA/N-0.html
  - Discovers all pages by following links (includes both fruitsA and fruitsB directories)
- Crawls personal dataset (MyAnimeList anime pages, 1267 pages from https://myanimelist.net/anime/)
  - Multi-phase crawling approach to work around rate limiting
  - Some anime IDs return 404 (deleted entries), which are handled gracefully
- Implements URL normalization to prevent duplicates (removes hash fragments and trailing slashes)
- Stores page content, links, and word frequencies in SQLite database

#### PageRank Calculation
- Implements PageRank algorithm with damping factor (alpha = 0.1)
- Handles dangling nodes properly
- Converges using euclidean distance threshold (epsilon = 0.0001)
- Stores PageRank values in database for each page

#### TF-IDF Search Engine
- Builds inverted index with TF-IDF scoring
- Supports cosine similarity for document ranking
- Optional PageRank boosting for search results
- Extracts text from paragraph tags only (as per assignment requirements)

#### RESTful API
- **GET /fruitsA** - Search fruitsA dataset
  - Query parameters: `q` (query), `boost` (true/false), `limit` (1-50)
  - Returns JSON with format: `{ "result": [{ "url", "score", "title", "pr" }] }`
- **GET /personal** - Search personal dataset (MyAnimeList)
  - Same parameters and response format as /fruitsA
- **GET /page/:dataset/:pageId** - View detailed page information
  - Shows URL, title, PageRank, incoming links, outgoing links, and word frequencies

#### Browser Interface
- Home page with search forms for both datasets
- Search results page showing:
  - URL of original page
  - Title of original page
  - Computed search score
  - PageRank value
  - Link to view detailed page data
- Page detail view showing:
  - URL and title
  - Incoming links
  - Outgoing links
  - Word frequency table (top 50 words)

### Personal Dataset Choice

**Dataset:** MyAnimeList Anime Pages (https://myanimelist.net/anime/)

**Why this site:**
- Rich text content in descriptions and reviews
- Well-structured HTML with clear paragraph tags
- Interesting link structure between related anime
- Challenging due to some deleted pages (404 errors)

**Challenges encountered:**
1. **404 Errors:** Some anime IDs have been deleted from MyAnimeList
   - **Solution:** Implemented error handling to catch 404s and mark pages as "Page Deleted"
   
2. **Rate Limiting (405 Errors):** MyAnimeList implements aggressive rate limiting that blocks requests after crawling for extended periods
   - **Problem:** After crawling several hundred pages, the site returns 405 (Method Not Allowed) errors, effectively blocking further crawling
   - **Solution:** Implemented a multi-phase crawling approach:
     1. Start crawling from a seed URL (e.g., `anime/1`)
     2. Continue until 405 errors appear (typically after 300-400 pages)
     3. Stop the crawler and wait 1-2 hours for rate limit to reset
     4. Resume crawling by changing the seed URL to start from where we left off
     5. Repeat this process until reaching the desired page count (500+)
   - **Implementation:** Modified `crawler.js` to allow flexible seed URL configuration. To resume crawling:
     ```bash
     # Initial crawl (will hit rate limit after ~400 pages)
     node crawler.js personal  # Starts from anime/1
     
     # After 1-2 hours, modify seedUrl in crawler.js to resume
     # Change: seedUrl = 'https://myanimelist.net/anime/400'
     node crawler.js personal  # Continues from anime/400
     ```
   - **Note:** The 100ms delay between requests helps but doesn't prevent rate limiting entirely. The multi-phase approach is necessary for crawling 500+ pages.
   
3. **Dynamic Content:** Some content loaded via JavaScript
   - **Solution:** Focused on server-rendered content in paragraph tags

## Installation & Usage

### Prerequisites
- Node.js (v14 or higher)
- npm

### Setup

```bash
# Install dependencies
npm install

# Crawl fruitsA dataset
npm run crawl:fruitsA

# Crawl personal dataset (MyAnimeList)
# Note: Due to rate limiting, you may need to run this multiple times
# with different seed URLs (see "Challenges encountered" section)
npm run crawl:personal

# Calculate PageRank for both datasets
node pagerank.js fruitsA
node pagerank.js personal

# Start the server
npm start
```

### Running the Server

```bash
node server.js
```

Server will be available at: http://localhost:3000 (on your local machine)

### API Examples

**Search fruitsA with boost:**
```
GET /fruitsA?q=apple+banana&boost=true&limit=20
```

**Search personal dataset:**
For the personal dataset we decided to crawl MyAnimeList anime pages, as it was a rich text content in descriptions and reviews, well-structured HTML with clear paragraph tags, interesting link structure between related anime, and challenging due to some deleted pages (404 errors).
```
GET /personal?q=action+adventure&boost=false&limit=10
```

**Get JSON response:**
```bash
curl -H "Accept: application/json" "http://localhost:3000/fruitsA?q=apple&limit=5"
```

## Database Schema

### Tables

**pages**
- id (PRIMARY KEY)
- dataset (TEXT)
- url (TEXT)
- title (TEXT)
- content (TEXT)
- pagerank (REAL)

**links**
- id (PRIMARY KEY)
- dataset (TEXT)
- from_url (TEXT)
- to_url (TEXT)

**word_frequencies**
- id (PRIMARY KEY)
- dataset (TEXT)
- url (TEXT)
- word (TEXT)
- frequency (INTEGER)

## Video Demonstration

**Video Demo URL:** [Youtube unlisted video link](https://youtu.be/ZOokIyWtnps)

## Deployment URLs

**fruitsA Search:** http://134.117.133.107:3000/fruitsA  
**Personal Search:** http://134.117.133.107:3000/personal

## Known Issues & Future Improvements

### Current Limitations
- Personal dataset crawl requires multi-phase approach due to MyAnimeList rate limiting (see Challenges section)
- Crawling 500+ pages may take several mins spread across multiple sessions
- Word frequency only counts paragraph text (not titles or other elements)
- No caching of search results (rebuilds index on server restart)

### Potential Improvements
- Implement search result caching
- Add pagination for search results
- Include more HTML elements in word frequency analysis
- Add search query suggestions/autocomplete
- Implement distributed search integration
- Add more sophisticated text preprocessing (stemming, stop words)

## RESTful Design Principles

This implementation follows REST principles:

1. **Resource-based URLs:** `/fruitsA`, `/personal`, `/page/:dataset/:pageId`
2. **HTTP Methods:** Uses GET for retrieving resources
3. **Stateless:** Each request contains all necessary information
4. **Content Negotiation:** Supports both JSON and HTML responses via Accept header
5. **Uniform Interface:** Consistent parameter naming and response formats

## Search Algorithm Details

### TF-IDF Calculation
- **Term Frequency (TF):** log₂(1 + word_count / total_words)
- **Inverse Document Frequency (IDF):** log₂(total_docs / (1 + docs_with_word))
- **TF-IDF Score:** TF × IDF

### Cosine Similarity
- Computes similarity in q-dimensional space (query terms only)
- Normalizes by vector magnitudes

### PageRank Boosting
- When boost=true: `final_score = tfidf_score × (1 + pagerank × 10)`
- Amplifies highly-ranked pages in search results

## Testing

The search engine has been tested with:
- Various single-word and multi-word queries
- Different limit values (1-50)
- Boost enabled and disabled
- Both JSON and HTML response formats
- Edge cases (empty results, invalid parameters)

---

**Submission Date:** March 6th, 2026  
**Course:** COMP 4601A - Winter 2026

# Task: "What people say" research for a batch of apps

You are researching public opinion about apps listed on an app directory (remadebyai.com), so we can show a short "What people say" round-up on each app page. Your batch is in the file named in your instructions (one app per line: slug | name | url | source | description).

For EACH app:
1. Use WebSearch (try "<name> review", "<name> hacker news", "<name> reddit", the repo name). Then use WebFetch on the most promising real discussion: Hacker News threads (https://hn.algolia.com/api/v1/items/<id> works well for the whole comment tree), tech press/blog reviews, Product Hunt, app stores, itch.io/Steam pages for games (user reviews/comments), Lobsters, dev.to, YouTube video pages, GitHub issues/discussions on the repo. reddit.com is blocked; skip it.
2. Decide if there is REAL third-party coverage: at least 2 independent sources with actual opinions (not just the maker's own README/announcement, not just auto-generated listing/aggregator pages, not just "awesome list" entries). If not, mark it as no coverage and move on quickly. Many of these apps are small and will have none, which is fine. Don't spend more than ~6 fetches on an app.
3. If there IS coverage, write:
   - summary: 2-4 sentences in YOUR OWN WORDS: what people praise, what they criticise, and honestly say if coverage is thin or mostly enthusiastic launch posts. Plain, neutral English. No em dashes.
   - praise: 2-4 short points (own words). complaints: 1-4 short points (own words; if genuinely none found, say e.g. "Few detailed reviews yet").
   - sources: 3-6, strongest first: {title, site, url, date (YYYY-MM-DD or YYYY-MM, or omit), quote, who, points}. quote = a SHORT verbatim excerpt (max 25 words) that you SAW on the fetched page; ask WebFetch to return exact sentences. If you cannot get the exact wording, omit quote. who = the person who wrote the quoted words (commenter username or article author), omit if unsure. points = e.g. "412 points" or "4.6 out of 5 from 120 ratings", omit if unknown. Omit empty fields entirely. Only include URLs you actually fetched or saw in search results. Never invent anything.
   - Avoid quoting insults or rude titles; pick substantive ones.

Write your result with the Write tool to the output file named in your instructions, as a JSON object keyed by slug:
{ "<slug>": { "summary": "...", "praise": [...], "complaints": [...], "sources": [...] }, "<slug2>": null, ... }
null = no real coverage. Include every slug from your batch. Then reply with just one line: "done: X with coverage, Y without".
Today is 2026-11-23.

# Source philosophy

Civic Signals is a small, community-maintained news feed for people working in and around digital government.

The source list is the heart of the project. It decides what kinds of work, voices and signals become visible in the feed. This page explains the thinking behind the list so contributors can suggest new sources without turning the project into a generic news aggregator.

## What Civic Signals is trying to surface

Civic Signals is interested in useful public signals from people, teams and organisations working on public services, digital government, civic technology and adjacent practice.

The feed should help people notice what is happening across the ecosystem, especially outside their immediate team, discipline, organisation or social network.

Good sources help people see:

- real practice, not just polished announcements
- delivery lessons and operational detail
- weeknotes and reflective practitioner writing
- public-sector design, content, research, policy and technology work
- civic infrastructure, public-interest technology and democratic participation
- systems thinking, service transformation and institutional change
- accessibility, inclusion, trauma-informed practice and design justice
- local government, central government, health, devolved government and international public-sector learning

The feed is not trying to be comprehensive. It is trying to be useful.

## The selection principle

A source is a good candidate when it creates signal for people working in or around digital government.

Signal usually means one or more of these things:

- it helps practitioners understand how real public services are being designed, delivered or operated
- it exposes work across organisational or disciplinary boundaries
- it shares practical learning, constraints, trade-offs or failure modes
- it makes public-sector delivery more legible
- it brings in adjacent thinking that helps people do public work better
- it adds voices or contexts that are easy to miss in dominant networks

The source does not need to be officially governmental. Some useful sources come from individuals, consultancies, studios, research groups, civic organisations, public-interest technology organisations and international institutions.

## What we prioritise

### Public-service relevance

Sources should have a clear relationship to public services, digital government, civic infrastructure or the practice of designing and delivering services that affect the public.

This can include direct public-sector work, adjacent public-interest work, or writing that is clearly useful to people doing public-sector delivery.

### Practitioner usefulness

We prefer sources that help people understand practice. That includes weeknotes, delivery reflections, design notes, research methods, architectural thinking, operating model reflections, content strategy, accessibility lessons and policy design.

A good post does not need to be polished. Often the most useful posts are rough, specific and situated.

### Breadth across disciplines

Digital government is not only technology. Sources should reflect the mixed reality of public services, including:

- service design
- content design
- user research
- product and delivery
- policy design
- data and architecture
- accessibility and inclusion
- strategy and systems thinking
- local government and place-based work
- governance, institutions and public value

### Working in the open

Sources that share what teams are learning in public are especially valuable. Civic Signals should reward open practice and make it easier to discover.

### Undervalued or adjacent voices

The feed should help break down clique dynamics. It should not only amplify the same familiar voices from central government, London, design Twitter, conference circuits or supplier networks.

Good additions may come from local government, devolved administrations, health, community organisations, civic technology, independent practitioners, international digital government teams or people working at the edges of disciplines.

## What we avoid

Civic Signals should not become a generic product, tech or consultancy marketing feed.

Avoid sources where the dominant pattern is:

- sales content with little practical learning
- vendor thought leadership with no public-service specificity
- generic AI, product or digital transformation commentary
- event promotion without useful substance
- reposted press releases
- SEO-driven listicles
- high-volume feeds that drown out more useful sources
- personal brands that generate more noise than signal

Some commercial or consultancy sources are still useful. The question is not whether a source is commercial. The question is whether it consistently contributes useful public-service signal.

## Source status

Sources use a simple status field in `data/sources.yml`.

### `active`

The source is included in the automated feed.

Use `active` when:

- the feed URL works
- recent items parse successfully
- the source is relevant enough to include
- it does not create obvious duplication or noise

### `needs-review`

The source is useful or plausible, but not ready for automated ingestion.

Use `needs-review` when:

- the feed URL is broken or uncertain
- the source blocks automated requests
- the source appears useful but has not been checked
- the feed is too noisy and needs judgement
- the source may duplicate another active source

### `paused`

The source is known but intentionally not ingested for now.

Use `paused` when:

- the source used to be useful but has gone quiet
- it creates too much noise
- it repeatedly breaks ingestion
- it is worth keeping as a record but not displaying

## Feed-first, scraping-last

Civic Signals should prefer explicit syndication formats such as RSS, Atom and JSON Feed.

Feeds are better than scraping because they are designed for reuse, more stable than HTML pages and easier to check automatically.

The order of preference is:

1. RSS or Atom feed
2. JSON Feed
3. official API or structured endpoint
4. carefully scoped page scraping
5. manual tracking only

Scraping should be a last resort. If we scrape, it should be explicit, polite, minimal and cache-aware.

## Tags and categories

Tags should describe why the source is useful, not every topic the source might mention.

Good tags are practical and reusable. For example:

- `digital-government`
- `public-sector`
- `service-design`
- `content-design`
- `user-research`
- `accessibility`
- `local-government`
- `policy-design`
- `systems-thinking`
- `delivery`
- `architecture`
- `civic-tech`
- `public-interest-technology`
- `weeknotes`
- `practitioners`

Avoid overly clever, temporary or one-off tags unless they are needed to identify a person or recurring theme.

## How to judge a new source

Before adding a source, ask:

1. Would someone working in digital government plausibly learn something useful from this source?
2. Does it expose real practice, context or change?
3. Is it specific enough to be more than general digital commentary?
4. Does it broaden the feed, or merely duplicate an existing dominant voice?
5. Is the feed technically reliable?
6. Does it produce too much volume for the amount of signal it adds?
7. Would we be comfortable explaining why this source belongs in Civic Signals?

If the answer is unclear, add it as `needs-review` rather than `active`.

## Examples of strong source types

### Government and public-sector team blogs

These are often the strongest sources because they show delivery work, service change, policy implementation and real constraints.

Examples include central government blogs, devolved government digital blogs, local digital teams, NHS design and delivery blogs and public-sector technology blogs.

### Practitioner blogs and weeknotes

These are valuable because they show what work feels like before it becomes a case study. They often reveal methods, uncertainty, organisational friction and practical learning.

### Public-interest technology and civic infrastructure sources

These help connect digital government to broader questions of democracy, participation, infrastructure, public goods, rights and civic capacity.

### Systems, strategy and mapping sources

These are useful when they help people understand complexity, institutions, governance, operating models, power, incentives and delivery landscapes.

### Accessibility, inclusion and design justice sources

These are core to public-service quality. They should not be treated as niche. Sources in this area help make services more usable, ethical and equitable.

## Examples of weak source types

### Generic product management feeds

Some product thinking is useful. But generic product commentary can quickly drift away from public-service reality. Add only when the writing is unusually applicable to public-sector delivery, discovery, strategy or operating models.

### Consultancy marketing blogs

Some consultancies publish excellent practical writing. Others mostly publish sales collateral. Prefer sources that show methods, lessons, trade-offs and public-service specificity.

### High-volume institutional feeds

Large organisations may publish many updates. If the feed mixes useful digital-government material with lots of unrelated announcements, prefer a narrower category feed or keep the source in `needs-review`.

## Contribution guide

To suggest a source, add an entry to `data/sources.yml` using this shape:

```yaml
- id: example-source
  name: Example Source
  url: https://example.org/blog/
  feedUrl: https://example.org/feed/
  status: needs-review
  organisation: Example Organisation
  tags:
    - digital-government
    - public-sector
    - service-design
```

Use a stable, lowercase `id` with hyphens.

Start with `needs-review` unless you have checked that the feed parses successfully.

After adding or changing sources, run:

```bash
npm run check:sources
npm run ingest
npm run build
```

If the source works and fits the philosophy, it can be marked `active`.

## The editorial stance

Civic Signals is not neutral about quality. It is intentionally biased towards:

- public value over commercial noise
- practice over branding
- useful detail over thought leadership
- openness over gatekeeping
- breadth over clique dynamics
- accessibility and inclusion as core quality
- simple, maintainable technology over unnecessary platform complexity

The goal is not to decide who is important. The goal is to make useful public-service work easier to notice.

# Sources

Civic Signals is built from public sources that help people working in and around UK digital government keep up with the wider ecosystem and improve the products and services they build.

The source list is not intended to be exhaustive. It is a curated set of public sources that can produce useful signals for people interested in digital government, public services, digital delivery and civic technology.

## What belongs in Civic Signals

A source can be useful if it helps people understand at least one of these areas:

- UK digital government
- digital delivery in public services
- product strategy, product management and outcome-focused practice
- service design, content design, user research and accessibility
- policy, public-sector reform and public administration
- civic technology, public-interest technology and responsible technology
- data, AI, security, architecture and technical delivery
- procurement, supplier markets and operating models
- local government and devolved public services
- international practice that is relevant to UK digital government

A source does not need to publish frequently. Rare but strong material is welcome if it is relevant and useful.

## Source quality

When reviewing a source, consider:

- relevance to UK digital government or digital delivery practice
- whether the material is public and stable enough to reference
- whether the source adds a useful perspective to the wider ecosystem
- whether the source is original, practical, authoritative or otherwise strong
- whether it helps people create better public products and services
- whether it broadens the set of voices, disciplines or contexts represented

Publishing frequency can be useful, but it is not a quality requirement.

## International sources

Civic Signals is UK-focused, but international sources can be included when they help UK practitioners understand:

- good practice
- standards and expectations
- comparable approaches
- where the bar is moving
- lessons from other public-sector or civic technology contexts

International sources should add useful context rather than shifting the centre of gravity away from UK digital government.

## Source statuses

Sources in `data/sources.yml` have a `status` field.

Use `active` for sources that should be ingested.

Use `needs-review` for sources that may be useful but need checking, categorisation or a better feed URL.

Use `paused` for sources that should remain documented but should not currently be ingested.

Suggested sources in the public spreadsheet use a slightly different review status:

- `New`
- `In review`
- `Accepted`
- `Not included`
- `Needs more information`

These spreadsheet statuses are for review only. A suggestion is not part of Civic Signals until it is added to the repository.

## Source fields

Each source in `data/sources.yml` should normally include:

```yaml
- id: example-source
  name: Example Source
  url: https://example.com/
  feedUrl: https://example.com/feed/
  status: active
  organisation: Example Organisation
  tags:
    - digital-government
    - product-management
```

### `id`

Use a short, stable, lowercase identifier.

Use hyphens rather than spaces.

Prefer the source or organisation name, for example:

```yaml
id: government-digital-service
```

### `name`

Use the public name of the source.

### `url`

Use the main public URL for the source.

### `feedUrl`

Use the RSS or Atom feed URL when available.

A source can still be useful without a feed URL, but it may need another ingestion method in the future.

### `status`

Use one of:

- `active`
- `needs-review`
- `paused`

### `organisation`

Use the organisation, team, publication or person most closely associated with the source.

For independent practitioners, use the person's public name.

### `tags`

Tags describe the source. They help with browsing, classification and signal generation.

Use lowercase tags with hyphens.

Prefer existing tags where possible. Add new tags only when they describe something meaningful and likely to be reused.

## Tag guidance

Tags should describe the source's recurring focus, not every possible topic it might mention once.

Useful tag groups include:

### Government and public-sector context

- `central-government`
- `local-government`
- `devolved-government`
- `public-sector`
- `public-services`
- `public-sector-reform`
- `policy`
- `governance`

### Delivery and product practice

- `digital-government`
- `digital-delivery`
- `delivery`
- `product-management`
- `product-strategy`
- `outcomes`
- `continuous-discovery`
- `service-design`
- `content-design`
- `user-research`
- `design-practice`
- `accessibility`

### Technology and data

- `technology`
- `architecture`
- `technical-architecture`
- `data`
- `ai`
- `responsible-ai`
- `security`

### Civic and professional ecosystem

- `civic-tech`
- `public-interest-technology`
- `community`
- `events`
- `weeknotes`
- `personal-blog`
- `practitioners`
- `research`
- `reports`

### Supplier and market context

- `supplier`
- `consultancy`
- `vendor`
- `procurement`
- `commercial`

### International context

- `international`
- country or region tags where useful, for example `germany`, `canada` or `scotland`

## Suggesting sources

People can suggest sources through the public suggestions spreadsheet linked from `/suggest-source/`.

The spreadsheet is intended to keep contribution lightweight and transparent. Contributors do not need a GitHub account.

The most useful suggestion fields are:

- source name
- source URL
- feed URL, if known
- source type
- relevance area
- UK relevance
- why the source is useful
- optional contact details

## Reviewing suggestions

When reviewing the suggestions spreadsheet:

1. Check whether the source already exists in `data/sources.yml`.
2. Check whether the source is relevant to UK digital government or digital delivery practice.
3. Check whether the source has a usable RSS or Atom feed.
4. Decide whether it should be accepted, not included or marked as needing more information.
5. If accepted, add the source to `data/sources.yml` in a pull request.
6. Use `needs-review` in the repository if the source is promising but needs further checking.

## Approval principles

Accepting a source does not mean Civic Signals endorses the source or agrees with everything it publishes.

It means the source is likely to produce public material that is useful for people working in and around UK digital government.

Sources should help Civic Signals remain useful, varied and trustworthy. Avoid adding sources that mainly create noise, marketing volume or duplicate coverage without adding a useful perspective.

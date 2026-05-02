# Civic Signals

Civic Signals is a small, community-maintained news feed for people working in and around digital government.

It collects useful public updates from blogs, weeknotes, reports and other digital government sources into one simple feed.

The aim is not to build a portal or publishing platform. The first version is deliberately small: a static website, a list of sources, and an automated feed refresh.

## What this is for

People working in digital government often rely on fragmented networks, newsletters, Slack groups, blog subscriptions and social media to keep up with what is happening.

Civic Signals gives people one place to check for useful updates across the wider ecosystem.

It is especially intended for people working across boundaries, including:

- service designers
- content designers
- user researchers
- delivery managers
- policy professionals
- developers and architects
- people in local government, central government, arm’s-length bodies, consultancies and civic technology organisations


## Tech stack

- [Astro](https://astro.build/) for the static site
- TypeScript for ingestion and validation
- GOV.UK Frontend-inspired styling and patterns
- YAML for source management
- JSON for generated feed data
- GitHub Actions for scheduled refresh and deployment
- GitHub Pages for hosting

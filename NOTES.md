# Relationship to teamwix-v2 and locdoc-hub-app

This repo is the **source of truth** for the shared Employee Hub UI: design
tokens, vanilla web components, and pure scoring logic. Two other repos
consume it, in different ways.

## teamwix-v2 (live, Wix)

Wix's Git integration requires files to physically exist inside the Wix repo
— it can't pull them in as a node dependency at runtime. So instead of a
package import, `scripts/sync-to-teamwix.mjs` **generates copies** of the
shared source files directly into `../teamwix-v2` on disk.

```bash
npm run sync:teamwix                        # assumes ../teamwix-v2
TEAMWIX_PATH=/path/to/teamwix npm run sync:teamwix   # override the path
```

Rules that follow from this:

- **Edit the source here, never in `teamwix-v2`.** Every copied file gets a
  `GENERATED — DO NOT EDIT HERE` banner pointing back to its source in this
  repo, but it's still possible to edit the copy by mistake.
- The sync target must stay pinned to `teamwix-v2` (Loc-Doc-Security org) —
  that's the repo actually wired to Wix's deploy. An older `teamwix` (personal
  account) previously existed on disk and had lost its Wix integration; it's
  since been removed. If a folder like that reappears, don't point
  `TEAMWIX_PATH` at it.
- After syncing, the changes still need to be committed and pushed from
  inside `teamwix-v2` itself — the sync script only writes local files.

## locdoc-hub-app (proof of concept, not live yet)

A standalone build of the same Employee Hub that runs entirely outside Wix —
testing whether it's viable to eventually self-host instead of running on
Wix. Unlike the `teamwix-v2` path, this one consumes `locdoc-hub-ui` as a
normal local package dependency (`npm install` links it), not a generated
copy — so no sync step is needed here, just keep the shared package installed.

It swaps out Wix's data/auth layer for its own proxy
(`server/wix-rest.mjs` live, `server/fixtures.mjs` mocked) in front of the
*same* shared components and scoring logic. The thesis being tested: the UI
components are portable; only the data/auth/nav layer is Wix-specific.

## tl;dr for future-you

Change shared UI/scoring behavior → edit it **here**. Wix site → run
`npm run sync:teamwix`, then commit inside `teamwix-v2`. Self-host POC → just
reinstall, no sync step. Full system-wide rationale (why these are three
separate repos instead of one) is in `~/Projects/WORKFLOW.md`.

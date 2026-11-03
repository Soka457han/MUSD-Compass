> **Update 25 Oct 2026 ~06:40 UTC — primary source read.** The official AKINDO page (https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10) was read in a real browser (it needs JavaScript, which is why the first pass below could not open it). It **overrides** the first pass where they differ:
>
> | # | Claim | Status from the official page |
> |---|---|---|
> | 1 | Stage 1 screening drops incomplete submissions | **VERIFIED** — AKINDO DevRel checks integration, a working deployment and "all submission materials provided"; others "are not forwarded". Required: live testnet/mainnet link, public GitHub repo, project deck, **a 2-minute pitch video**, and the form. |
> | 2 | Proportional rewards, no pass mark | **VERIFIED** — "Each project's share of that Wave's pool is proportional to its share of total points." Wave 1 $2,000, Wave 2 $5,000 (in MEZO, 14-day TWAP at KYB). KYB required. |
> | 3 | Criteria and weights | **VERIFIED** — Mezo Integration 30%, Product & Business Viability 30%, Technical Implementation 20%, User Experience 10%, Submission Materials Quality 10% ("demo clarity and pitch effectiveness"). |
> | 4 | Form fields | **VERIFIED** — project name; category (3–5 words); TL;DR (one sentence); how it works (problem, how it functions, how MUSD/MEZO is used and positioned); target group (user type, experience level, region, mobile/desktop, track fit); tech stack; track (1, 2 or both); chain deployed on; project status (new or existing + site); readiness (mainnet / testnet / demo only); future milestones (next three, with timelines); team info (members, roles, X or LinkedIn). |
> | 5 | Track 2 wording | **VERIFIED** — "Telegram or WhatsApp bots for MUSD/MEZO transactions and monitoring", "Matching and discovery platforms", "Marketplaces and aggregators for Mezo ecosystem products", "Cross-platform wallets and interfaces…". |
> | 6 | Principles | **VERIFIED** — "Extend, don't detour" (extending existing Mezo products is prioritized); "Composability wins" (plugging into lending markets, DEXs, vote-escrow systems scores higher than isolated consumer apps); "Long-term commitment counts". |
> | 7 | Testnet OK, waves | **VERIFIED** — Mezo testnet accepted; Wave 2 Nov 2–15, judged Nov 16–22; Wave 2 resubmissions must say what changed. |
> | 8 | Deadline | **VERIFIED** — 10/26 21:00 shown in the viewer's local time (Dhaka, UTC+6) = **26 Oct 15:00 UTC**; countdown read "1 day 08:20" at ~06:40 UTC 25 Oct. |

---

# AKINDO / Mezo Buildathon: checking the reviewer's claims

Researched 2026-10-25 with WebSearch and WebFetch only.

**Main limit:** the official AKINDO Mezo page (https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10) and AKINDO's WaveHack Docs (Notion) both need JavaScript to load. WebFetch got back only navigation and metadata from them, so their rules, judging text and form could **not** be read. x.com pages are blocked by robots.txt. That leaves two primary sources that could actually be read:

- the Mezo blog announcement: https://mezo.org/blog/mezo-buildathon-is-underway ("Mezo blog" below)
- AKINDO's "What is WaveHack?" page: https://app.akindo.io/about-wave-hack

Where only a third-party source exists, it is labelled **[3rd-party]**.

## Summary

| # | Claim | Status | Basis |
|---|---|---|---|
| 1 | "Stage 1 screening" drops submissions that lack required materials; video is mandatory | **NOT FOUND** (primary). Only "working deployment" and "integrate MUSD and/or MEZO" are confirmed as required | Mezo blog; AKINDO page unreadable |
| 2 | Proportional rewards, no pass mark; Wave 1 pool | **Partly VERIFIED**: the pool is $2,000 in MEZO, and AKINDO says more votes means more grants. "No pass mark" and "share by points" are NOT FOUND. The blog's "eligible projects advance" suggests some filter exists | Mezo blog; AKINDO about page |
| 3 | Weights 30/30/20/10/10 | **NOT FOUND** (primary). Two [3rd-party] READMEs give the same weights. The second criterion is named "Product & Business Viability", not "Product & Viability" | GitHub READMEs |
| 4 | Form fields | **NOT FOUND** (primary). [3rd-party] list confirms most fields. No character limits found. Can't say whether both tracks can be picked | GitHub README (adetyaz/Ipin) |
| 5 | Track 2 lists aggregators, Telegram bots for monitoring, discovery platforms, WhatsApp | **Partly CONTRADICTED**: "Telegram or WhatsApp tools" and "discovery platforms" are there. "Aggregators" and "for monitoring" are not, as far as the fetch shows | Mezo blog |
| 6 | "Extend, don't detour" / "composability wins" | **NOT FOUND** in any Mezo blog post, docs page or search result | Searches plus 4 Mezo blog posts |
| 7 | Wave 1 vs later waves; testnet/mainnet | **VERIFIED**: testnet is OK and mainnet is not required. Eligible projects advance to Wave 2. AKINDO expects you to keep updating your product each wave | Mezo blog; AKINDO about page |
| 8 | Deadline and timezone | **Date VERIFIED** (Oct 26). **Timezone NOT FOUND** in primary sources. [3rd-party] says "deadline 16:00" with no zone | Mezo blog; GitHub README |

## 1. Stage 1 screening and required materials

- **Primary (Mezo blog):** says every submission "must integrate MUSD and/or MEZO" and "must include a working deployment". It also says "Wave 1 focuses on the core experience: what the product does, how it uses MUSD or MEZO, and how someone can try it." The paraphrase shown by WebFetch reads "Every submission must include a working deployment." — https://mezo.org/blog/mezo-buildathon-is-underway
- The words "Stage 1" and "screening" appear in **no** primary source I could read. The AKINDO Mezo page and the WaveHack Docs could not be read.
- **[3rd-party] AKINDO's own product-page feature post (2024 Substack, not specific to Mezo)** lists:
  - GitHub repo as required: "the repo must be public so judges can evaluate it"
  - video (YouTube URL) as **optional**
  - live demo as optional
  - at least one image as required

  https://akindo.substack.com/p/new-feature-you-can-now-submit-products?open=false (this is AKINDO-authored but older and generic, so treat it with care)
- **[3rd-party] participant checklist (adetyaz/Ipin):** lists "Two-minute pitch video" and "Deck (8 slides)". That is the team's own checklist, not a quoted rule. https://github.com/adetyaz/Ipin
- **[3rd-party] NightHire PR (Midnight buildathon, a different event):** "The Buildathon rules list demo video as a required submission artefact". The "Stage 1 screening" wording there describes that project's own app, not an AKINDO stage. https://github.com/Ryjen1/NightHire/pull/1
- **Verdict:** NOT FOUND. No primary source shows whether a video is mandatory for Mezo. Treat a video, a deck, a public GitHub repo and a live demo URL as cheap insurance.

## 2. Reward distribution and Wave 1 pool

- **Pool:** the Mezo blog says "$7,000 in MEZO prizes across two waves". **Wave 1: $2,000 in MEZO**; Wave 2: $5,000 in MEZO. VERIFIED. https://mezo.org/blog/mezo-buildathon-is-underway
- **AKINDO (generic WaveHack):** "The more votes you get, the more grants you can get." It also says "Submitted updates are voted on by the core team and community for feedback." https://app.akindo.io/about-wave-hack
- The blog's "Eligible projects advance to Wave 2" means **some** eligibility filter exists. That is not the same as "no pass mark".
- **Verdict:** proportional-style payout is consistent with AKINDO's generic page. "No pass mark" and "a share by points" for the Mezo event are NOT FOUND.

## 3. Judging criteria and weights

- No primary source found: the AKINDO page could not be read, and the Mezo blog lists no criteria.
- **[3rd-party] pylon-mezo README:** "Mezo Integration (30%)", "Product & Business Viability (30%)", "Technical Implementation (20%)", "User Experience (10%)", "Submission Materials (10%)". https://github.com/PhiBao/pylon-mezo
- **[3rd-party] adetyaz/Ipin README:** gives the same five criteria and weights. It adds this kickoff note: "judges use the live product and read the code to check it does what the UI claims". https://github.com/adetyaz/Ipin
- **Caution:** the *first* Mezo Hackathon (2025) used different weights: Integration 30%, Technical 30%, Business Viability & Use Case 20%, UX 10%, Presentation 10%. https://mezo.org/blog/the-mezo-hackathon-build-bitcoin-finance-in-4-weeks/
- **Verdict:** the weights are probably right (two independent participants agree), but this is NOT FOUND in primary sources. The exact names are "Technical Implementation" and "Product & Business Viability".

## 4. Submission form fields

- No primary source found: the form sits behind the AKINDO login and the page could not be read.
- **[3rd-party] adetyaz/Ipin checklist:** "AKINDO form (name, category, TL;DR, how it works, target group, stack, track, chain, status, readiness, three milestones, team)". Their drafts show that "status" takes values like "entirely new", and that they chose "Track 2 is primary". https://github.com/adetyaz/Ipin
- Not confirmed:
  - the "3–5 word" limit on category
  - the "one sentence" TL;DR
  - milestone **dates**
  - an X/LinkedIn link in team info
  - any character limits
  - whether both tracks can be selected. "Track 2 is primary" hints at a primary/secondary choice, but that is INFERRED.
- **Verdict:** the field list is roughly confirmed by a third party. The format details are NOT FOUND.

## 5. Track wording (Mezo blog, as returned by WebFetch)

- **Track 1, DeFi:** build around "borrowing, lending, looping, and yield using MUSD or MEZO". Examples: collateral integrations, auto-compounding vaults, liquidity pools and DEX integrations, clearer borrowing or looping interfaces.
- **Track 2, Access & Distribution:** "Make MUSD and MEZO easier to discover, access, and use." Examples:
  - "Telegram or WhatsApp tools"
  - "discovery platforms that help compare integrations"
  - marketplaces that bring MUSD and MEZO into everyday transactions
  - simpler wallet interfaces
- WebFetch said explicitly: "It also doesn't mention aggregators."
- "Telegram bots *for monitoring*" was not found. The blog says "Telegram or WhatsApp tools".
- https://mezo.org/blog/mezo-buildathon-is-underway
- **Caveat:** WebFetch summarises pages, so these quotes may be lightly paraphrased. Check them against the live page before quoting them in the submission.
- **Verdict:** WhatsApp and discovery platforms are VERIFIED. "Aggregators" and "for monitoring" are CONTRADICTED (absent). MUSD Compass fits "discovery platforms that help compare" well.

## 6. "Extend, don't detour" / "composability wins"

- Searched the web, mezo.org and the docs. Also fetched these Mezo posts:
  - the buildathon announcement
  - Hackathon 1 winners
  - Hackathon 2 winners
  - the first hackathon announcement
- None contains either phrase. The closest wording is in the winners post: "extends the capabilities of Bitcoin", and a project described as a "composable 'money lego'". https://mezo.org/blog/mezo-hackathon-winners
- These phrases might be on the AKINDO page (unreadable) or in kickoff call notes.
- **Verdict:** NOT FOUND. Don't quote them as Mezo's words unless you can see them on the AKINDO page.

## 7. Wave rules, testnet and mainnet

- **Mezo blog:**
  - accepted networks are "Mezo, Ethereum, Base, or BSC"
  - "Mezo testnet submissions are welcome"
  - "New projects and extensions of existing products are both welcome"
  - Wave 1 (Oct 16–26): "Eligible projects advance to Wave 2"
  - Wave 2 (Nov 2–15): final submissions due Nov 15; winners and an online demo on Nov 23

  https://mezo.org/blog/mezo-buildathon-is-underway
- **AKINDO:** "Update your product, improve it, and submit it to the next wave." https://app.akindo.io/about-wave-hack
- **[3rd-party] NightHire (a different AKINDO buildathon):** a resubmission "must include a clear explanation of what has changed". This may apply to Wave 2 here too. INFERRED.
- **After the buildathon:** the Mezo Ignition Program supports projects "moving from prototype toward mainnet", so mainnet is not expected for Wave 1.
- **Verdict:** VERIFIED. Testnet is OK, mainnet is not required, and you keep building across waves. Whether you must take part in Wave 1 to enter Wave 2 is not stated.

## 8. Deadline and timezone

- **Mezo blog:** Wave 1 is October 16–26, and "Submissions due October 26". VERIFIED. https://mezo.org/blog/mezo-buildathon-is-underway
- **Timezone:** not stated in any readable primary source.
- **[3rd-party] adetyaz/Ipin:** "Wave 1: Oct 16 – Oct 26, 2026 (deadline 16:00)". No zone is given, and AKINDO pages usually show local time. https://github.com/adetyaz/Ipin
- **Recommendation:** submit by Oct 25 to be safe, and check the countdown on the AKINDO page while logged in.

## Unverified / could not access

- https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10 (the official Mezo WaveHack page): JavaScript app, only navigation was returned. Overview, rules, judging and the form were **not read**.
- https://akindo.notion.site/WaveHack-Docs-91fa2690f9cf4b3bb37ba241c27ca674 (AKINDO WaveHack Docs): Notion needs JavaScript, nothing returned.
- https://x.com/MezoNetwork and AKINDO X posts: blocked by robots.txt.
- https://github.com/thirdbase1/buildathon-radar/tree/main/data (third-party scrape, which mentions a Mezo "rubric, payout mechanics" file): blocked by robots.txt.
- The submission form itself: requires an AKINDO login.
- Mezo Discord announcements and the kickoff recording: not reachable with these tools.

---
name: Remote identity asset reliability
description: A visual QA lesson about external avatar and identity-image sources.
---

Use stable, verified image URLs for identity-critical remote media such as avatars. Dynamic avatar services can fail selectively for an individual query even when nearby variants load correctly.

**Why:** A single broken avatar is highly visible in a social-feed interface and makes the product feel unfinished.

**How to apply:** Prefer a known-good static image URL for the signed-in user and verify every repeated identity state (composer, account chip, post, and detail thread) after a clean restart.
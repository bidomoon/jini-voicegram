# Voicegram social beta — 2026-09-26

## Product structure
Home feed (all / following), explore (post and profile search), create, notifications, and profile. Home and own profile expose separate voice and text creation entry points. Creation has two steps: tell your story, then review and publish. Text posts do not require an image. Photo/image and video tools are optional. Instagram integration is deferred and absent from the primary flow.

## Persisted behavior
`/api/social` stores tester profiles, posts, likes, comments, follows, blocks and reports in a dedicated Netlify Blobs store `voicegram-social-beta-v1`. Media is delivered only to authorized testers who can view the post. Likes and comments drive in-app notifications (refresh-based, not push). Saved bookmarks and draft work remain on the device. Sample posts are explicitly labeled; they do not have fabricated engagement or enabled reactions.

Writes use strong consistency and conditional ETag updates. Post and comment IDs support retries. Only authors can delete their own posts/comments. User identity is a signed HttpOnly cookie using `SOCIAL_SESSION_SECRET`, distinct from the tester invitation/access code. Origin checks and the existing signed tester session protect writes. Deleting a post makes it unavailable immediately and removes its media file.

## Deliberate beta limits
This is not a production account system. Device identities cannot be recovered after cookie deletion and do not sync across devices. Server data is available to testers; team SSO remains enabled. A real account provider, account deletion/recovery, privacy/terms, moderation workflow and support must be completed before public launch. Reports are stored, not automatically reviewed. Blocking hides both users from each other and removes follow edges.

The current bounded community state is intended for a small test: 500 profiles, 300 active posts, 3,000 comments. Writes are capped per identity (25/minute; posts at least 15 seconds apart). Media limit is 4MB. Database pagination, storage lifecycle/abandoned upload cleanup, stronger abuse protection, and administrative moderation are launch gates. Cookie loss allows a new tester identity; this is not a public anti-abuse or authentication system.

AI image generation still uses the existing confirmed-cost flow. Runway video remains dependent on its separate API configuration. Browser speech recognition depends on device/browser support and permissions; no background driving assistant or hands-free publishing is claimed.

## Verification
- TypeScript and production build.
- `node --test tests/social.test.mjs`: distinct-user interactions, retry deduplication, deletion ownership, block visibility, report privacy, ETag concurrency and unauthorized request protection.
- Local Chromium with simulated API backed by the same state mutation module: widths 360 / 390 / 430 / 768 / 1440, no horizontal overflow on home and creation; likes, comments, follow, text publication, second user visibility, notifications, profile editing, home/profile creation entry.
- Browser test used temporary Korean/emoji fonts because the test container lacked them; product uses device font fallbacks.
- No real user content or paid AI requests were created for these tests. Production cross-device operation, real microphone permission/recognition and real-device file playback require tester validation. Netlify deploy readiness is checked separately.

## Reference
Netlify Blobs strong consistency and conditional `onlyIfMatch`/`onlyIfNew` writes verified against official documentation on 2026-09-26: https://docs.netlify.com/build/data-and-storage/netlify-blobs/

## 2026-09-27 account extension
Kakao account identity and server sessions have been added, with provider keys/activation still pending. Existing tester device identities are retained separately. See `kakao-toss-setup.md` for current status; earlier device-only limitations apply to the tester path.

# Higgsfield video integration — 2026-09-28

## Delivered

New Voicegram motion videos use the documented Higgsfield app API model `bytedance/seedance-2.0/image-to-video`, at 720p, 5 or 10 seconds, with `generate_audio: false`. The GPT image-and-caption planning step and approval stay in place. The uploaded photo's aspect ratio is preserved; unsupported aspect-ratio parameters are not sent. UI no longer quotes Runway pricing or offers an ineffective orientation setting.

The server obtains a signed reference upload URL, uploads the photo with every returned storage header and without API credentials, and only then submits the approved motion prompt. API credentials never reach the browser or storage server. The existing durable generation claim runs before upload/submission. Duplicate requests and client response loss retrieve the existing result. Timeout or server-error uncertainty does not cause an automatic generation retry.

Higgsfield request IDs use an internal `hf-` prefix. Owner-signed tickets bind status and video import to the authenticated session. The documented `/requests/{request_id}/status` endpoint maps completed, failed, canceled and moderation results to the app's existing workflow. Completed MP4s can be previewed and imported into the feed (20 MB limit). Old Runway jobs retain their original status/download route if their server key remains configured; new requests never fall back to Runway or a zoom effect.

## Connection status and remaining steps

The ChatGPT Higgsfield plugin is authenticated. Its credit balance and credential are separate from the developer API. Plugin credentials cannot be reused as an app API key. Plugin generation has not been submitted in this change.

Voicegram's Netlify environment currently has no Higgsfield API credential. App video generation therefore remains disabled. Set `HF_API_KEY` to the complete credential copied from `https://open.higgsfield.ai/api-keys`, with a secret Functions production scope. Alternatively set both `HF_API_KEY_ID` and `HF_API_KEY_SECRET`. Keep `MEDIA_ENABLED=true`, then redeploy. Do not expose credentials in source, client environment variables, logs or chat. Any API funding/subscription purchase requires the owner's approval.

The cost confirmation links to official API pricing and states that API usage is billed separately. No unverified model price or plugin-credit price is used as the app's dollar estimate. Current plugin estimate for a different model, Seedance 2.0 Mini (5 seconds, 720p, silent), is 5 plugin credits; this is not an app API quote.

Live credential validity, model entitlement, API balance and real motion quality remain unverified. Existing attachments are application screenshots, not the original musician photo. A real visual-quality check requires that original photo and an authorized funded API, or a direct plugin generation using its own credits. A mock video fixture is never evidence that the pictured musician animates correctly.

## Verification

- 23 Node tests pass, including actual function handlers with mocked external providers: photo/caption planning; source/settings ownership; 5/10-second request mapping; exact signed-upload headers; no API credential on storage PUT; upload failure prevents video submission; billing refusal; timeout and 5xx uncertainty; no duplicate paid submission; all terminal states; owner-only downloads; >4 MB feed import and publication deduplication; legacy job retrieval.
- TypeScript validation and production Netlify build pass.
- Browser verification uses actual function handlers, in-memory storage, mocked providers and a synthetic MP4, not paid AI generation. It exercises lost analysis/video responses, draft restoration, missing-key state, cost confirmation, playback, feed publication retry and five viewport widths.

## Official contracts checked

- https://open.higgsfield.ai/models/bytedance/seedance-2.0/image-to-video/api-reference
- https://docs.higgsfield.ai/docs/authentication
- https://docs.higgsfield.ai/docs/concepts/file-uploads
- https://docs.higgsfield.ai/docs/api-reference/requests/get-request-status
- https://docs.higgsfield.ai/docs/concepts/requests
- https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api
- https://open.higgsfield.ai/pricing

This document supersedes the Runway provider and pricing sections in `video-motion-upgrade-2026-09-27.md`.

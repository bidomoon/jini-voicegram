# Photo-to-video motion planning — 2026-09-27

The previous default video was a six-second local zoom effect. AI subject motion is now the default video workflow; the existing effect remains explicitly named “사진 확대 효과”. Instagram connection remains deferred.

## User flow

1. Add a photo, choose a motion (including instrument performance), and speak or type a brief. An optional post caption provides context. Select 5 or 10 seconds and portrait or landscape.
2. Explicitly confirm photo/text analysis cost. The server sends the actual image, brief and caption to OpenAI Responses using the existing OpenAI key and `OPENAI_VIDEO_PLAN_MODEL`, falling back to `OPENAI_CHAT_MODEL` / `gpt-4.1-mini`.
3. Review a Korean description of the visible scene, subject movement, camera and source-specific limitations. The planner does not create video.
4. Confirm a separate video generation charge. The server submits the approved English motion prompt and reference image to Runway Gen-4.5. Preview the silent video, then publish to the Voicegram feed.

## Cost and retry controls

- Both analysis and video submission claim a durable request ID before contacting a chargeable API. Lost responses are recovered by GET, without resubmission.
- The completed server-side plan is bound to the session, photo bytes, brief, caption, duration, aspect ratio and motion preset. Changed inputs require a new reviewed plan.
- A plan contains exactly one permitted video request ID. Changing IDs or supplying a client-written prompt cannot bypass this.
- No automatic regeneration or zoom-effect fallback. Explicit new analysis/generation requires cost confirmation. Unknown results retain their durable claim.
- Runway prompt text is validated at <= 1,000 UTF-16 characters. Unsupported or malformed plans never start video.
- At the verified API rate of 12 credits/second and $0.01/credit, the UI estimates $0.60 for 5 seconds and $1.20 for 10 seconds, excluding taxes, photo analysis, storage and delivery. This is an API estimate, not a consumer subscription price.
- No consumer credit balance, total monthly spending cap, refund entitlement or paid subscription was implemented here. Before commercial launch, use a server-side usage ledger and finite video allowances; do not advertise unlimited video generation.

## Transfer and ownership

Task tickets are session-bound. Download URLs are taken only from the authenticated provider response, never from arbitrary client input. MP4 content is checked and capped at 20 MB. Downloads and stored media use streaming responses. Publication imports the completed provider file on the server to avoid the multipart upload limit. Repeating a published post ID does not download or publish it twice.

Drafts preserve plans, task IDs and completed video Blobs across reloads. Service-key absence disables generation while still allowing configured GPT analysis. The video is silent; accurate hands, poster lettering, musical technique and first-try quality are not guaranteed.

## Verification

- 21 automated tests passed, including image/caption vision input, 5/10-second request bodies, changed-source rejection, cross-session rejection, one generation per plan, lost response recovery, invalid/uncertain planner results, absent video credentials, a 5 MB server import, publication deduplication and size limits.
- Browser verification with actual function handlers and isolated stores passed planning, both cost gates, reload recovery after lost analysis/video responses, missing-key disablement, MP4 playback, publication retry and 360/390/430/768/1440px layouts. External AI responses and video footage were local test fixtures; no paid API calls occurred.
- Existing image generation/edit/undo, draft recovery and local six-second effect browser flows passed.
- TypeScript and the production build passed. The Netlify package includes `/api/video-plan` and all function bundles.

The browser video test uses Playwright and an installed Chromium; it generates a clearly synthetic local clip with ffmpeg, or accepts `QA_VIDEO_FIXTURE`. It previews the production build, so run `npm run build:netlify` first.

## Deployment / outstanding integration

Deploy to the existing `jini-voicegram` project, site ID `e78fcfa6-0dd7-45e0-a3e1-e417ce52b91c`, team `jini-sale-item`. Preserve environment variables and team SSO protection.

The existing OpenAI key is configured. `RUNWAYML_API_SECRET` is absent on this app. Add the owner's authorized Runway API key to Netlify Functions, redeploy and then run a deliberately approved paid motion-quality check before enabling this feature for customers. Real AI motion quality has not been tested. Kakao, Toss and Instagram integration status is unchanged.

Official references checked on 2026-09-27:
- https://developers.openai.com/api/docs/guides/images-vision
- https://docs.dev.runwayml.com/api
- https://docs.dev.runwayml.com/guides/pricing/

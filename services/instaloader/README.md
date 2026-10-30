# DashReply Instaloader bridge

Small Python service used by the DashReply backend as the first extraction provider. It only requests public profile Reels and does not accept Instagram credentials or browser cookies.

## Deploy

Deploy this folder as a Docker web service (for example, a private Render service). Set a long random `INSTALOADER_SERVICE_TOKEN` in the service environment. Do not expose this service publicly without the token.

After deployment, add these environment variables to the DashReply Vercel project:

- `INSTALOADER_SERVICE_URL`: the service base URL, without a trailing slash.
- `INSTALOADER_SERVICE_TOKEN`: the same secret token configured on the Python service.
- `INSCRAPE_API_KEY`: your InScrape API key (100 free credits are advertised by InScrape).

The DashReply backend tries Instaloader first. If it errors or returns no usable Reel, it falls back to InScrape. If Instaloader is not deployed/configured, InScrape is used directly.

## Local run

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export INSTALOADER_SERVICE_TOKEN='replace-with-a-long-random-secret'
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check: `GET /health`. Reels endpoint: `POST /reels` with `Authorization: Bearer <token>` and JSON `{"handle":"username","limit":18}`.

Instagram may require authentication for some public profiles or rate-limit requests. This bridge intentionally does not use login credentials, session cookies, or private endpoints. The InScrape fallback is called by DashReply, not by this service.

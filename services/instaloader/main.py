import os
import re
from datetime import timezone
from typing import Any

import instaloader
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="DashReply Instaloader bridge", docs_url=None, redoc_url=None)
USERNAME_RE = re.compile(r"^[a-zA-Z0-9._]{1,30}$")

class ReelsRequest(BaseModel):
    handle: str
    limit: int = Field(default=18, ge=1, le=30)

def extract_reels(handle: str, limit: int) -> list[dict[str, Any]]:
    loader = instaloader.Instaloader(
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
    )
    profile = instaloader.Profile.from_username(loader.context, handle)
    reels = []
    for post in profile.get_reels():
        if not post.is_video:
            continue
        try:
            date = post.date_utc.replace(tzinfo=timezone.utc).isoformat()
        except Exception:
            date = None
        reels.append({
            "id": str(post.mediaid),
            "shortcode": post.shortcode,
            "caption": post.caption or "",
            "video_url": post.video_url,
            "thumbnail_url": post.url,
            "permalink": f"https://www.instagram.com/reel/{post.shortcode}/",
            "taken_at": date,
        })
        if len(reels) >= limit:
            break
    return reels

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/reels")
async def get_reels(body: ReelsRequest, authorization: str | None = Header(default=None)):
    expected = os.getenv("INSTALOADER_SERVICE_TOKEN", "")
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    handle = body.handle.strip().lstrip("@").lower()
    if not USERNAME_RE.fullmatch(handle):
        raise HTTPException(status_code=400, detail="Invalid Instagram username")
    try:
        reels = await run_in_threadpool(extract_reels, handle, body.limit)
        return {"handle": handle, "reels": reels, "provider": "Instaloader"}
    except instaloader.exceptions.ProfileNotExistsException:
        raise HTTPException(status_code=404, detail="Instagram profile not found")
    except instaloader.exceptions.PrivateProfileNotFollowedException:
        raise HTTPException(status_code=403, detail="Private profiles are not supported")
    except instaloader.exceptions.LoginRequiredException:
        raise HTTPException(status_code=503, detail="Instagram requires authentication for this profile")
    except Exception as exc:
        # Do not expose upstream response bodies, cookies, or internal request details.
        raise HTTPException(status_code=502, detail="Instaloader could not retrieve this public profile") from exc

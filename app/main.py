from fastapi import Depends, FastAPI, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db, init_db
from app.models import Brand, Keyword, Mention, ScanRun
from app.scanner import ensure_default_brand, run_scan

app = FastAPI(title="Reddit Thread Tracker")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


@app.on_event("startup")
def startup() -> None:
    init_db()
    db = next(get_db())
    try:
        ensure_default_brand(db)
    finally:
        db.close()


@app.get("/")
def dashboard(request: Request, sentiment: str = "all", db: Session = Depends(get_db)):
    brand = ensure_default_brand(db)

    mention_query = select(Mention).where(Mention.brand_id == brand.id)
    if sentiment != "all":
        mention_query = mention_query.where(Mention.sentiment == sentiment)

    mentions = db.scalars(mention_query.order_by(desc(Mention.created_at)).limit(100)).all()
    scan_runs = db.scalars(
        select(ScanRun).where(ScanRun.brand_id == brand.id).order_by(desc(ScanRun.started_at)).limit(8)
    ).all()
    keywords = db.scalars(select(Keyword).where(Keyword.brand_id == brand.id).order_by(Keyword.phrase)).all()

    total_mentions = db.scalar(select(func.count()).select_from(Mention).where(Mention.brand_id == brand.id)) or 0
    negative_mentions = (
        db.scalar(
            select(func.count()).select_from(Mention).where(Mention.brand_id == brand.id, Mention.sentiment == "negative")
        )
        or 0
    )
    latest_scan = scan_runs[0] if scan_runs else None

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "brand": brand,
            "mentions": mentions,
            "keywords": keywords,
            "scan_runs": scan_runs,
            "total_mentions": total_mentions,
            "negative_mentions": negative_mentions,
            "latest_scan": latest_scan,
            "sentiment_filter": sentiment,
            "settings": get_settings(),
        },
    )


@app.post("/brands")
def update_brand(name: str = Form(...), db: Session = Depends(get_db)):
    brand = ensure_default_brand(db)
    brand.name = name.strip()
    db.commit()
    return RedirectResponse("/", status_code=303)


@app.post("/keywords")
def add_keyword(phrase: str = Form(...), db: Session = Depends(get_db)):
    brand = ensure_default_brand(db)
    cleaned = phrase.strip()
    if cleaned:
        exists = db.scalar(select(Keyword).where(Keyword.brand_id == brand.id, Keyword.phrase == cleaned))
        if not exists:
            db.add(Keyword(brand_id=brand.id, phrase=cleaned))
            db.commit()
    return RedirectResponse("/", status_code=303)


@app.post("/keywords/{keyword_id}/toggle")
def toggle_keyword(keyword_id: int, db: Session = Depends(get_db)):
    keyword = db.get(Keyword, keyword_id)
    if keyword:
        keyword.is_active = not keyword.is_active
        db.commit()
    return RedirectResponse("/", status_code=303)


@app.post("/scan")
def scan_now(db: Session = Depends(get_db)):
    brand = ensure_default_brand(db)
    run_scan(db, brand.id)
    return RedirectResponse("/", status_code=303)


@app.post("/scan/cron")
def scan_from_cron(secret: str = Form(...), db: Session = Depends(get_db)):
    if secret != get_settings().alert_secret:
        return {"ok": False, "error": "Invalid secret."}
    brand = ensure_default_brand(db)
    scan = run_scan(db, brand.id)
    return {"ok": scan.status == "success", "scan_id": scan.id, "status": scan.status}

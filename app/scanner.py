from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.alerts import send_webhook_alert
from app.config import get_settings
from app.models import Brand, Keyword, Mention, ScanRun
from app.sentiment import score_sentiment
from app.serper_client import search_reddit_mentions


def ensure_default_brand(db: Session) -> Brand:
    settings = get_settings()
    brand = db.scalar(select(Brand).where(Brand.name == settings.default_brand))
    if brand:
        return brand

    brand = Brand(name=settings.default_brand)
    db.add(brand)
    db.flush()

    starter_keywords = [
        settings.default_brand,
        f"{settings.default_brand} review",
        f"{settings.default_brand} complaint",
        f"{settings.default_brand} scam",
    ]
    for phrase in starter_keywords:
        db.add(Keyword(brand_id=brand.id, phrase=phrase))
    db.commit()
    db.refresh(brand)
    return brand


def run_scan(db: Session, brand_id: int) -> ScanRun:
    settings = get_settings()
    brand = db.get(Brand, brand_id)
    if not brand:
        raise ValueError("Brand not found.")

    scan = ScanRun(brand_id=brand.id)
    db.add(scan)
    db.commit()
    db.refresh(scan)

    results_found = 0
    negative_found = 0

    try:
        keywords = db.scalars(
            select(Keyword).where(Keyword.brand_id == brand.id, Keyword.is_active.is_(True))
        ).all()

        for keyword in keywords:
            results = search_reddit_mentions(settings.serper_api_key, keyword.phrase)
            for result in results:
                sentiment, severity = score_sentiment(f"{result.title} {result.snippet}")
                mention = Mention(
                    brand_id=brand.id,
                    keyword_id=keyword.id,
                    title=result.title[:500],
                    snippet=result.snippet,
                    url=result.url,
                    subreddit=result.subreddit,
                    sentiment=sentiment,
                    severity=severity,
                )
                db.add(mention)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    continue

                results_found += 1
                if sentiment == "negative":
                    negative_found += 1
                    alert_sent = send_webhook_alert(
                        settings.alert_webhook_url,
                        brand.name,
                        mention.title,
                        mention.url,
                        mention.severity,
                    )
                    if alert_sent:
                        mention.is_alert_sent = True
                        db.commit()

        scan.status = "success"
    except Exception as exc:
        scan.status = "failed"
        scan.error_message = str(exc)
    finally:
        scan.results_found = results_found
        scan.negative_found = negative_found
        scan.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(scan)

    return scan

from app.db import SessionLocal, init_db
from app.scanner import ensure_default_brand, run_scan


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        brand = ensure_default_brand(db)
        scan = run_scan(db, brand.id)
        print(f"Scan {scan.status}: {scan.results_found} new results, {scan.negative_found} negative.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

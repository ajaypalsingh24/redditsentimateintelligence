# Reddit Thread Tracker

A FastAPI web app that tracks Reddit mentions for a brand using Serper Google Search results.

## What it does

- Searches Google through Serper for Reddit mentions from the last 24 hours.
- Saves found mentions in a database.
- Labels mentions as positive, neutral, or negative with a simple keyword-based scorer.
- Shows a web dashboard with filters and scan history.
- Sends optional webhook alerts for new negative mentions.
- Supports SQLite locally and Neon PostgreSQL on Render.

## Local Setup

This project is pinned to Python 3.12 for Render deployment.

1. Create a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install packages:

```powershell
pip install -r requirements.txt
```

3. Create your `.env` file:

```powershell
Copy-Item .env.example .env
```

4. Add your Serper API key in `.env`:

```env
SERPER_API_KEY=your_real_key
```

5. Start the app:

```powershell
uvicorn app.main:app --reload
```

6. Open:

```text
http://127.0.0.1:8000
```

## Neon Setup

Use a Neon PostgreSQL connection string in `DATABASE_URL`.

If Neon gives a URL starting with `postgres://`, change it to `postgresql+psycopg://`.

Example:

```env
DATABASE_URL=postgresql+psycopg://user:password@host.neon.tech/dbname?sslmode=require
```

## Render Setup

Push this folder to GitHub, create a Render Blueprint from `render.yaml`, and add these environment variables:

- `DATABASE_URL`
- `SERPER_API_KEY`
- `ALERT_WEBHOOK_URL` optional
- `ALERT_SECRET`

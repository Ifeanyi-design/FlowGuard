"""FastAPI app: CORS from env, startup DB init, router mounting."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .database import Base, SessionLocal, engine
from .models import User  # noqa: F401  (register models)
from .models import Account, AuditLog, Beneficiary, Case, RiskEvent, Transaction  # noqa: F401
from .routers import auth, bank, cases, demo, transactions
from .seed import init_db, seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            seed()
    finally:
        db.close()
    yield


app = FastAPI(title="FlowGuard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(cases.router)
app.include_router(demo.router)
app.include_router(auth.router)
app.include_router(bank.router)


@app.get("/api/health")
def health():
    from sqlalchemy import text

    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            db_status = "ok"
        finally:
            db.close()
    except Exception as exc:  # surface DB issues without crashing
        db_status = f"error: {exc}"
    return {"status": "ok", "service": "flowguard-api", "db": db_status}


@app.get("/")
def root():
    return {"service": "flowguard-api", "health": "/api/health"}

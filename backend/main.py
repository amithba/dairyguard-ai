from datetime import date

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session

try:
    from .ai_engine import detect_milk_anomalies
    from .auth import (
        create_access_token, get_current_user, hash_password, verify_password
    )
    from .database import Base, engine, get_db
    from . import models
except ImportError:
    from ai_engine import detect_milk_anomalies
    from auth import (
        create_access_token, get_current_user, hash_password, verify_password
    )
    from database import Base, engine, get_db
    import models

# Creates missing tables. The explicit ALTER below handles an existing farms table.
Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.execute(text(
        "ALTER TABLE farms ADD COLUMN IF NOT EXISTS user_id INTEGER NULL "
        "REFERENCES users(id)"
    ))
    connection.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_farms_user_id ON farms (user_id)"
    ))

app = FastAPI(
    title="DairyGuard AI",
    description="Dairy farm management, milk tracking, cost analysis, and explainable alerts.",
    version="1.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FarmInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    location: str = Field(default="", max_length=200)


class CowInput(BaseModel):
    tag_number: str = Field(min_length=1, max_length=50)
    breed: str = Field(default="Unknown", max_length=80)
    age_months: int = Field(default=0, ge=0)
    farm_id: int


class MilkInput(BaseModel):
    cow_id: int
    liters: float = Field(gt=0)
    record_date: date = Field(default_factory=date.today)


class FeedInput(BaseModel):
    farm_id: int
    amount: float = Field(ge=0)
    description: str = Field(default="Feed", max_length=200)
    record_date: date = Field(default_factory=date.today)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=12, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


@app.get("/")
def root():
    return {"message": "Welcome to DairyGuard AI", "status": "running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "healthy", "database": "connected"}


@app.post("/auth/register", status_code=201)
def register_user(request: RegisterRequest, db: Session = Depends(get_db)):
    username = request.username.strip()
    if len(username) < 3:
        raise HTTPException(400, "Username must contain at least 3 characters")
    if db.query(models.User).filter(func.lower(models.User.username) == username.lower()).first():
        raise HTTPException(409, "Username is already registered")
    user = models.User(
        username=username,
        password_hash=hash_password(request.password),
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Could not register this username; it may already exist")
    db.refresh(user)
    return {"message": "Registration successful", "user_id": user.id, "username": user.username}


@app.post("/auth/login")
def login_user(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        func.lower(models.User.username) == request.username.strip().lower()
    ).first()
    if user is None or not user.is_active or not verify_password(request.password, user.password_hash):
        raise HTTPException(401, "Incorrect username or password")
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "username": user.username,
    }


@app.get("/auth/me")
def current_user_info(user=Depends(get_current_user)):
    return {"id": user.id, "username": user.username}


@app.post("/farms", status_code=201)
def create_farm(data: FarmInput, db: Session = Depends(get_db), user=Depends(get_current_user)):
    farm = models.Farm(**data.model_dump(), user_id=user.id)
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return {"id": farm.id, "name": farm.name, "location": farm.location, "user_id": farm.user_id}


@app.get("/farms")
def list_farms(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Farm).filter(models.Farm.user_id == user.id).order_by(models.Farm.id).all()


@app.post("/cows", status_code=201)
def create_cow(data: CowInput, db: Session = Depends(get_db), user=Depends(get_current_user)):
    farm = db.query(models.Farm).filter_by(id=data.farm_id, user_id=user.id).first()
    if not farm:
        raise HTTPException(404, "Farm not found")
    if db.query(models.Cow).filter_by(tag_number=data.tag_number).first():
        raise HTTPException(409, "Cow tag number already exists")
    cow = models.Cow(**data.model_dump())
    db.add(cow)
    db.commit()
    db.refresh(cow)
    return {"id": cow.id, "tag_number": cow.tag_number, "farm_id": cow.farm_id}


@app.get("/cows")
def list_cows(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return (
        db.query(models.Cow)
        .join(models.Farm, models.Cow.farm_id == models.Farm.id)
        .filter(models.Farm.user_id == user.id)
        .order_by(models.Cow.id).all()
    )


@app.post("/milk-records", status_code=201)
def create_milk_record(data: MilkInput, db: Session = Depends(get_db), user=Depends(get_current_user)):
    cow = (
        db.query(models.Cow)
        .join(models.Farm, models.Cow.farm_id == models.Farm.id)
        .filter(models.Cow.id == data.cow_id, models.Farm.user_id == user.id)
        .first()
    )
    if not cow:
        raise HTTPException(404, "Cow not found")
    record = models.MilkRecord(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/milk-records")
def list_milk_records(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return (
        db.query(models.MilkRecord)
        .join(models.Cow, models.MilkRecord.cow_id == models.Cow.id)
        .join(models.Farm, models.Cow.farm_id == models.Farm.id)
        .filter(models.Farm.user_id == user.id)
        .order_by(models.MilkRecord.record_date.desc()).all()
    )


@app.post("/feed-costs", status_code=201)
def create_feed_cost(data: FeedInput, db: Session = Depends(get_db), user=Depends(get_current_user)):
    farm = db.query(models.Farm).filter_by(id=data.farm_id, user_id=user.id).first()
    if not farm:
        raise HTTPException(404, "Farm not found")
    record = models.FeedCost(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/feed-costs")
def list_feed_costs(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return (
        db.query(models.FeedCost)
        .join(models.Farm, models.FeedCost.farm_id == models.Farm.id)
        .filter(models.Farm.user_id == user.id)
        .order_by(models.FeedCost.record_date.desc()).all()
    )


@app.get("/analytics/farm/{farm_id}")
def farm_analytics(farm_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    farm = db.query(models.Farm).filter_by(id=farm_id, user_id=user.id).first()
    if not farm:
        raise HTTPException(404, "Farm not found")
    cow_count = db.query(func.count(models.Cow.id)).filter_by(farm_id=farm_id).scalar() or 0
    milk = (
        db.query(func.coalesce(func.sum(models.MilkRecord.liters), 0.0))
        .join(models.Cow, models.MilkRecord.cow_id == models.Cow.id)
        .filter(models.Cow.farm_id == farm_id).scalar()
    )
    feed = db.query(func.coalesce(func.sum(models.FeedCost.amount), 0.0)).filter_by(farm_id=farm_id).scalar()
    return {
        "farm_id": farm_id, "farm_name": farm.name, "cow_count": cow_count,
        "total_recorded_milk_liters": round(float(milk), 2),
        "total_recorded_feed_cost": round(float(feed), 2),
        "note": "Totals cover all recorded dates; they are not daily forecasts or profit estimates."
    }


@app.get("/alerts/cow/{cow_id}")
def cow_alerts(cow_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    cow = (
        db.query(models.Cow)
        .join(models.Farm, models.Cow.farm_id == models.Farm.id)
        .filter(models.Cow.id == cow_id, models.Farm.user_id == user.id)
        .first()
    )
    if not cow:
        raise HTTPException(404, "Cow not found")
    records = db.query(models.MilkRecord).filter_by(cow_id=cow_id).order_by(models.MilkRecord.record_date).all()
    results = detect_milk_anomalies([r.liters for r in records])
    if results and results[0].get("status") == "insufficient_data":
        return {"cow_id": cow_id, **results[0]}
    return {
        "cow_id": cow_id, "records_analyzed": len(records), "alerts": results,
        "disclaimer": "Alerts flag unusual recorded values and do not diagnose disease."
    }


@app.get("/analytics/farm/{farm_id}/profitability")
def farm_profitability(
    farm_id: int,
    milk_price_per_liter: float = 40.0,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    farm = db.query(models.Farm).filter_by(id=farm_id, user_id=user.id).first()
    if not farm:
        raise HTTPException(404, "Farm not found")
    if milk_price_per_liter < 0:
        raise HTTPException(422, "Milk price cannot be negative")
    total_milk = (
        db.query(func.coalesce(func.sum(models.MilkRecord.liters), 0.0))
        .join(models.Cow, models.MilkRecord.cow_id == models.Cow.id)
        .filter(models.Cow.farm_id == farm_id).scalar()
    )
    total_feed = db.query(func.coalesce(func.sum(models.FeedCost.amount), 0.0)).filter_by(farm_id=farm_id).scalar()
    revenue = float(total_milk) * milk_price_per_liter
    balance = revenue - float(total_feed)
    return {
        "farm_id": farm_id, "farm_name": farm.name,
        "recorded_milk_liters": round(float(total_milk), 2),
        "assumed_milk_price_per_liter": milk_price_per_liter,
        "estimated_milk_revenue": round(revenue, 2),
        "recorded_feed_cost": round(float(total_feed), 2),
        "estimated_balance_before_other_expenses": round(balance, 2),
        "currency": "INR",
        "note": "Estimate uses all recorded dates. It excludes labor, veterinary care, utilities, and other expenses."
    }

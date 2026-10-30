from datetime import date
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from .database import Base
except ImportError:
    from database import Base


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(200), default="")
    # Nullable temporarily so existing database rows survive the migration.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    owner: Mapped["User"] = relationship()
    cows: Mapped[list["Cow"]] = relationship(
        back_populates="farm", cascade="all, delete-orphan"
    )


class Cow(Base):
    __tablename__ = "cows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tag_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    breed: Mapped[str] = mapped_column(String(80), default="Unknown")
    age_months: Mapped[int] = mapped_column(Integer, default=0)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False)
    farm: Mapped["Farm"] = relationship(back_populates="cows")


class MilkRecord(Base):
    __tablename__ = "milk_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cow_id: Mapped[int] = mapped_column(ForeignKey("cows.id"), nullable=False)
    record_date: Mapped[date] = mapped_column(Date, default=date.today)
    liters: Mapped[float] = mapped_column(Float, nullable=False)


class FeedCost(Base):
    __tablename__ = "feed_costs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False)
    record_date: Mapped[date] = mapped_column(Date, default=date.today)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(200), default="Feed")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

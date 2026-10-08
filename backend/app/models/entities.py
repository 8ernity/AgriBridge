"""SQLAlchemy entity models for AgriBridge platform."""
import datetime
import uuid
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.db import Base


class Device(Base):
    """Anonymous device identity preserving farmer privacy."""
    __tablename__ = "devices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    language = Column(String, default="en")
    country = Column(String, default="IN")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    plots = relationship("Plot", back_populates="device", cascade="all, delete-orphan")


class Plot(Base):
    """Agricultural field boundary and metadata."""
    __tablename__ = "plots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String, ForeignKey("devices.id"), nullable=True)
    name = Column(String, nullable=False)
    crop = Column(String, nullable=False)
    sowing_date = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    area_ha = Column(Float, default=0.5)
    geom_geojson = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    device = relationship("Device", back_populates="plots")
    scans = relationship("Scan", back_populates="plot")
    advisories = relationship("Advisory", back_populates="plot")


class Scan(Base):
    """Leaf disease scan result and diagnostic triage."""
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    plot_id = Column(String, ForeignKey("plots.id"), nullable=True)
    crop = Column(String, nullable=True)
    top_disease = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    status = Column(String, nullable=False)  # "confident" or "uncertain"
    predictions_json = Column(Text, nullable=False)
    retake_guidance = Column(Text, nullable=True)
    management_summary = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)
    model_version = Column(String, default="1.0.0")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    plot = relationship("Plot", back_populates="scans")


class Advisory(Base):
    """Source-grounded agronomic RAG dialogue interaction."""
    __tablename__ = "advisories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    plot_id = Column(String, ForeignKey("plots.id"), nullable=True)
    scan_id = Column(String, ForeignKey("scans.id"), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources_json = Column(Text, nullable=True)
    language = Column(String, default="en")
    feedback = Column(String, nullable=True)  # "helpful", "not_helpful"
    feedback_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    plot = relationship("Plot", back_populates="advisories")


class EnvCache(Base):
    """Cached response records for weather, soil, and satellite data."""
    __tablename__ = "env_cache"

    key = Column(String, primary_key=True)
    source = Column(String, nullable=False)
    payload_json = Column(Text, nullable=False)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


class OutbreakReport(Base):
    """Anonymized coarse-grid disease surveillance tracking."""
    __tablename__ = "outbreak_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    cell_id = Column(String, nullable=False)  # Coarse grid (0.1 deg)
    crop = Column(String, nullable=False)
    disease = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

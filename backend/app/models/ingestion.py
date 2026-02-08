from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id = Column(Integer, primary_key=True, index=True)
    entity = Column(String, nullable=False, index=True)  # sales_history, inventory_levels, dealer_orders
    source = Column(String, nullable=False, index=True)  # manual_json, manual_csv, scheduled_file
    filename = Column(String, nullable=True)
    dry_run = Column(Boolean, nullable=False, default=True)
    status = Column(String, nullable=False, default="SUCCESS")  # SUCCESS, PARTIAL, FAILED
    processed = Column(Integer, nullable=False, default=0)
    inserted = Column(Integer, nullable=False, default=0)
    updated = Column(Integer, nullable=False, default=0)
    skipped = Column(Integer, nullable=False, default=0)
    error_count = Column(Integer, nullable=False, default=0)
    errors_json = Column(Text, nullable=True)
    triggered_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

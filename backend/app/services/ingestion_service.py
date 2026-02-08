import csv
import io
import json
import shutil
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    Dealer,
    DealerOrder,
    IngestionRun,
    InventoryLevel,
    Region,
    SKU,
    SalesHistory,
    Warehouse,
)
from app.schemas.ingestion import DealerOrderIn, IngestionError, IngestionResult, InventoryLevelIn, SalesHistoryIn


def parse_csv_content(content: bytes) -> list[dict]:
    if not content:
        return []
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader if any((value or "").strip() for value in row.values())]


def validate_rows(raw_rows: list[dict], model_cls) -> tuple[list, list[IngestionError]]:
    validated = []
    errors: list[IngestionError] = []
    for idx, raw in enumerate(raw_rows, start=1):
        try:
            validated.append(model_cls.model_validate(raw))
        except ValidationError as e:
            errors.append(IngestionError(row=idx, message=e.errors()[0].get("msg", "Invalid row")))
    return validated, errors


def _finalize_ingestion(db: Session, dry_run: bool):
    if dry_run:
        db.rollback()
    else:
        db.commit()


def ingest_sales_history(
    db: Session,
    rows: Sequence[SalesHistoryIn],
    dry_run: bool = True,
) -> IngestionResult:
    sku_lookup = {row.sku_code: row.id for row in db.query(SKU.id, SKU.sku_code).all()}
    region_lookup = {row.name.lower(): row.id for row in db.query(Region.id, Region.name).all()}

    processed = inserted = updated = skipped = 0
    errors: list[IngestionError] = []

    for idx, row in enumerate(rows, start=1):
        sku_id = sku_lookup.get(row.sku_code)
        region_id = region_lookup.get(row.region_name.lower())
        if not sku_id:
            errors.append(IngestionError(row=idx, message=f"Unknown sku_code '{row.sku_code}'"))
            skipped += 1
            continue
        if not region_id:
            errors.append(IngestionError(row=idx, message=f"Unknown region_name '{row.region_name}'"))
            skipped += 1
            continue

        existing = (
            db.query(SalesHistory)
            .filter(
                SalesHistory.sku_id == sku_id,
                SalesHistory.region_id == region_id,
                SalesHistory.date == row.date,
            )
            .first()
        )
        if existing:
            existing.quantity_sold = row.quantity_sold
            existing.revenue = row.revenue
            existing.channel = row.channel
            updated += 1
        else:
            db.add(
                SalesHistory(
                    sku_id=sku_id,
                    region_id=region_id,
                    date=row.date,
                    quantity_sold=row.quantity_sold,
                    revenue=row.revenue,
                    channel=row.channel,
                )
            )
            inserted += 1
        processed += 1

    _finalize_ingestion(db, dry_run=dry_run)
    return IngestionResult(
        entity="sales_history",
        dry_run=dry_run,
        processed=processed,
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )


def ingest_inventory_levels(
    db: Session,
    rows: Sequence[InventoryLevelIn],
    dry_run: bool = True,
) -> IngestionResult:
    sku_lookup = {row.sku_code: row.id for row in db.query(SKU.id, SKU.sku_code).all()}
    warehouse_lookup = {row.code: row.id for row in db.query(Warehouse.id, Warehouse.code).all()}

    processed = inserted = updated = skipped = 0
    errors: list[IngestionError] = []

    for idx, row in enumerate(rows, start=1):
        sku_id = sku_lookup.get(row.sku_code)
        warehouse_id = warehouse_lookup.get(row.warehouse_code)

        if not sku_id:
            errors.append(IngestionError(row=idx, message=f"Unknown sku_code '{row.sku_code}'"))
            skipped += 1
            continue
        if not warehouse_id:
            errors.append(IngestionError(row=idx, message=f"Unknown warehouse_code '{row.warehouse_code}'"))
            skipped += 1
            continue

        approx_daily = max((row.reorder_point or 50) / 14, 1)
        computed_days = row.current_stock / approx_daily
        days_of_cover = row.days_of_cover if row.days_of_cover is not None else round(computed_days, 1)

        existing = (
            db.query(InventoryLevel)
            .filter(
                InventoryLevel.warehouse_id == warehouse_id,
                InventoryLevel.sku_id == sku_id,
            )
            .first()
        )
        if existing:
            existing.current_stock = row.current_stock
            if row.reorder_point is not None:
                existing.reorder_point = row.reorder_point
            if row.max_capacity is not None:
                existing.max_capacity = row.max_capacity
            existing.days_of_cover = days_of_cover
            existing.last_updated = row.last_updated or datetime.utcnow()
            updated += 1
        else:
            db.add(
                InventoryLevel(
                    warehouse_id=warehouse_id,
                    sku_id=sku_id,
                    current_stock=row.current_stock,
                    reorder_point=row.reorder_point if row.reorder_point is not None else 50,
                    max_capacity=row.max_capacity if row.max_capacity is not None else 5000,
                    days_of_cover=days_of_cover,
                    last_updated=row.last_updated or datetime.utcnow(),
                )
            )
            inserted += 1
        processed += 1

    _finalize_ingestion(db, dry_run=dry_run)
    return IngestionResult(
        entity="inventory_levels",
        dry_run=dry_run,
        processed=processed,
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )


def ingest_dealer_orders(
    db: Session,
    rows: Sequence[DealerOrderIn],
    dry_run: bool = True,
) -> IngestionResult:
    sku_lookup = {row.sku_code: row.id for row in db.query(SKU.id, SKU.sku_code).all()}
    dealer_lookup = {row.code: row.id for row in db.query(Dealer.id, Dealer.code).all()}

    processed = inserted = updated = skipped = 0
    errors: list[IngestionError] = []

    for idx, row in enumerate(rows, start=1):
        sku_id = sku_lookup.get(row.sku_code)
        dealer_id = dealer_lookup.get(row.dealer_code)
        if not sku_id:
            errors.append(IngestionError(row=idx, message=f"Unknown sku_code '{row.sku_code}'"))
            skipped += 1
            continue
        if not dealer_id:
            errors.append(IngestionError(row=idx, message=f"Unknown dealer_code '{row.dealer_code}'"))
            skipped += 1
            continue

        db.add(
            DealerOrder(
                dealer_id=dealer_id,
                sku_id=sku_id,
                quantity=row.quantity,
                order_date=row.order_date or datetime.utcnow(),
                status=row.status,
                is_ai_suggested=row.is_ai_suggested,
                order_source=row.order_source,
                savings_amount=row.savings_amount,
            )
        )
        inserted += 1
        processed += 1

    _finalize_ingestion(db, dry_run=dry_run)
    return IngestionResult(
        entity="dealer_orders",
        dry_run=dry_run,
        processed=processed,
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )


def _serialize_error(err: Any) -> dict:
    if hasattr(err, "model_dump"):
        return err.model_dump()
    if isinstance(err, dict):
        return err
    return {"message": str(err)}


def _serialize_ingestion_run(run: IngestionRun) -> dict:
    return {
        "id": run.id,
        "entity": run.entity,
        "source": run.source,
        "filename": run.filename,
        "dry_run": run.dry_run,
        "status": run.status,
        "processed": run.processed,
        "inserted": run.inserted,
        "updated": run.updated,
        "skipped": run.skipped,
        "error_count": run.error_count,
        "errors_json": run.errors_json,
        "triggered_by_user_id": run.triggered_by_user_id,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


def _derive_status(result: IngestionResult | None, error_message: str | None) -> str:
    if error_message:
        return "FAILED"
    if result is None:
        return "FAILED"
    error_count = len(result.errors)
    if error_count == 0:
        return "SUCCESS"
    if result.processed > 0 or result.inserted > 0 or result.updated > 0:
        return "PARTIAL"
    return "FAILED"


def log_ingestion_run(
    *,
    entity: str,
    source: str,
    dry_run: bool,
    result: IngestionResult | None = None,
    filename: str | None = None,
    triggered_by_user_id: int | None = None,
    started_at: datetime | None = None,
    error_message: str | None = None,
) -> dict:
    errors_payload = []
    if result is not None:
        errors_payload = [_serialize_error(err) for err in result.errors]
    if error_message:
        errors_payload.append({"row": 0, "message": error_message})

    run = IngestionRun(
        entity=entity,
        source=source,
        filename=filename,
        dry_run=dry_run,
        status=_derive_status(result, error_message),
        processed=result.processed if result else 0,
        inserted=result.inserted if result else 0,
        updated=result.updated if result else 0,
        skipped=result.skipped if result else 0,
        error_count=len(errors_payload),
        errors_json=json.dumps(errors_payload, ensure_ascii=True) if errors_payload else None,
        triggered_by_user_id=triggered_by_user_id,
        started_at=started_at or datetime.utcnow(),
        completed_at=datetime.utcnow(),
    )

    db = SessionLocal()
    try:
        db.add(run)
        db.commit()
        db.refresh(run)
        return _serialize_ingestion_run(run)
    finally:
        db.close()


def list_ingestion_runs(db: Session, limit: int = 50, offset: int = 0, entity: str | None = None) -> dict:
    query = db.query(IngestionRun)
    if entity:
        query = query.filter(IngestionRun.entity == entity)
    total = query.count()
    rows = (
        query.order_by(IngestionRun.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [_serialize_ingestion_run(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def get_ingestion_run(db: Session, run_id: int) -> dict | None:
    row = db.query(IngestionRun).filter(IngestionRun.id == run_id).first()
    if not row:
        return None
    return _serialize_ingestion_run(row)


def detect_entity_from_filename(filename: str) -> str | None:
    lower = filename.lower()
    if lower.startswith("sales_history") or "sales_history" in lower:
        return "sales_history"
    if lower.startswith("inventory_levels") or "inventory_levels" in lower:
        return "inventory_levels"
    if lower.startswith("dealer_orders") or "dealer_orders" in lower:
        return "dealer_orders"
    return None


def _safe_move(src: Path, target_dir: Path) -> Path:
    target_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    destination = target_dir / f"{stamp}_{src.name}"
    suffix = 1
    while destination.exists():
        destination = target_dir / f"{stamp}_{suffix}_{src.name}"
        suffix += 1
    shutil.move(str(src), str(destination))
    return destination


def _ingest_rows_by_entity(db: Session, entity: str, rows: list, dry_run: bool) -> IngestionResult:
    if entity == "sales_history":
        return ingest_sales_history(db, rows, dry_run=dry_run)
    if entity == "inventory_levels":
        return ingest_inventory_levels(db, rows, dry_run=dry_run)
    if entity == "dealer_orders":
        return ingest_dealer_orders(db, rows, dry_run=dry_run)
    raise ValueError(f"Unsupported entity: {entity}")


def _entity_model(entity: str):
    if entity == "sales_history":
        return SalesHistoryIn
    if entity == "inventory_levels":
        return InventoryLevelIn
    if entity == "dealer_orders":
        return DealerOrderIn
    raise ValueError(f"Unsupported entity: {entity}")


def process_ingestion_file(
    file_path: Path,
    archive_dir: Path,
    error_dir: Path,
) -> dict:
    started_at = datetime.utcnow()
    entity = detect_entity_from_filename(file_path.name)
    if not entity:
        run = log_ingestion_run(
            entity="unknown",
            source="scheduled_file",
            dry_run=False,
            filename=file_path.name,
            started_at=started_at,
            error_message="Could not infer entity from filename. Use sales_history*, inventory_levels*, or dealer_orders* prefix.",
        )
        _safe_move(file_path, error_dir)
        return {"filename": file_path.name, "entity": "unknown", "status": run["status"]}

    try:
        raw_rows = parse_csv_content(file_path.read_bytes())
        rows, validation_errors = validate_rows(raw_rows, _entity_model(entity))

        db = SessionLocal()
        try:
            result = _ingest_rows_by_entity(db, entity, rows, dry_run=False)
        finally:
            db.close()

        result.errors.extend(validation_errors)
        result.skipped += len(validation_errors)
        run = log_ingestion_run(
            entity=entity,
            source="scheduled_file",
            dry_run=False,
            result=result,
            filename=file_path.name,
            started_at=started_at,
        )
        _safe_move(file_path, archive_dir)
        return {
            "filename": file_path.name,
            "entity": entity,
            "status": run["status"],
            "processed": result.processed,
            "inserted": result.inserted,
            "updated": result.updated,
            "skipped": result.skipped,
        }
    except Exception as exc:
        run = log_ingestion_run(
            entity=entity,
            source="scheduled_file",
            dry_run=False,
            filename=file_path.name,
            started_at=started_at,
            error_message=str(exc),
        )
        _safe_move(file_path, error_dir)
        return {"filename": file_path.name, "entity": entity, "status": run["status"], "error": str(exc)}


def process_ingestion_inbox_once(
    inbox_dir: Path,
    archive_dir: Path,
    error_dir: Path,
) -> dict:
    inbox_dir.mkdir(parents=True, exist_ok=True)
    archive_dir.mkdir(parents=True, exist_ok=True)
    error_dir.mkdir(parents=True, exist_ok=True)

    csv_files = sorted(
        [path for path in inbox_dir.iterdir() if path.is_file() and path.suffix.lower() == ".csv"]
    )
    results = [process_ingestion_file(path, archive_dir, error_dir) for path in csv_files]
    return {
        "processed_files": len(csv_files),
        "results": results,
    }

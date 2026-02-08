from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import INGEST_ARCHIVE_DIR, INGEST_ERROR_DIR, INGEST_INBOX_DIR
from app.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.schemas.ingestion import (
    DealerOrderIn,
    IngestionResult,
    InventoryLevelIn,
    SalesHistoryIn,
)
from app.services.ingestion_service import (
    get_ingestion_run,
    ingest_dealer_orders,
    ingest_inventory_levels,
    ingest_sales_history,
    list_ingestion_runs,
    log_ingestion_run,
    parse_csv_content,
    process_ingestion_inbox_once,
    validate_rows,
)

router = APIRouter()


def _parse_upload_csv(file: UploadFile) -> list[dict]:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file name")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are supported")
    return parse_csv_content(file.file.read())


@router.get("/templates")
def ingestion_templates(user: User = Depends(require_admin)):
    return {
        "sales_history": ["sku_code", "region_name", "date", "quantity_sold", "revenue", "channel"],
        "inventory_levels": ["warehouse_code", "sku_code", "current_stock", "reorder_point", "max_capacity", "days_of_cover", "last_updated"],
        "dealer_orders": ["dealer_code", "sku_code", "quantity", "order_date", "status", "is_ai_suggested", "order_source", "savings_amount"],
        "scheduler": {
            "drop_folder": str(INGEST_INBOX_DIR),
            "file_prefix_rules": ["sales_history*.csv", "inventory_levels*.csv", "dealer_orders*.csv"],
        },
    }


@router.get("/runs")
def ingestion_runs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    entity: str | None = Query(default=None),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_ingestion_runs(db, limit=limit, offset=offset, entity=entity)


@router.get("/runs/{run_id}")
def ingestion_run_detail(
    run_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    run = get_ingestion_run(db, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingestion run not found")
    return run


@router.post("/run-now")
def run_ingestion_now(user: User = Depends(require_admin)):
    return process_ingestion_inbox_once(
        inbox_dir=Path(INGEST_INBOX_DIR),
        archive_dir=Path(INGEST_ARCHIVE_DIR),
        error_dir=Path(INGEST_ERROR_DIR),
    )


@router.post("/sales-history/json", response_model=IngestionResult)
def ingest_sales_json(
    rows: list[SalesHistoryIn],
    dry_run: bool = Query(True),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = ingest_sales_history(db, rows, dry_run=dry_run)
    log_ingestion_run(
        entity="sales_history",
        source="manual_json",
        dry_run=dry_run,
        result=result,
        triggered_by_user_id=user.id,
    )
    return result


@router.post("/sales-history/csv", response_model=IngestionResult)
def ingest_sales_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(True),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    raw_rows = _parse_upload_csv(file)
    rows, validation_errors = validate_rows(raw_rows, SalesHistoryIn)
    result = ingest_sales_history(db, rows, dry_run=dry_run)
    result.errors.extend(validation_errors)
    result.skipped += len(validation_errors)
    log_ingestion_run(
        entity="sales_history",
        source="manual_csv",
        dry_run=dry_run,
        result=result,
        filename=file.filename,
        triggered_by_user_id=user.id,
    )
    return result


@router.post("/inventory-levels/json", response_model=IngestionResult)
def ingest_inventory_json(
    rows: list[InventoryLevelIn],
    dry_run: bool = Query(True),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = ingest_inventory_levels(db, rows, dry_run=dry_run)
    log_ingestion_run(
        entity="inventory_levels",
        source="manual_json",
        dry_run=dry_run,
        result=result,
        triggered_by_user_id=user.id,
    )
    return result


@router.post("/inventory-levels/csv", response_model=IngestionResult)
def ingest_inventory_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(True),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    raw_rows = _parse_upload_csv(file)
    rows, validation_errors = validate_rows(raw_rows, InventoryLevelIn)
    result = ingest_inventory_levels(db, rows, dry_run=dry_run)
    result.errors.extend(validation_errors)
    result.skipped += len(validation_errors)
    log_ingestion_run(
        entity="inventory_levels",
        source="manual_csv",
        dry_run=dry_run,
        result=result,
        filename=file.filename,
        triggered_by_user_id=user.id,
    )
    return result


@router.post("/dealer-orders/json", response_model=IngestionResult)
def ingest_orders_json(
    rows: list[DealerOrderIn],
    dry_run: bool = Query(True),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = ingest_dealer_orders(db, rows, dry_run=dry_run)
    log_ingestion_run(
        entity="dealer_orders",
        source="manual_json",
        dry_run=dry_run,
        result=result,
        triggered_by_user_id=user.id,
    )
    return result


@router.post("/dealer-orders/csv", response_model=IngestionResult)
def ingest_orders_csv(
    file: UploadFile = File(...),
    dry_run: bool = Query(True),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    raw_rows = _parse_upload_csv(file)
    rows, validation_errors = validate_rows(raw_rows, DealerOrderIn)
    result = ingest_dealer_orders(db, rows, dry_run=dry_run)
    result.errors.extend(validation_errors)
    result.skipped += len(validation_errors)
    log_ingestion_run(
        entity="dealer_orders",
        source="manual_csv",
        dry_run=dry_run,
        result=result,
        filename=file.filename,
        triggered_by_user_id=user.id,
    )
    return result

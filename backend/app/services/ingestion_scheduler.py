import asyncio
from pathlib import Path

from app.config import INGEST_ARCHIVE_DIR, INGEST_ENABLED, INGEST_ERROR_DIR, INGEST_INBOX_DIR, INGEST_POLL_SECONDS
from app.services.ingestion_service import process_ingestion_inbox_once


async def ingestion_loop(stop_event: asyncio.Event):
    if not INGEST_ENABLED:
        print("Ingestion scheduler disabled (INGEST_ENABLED=false).")
        return

    inbox = Path(INGEST_INBOX_DIR)
    archive = Path(INGEST_ARCHIVE_DIR)
    error = Path(INGEST_ERROR_DIR)
    print(f"Ingestion scheduler active. Polling every {INGEST_POLL_SECONDS}s from {inbox}")

    while not stop_event.is_set():
        try:
            result = process_ingestion_inbox_once(
                inbox_dir=inbox,
                archive_dir=archive,
                error_dir=error,
            )
            processed_files = result.get("processed_files", 0)
            if processed_files:
                print(f"Ingestion scheduler processed {processed_files} file(s).")
        except Exception as exc:
            print(f"Warning: Scheduled ingestion loop failed: {exc}")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=max(5, INGEST_POLL_SECONDS))
        except asyncio.TimeoutError:
            continue

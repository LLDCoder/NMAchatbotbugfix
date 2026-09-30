import os

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


OCR_VL_URL = os.getenv("OCR_VL_URL", "http://ocr-cpu:8080").rstrip("/")
OCR_TIMEOUT = float(os.getenv("OCR_TIMEOUT_SECONDS", "300"))
OCR_MODEL_NAME = os.getenv("OCR_MODEL_NAME", "PP-OCRv4")
OCR_PROVIDER = os.getenv("OCR_PROVIDER", "PaddleOCR-CPU")


class LayoutParsingRequest(BaseModel):
    file: str = Field(min_length=1)
    fileType: int | None = Field(default=None, ge=0, le=1)
    # Keep the official PaddleOCR-VL request surface extensible without
    # requiring a release of this gateway for every pipeline option.
    model_config = {"extra": "allow"}


app = FastAPI(title="DSH OCR Gateway", version="0.1.0")


@app.get("/healthz")
async def healthz():
    return {
        "status": "ok",
        "provider": OCR_PROVIDER,
        "model": OCR_MODEL_NAME,
        "upstream": OCR_VL_URL,
    }


@app.get("/readyz")
async def readyz():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{OCR_VL_URL}/health")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"OCR unavailable: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=503,
            detail=f"OCR health check returned {response.status_code}",
        )
    return {
        "status": "ready",
        "provider": OCR_PROVIDER,
        "model": OCR_MODEL_NAME,
        "upstream": OCR_VL_URL,
    }


@app.post("/layout-parsing")
async def layout_parsing(payload: LayoutParsingRequest):
    body = payload.model_dump(by_alias=True, exclude_none=True)
    async with httpx.AsyncClient(timeout=OCR_TIMEOUT) as client:
        try:
            response = await client.post(f"{OCR_VL_URL}/layout-parsing", json=body)
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail=f"OCR unavailable: {exc}") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"OCR returned {response.status_code}: {response.text[:500]}")
    return response.json()

"""OCR endpoint — Ruhsat (Turkish vehicle registration) ve Kimlik (TC kimlik kartı / sürücü belgesi)
fotoğraflarından otomatik alan çıkarımı. Gemini 2.5 Pro Vision (via Emergent Universal Key) kullanır.
Kullanıcı çekincesi yok — partial OCR sonuçları da kabul edilir (alanlar Optional).
"""
import os
import json
import base64
import uuid
from typing import Optional, Literal
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from dotenv import load_dotenv

from auth import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv()

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
_ACCEPTED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


class RuhsatOCRResult(BaseModel):
    plaka: Optional[str] = ""
    marka: Optional[str] = ""
    model: Optional[str] = ""
    yil: Optional[str] = ""
    motor_no: Optional[str] = ""
    sasi_no: Optional[str] = ""
    ruhsat_tarihi: Optional[str] = ""
    renk: Optional[str] = ""
    yakit: Optional[str] = ""
    vites: Optional[str] = ""


class KimlikOCRResult(BaseModel):
    ad: Optional[str] = ""
    soyad: Optional[str] = ""
    tc_kimlik_no: Optional[str] = ""
    dogum_tarihi: Optional[str] = ""
    dogum_yeri: Optional[str] = ""


class OCRResponse(BaseModel):
    type: Literal["ruhsat", "kimlik"]
    data: dict
    raw_response: Optional[str] = None


_RUHSAT_PROMPT = """Bu görsel bir Türk araç tescil belgesidir (RUHSAT). Görseldeki bilgileri OKU ve aşağıdaki JSON şemasına EKSİKSİZ uy:

{
  "plaka": "tam plaka, örn: 34 ABC 1234 — varsa boşluksuz tek string",
  "marka": "araç markası, örn: BMW",
  "model": "araç modeli, örn: 320i",
  "yil": "model yılı, sadece 4 haneli sayı, örn: 2020",
  "motor_no": "motor numarası",
  "sasi_no": "şasi numarası (VIN)",
  "ruhsat_tarihi": "ruhsat tescil tarihi, YYYY-MM-DD formatında",
  "renk": "araç rengi",
  "yakit": "yakıt türü, örn: Benzin/Dizel/LPG/Hibrit/Elektrik",
  "vites": "şanzıman türü, örn: Manuel/Otomatik/Yarı-Otomatik"
}

KURALLAR:
- Sadece geçerli JSON döndür, başka HİÇBİR metin/açıklama ekleme.
- Okunmayan/belirsiz alanları boş string ("") bırak.
- Plaka boşluksuz veya boşluklu olabilir, kullanıcı her ikisini de okuyabilmeli.
- Tarihleri ISO 8601 formatına çevir (YYYY-MM-DD).
"""

_KIMLIK_PROMPT = """Bu görsel bir Türk kimlik kartı veya sürücü belgesidir. Görseldeki bilgileri OKU ve aşağıdaki JSON şemasına EKSİKSİZ uy:

{
  "ad": "kişinin adı (sadece ad, soyad değil)",
  "soyad": "kişinin soyadı",
  "tc_kimlik_no": "11 haneli TC kimlik numarası, sadece rakam",
  "dogum_tarihi": "doğum tarihi, YYYY-MM-DD formatında",
  "dogum_yeri": "doğum yeri (şehir/ilçe)"
}

KURALLAR:
- Sadece geçerli JSON döndür, başka HİÇBİR metin/açıklama ekleme.
- Okunmayan/belirsiz alanları boş string ("") bırak.
- TC kimlik no sadece rakam olmalı, harf/boşluk olmamalı.
"""


def _parse_json_response(text: str) -> dict:
    """LLM yanıtından JSON parse et — bazen ```json fence içinde gelir."""
    if not text:
        return {}
    s = text.strip()
    # Strip code fences
    if s.startswith("```"):
        s = s.split("```")[1] if "```" in s else s
        if s.startswith("json"):
            s = s[4:]
        s = s.strip("` \n")
    # En dıştaki { ... } bul
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end > start:
        s = s[start:end + 1]
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return {}


@router.post("/ocr", response_model=OCRResponse)
async def ocr_image(
    file: UploadFile = File(...),
    type: Literal["ruhsat", "kimlik"] = Form(...),
    current_user: dict = Depends(get_current_user),
):
    """Ruhsat veya kimlik fotoğrafından alan çıkarımı."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="OCR servisi yapılandırılmamış (LLM key eksik)")

    mime = (file.content_type or "").lower()
    if mime not in _ACCEPTED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz dosya türü ({mime}). JPG, PNG veya WebP gönderin.",
        )

    blob = await file.read()
    if len(blob) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Dosya çok büyük (max 10 MB).")
    if len(blob) < 1024:
        raise HTTPException(status_code=400, detail="Dosya çok küçük — geçerli bir görsel gönderin.")

    image_b64 = base64.b64encode(blob).decode("utf-8")
    image_content = ImageContent(image_base64=image_b64)

    prompt = _RUHSAT_PROMPT if type == "ruhsat" else _KIMLIK_PROMPT
    session_id = f"ocr-{type}-{uuid.uuid4().hex[:8]}"

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="Sen kesin ve sadık bir OCR asistanısın. Sadece istenen JSON'ı döndür.",
        ).with_model("gemini", "gemini-2.5-pro")

        response = await chat.send_message(UserMessage(
            text=prompt,
            file_contents=[image_content],
        ))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR çağrısı başarısız: {e}")

    raw = response if isinstance(response, str) else str(response)
    parsed = _parse_json_response(raw)

    # Validate against schema (drop unknown keys, keep partial)
    if type == "ruhsat":
        result = RuhsatOCRResult(**{k: parsed.get(k, "") for k in RuhsatOCRResult.model_fields}).model_dump()
    else:
        result = KimlikOCRResult(**{k: parsed.get(k, "") for k in KimlikOCRResult.model_fields}).model_dump()

    return OCRResponse(type=type, data=result, raw_response=raw[:500] if raw else None)

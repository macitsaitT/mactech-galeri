"""AI Render endpoint — Araç fotosunu Nano Banana (Gemini image gen) ile
dramatik stüdyo zeminli/sosyal-medya hazır görsele dönüştürür.
Image-to-image: input araç fotosu → reference olarak verilir, style preset prompt'a eklenir.
"""
import os
import base64
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from dotenv import load_dotenv

from auth import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv()

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
_ACCEPTED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_MAX_BYTES = 10 * 1024 * 1024


# ✅ Stil önayarları — kullanıcıya seçenek olarak sunulur
STYLE_PRESETS = {
    "studio_dark": (
        "Cinematic luxury showroom render. Place the SAME car (preserve exact body shape, "
        "color, plate, badges) on a glossy dark reflective floor. Add soft dramatic studio "
        "lighting from above-left, with a clean black-to-charcoal gradient background. "
        "Subtle volumetric haze, deep shadows, a few rim-light highlights along the body. "
        "Photoreal, ultra-detailed, 4K, automotive magazine quality."
    ),
    "dramatic_lighting": (
        "Hollywood-style dramatic automotive ad shot. Keep the SAME car identity (color, "
        "shape, plate, wheels), set against a moody dark backdrop with sharp warm rim "
        "lighting from one side and cool fill light from the other. High contrast, "
        "cinematic film-still quality, lens flare hints, mist, ultra detailed."
    ),
    "billboard": (
        "Premium roadside billboard composition. Place the SAME car (same color/details/"
        "plate) on a smooth modern street with bokeh city lights in the background at "
        "dusk. Wide format, magazine-cover aesthetic, vibrant yet professional colors, "
        "warm sunset glow on body panels, sharp focus on the car."
    ),
    "showroom": (
        "Professional automotive dealership showroom photograph. Place the SAME car "
        "(unchanged color, body, plate, wheels) on a clean polished tile floor under "
        "bright but soft warm dealership lighting. White/cream gradient background, "
        "subtle reflections, no other cars in frame, clean and inviting composition."
    ),
}

Style = Literal["studio_dark", "dramatic_lighting", "billboard", "showroom"]


class RenderResponse(BaseModel):
    image_base64: str  # data:image/png;base64,...
    mime_type: str = "image/png"


@router.post("/ai/render-car", response_model=RenderResponse)
async def render_car(
    file: UploadFile = File(...),
    style: Style = Form(...),
    extra: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Araç fotosunu seçilen stilde yeniden render et (image-to-image, Nano Banana)."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI Render servisi yapılandırılmamış (LLM key eksik)")

    mime = (file.content_type or "").lower()
    if mime not in _ACCEPTED_MIME:
        raise HTTPException(status_code=400, detail=f"Geçersiz dosya türü ({mime}). JPG, PNG veya WebP gönderin.")

    blob = await file.read()
    if len(blob) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Dosya çok büyük (max 10 MB).")
    if len(blob) < 1024:
        raise HTTPException(status_code=400, detail="Dosya çok küçük — geçerli bir görsel gönderin.")

    preset_prompt = STYLE_PRESETS.get(style)
    if not preset_prompt:
        raise HTTPException(status_code=400, detail=f"Bilinmeyen stil: {style}")

    full_prompt = preset_prompt + (
        "\n\nIMPORTANT: Keep the car identity 100% the same (same color, plate, wheels, "
        "body lines). Do not alter the vehicle itself — only the lighting and background."
    )
    if extra and extra.strip():
        full_prompt += f"\n\nAdditional direction: {extra.strip()[:300]}"

    image_b64 = base64.b64encode(blob).decode("utf-8")
    session_id = f"render-{style}-{uuid.uuid4().hex[:8]}"

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a premium automotive photo retoucher.",
        ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        msg = UserMessage(
            text=full_prompt,
            file_contents=[ImageContent(image_base64=image_b64)],
        )
        _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI render çağrısı başarısız: {e}")

    if not images:
        raise HTTPException(status_code=502, detail="Model görüntü üretmedi.")

    first = images[0]
    return RenderResponse(
        image_base64=first.get("data", ""),
        mime_type=first.get("mime_type", "image/png"),
    )

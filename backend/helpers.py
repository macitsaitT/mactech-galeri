from datetime import datetime, timezone
import uuid


def build_data_filter(current_user: dict, extra_filter: dict = None, include_deleted: bool = True) -> dict:
    org_id = current_user.get("org_id", current_user["user_id"])
    query = {"org_id": org_id}
    if not include_deleted:
        query["deleted"] = False
    if extra_filter:
        query.update(extra_filter)
    return query


async def log_activity(
    db,
    *,
    current_user: dict,
    action: str,
    entity_type: str,
    entity_id: str = "",
    entity_label: str = "",
    details: dict = None,
) -> None:
    """Yeni bir etkinlik (activity log) kaydı oluşturur.

    action: 'create' | 'update' | 'delete' | 'price_change' | 'status_change' | 'sale' vs.
    entity_type: 'car' | 'user' | 'transaction' | 'customer' | 'capital' | ...
    entity_label: gösterilecek kısa etiket (örn: plaka, kullanıcı adı).
    details: arbitrary dict (örn: {old: 100000, new: 120000, field: 'sale_price'}).
    """
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "org_id": current_user.get("org_id", current_user.get("user_id", "")),
            "user_id": current_user.get("user_id", ""),
            "user_name": current_user.get("company_name") or current_user.get("email", ""),
            "user_role": current_user.get("role", ""),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id or "",
            "entity_label": entity_label or "",
            "details": details or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.activity_logs.insert_one(doc)
    except Exception:
        # Log yazma başarısız olsa bile ana işlemi kesmesin.
        pass

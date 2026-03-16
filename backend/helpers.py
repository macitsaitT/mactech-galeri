def build_data_filter(current_user: dict, extra_filter: dict = None, include_deleted: bool = True) -> dict:
    org_id = current_user.get("org_id", current_user["user_id"])
    query = {"org_id": org_id}
    if not include_deleted:
        query["deleted"] = False
    if extra_filter:
        query.update(extra_filter)
    return query

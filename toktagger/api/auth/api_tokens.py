"""Personal API tokens that TokTagger issues to users for scripts."""

import hashlib
import secrets
import time
from typing import Any


from toktagger.api.crud.db import MongoDBClient
from toktagger.api.schemas import convert_to_objectid
from toktagger.api.schemas.auth import ApiTokenCreated, ApiTokenOut

API_TOKENS_COLLECTION = "api_tokens"
TOKEN_PREFIX = "tt_"
HINT_LENGTH = 4
LAST_USED_RESOLUTION_SECONDS = 60


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def is_api_token(token: str) -> bool:
    return token.startswith(TOKEN_PREFIX)


def _to_out(document: dict[str, Any]) -> ApiTokenOut:
    return ApiTokenOut.model_validate({**document, "_id": str(document["_id"])})


async def create_api_token(
    db_client: MongoDBClient, user_id: str, name: str, lifetime_seconds: float
) -> ApiTokenCreated:
    """Store a new token for a user and return it. Only its hash is stored."""
    token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    now = time.time()
    document = {
        "user_id": convert_to_objectid(user_id, "users"),
        "name": name,
        "token_hash": _hash(token),
        "hint": token[-HINT_LENGTH:],
        "created_at": now,
        "expires_at": now + lifetime_seconds,
        "last_used_at": None,
    }
    result = await db_client.db[API_TOKENS_COLLECTION].insert_one(document)
    created = _to_out({**document, "_id": result.inserted_id})
    return ApiTokenCreated(**created.model_dump(), token=token)


async def list_api_tokens(db_client: MongoDBClient, user_id: str) -> list[ApiTokenOut]:
    tokens = db_client.db[API_TOKENS_COLLECTION]
    await tokens.delete_many({"expires_at": {"$lt": time.time()}})
    documents = await tokens.find(
        {"user_id": convert_to_objectid(user_id, "users")}
    ).to_list()
    return sorted(
        (_to_out(document) for document in documents),
        key=lambda token: token.created_at,
        reverse=True,
    )


async def revoke_api_token(
    db_client: MongoDBClient, user_id: str, token_id: str
) -> bool:
    """Delete a token of the user. Return False when the user has no such token."""
    # delete_many, because Mongita's delete_one ignores every other field when _id is set.
    result = await db_client.db[API_TOKENS_COLLECTION].delete_many(
        {
            "_id": convert_to_objectid(token_id, "tokens"),
            "user_id": convert_to_objectid(user_id, "users"),
        }
    )
    return result.deleted_count == 1


async def revoke_all_api_tokens(db_client: MongoDBClient, user_id: str) -> None:
    await db_client.db[API_TOKENS_COLLECTION].delete_many(
        {"user_id": convert_to_objectid(user_id, "users")}
    )


async def authenticate_api_token(db_client: MongoDBClient, token: str) -> str | None:
    """Return the user ID that owns a token, or None when it is unknown or expired."""
    tokens = db_client.db[API_TOKENS_COLLECTION]
    document = await tokens.find_one({"token_hash": _hash(token)})
    now = time.time()
    if document is None or document["expires_at"] <= now:
        return None
    last_used_at = document.get("last_used_at")
    # Throttled so that a busy script does not write to the database on every request.
    if last_used_at is None or now - last_used_at >= LAST_USED_RESOLUTION_SECONDS:
        await tokens.update_one(
            {"_id": document["_id"]}, {"$set": {"last_used_at": now}}
        )
    return str(document["user_id"])

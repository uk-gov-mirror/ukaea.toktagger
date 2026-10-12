"""Browser sessions, each tied to a refresh token at the identity provider."""

import secrets
import time
from typing import Any

from toktagger.api import config
from toktagger.api.auth import oidc
from toktagger.api.crud.db import MongoDBClient

SESSIONS_COLLECTION = "sessions"


class SessionEndedError(Exception):
    """Raised when a session can no longer be used, so the user must sign in again."""


async def start_session(
    db_client: MongoDBClient,
    username: str,
    issuer: str,
    sub: str,
    token: dict[str, Any],
) -> str:
    """Store a new session for a signed-in user and return its id.

    Raises ValueError when the provider did not return a refresh token.
    """
    refresh_token = token.get("refresh_token")
    if not isinstance(refresh_token, str):
        raise ValueError("The identity provider returned no refresh token")
    sessions = db_client.db[SESSIONS_COLLECTION]
    now = time.time()
    idle_cutoff = now - config.settings.auth.session_idle_timeout_seconds
    await sessions.delete_many({"refreshed_at": {"$lt": idle_cutoff}})
    session_id = secrets.token_urlsafe(32)
    await sessions.insert_one(
        {
            "_id": session_id,
            "username": username,
            "issuer": issuer,
            "sub": sub,
            "refresh_token": refresh_token,
            "id_token": token.get("id_token"),
            "refreshed_at": now,
        }
    )
    return session_id


async def refresh_session(db_client: MongoDBClient, session_id: str) -> None:
    """Read the account from the provider again and update the local user from it.

    A lock shared by all workers serialises the refresh, because the provider can
    revoke a refresh token once it is used. A request that waited for the lock
    finds the session already refreshed and returns.

    Raises SessionEndedError when the session is unknown or the provider ends it.
    """
    sessions = db_client.db[SESSIONS_COLLECTION]
    async with db_client.lock(f"sessions:{session_id}"):
        session = await sessions.find_one({"_id": session_id})
        if session is None:
            raise SessionEndedError("Session ended. Sign in again.")
        if (
            time.time() - session["refreshed_at"]
            < config.settings.auth.session_refresh_seconds
        ):
            return

        idp = oidc.get_idp()
        try:
            token = await idp.fetch_access_token(
                grant_type="refresh_token", refresh_token=session["refresh_token"]
            )
        except oidc.OAuthError as exc:
            await sessions.delete_one({"_id": session_id})
            raise SessionEndedError(
                "The identity provider ended the session. Sign in again."
            ) from exc
        # Saved before userinfo, so a failure there does not lose a rotated refresh token.
        await sessions.update_one(
            {"_id": session_id},
            {
                "$set": {
                    "refresh_token": token.get(
                        "refresh_token", session["refresh_token"]
                    ),
                    "id_token": token.get("id_token", session["id_token"]),
                }
            },
        )

        claims = dict(await idp.userinfo(token=token))
        if claims.get("sub") != session["sub"]:
            await sessions.delete_one({"_id": session_id})
            raise SessionEndedError(
                "The identity provider returned a different account. Sign in again."
            )
        user = await oidc.provision_user(db_client, session["issuer"], claims)
        if user.username != session["username"]:
            await sessions.delete_one({"_id": session_id})
            raise SessionEndedError("Session ended. Sign in again.")
        await sessions.update_one(
            {"_id": session_id}, {"$set": {"refreshed_at": time.time()}}
        )


async def end_session(db_client: MongoDBClient, session_id: str) -> str | None:
    """Remove a session and return its provider ID token, for the sign-out hint."""
    sessions = db_client.db[SESSIONS_COLLECTION]
    session = await sessions.find_one({"_id": session_id})
    await sessions.delete_one({"_id": session_id})
    return session.get("id_token") if session else None

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AuthConfig(BaseModel):
    provider: Literal["canaille", "oidc"]
    account_url: str | None = None


class LogoutResponse(BaseModel):
    logout_url: str | None = None


class ApiTokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    expires_in_days: int = Field(30, gt=0)


class ApiTokenOut(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    id: str = Field(..., alias="_id")
    name: str
    hint: str = Field(..., description="Last characters of the token.")
    created_at: datetime
    expires_at: datetime
    last_used_at: datetime | None = None


class ApiTokenCreated(ApiTokenOut):
    token: str = Field(..., description="The token. The server shows it one time only.")

"""
MongoDB 모델 정의
"""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from bson import ObjectId

class PyObjectId(ObjectId):
    """MongoDB ObjectId를 위한 커스텀 타입"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

class User(BaseModel):
    """사용자 모델"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    google_id: Optional[str] = None
    email: str
    name: str
    profile_image: Optional[str] = None
    wallet_address: Optional[str] = None
    wallet_created: bool = False
    wallet_password: Optional[str] = None
    welcome_bonus_given: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Wallet(BaseModel):
    """지갑 모델"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    address: str
    private_key: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Transaction(BaseModel):
    """트랜잭션 모델"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    wallet_address: str
    transaction_hash: str
    transaction_type: str  # "welcome_bonus", "stake", "unstake", "claim_rewards"
    amount: str
    status: str = "pending"  # "pending", "confirmed", "failed"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class TokenBalance(BaseModel):
    """토큰 잔액 모델"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    wallet_address: str
    balance: str
    staked_amount: str
    pending_rewards: str
    is_staking_active: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

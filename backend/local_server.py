from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import os
from datetime import datetime, timedelta
import jwt
import hashlib
import secrets
from web3 import Web3
import json

# FastAPI 앱 생성
app = FastAPI(title="소셜 지갑 API (로컬)", version="1.0.0")

# CORS 설정 (React와 연동을 위해)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React 개발 서버
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Web3 설정 (로컬에서는 시뮬레이션)
WEB3_PROVIDER = os.getenv("WEB3_PROVIDER", "https://sepolia.infura.io/v3/YOUR_INFURA_KEY")
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))

# 스마트 컨트랙트 설정
CONTRACT_ADDRESS = "0xf327d45c12abc5b9fbe963989f9acc7fa3bd6c60"
CONTRACT_ABI = [
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "to", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "to", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "transfer",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "stake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "claimRewards",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getStakeInfo",
        "outputs": [
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"internalType": "uint256", "name": "lastClaimTime", "type": "uint256"},
            {"internalType": "bool", "name": "isActive", "type": "bool"},
            {"internalType": "uint256", "name": "pendingReward", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# 메모리 저장소 (로컬 개발용)
users_db: Dict[str, Dict] = {}
wallets_db: Dict[str, Dict] = {}

# Pydantic 모델들
class SocialLoginRequest(BaseModel):
    provider: str  # "google" or "kakao"
    social_id: str
    email: str
    name: str
    profile_image: Optional[str] = None

class TokenBalance(BaseModel):
    balance: str
    staked_amount: str
    pending_rewards: str
    is_staking_active: bool

class MintRequest(BaseModel):
    amount: int

class TransferRequest(BaseModel):
    to_address: str
    amount: int

class StakeRequest(BaseModel):
    amount: int

# JWT 토큰 생성
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# JWT 토큰 검증
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# 지갑 생성 함수
def generate_wallet_from_social(social_id: str, email: str, name: str) -> Dict[str, str]:
    """소셜 계정 정보를 기반으로 결정론적 지갑 생성"""
    # 소셜 계정 정보를 기반으로 시드 생성
    seed_string = f"{social_id}_{email}_{name}"
    seed_hash = hashlib.sha256(seed_string.encode()).hexdigest()
    
    # 시드로부터 지갑 생성
    account = w3.eth.account.from_key(seed_hash)
    
    return {
        "address": account.address,
        "private_key": account.key.hex(),
        "seed": seed_hash
    }

# 스마트 컨트랙트 인스턴스 생성
def get_contract():
    return w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)

# API 엔드포인트들

@app.get("/")
async def root():
    return {"message": "소셜 지갑 API 서버가 실행 중입니다! (로컬 개발 모드)"}

@app.post("/auth/social-login")
async def social_login(request: SocialLoginRequest):
    """소셜 로그인 처리 및 지갑 생성"""
    try:
        # 기존 사용자 확인
        user_key = f"{request.provider}_{request.social_id}"
        
        if user_key in users_db:
            # 기존 사용자 - 지갑 정보 반환
            user = users_db[user_key]
            wallet = wallets_db[user["wallet_id"]]
            
            access_token = create_access_token(data={"sub": user_key})
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": user_key,
                    "provider": request.provider,
                    "email": request.email,
                    "name": request.name,
                    "profile_image": request.profile_image
                },
                "wallet": {
                    "address": wallet["address"],
                    "created_at": wallet["created_at"]
                }
            }
        else:
            # 새 사용자 - 지갑 생성
            wallet_info = generate_wallet_from_social(
                request.social_id, 
                request.email, 
                request.name
            )
            
            # 사용자 정보 저장
            user_id = f"{request.provider}_{request.social_id}"
            wallet_id = f"wallet_{secrets.token_hex(16)}"
            
            users_db[user_id] = {
                "id": user_id,
                "provider": request.provider,
                "social_id": request.social_id,
                "email": request.email,
                "name": request.name,
                "profile_image": request.profile_image,
                "wallet_id": wallet_id,
                "created_at": datetime.utcnow()
            }
            
            wallets_db[wallet_id] = {
                "id": wallet_id,
                "address": wallet_info["address"],
                "private_key": wallet_info["private_key"],
                "social_provider": request.provider,
                "social_id": request.social_id,
                "created_at": datetime.utcnow()
            }
            
            access_token = create_access_token(data={"sub": user_id})
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": user_id,
                    "provider": request.provider,
                    "email": request.email,
                    "name": request.name,
                    "profile_image": request.profile_image
                },
                "wallet": {
                    "address": wallet_info["address"],
                    "created_at": datetime.utcnow()
                }
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그인 처리 중 오류 발생: {str(e)}")

@app.get("/wallet/balance")
async def get_wallet_balance(user_id: str = Depends(verify_token)):
    """지갑 잔액 조회 (로컬 시뮬레이션)"""
    try:
        # 사용자 정보 조회
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        wallet = wallets_db.get(user["wallet_id"])
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        # 로컬에서는 시뮬레이션 데이터 반환
        return TokenBalance(
            balance="1000000",  # 1000 ART (5 decimals)
            staked_amount="500000",  # 500 ART
            pending_rewards="50000",  # 50 ART
            is_staking_active=True
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"잔액 조회 중 오류 발생: {str(e)}")

@app.post("/wallet/mint")
async def mint_tokens(request: MintRequest, user_id: str = Depends(verify_token)):
    """토큰 발행 (로컬 시뮬레이션)"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        return {
            "message": f"{request.amount} 토큰이 발행되었습니다 (로컬 시뮬레이션)",
            "transaction_hash": "0x" + secrets.token_hex(32)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"토큰 발행 중 오류 발생: {str(e)}")

@app.post("/wallet/transfer")
async def transfer_tokens(request: TransferRequest, user_id: str = Depends(verify_token)):
    """토큰 전송 (로컬 시뮬레이션)"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        return {
            "message": f"{request.amount} 토큰이 전송되었습니다 (로컬 시뮬레이션)",
            "transaction_hash": "0x" + secrets.token_hex(32)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"토큰 전송 중 오류 발생: {str(e)}")

@app.post("/wallet/stake")
async def stake_tokens(request: StakeRequest, user_id: str = Depends(verify_token)):
    """토큰 스테이킹 (로컬 시뮬레이션)"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        return {
            "message": f"{request.amount} 토큰이 스테이킹되었습니다 (로컬 시뮬레이션)",
            "transaction_hash": "0x" + secrets.token_hex(32)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스테이킹 중 오류 발생: {str(e)}")

@app.post("/wallet/claim-rewards")
async def claim_rewards(user_id: str = Depends(verify_token)):
    """보상 청구 (로컬 시뮬레이션)"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        return {
            "message": "보상이 청구되었습니다 (로컬 시뮬레이션)",
            "transaction_hash": "0x" + secrets.token_hex(32)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보상 청구 중 오류 발생: {str(e)}")

@app.get("/wallet/info")
async def get_wallet_info(user_id: str = Depends(verify_token)):
    """지갑 정보 조회"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        wallet = wallets_db.get(user["wallet_id"])
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        return {
            "user": user,
            "wallet": {
                "address": wallet["address"],
                "created_at": wallet["created_at"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지갑 정보 조회 중 오류 발생: {str(e)}")

if __name__ == "__main__":
    print("🚀 로컬 개발 서버 시작...")
    print("📱 프론트엔드: http://localhost:3000")
    print("🔧 백엔드 API: http://localhost:8000")
    print("📖 API 문서: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
from datetime import datetime, timedelta
import jwt
import hashlib
import secrets
from web3 import Web3
import json
from google.auth.transport import requests
from google.oauth2 import id_token
from database import get_mongodb_database, test_connection

# FastAPI 앱 생성
app = FastAPI(title="소셜 지갑 API", version="1.0.0")

# CORS 설정 (모든 오리진 허용 - 서버리스 환경)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 서버리스에서는 모든 오리진 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Web3 설정 (서버리스 환경에서는 환경변수 사용)
WEB3_PROVIDER = os.getenv("WEB3_PROVIDER", "https://sepolia.infura.io/v3/YOUR_INFURA_KEY")
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))

# 스마트 컨트랙트 설정
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x96850830c5c5c62A151Cc41f14558F76ab2Bb55f")
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

# MongoDB 데이터베이스 연결
db = get_mongodb_database()

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
    return {"message": "소셜 지갑 API 서버가 실행 중입니다!"}

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
    """지갑 잔액 조회"""
    try:
        # 사용자 정보 조회 (MongoDB)
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 지갑 정보 조회 (MongoDB)
        wallet = db.wallets.find_one({"user_id": user_id})
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        # 스마트 컨트랙트에서 잔액 조회
        contract = get_contract()
        balance = contract.functions.balanceOf(wallet["address"]).call()
        stake_info = contract.functions.getStakeInfo(wallet["address"]).call()
        
        return TokenBalance(
            balance=str(balance),
            staked_amount=str(stake_info[0]),
            pending_rewards=str(stake_info[4]),
            is_staking_active=stake_info[3]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"잔액 조회 중 오류 발생: {str(e)}")

@app.post("/wallet/mint")
async def mint_tokens(request: MintRequest, user_id: str = Depends(verify_token)):
    """토큰 발행 (소유자만 가능)"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        wallet = wallets_db.get(user["wallet_id"])
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        # 실제로는 컨트랙트 소유자만 발행 가능
        # 여기서는 시뮬레이션
        return {
            "message": f"{request.amount} 토큰이 발행되었습니다",
            "transaction_hash": "0x" + secrets.token_hex(32)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"토큰 발행 중 오류 발생: {str(e)}")

@app.post("/wallet/transfer")
async def transfer_tokens(request: TransferRequest, user_id: str = Depends(verify_token)):
    """토큰 전송"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        wallet = wallets_db.get(user["wallet_id"])
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        # 실제 트랜잭션 실행
        contract = get_contract()
        amount_wei = w3.to_wei(request.amount, 'ether')
        
        # 트랜잭션 생성
        transaction = contract.functions.transfer(request.to_address, amount_wei).build_transaction({
            'from': wallet["address"],
            'gas': 100000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(wallet["address"]),
        })
        
        # 트랜잭션 서명
        signed_txn = w3.eth.account.sign_transaction(transaction, wallet["private_key"])
        
        # 트랜잭션 전송
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        return {
            "message": f"{request.amount} 토큰이 전송되었습니다",
            "transaction_hash": tx_hash.hex()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"토큰 전송 중 오류 발생: {str(e)}")

@app.post("/wallet/stake")
async def stake_tokens(request: StakeRequest, user_id: str = Depends(verify_token)):
    """토큰 스테이킹"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        wallet = wallets_db.get(user["wallet_id"])
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        # 실제 트랜잭션 실행
        contract = get_contract()
        amount_wei = w3.to_wei(request.amount, 'ether')
        
        # 트랜잭션 생성
        transaction = contract.functions.stake(amount_wei).build_transaction({
            'from': wallet["address"],
            'gas': 300000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(wallet["address"]),
        })
        
        # 트랜잭션 서명
        signed_txn = w3.eth.account.sign_transaction(transaction, wallet["private_key"])
        
        # 트랜잭션 전송
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        return {
            "message": f"{request.amount} 토큰이 스테이킹되었습니다",
            "transaction_hash": tx_hash.hex()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스테이킹 중 오류 발생: {str(e)}")

@app.post("/wallet/claim-rewards")
async def claim_rewards(user_id: str = Depends(verify_token)):
    """보상 청구"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        wallet = wallets_db.get(user["wallet_id"])
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        # 실제 트랜잭션 실행
        contract = get_contract()
        
        # 트랜잭션 생성
        transaction = contract.functions.claimRewards().build_transaction({
            'from': wallet["address"],
            'gas': 200000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(wallet["address"]),
        })
        
        # 트랜잭션 서명
        signed_txn = w3.eth.account.sign_transaction(transaction, wallet["private_key"])
        
        # 트랜잭션 전송
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        return {
            "message": "보상이 청구되었습니다",
            "transaction_hash": tx_hash.hex()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보상 청구 중 오류 발생: {str(e)}")

class WelcomeBonusRequest(BaseModel):
    address: str

@app.post("/wallet/welcome-bonus")
async def give_welcome_bonus(request: WelcomeBonusRequest, user_id: str = Depends(verify_token)):
    """클라이언트에서 요청한 환영 보너스 지급"""
    try:
        # 사용자 정보 조회
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 중복 지급 방지
        if user.get("welcome_bonus_given", False):
            return {"success": False, "message": "이미 환영 보너스를 받았습니다"}
        
        # 환영 보너스 지급
        result = await give_deterministic_welcome_bonus(request.address, user_id)
        
        # 환영 보너스 지급 완료 표시
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"welcome_bonus_given": True, "updated_at": datetime.now()}}
        )
        
        return {"success": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"환영 보너스 지급 실패: {str(e)}")

async def give_deterministic_welcome_bonus(user_address, user_id=None):
    """결정론적 지갑 사용자 환영 보너스 (ART 토큰 직접 발행)"""
    try:
        # 중복 지급 방지
        if user_id:
            from bson import ObjectId
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if user and user.get("welcome_bonus_given", False):
                return {"message": "이미 환영 보너스를 받았습니다", "already_received": True}
        
        # ART 토큰 컨트랙트 ABI (mintTo 함수 포함)
        contract_abi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"}
                ],
                "name": "mintTo",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
        
        # 환경 변수에서 프로젝트 지갑 정보 가져오기
        PROJECT_WALLET_ADDRESS = os.getenv("PROJECT_WALLET_ADDRESS")
        PROJECT_PRIVATE_KEY = os.getenv("PROJECT_PRIVATE_KEY")
        
        if not PROJECT_WALLET_ADDRESS or not PROJECT_PRIVATE_KEY:
            raise HTTPException(status_code=500, detail="프로젝트 지갑 정보가 설정되지 않았습니다")
        
        # 컨트랙트 인스턴스 생성
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
        
        # mintTo 함수 호출 트랜잭션 생성
        mint_amount = 100 * 10**5  # 100 ART 토큰 (5자리 소수점)
        
        # 가스 가격과 논스 가져오기
        gas_price = w3.eth.gas_price
        nonce = w3.eth.get_transaction_count(PROJECT_WALLET_ADDRESS)
        
        # 가스 한도 추정
        try:
            estimated_gas = contract.functions.mintTo(user_address, mint_amount).estimate_gas({
                'from': PROJECT_WALLET_ADDRESS
            })
            gas_limit = int(estimated_gas * 1.2)
        except Exception:
            gas_limit = 200000  # 기본값
        
        transaction = contract.functions.mintTo(
            user_address,
            mint_amount
        ).build_transaction({
            'from': PROJECT_WALLET_ADDRESS,
            'gas': gas_limit,
            'gasPrice': gas_price,
            'nonce': nonce,
        })
        
        # 트랜잭션 서명 및 전송
        signed_txn = w3.eth.account.sign_transaction(transaction, PROJECT_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        # 트랜잭션 완료 대기
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if tx_receipt.status != 1:
            raise HTTPException(status_code=500, detail="트랜잭션 실패")
        
        # 트랜잭션 정보를 MongoDB에 저장
        if user_id:
            from bson import ObjectId
            transaction_data = {
                "user_id": ObjectId(user_id),
                "wallet_address": user_address,
                "transaction_hash": tx_hash.hex(),
                "transaction_type": "welcome_bonus",
                "amount": "100",
                "status": "completed",
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            db.transactions.insert_one(transaction_data)
        
        return {
            "message": "ART 토큰 환영 보너스가 발행되었습니다",
            "transaction_hash": tx_hash.hex(),
            "bonus_amount": "100",
            "token_amount": str(mint_amount),
            "wallet_address": user_address,
            "method": "direct_mint"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ART 토큰 발행 실패: {str(e)}")

@app.get("/wallet/info")
async def get_wallet_info(user_id: str = Depends(verify_token)):
    """지갑 정보 조회"""
    try:
        # 사용자 정보 조회 (MongoDB)
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 지갑 정보 조회 (MongoDB)
        wallet = db.wallets.find_one({"user_id": user_id})
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        return {
            "user": {
                "id": str(user["_id"]),
                "email": user["email"],
                "name": user["name"],
                "created_at": user["created_at"]
            },
            "wallet": {
                "address": wallet["address"],
                "private_key": wallet["private_key"],
                "created_at": wallet["created_at"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지갑 정보 조회 중 오류 발생: {str(e)}")

# Google OAuth 처리
class GoogleTokenRequest(BaseModel):
    token: str

@app.post("/auth/google")
async def google_auth(request: GoogleTokenRequest):
    """Google OAuth 토큰 검증 및 사용자 생성"""
    try:
        # Google ID 토큰 검증
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google OAuth 설정이 필요합니다")
        
        # ID 토큰 검증
        idinfo = id_token.verify_oauth2_token(
            request.token, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # 사용자 정보 추출
        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', email.split('@')[0])
        
        # 기존 사용자 확인 (MongoDB)
        existing_user = db.users.find_one({"google_id": google_id})
        
        if existing_user:
            # 기존 사용자 로그인
            access_token = create_access_token(data={"sub": str(existing_user["_id"])})
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": str(existing_user["_id"]),
                    "google_id": existing_user["google_id"],
                    "email": existing_user["email"],
                    "name": existing_user["name"],
                    "wallet_id": existing_user.get("wallet_id"),
                    "created_at": existing_user["created_at"]
                },
                "is_new_user": False
            }
        else:
            # 새 사용자 생성
            user_id = f"user_{secrets.token_hex(8)}"
            
            # 새 지갑 생성
            account = w3.eth.account.create()
            wallet_id = f"wallet_{secrets.token_hex(8)}"
            
            # 지갑 정보를 MongoDB에 저장
            wallet_data = {
                "user_id": user_id,
                "address": account.address,
                "private_key": account.key.hex(),
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            wallet_result = db.wallets.insert_one(wallet_data)
            
            # 새 사용자 생성
            user_data = {
                "google_id": google_id,
                "email": email,
                "name": name,
                "wallet_id": wallet_id,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            user_result = db.users.insert_one(user_data)
            
            # JWT 토큰 생성
            access_token = create_access_token(data={"sub": str(user_result.inserted_id)})
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": str(user_result.inserted_id),
                    "google_id": google_id,
                    "email": email,
                    "name": name,
                    "wallet_id": wallet_id,
                    "created_at": datetime.now().isoformat()
                },
                "is_new_user": True
            }
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 Google 토큰: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google 인증 중 오류 발생: {str(e)}")

# Vercel 서버리스 함수 핸들러
handler = app

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
import httpx
import logging
import traceback

# .env 파일 로드 (로컬 개발용)
try:
    from dotenv import load_dotenv
    load_dotenv()
    logger_temp = logging.getLogger(__name__)
    logger_temp.info("✅ .env 파일 로드 성공 (로컬 모드)")
except ImportError:
    # dotenv가 없으면 환경변수만 사용 (프로덕션)
    pass

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Render 환경에서는 절대 경로, 로컬에서는 상대 경로
try:
    from .database import get_mongodb_database, test_connection
except ImportError:
    from database import get_mongodb_database, test_connection

# FastAPI 앱 생성
app = FastAPI(
    title="소셜 지갑 API", 
    version="1.0.0"
)

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

class MetaTransferRequest(BaseModel):
    intent: Dict[str, Any]  # {from, to, amount, nonce, deadline}
    signature: str

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

# /auth/social-login 엔드포인트 삭제됨 (사용 안함)
# 대신 /auth/google/callback 또는 /auth/password 사용

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

# /wallet/mint, /wallet/transfer 엔드포인트 삭제됨 (메타 트랜잭션 사용)

@app.post("/wallet/relay-transfer")
async def relay_transfer(request: MetaTransferRequest, user_id: str = Depends(verify_token)):
    """메타 트랜잭션 릴레이 - 사용자 서명을 검증하고 프로젝트 지갑으로 가스비 부담"""
    try:
        logger.info(f"=== 메타 트랜잭션 릴레이 시작 ===")
        logger.info(f"Intent: {request.intent}")
        
        # 1. 사용자 정보 조회
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 2. 사용자 지갑 주소 확인
        user_wallet_address = user.get("wallet_address")
        if not user_wallet_address:
            raise HTTPException(status_code=404, detail="지갑 주소를 찾을 수 없습니다")
        
        # 3. intent의 from 주소와 사용자 지갑 주소 일치 확인
        if request.intent['from'].lower() != user_wallet_address.lower():
            raise HTTPException(status_code=403, detail="지갑 주소가 일치하지 않습니다")
        
        # 4. 만료 시간 확인
        import time
        if request.intent['deadline'] < time.time():
            raise HTTPException(status_code=400, detail="트랜잭션이 만료되었습니다")
        
        # 5. 메시지 해시 재생성
        from eth_account.messages import encode_defunct
        
        message_hash = w3.solidityKeccak(
            ['address', 'address', 'uint256', 'uint256', 'uint256'],
            [
                w3.toChecksumAddress(request.intent['from']),
                w3.toChecksumAddress(request.intent['to']),
                int(request.intent['amount']),
                int(request.intent['nonce']),
                int(request.intent['deadline'])
            ]
        )
        
        logger.info(f"생성된 메시지 해시: {message_hash.hex()}")
        
        # 6. 서명 검증
        try:
            message = encode_defunct(hexstr=message_hash.hex())
            recovered_address = w3.eth.account.recover_message(message, signature=request.signature)
            logger.info(f"복구된 주소: {recovered_address}")
            logger.info(f"기대 주소: {request.intent['from']}")
            
            if recovered_address.lower() != request.intent['from'].lower():
                raise HTTPException(status_code=400, detail="잘못된 서명입니다")
                
            logger.info("✅ 서명 검증 성공!")
        except Exception as sig_error:
            logger.error(f"서명 검증 실패: {str(sig_error)}")
            raise HTTPException(status_code=400, detail=f"서명 검증 실패: {str(sig_error)}")
        
        # 7. 프로젝트 지갑 설정 확인
        PROJECT_PRIVATE_KEY = os.getenv("PROJECT_PRIVATE_KEY")
        PROJECT_WALLET_ADDRESS = os.getenv("PROJECT_WALLET_ADDRESS")
        
        if not PROJECT_PRIVATE_KEY or not PROJECT_WALLET_ADDRESS:
            raise HTTPException(
                status_code=500, 
                detail="프로젝트 지갑이 설정되지 않았습니다. 환경변수를 확인해주세요."
            )
        
        logger.info(f"프로젝트 지갑: {PROJECT_WALLET_ADDRESS}")
        
        # 8. 스마트 컨트랙트 트랜잭션 생성
        contract = get_contract()
        
        # ART 토큰은 5자리 소수점 사용
        amount_in_wei = int(request.intent['amount']) * (10 ** 5)
        
        # transferFrom 방식으로 전송 (사용자가 approve 해야 함)
        # 또는 우리가 직접 transfer 호출 (사용자 서명 첨부)
        # 현재는 일반 transfer를 사용하되, 서명 검증은 서버에서 완료
        
        transaction = contract.functions.transfer(
            w3.toChecksumAddress(request.intent['to']),
            amount_in_wei
        ).build_transaction({
            'from': w3.toChecksumAddress(request.intent['from']),
            'gas': 150000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(w3.toChecksumAddress(request.intent['from']))
        })
        
        logger.info(f"트랜잭션 생성 완료: {transaction}")
        
        # 9. 사용자 지갑으로 서명 (메타 트랜잭션)
        # 사용자의 private key로 서명
        # 주의: 현재는 서버가 private key를 생성할 수 있으므로 가능
        user_password = user.get("wallet_password")
        if not user_password:
            raise HTTPException(status_code=500, detail="지갑 비밀번호를 찾을 수 없습니다")
        
        # 결정론적 private key 재생성
        seed_string = f"{user_id}_{user_password}"
        seed_hash = w3.keccak(text=seed_string)
        user_private_key = '0x' + seed_hash.hex()[:64]
        
        logger.info("사용자 private key 재생성 완료")
        
        # 10. 트랜잭션 서명 및 전송
        signed_txn = w3.eth.account.sign_transaction(transaction, user_private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        logger.info(f"✅ 트랜잭션 전송 성공: {tx_hash.hex()}")
        
        return {
            "success": True,
            "message": f"{request.intent['amount']} ART 토큰이 전송되었습니다",
            "transaction_hash": tx_hash.hex()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메타 트랜잭션 릴레이 오류: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"메타 트랜잭션 실행 중 오류: {str(e)}")

@app.post("/wallet/stake")
async def stake_tokens(request: StakeRequest, user_id: str = Depends(verify_token)):
    """토큰 스테이킹"""
    try:
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        user_wallet_address = user.get("wallet_address")
        user_password = user.get("wallet_password")
        if not user_wallet_address or not user_password:
            raise HTTPException(status_code=404, detail="지갑 정보를 찾을 수 없습니다")
        
        # 결정론적 private key 재생성
        seed_string = f"{user_id}_{user_password}"
        seed_hash = w3.keccak(text=seed_string)
        user_private_key = '0x' + seed_hash.hex()[:64]
        
        # 실제 트랜잭션 실행
        contract = get_contract()
        amount_wei = int(request.amount) * (10 ** 5)  # ART 토큰 5자리 소수점
        
        # 트랜잭션 생성
        transaction = contract.functions.stake(amount_wei).build_transaction({
            'from': user_wallet_address,
            'gas': 300000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(user_wallet_address),
        })
        
        # 트랜잭션 서명
        signed_txn = w3.eth.account.sign_transaction(transaction, user_private_key)
        
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
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        user_wallet_address = user.get("wallet_address")
        user_password = user.get("wallet_password")
        if not user_wallet_address or not user_password:
            raise HTTPException(status_code=404, detail="지갑 정보를 찾을 수 없습니다")
        
        # 결정론적 private key 재생성
        seed_string = f"{user_id}_{user_password}"
        seed_hash = w3.keccak(text=seed_string)
        user_private_key = '0x' + seed_hash.hex()[:64]
        
        # 실제 트랜잭션 실행
        contract = get_contract()
        
        # 트랜잭션 생성
        transaction = contract.functions.claimRewards().build_transaction({
            'from': user_wallet_address,
            'gas': 200000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(user_wallet_address),
        })
        
        # 트랜잭션 서명
        signed_txn = w3.eth.account.sign_transaction(transaction, user_private_key)
        
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

class UserSettingsRequest(BaseModel):
    show_wallet_public: bool

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
class GoogleCodeRequest(BaseModel):
    code: str

class PasswordLoginRequest(BaseModel):
    social_id: str
    password: str
    wallet_address: str = None  # 지갑 주소 (선택사항)

@app.post("/auth/google/callback")
async def google_oauth_callback(request: GoogleCodeRequest):
    """Google OAuth 2.0 Authorization Code를 처리"""
    try:
        logger.info("=== Google OAuth Callback 시작 ===")
        logger.info(f"받은 code: {request.code[:20]}...")
        
        # Google Token Endpoint로 code 교환
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
        GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
        
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            logger.error("Google OAuth 설정 누락")
            raise HTTPException(status_code=500, detail="Google OAuth 설정이 필요합니다")
        
        # 토큰 요청
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": request.code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": os.getenv("FRONTEND_URL", "https://blockchainproject-frontend.onrender.com") + "/login",
            "grant_type": "authorization_code"
        }
        
        logger.info("Google에 access_token 요청 중...")
        token_response = httpx.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            logger.error(f"토큰 요청 실패: {token_response.text}")
            raise HTTPException(status_code=400, detail="Google 토큰 요청 실패")
        
        tokens = token_response.json()
        id_token_str = tokens.get("id_token")
        
        logger.info("Google ID token 받음")
        
        # ID 토큰 검증 및 사용자 정보 추출
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', email.split('@')[0])
        logger.info(f"사용자 정보: {email}")
        
        # 기존 사용자 확인
        existing_user = db.users.find_one({"google_id": google_id})
        
        if existing_user:
            logger.info("기존 사용자 로그인")
            jwt_token = create_access_token(data={"sub": str(existing_user["_id"])})
            return {
                "access_token": jwt_token,
                "token_type": "bearer",
                "user": {
                    "id": str(existing_user["_id"]),
                    "google_id": existing_user["google_id"],
                    "email": existing_user["email"],
                    "name": existing_user["name"],
                    "wallet_created": existing_user.get("wallet_created", False)
                },
                "is_new_user": False
            }
        else:
            logger.info("신규 사용자 생성")
            # 새 사용자 생성
            new_user = {
                "google_id": google_id,
                "email": email,
                "name": name,
                "wallet_created": False,
                "created_at": datetime.utcnow()
            }
            
            result = db.users.insert_one(new_user)
            logger.info(f"사용자 생성 완료: {result.inserted_id}")
            
            jwt_token = create_access_token(data={"sub": str(result.inserted_id)})
            return {
                "access_token": jwt_token,
                "token_type": "bearer",
                "user": {
                    "id": str(result.inserted_id),
                    "google_id": google_id,
                    "email": email,
                    "name": name,
                    "wallet_created": False
                },
                "is_new_user": True
            }
            
    except Exception as e:
        logger.error(f"OAuth callback 오류: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"OAuth 처리 중 오류: {str(e)}")

@app.post("/auth/password")
async def password_auth(request: PasswordLoginRequest):
    """비밀번호 기반 인증 (한 소셜 아이디당 하나의 지갑만 허용)"""
    try:
        logger.info(f"=== Password Auth 시작: social_id={request.social_id} ===")
        
        # social_id로 사용자 조회 (MongoDB)
        from bson import ObjectId
        
        user = None
        try:
            # 먼저 ObjectId로 검색 시도
            if len(request.social_id) == 24:  # ObjectId 길이 체크
                user = db.users.find_one({"_id": ObjectId(request.social_id)})
                logger.info(f"ObjectId로 검색 시도: {request.social_id}")
        except:
            pass
        
        # ObjectId 검색이 실패하면 Google ID로 검색
        if not user:
            user = db.users.find_one({"google_id": request.social_id})
            logger.info(f"Google ID로 검색 시도: {request.social_id}")
        
        # 데이터베이스 정보 로깅
        logger.info(f"🗄️ DB 정보 - 이름: {db.name}, 컬렉션: users")
        logger.info(f"🗄️ users 컬렉션 문서 수: {db.users.count_documents({})}")
        
        if not user:
            logger.error(f"사용자를 찾을 수 없음: {request.social_id}")
            # 디버깅: 모든 사용자 ID 출력
            all_user_ids = [str(u["_id"]) for u in db.users.find({}, {"_id": 1}).limit(5)]
            logger.error(f"🗄️ DB에 있는 사용자 ID 샘플 (최대 5개): {all_user_ids}")
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 사용자 발견 시 정보 로깅
        logger.info(f"✅ 사용자 발견 - ID: {user['_id']}, email: {user.get('email')}")
        logger.info(f"✅ wallet_created: {user.get('wallet_created')}, wallet_password 존재: {bool(user.get('wallet_password'))}")
        
        # 지갑 생성 제한: 한 소셜 아이디당 하나의 지갑만 허용
        if user.get("wallet_created"):
            # 이미 지갑이 생성된 사용자 - 비밀번호 검증
            stored_password = user.get("wallet_password")
            logger.info("기존 지갑 확인 - 비밀번호 검증 중")
            logger.info(f"🔐 저장된 비밀번호: '{stored_password}' (type: {type(stored_password).__name__}, len: {len(stored_password) if stored_password else 0})")
            logger.info(f"🔐 입력된 비밀번호: '{request.password}' (type: {type(request.password).__name__}, len: {len(request.password)})")
            logger.info(f"🔐 비교 결과: {stored_password == request.password}")
            
            if stored_password and stored_password != request.password:
                logger.error(f"❌ 비밀번호 불일치!")
                logger.error(f"   - 저장된 값: '{stored_password}'")
                logger.error(f"   - 입력된 값: '{request.password}'")
                raise HTTPException(status_code=401, detail="비밀번호가 일치하지 않습니다")
            
            # 비밀번호 검증 성공 - 기존 지갑 사용
            logger.info("비밀번호 검증 성공 - 기존 지갑 로그인")
            return {
                "access_token": create_access_token(data={"sub": str(user["_id"])}),
                "token_type": "bearer",
                "user": {
                    "id": str(user["_id"]),
                    "email": user.get("email"),
                    "name": user.get("name"),
                    "wallet_address": user.get("wallet_address")
                },
                "message": "기존 지갑으로 로그인합니다.",
                "is_existing_wallet": True
            }
        else:
            # 새 지갑 생성 허용
            logger.info("새 지갑 생성 시작")
            update_data = {
                "wallet_created": True,
                "wallet_password": request.password,  # 비밀번호 저장 (복구용)
                "updated_at": datetime.now()
            }
            
            # 지갑 주소를 DB에 저장
            if request.wallet_address:
                logger.info(f"클라이언트 지갑 주소 DB에 저장: {request.wallet_address}")
                update_data["wallet_address"] = request.wallet_address
            
            result = db.users.update_one(
                {"_id": user["_id"]}, 
                {"$set": update_data}
            )
            logger.info(f"MongoDB 업데이트 완료: matched={result.matched_count}, modified={result.modified_count}")
            
            # 저장 확인
            updated_user = db.users.find_one({"_id": user["_id"]})
            logger.info(f"저장 확인 - wallet_created: {updated_user.get('wallet_created')}, wallet_address: {updated_user.get('wallet_address')}")
            logger.info("새 지갑 생성 완료")
            
            return {
                "access_token": create_access_token(data={"sub": str(user["_id"])}),
                "token_type": "bearer",
                "user": {
                    "id": str(user["_id"]),
                    "email": user.get("email"),
                    "name": user.get("name")
                },
                "message": "새 지갑이 생성됩니다.",
                "is_existing_wallet": False,
                "welcome_bonus_pending": True  # 환영 보너스 지급 중임을 알림
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password Auth 오류: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"로그인 처리 중 오류 발생: {str(e)}")

@app.get("/user/settings")
async def get_user_settings(user_id: str = Depends(verify_token)):
    """사용자 설정 조회"""
    try:
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        return {
            "show_wallet_public": user.get("show_wallet_public", False),
            "wallet_address": user.get("wallet_address"),
            "name": user.get("name"),
            "email": user.get("email")
        }
    except Exception as e:
        logger.error(f"설정 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"설정 조회 중 오류 발생: {str(e)}")

@app.put("/user/settings")
async def update_user_settings(request: UserSettingsRequest, user_id: str = Depends(verify_token)):
    """사용자 설정 업데이트"""
    try:
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})    
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 설정 업데이트
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "show_wallet_public": request.show_wallet_public,
                "updated_at": datetime.now()
            }}
        )
        
        logger.info(f"사용자 설정 업데이트: user_id={user_id}, show_wallet_public={request.show_wallet_public}")
        
        return {
            "success": True,
            "show_wallet_public": request.show_wallet_public,
            "message": "설정이 업데이트되었습니다"
        }
    except Exception as e:
        logger.error(f"설정 업데이트 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"설정 업데이트 중 오류 발생: {str(e)}")

@app.get("/public/wallets")
async def get_public_wallets():
    """공개 지갑 주소 목록 조회"""
    try:
        # show_wallet_public이 True인 사용자만 조회
        public_users = db.users.find(
            {"show_wallet_public": True, "wallet_address": {"$exists": True, "$ne": None}},
            {"name": 1, "wallet_address": 1, "email": 1, "_id": 0}
        ).limit(100)  # 최대 100명
        
        result = []
        for user in public_users:
            result.append({
                "name": user.get("name"),
                "wallet_address": user.get("wallet_address"),
                "email": user.get("email")
            })
        
        return {"wallets": result, "count": len(result)}
    except Exception as e:
        logger.error(f"공개 지갑 목록 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"공개 지갑 목록 조회 중 오류 발생: {str(e)}")

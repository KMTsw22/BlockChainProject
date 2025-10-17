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
from google.auth.transport import requests
from google.oauth2 import id_token
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

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

# Web3 설정 (지갑 생성용)
WEB3_PROVIDER = os.getenv("WEB3_PROVIDER", "https://sepolia.infura.io/v3/e8630d4f3cd6413ea851365717502af4")
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))

# Web3 연결 상태 콘솔 출력
print(f"🔗 Web3 연결: {w3.is_connected()}")
if w3.is_connected():
    print(f"📊 블록: {w3.eth.block_number}")
    print(f"🔗 체인: {w3.eth.chain_id}")
else:
    print("❌ 연결 실패!")

# 메모리 저장소 (로컬 개발용)
users_db: Dict[str, Dict] = {}

# Pydantic 모델들
class SocialLoginRequest(BaseModel):
    provider: str  # "google" or "kakao"
    social_id: str
    email: str
    name: str
    profile_image: Optional[str] = None

class GoogleTokenRequest(BaseModel):
    token: str

class PrivateKeyRequest(BaseModel):
    private_key: str

class PasswordLoginRequest(BaseModel):
    social_id: str
    password: str


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

# 지갑 생성 함수 (social_id + password)
def generate_wallet_from_credentials(social_id: str, password: str) -> Dict[str, str]:
    """social_id + password로 지갑 생성"""
    # social_id + password로 시드 생성
    seed_string = f"{social_id}_{password}"
    seed_hash = hashlib.sha256(seed_string.encode()).hexdigest()
    
    # 시드로부터 지갑 생성
    account = w3.eth.account.from_key(seed_hash)
    
    return {
        "address": account.address,
        "private_key": account.key.hex(),
        "seed": seed_hash
    }


# Private Key 검증 함수
def verify_private_key(private_key: str, expected_address: str) -> bool:
    """Private Key가 해당 지갑 주소와 일치하는지 확인"""
    try:
        account = w3.eth.account.from_key(private_key)
        return account.address.lower() == expected_address.lower()
    except Exception:
        return False

# 스마트 컨트랙트 관련 함수 제거 - 클라이언트에서 직접 처리

# API 엔드포인트들

@app.get("/")
async def root():
    return {"message": "소셜 지갑 API 서버가 실행 중입니다! (로컬 개발 모드)"}


@app.post("/auth/password")
async def password_auth(request: PasswordLoginRequest):
    """비밀번호 기반 로그인/생성 (인증만 담당)"""
    try:
        # social_id로 사용자 조회
        user_key = f"google_{request.social_id}"
        user = users_db.get(user_key)
        
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # social_id + password로 지갑 생성
        wallet_info = generate_wallet_from_credentials(request.social_id, request.password)
        wallet_address = wallet_info["address"]
        
        # 사용자 정보에 지갑 주소 업데이트
        user["wallet_address"] = wallet_address
        users_db[user_key] = user
        
        # JWT 토큰 생성
        access_token = create_access_token(data={"sub": user_key})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user_key,
                "email": user.get("email"),
                "name": user.get("name")
            },
            "wallet": {
                "address": wallet_address,
                "private_key": wallet_info["private_key"]  # 클라이언트에서 직접 사용
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그인 처리 중 오류 발생: {str(e)}")

@app.post("/auth/google")
async def google_auth(request: GoogleTokenRequest):
    """Google OAuth 토큰 검증 및 사용자 생성"""
    try:
        # Google ID 토큰 검증
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "642921295-hbu979qt4a2ndq1ucpf4j8v83kmfs8mk.apps.googleusercontent.com")
        
        # Google ID 토큰 검증
        idinfo = id_token.verify_oauth2_token(
            request.token, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # 사용자 정보 추출
        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', email.split('@')[0])
        profile_image = idinfo.get('picture', '')
        
        # 사용자 정보 저장 (비밀번호 설정을 위해)
        user_key = f"google_{google_id}"
        
        users_db[user_key] = {
            "id": user_key,
            "provider": "google",
            "social_id": google_id,
            "email": email,
            "name": name,
            "profile_image": profile_image,
            "created_at": datetime.utcnow()
        }
        
        return {
            "message": "Google 인증 성공. 비밀번호를 설정해주세요.",
            "user": {
                "id": user_key,
                "email": email,
                "name": name,
                "profile_image": profile_image
            }
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그인 처리 중 오류 발생: {str(e)}")

# 잔액 조회는 클라이언트에서 직접 스마트 컨트랙트 호출

# 토큰 발행은 클라이언트에서 직접 스마트 컨트랙트 호출

# 토큰 전송은 클라이언트에서 직접 스마트 컨트랙트 호출

# 스테이킹은 클라이언트에서 직접 스마트 컨트랙트 호출

# 보상 청구는 클라이언트에서 직접 스마트 컨트랙트 호출

@app.post("/wallet/verify-private-key")
async def verify_private_key(request: PrivateKeyRequest, user_id: str = Depends(verify_token)):
    """Private Key 검증 및 계좌 연동"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        wallet_address = user.get("wallet_address")
        if not wallet_address:
            raise HTTPException(status_code=404, detail="지갑 주소를 찾을 수 없습니다")
        
        # Private Key 검증
        if not verify_private_key(request.private_key, wallet_address):
            raise HTTPException(status_code=400, detail="Private Key가 지갑 주소와 일치하지 않습니다")
        
        return {
            "message": "Private Key 검증 성공",
            "wallet_address": wallet_address,
            "verified": True
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Private Key 검증 중 오류 발생: {str(e)}")

@app.get("/user/profile")
async def get_user_profile(user_id: str = Depends(verify_token)):
    """사용자 프로필 조회"""
    try:
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        return {
            "user": {
                "id": user.get("id"),
                "email": user.get("email"),
                "name": user.get("name"),
                "profile_image": user.get("profile_image"),
                "wallet_address": user.get("wallet_address"),
                "created_at": user.get("created_at")
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"사용자 정보 조회 중 오류 발생: {str(e)}")

if __name__ == "__main__":
    print("🚀 인증 서버 시작 (스마트 컨트랙트는 클라이언트에서 직접 처리)...")
    print("📱 프론트엔드: http://localhost:3000")
    print("🔧 백엔드 API: http://localhost:8000")
    print("📖 API 문서: http://localhost:8000/docs")
    print("💡 스마트 컨트랙트 작업은 클라이언트에서 직접 처리됩니다")
    uvicorn.run(app, host="0.0.0.0", port=8000)

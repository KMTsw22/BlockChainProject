from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
import os
from datetime import datetime, timedelta
import jwt
from web3 import Web3
from google.auth.transport import requests
from google.oauth2 import id_token
from dotenv import load_dotenv
from database import get_mongodb_database

# .env 파일 로드
load_dotenv()

# 이더리움 설정
WEB3_PROVIDER = os.getenv("WEB3_PROVIDER", "https://sepolia.infura.io/v3/YOUR_INFURA_KEY")
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))

# 프로젝트 지갑 설정
PROJECT_PRIVATE_KEY = os.getenv("PROJECT_PRIVATE_KEY")
PROJECT_WALLET_ADDRESS = os.getenv("PROJECT_WALLET_ADDRESS")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x96850830c5c5c62A151Cc41f14558F76ab2Bb55f")

# FastAPI 앱 생성
app = FastAPI(title="소셜 지갑 API (로컬)", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# MongoDB 데이터베이스 연결
db = get_mongodb_database()
print("✅ MongoDB Atlas 연결 성공!")

# Pydantic 모델
# WelcomeBonusRequest 모델 삭제됨 - 서버에서 자동으로 지급

class PasswordLoginRequest(BaseModel):
    social_id: str
    password: str
    wallet_address: str = None  # 지갑 주소 (선택사항)

class GoogleTokenRequest(BaseModel):
    token: str


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
                status_code=401,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# API 엔드포인트들
@app.get("/")
async def root():
    return {"message": "소셜 지갑 API 서버가 실행 중입니다! (로컬 개발 모드)"}

@app.post("/auth/password")
async def password_auth(request: PasswordLoginRequest):
    """비밀번호 기반 인증 (한 소셜 아이디당 하나의 지갑만 허용)"""
    try:
        print(f"🔍 요청 데이터: social_id={request.social_id}, password={request.password}")
        print(f"🔍 social_id 타입: {type(request.social_id)}")
        print(f"🔍 password 타입: {type(request.password)}")
        
        # social_id로 사용자 조회 (MongoDB)
        # ObjectId인 경우와 Google ID인 경우 모두 처리
        from bson import ObjectId
        
        user = None
        try:
            # 먼저 ObjectId로 검색 시도
            if len(request.social_id) == 24:  # ObjectId 길이 체크
                user = db.users.find_one({"_id": ObjectId(request.social_id)})
                print(f"🔍 ObjectId로 검색 시도: {request.social_id}")
        except:
            pass
        
        # ObjectId 검색이 실패하면 Google ID로 검색
        if not user:
            user = db.users.find_one({"google_id": request.social_id})
            print(f"🔍 Google ID로 검색 시도: {request.social_id}")
        
        if not user:
            print(f"❌ 사용자를 찾을 수 없음: {request.social_id}")
            # 모든 사용자 목록 출력 (디버깅용)
            all_users = list(db.users.find({}, {"google_id": 1, "email": 1, "_id": 1}))
            print(f"🔍 데이터베이스의 모든 사용자: {all_users}")
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 지갑 생성 제한: 한 소셜 아이디당 하나의 지갑만 허용
        if user.get("wallet_created"):
            # 이미 지갑이 생성된 사용자 - 비밀번호 검증
            stored_password = user.get("wallet_password")
            print(f"🔍 저장된 비밀번호: {stored_password}")
            print(f"🔍 입력된 비밀번호: {request.password}")
            print(f"🔍 비밀번호 타입 - 저장: {type(stored_password)}, 입력: {type(request.password)}")
            
            if stored_password and stored_password != request.password:
                print(f"❌ 비밀번호 불일치: 저장된 비밀번호와 다름")
                return {
                    "error": "비밀번호가 일치하지 않습니다",
                    "status_code": 401
                }
            
            # 비밀번호 검증 성공 - 기존 지갑 사용
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
            from bson import ObjectId
            update_data = {
                "wallet_created": True,
                "wallet_password": request.password,  # 비밀번호 저장 (복구용)
                "updated_at": datetime.now()
            }
            
            # 지갑 주소는 클라이언트에서만 관리 (서버에 저장하지 않음)
            if request.wallet_address:
                print(f"🔍 클라이언트 지갑 주소 확인: {request.wallet_address} (저장하지 않음)")
            
            db.users.update_one(
                {"_id": user["_id"]}, 
                {"$set": update_data}
            )
            
            # 새 지갑 생성 완료 (환영 보너스는 클라이언트에서 요청)
            if request.wallet_address:
                print(f"🎁 새 지갑 생성 완료: {request.wallet_address} (환영 보너스는 클라이언트에서 요청)")
            
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그인 처리 중 오류 발생: {str(e)}")

@app.post("/auth/google")
async def google_auth(request: GoogleTokenRequest):
    """Google OAuth 토큰 검증 및 사용자 생성"""
    try:
        # Google ID 토큰 검증
        idinfo = id_token.verify_oauth2_token(
            request.token, 
            requests.Request(), 
            "642921295-hbu979qt4a2ndq1ucpf4j8v83kmfs8mk.apps.googleusercontent.com"
        )
        
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
                    "email": existing_user.get("email"),
                    "name": existing_user.get("name"),
                    "profile_image": existing_user.get("profile_image"),
                    "wallet_address": existing_user.get("wallet_address"),
                    "wallet_created": existing_user.get("wallet_created", False),
                    "created_at": existing_user.get("created_at")
                },
                "is_new_user": False
            }
        else:
            # 새 사용자 생성 (MongoDB)
            user_data = {
                "google_id": google_id,
                "email": email,
                "name": name,
                "profile_image": idinfo.get('picture'),
                "wallet_created": False,
                "welcome_bonus_given": False,  # 환영 보너스 지급 여부
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
                    "email": email,
                    "name": name,
                    "profile_image": idinfo.get('picture'),
                    "wallet_created": False,
                    "created_at": user_data["created_at"]
                },
                "is_new_user": True
            }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 Google 토큰: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google 인증 중 오류 발생: {str(e)}")


# JWT 토큰에서 사용자 ID 추출 함수
def get_current_user_id():
    """JWT 토큰에서 사용자 ID 추출"""
    from fastapi import Request, HTTPException, status
    
    def get_user_id(request: Request):
        try:
            # Authorization 헤더에서 토큰 추출
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
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
    
    return get_user_id

# 환영 보너스 요청 모델
class WelcomeBonusRequest(BaseModel):
    address: str

# 환영 보너스 API (클라이언트 요청 방식)
@app.post("/wallet/welcome-bonus")
async def give_welcome_bonus(request: WelcomeBonusRequest, current_user_id: str = Depends(get_current_user_id())):
    """클라이언트에서 요청한 환영 보너스 지급"""
    try:
        # JWT 토큰에서 사용자 ID 추출
        user_id = current_user_id
        print(f"🔍 환영 보너스 요청: user_id={user_id}, address={request.address}")
        
        # 사용자 정보 조회
        from bson import ObjectId
        try:
            # user_id가 문자열인 경우 ObjectId로 변환
            if isinstance(user_id, str):
                user = db.users.find_one({"_id": ObjectId(user_id)})
            else:
                user = db.users.find_one({"_id": user_id})
        except Exception as e:
            print(f"❌ 사용자 ID 변환 오류: {e}, user_id: {user_id}, type: {type(user_id)}")
            raise HTTPException(status_code=400, detail=f"유효하지 않은 사용자 ID: {str(e)}")
        
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 중복 지급 방지
        if user.get("welcome_bonus_given", False):
            print(f"⚠️ 이미 환영 보너스를 받은 사용자: {user_id}")
            return {
                "message": "이미 환영 보너스를 받았습니다",
                "already_received": True
            }
        
        # 환영 보너스 지급
        result = await give_deterministic_welcome_bonus(request.address, user_id)
        
        # 사용자에게 환영 보너스 지급 완료 표시
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"welcome_bonus_given": True, "updated_at": datetime.now()}}
        )
        print(f"✅ 환영 보너스 지급 완료 표시: {user_id}")
        
        return {
            "message": "환영 보너스가 지급되었습니다",
            "transaction_hash": result.get("transaction_hash"),
            "success": True
        }
        
    except Exception as e:
        print(f"❌ 환영 보너스 지급 실패: {e}")
        raise HTTPException(status_code=500, detail=f"환영 보너스 지급 실패: {str(e)}")

async def give_deterministic_welcome_bonus(user_address, user_id=None):
    """결정론적 지갑 사용자 환영 보너스 (ART 토큰 직접 발행)"""
    try:
        # 중복 지급 방지 (user_id가 있는 경우)
        if user_id:
            from bson import ObjectId
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if user and user.get("welcome_bonus_given", False):
                print(f"⚠️ give_deterministic_welcome_bonus: 이미 환영 보너스를 받은 사용자: {user_id}")
                return {
                    "message": "이미 환영 보너스를 받았습니다",
                    "already_received": True
                }
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
        
        # 컨트랙트 인스턴스 생성
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
        
        # mintTo 함수 호출 트랜잭션 생성
        mint_amount = 100 * 10**5  # 100 ART 토큰 (5자리 소수점)
        print(f"🔍 give_deterministic_welcome_bonus: user_address={user_address}, mint_amount={mint_amount}")
        
        # 가스 가격과 논스 가져오기
        try:
            gas_price = w3.eth.gas_price
            nonce = w3.eth.get_transaction_count(PROJECT_WALLET_ADDRESS)
            print(f"🔧 가스 가격: {gas_price}, 논스: {nonce}")
            
            # 가스 한도 추정
            try:
                estimated_gas = contract.functions.mintTo(user_address, mint_amount).estimate_gas({
                    'from': PROJECT_WALLET_ADDRESS
                })
                print(f"🔧 추정 가스: {estimated_gas}")
                # 추정 가스의 120%로 설정 (안전 마진)
                gas_limit = int(estimated_gas * 1.2)
            except Exception as gas_error:
                print(f"⚠️ 가스 추정 실패, 기본값 사용: {gas_error}")
                gas_limit = 200000  # 기본값
                
        except Exception as e:
            print(f"❌ 가스 가격/논스 조회 실패: {e}")
            raise HTTPException(status_code=500, detail=f"블록체인 연결 실패: {str(e)}")
        
        transaction = contract.functions.mintTo(
            user_address,  # 받을 주소
            mint_amount     # 발행할 토큰 양
        ).build_transaction({
            'from': PROJECT_WALLET_ADDRESS,
            'gas': gas_limit,  # 추정된 가스 한도 사용
            'gasPrice': gas_price,
            'nonce': nonce,
        })
        
        # 트랜잭션 서명 및 전송
        signed_txn = w3.eth.account.sign_transaction(transaction, PROJECT_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        print(f"📤 트랜잭션 전송됨: {tx_hash.hex()}")
        print(f"⏳ 트랜잭션 완료 대기 중... (최대 120초)")
        
        # 트랜잭션 완료 대기
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if tx_receipt.status == 1:
            print(f"✅ 트랜잭션 완료: {tx_hash.hex()}")
            print(f"🎉 {user_address}에게 {mint_amount} 토큰 지급 완료")
        else:
            print(f"❌ 트랜잭션 실패: {tx_hash.hex()}")
            raise HTTPException(status_code=500, detail="트랜잭션 실패")
        
        print(user_address, mint_amount)
        
        # 트랜잭션 정보를 MongoDB에 저장 (user_id가 있는 경우만)
        if user_id:
            from bson import ObjectId
            transaction_data = {
                "user_id": ObjectId(user_id),
                "wallet_address": user_address,
                "transaction_hash": tx_hash.hex(),
                "transaction_type": "welcome_bonus",
                "amount": "100",
                "status": "completed",  # 트랜잭션 완료 후 저장
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


if __name__ == "__main__":
    print("🚀 인증 서버 시작 (스마트 컨트랙트는 클라이언트에서 직접 처리)...")
    print("📱 프론트엔드: http://localhost:3000")
    print("🔧 백엔드 API: http://localhost:8000")
    print("📖 API 문서: http://localhost:8000/docs")
    print("💡 스마트 컨트랙트 작업은 클라이언트에서 직접 처리됩니다")
    uvicorn.run(app, host="0.0.0.0", port=8000)
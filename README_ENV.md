# 환경변수 설정 가이드

## 📁 .env 파일 위치

프로젝트 루트(`BlockChainProject/`)에 `.env` 파일을 하나만 만드세요.

```
BlockChainProject/
├── .env                    ← 여기에 하나만!
├── backend/
├── frontend/
└── ...
```

## 📝 .env 파일 내용

```bash
# ====== 백엔드 설정 ======

# 프로젝트 지갑 (가스비 부담용)
PROJECT_PRIVATE_KEY=your_private_key_here
PROJECT_WALLET_ADDRESS=your_wallet_address_here

# Web3 Provider
WEB3_PROVIDER=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# 스마트 컨트랙트 주소 (EIP-2771)
CONTRACT_ADDRESS=0xC599e73663a962Daa5aF3c27833e73221F0B37Cd
FORWARDER_ADDRESS=0x03cC08E8AF9fD9f3AF9613d1db075456FDdb209b

# JWT 설정
SECRET_KEY=your-secret-key-here

# MongoDB 연결 문자열
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ====== 프론트엔드 설정 ======
# React는 REACT_APP_ 접두사가 필요합니다!
# 백엔드와 동일한 값을 사용하되, REACT_APP_ 접두사를 추가합니다.

REACT_APP_API_URL=http://localhost:8000
REACT_APP_WEB3_PROVIDER=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
REACT_APP_CONTRACT_ADDRESS=0xC599e73663a962Daa5aF3c27833e73221F0B37Cd
REACT_APP_FORWARDER_ADDRESS=0x03cC08E8AF9fD9f3AF9613d1db075456FDdb209b
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

## 🚀 사용 방법

### 백엔드
백엔드는 자동으로 루트의 `.env` 파일을 읽습니다.
```bash
cd backend
python index.py
```

### 프론트엔드
프론트엔드는 `dotenv-cli`를 통해 루트의 `.env` 파일을 읽습니다.

**첫 설치:**
```bash
cd frontend
npm install
```

**실행:**
```bash
npm start
```

## ⚠️ 주의사항

1. **`.env` 파일은 절대 Git에 커밋하지 마세요!**
   - `.gitignore`에 추가되어 있어야 합니다.

2. **프론트엔드 환경변수는 `REACT_APP_` 접두사 필수**
   - `REACT_APP_CONTRACT_ADDRESS` ✅
   - `CONTRACT_ADDRESS` ❌ (React가 인식 안 함)

3. **백엔드 환경변수는 접두사 없음**
   - `CONTRACT_ADDRESS` ✅

## 🔧 환경변수가 없을 때

- 백엔드: `None` 값으로 설정, 에러 발생
- 프론트엔드: `null` 값으로 설정, 에러 메시지 표시

## ✅ 확인 방법

### 백엔드
서버 시작 시 로그 확인:
```
✅ .env 파일 로드 성공 (로컬 모드)
```

### 프론트엔드
브라우저 콘솔 확인:
```javascript
🔧 사용 중인 컨트랙트 주소: 0xC599e736...
🔧 사용 중인 Forwarder 주소: 0x03cC08E8...
```

## 📋 현재 사용 중인 주소

- **ARTV2 컨트랙트**: `0xC599e73663a962Daa5aF3c27833e73221F0B37Cd`
- **MinimalForwarder**: `0x03cC08E8AF9fD9f3AF9613d1db075456FDdb209b`


# 🚀 서버리스 소셜 지갑 시스템

구글/카카오 소셜 로그인으로 자동 생성되는 블록체인 지갑 시스템을 **서버리스**로 배포합니다!

## 🏗️ 시스템 구조

- **백엔드**: FastAPI (Vercel 서버리스 함수)
- **프론트엔드**: React (Vercel 호스팅)
- **블록체인**: 이더리움 (Sepolia 테스트넷)
- **스마트 컨트랙트**: AdvancedRewardToken
- **배포**: Vercel (서버리스)

## ✨ 주요 기능

1. **소셜 로그인**: 구글/카카오 계정으로 로그인
2. **자동 지갑 생성**: 소셜 계정 정보를 기반으로 결정론적 지갑 생성
3. **토큰 관리**: 토큰 발행, 전송, 스테이킹
4. **보상 시스템**: 스테이킹을 통한 보상 수령
5. **스마트 컨트랙트 연동**: 블록체인에서 안전한 토큰 관리

## 🚀 서버리스 배포

### 1. Vercel CLI 설치

```bash
npm i -g vercel
```

### 2. 프로젝트 배포

```bash
# 프로젝트 루트에서
vercel

# 질문에 답변:
# - Set up and deploy? Y
# - Which scope? (개인 계정 선택)
# - Link to existing project? N
# - What's your project's name? social-wallet
# - In which directory is your code located? ./
```

### 3. 환경변수 설정

```bash
# Vercel 대시보드에서 또는 CLI로 설정
vercel env add SECRET_KEY
vercel env add WEB3_PROVIDER
```

### 4. 자동 배포 설정
- GitHub 저장소 연결
- Push할 때마다 자동 배포

## 📁 프로젝트 구조

```
BlockChainProject/
├── vercel.json              # Vercel 배포 설정
├── backend/
│   ├── api/
│   │   └── index.py         # 서버리스 함수
│   └── requirements.txt     # Python 의존성
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── contexts/
│   │   │   ├── AuthContext.js
│   │   │   └── WalletContext.js
│   │   ├── pages/
│   │   │   ├── LoginPage.js
│   │   │   ├── DashboardPage.js
│   │   │   └── WalletPage.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── AdvancedRewardToken.sol  # 스마트 컨트랙트
├── README.md
└── README_SERVERLESS.md     # 서버리스 상세 가이드
```

## 🔧 API 엔드포인트

### 인증
- `POST /api/auth/social-login` - 소셜 로그인

### 지갑 관리
- `GET /api/wallet/info` - 지갑 정보 조회
- `GET /api/wallet/balance` - 토큰 잔액 조회

### 토큰 액션
- `POST /api/wallet/mint` - 토큰 발행
- `POST /api/wallet/transfer` - 토큰 전송
- `POST /api/wallet/stake` - 토큰 스테이킹
- `POST /api/wallet/claim-rewards` - 보상 청구

## 🛡️ 보안 고려사항

1. **개인키 관리**: 소셜 계정 정보를 기반으로 결정론적 지갑 생성
2. **JWT 토큰**: 인증을 위한 JWT 토큰 사용
3. **CORS 설정**: React와의 안전한 통신
4. **환경변수**: 민감한 정보는 환경변수로 관리

## 🔮 향후 개선사항

1. **실제 소셜 로그인**: Google OAuth, Kakao SDK 연동
2. **데이터베이스**: PostgreSQL 또는 MongoDB 연동
3. **이벤트 리스너**: 스마트 컨트랙트 이벤트 실시간 감지
4. **모바일 지원**: React Native 버전 개발
5. **다중 체인**: 이더리움 외 다른 블록체인 지원

## 📝 사용법

1. **배포**: Vercel에 배포하면 전 세계 어디서나 접속 가능
2. **로그인**: 구글 또는 카카오 계정으로 로그인
3. **지갑 생성**: 자동으로 지갑이 생성되고 주소가 표시됩니다
4. **토큰 관리**: 대시보드에서 토큰 잔액을 확인하고 액션을 수행할 수 있습니다
5. **스테이킹**: 토큰을 스테이킹하여 보상을 받을 수 있습니다

## ⚠️ 주의사항

- 현재는 시뮬레이션 모드로 동작합니다
- 실제 블록체인과 연동하려면 Infura API 키가 필요합니다
- 테스트넷에서만 사용하세요 (메인넷 사용 금지)
- 개인키는 안전하게 보관하세요
- 서버리스 환경에서는 메모리 저장소 사용 (실제 운영에서는 데이터베이스 필요)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

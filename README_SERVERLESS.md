# 🚀 서버리스 소셜 지갑 시스템

구글/카카오 소셜 로그인으로 자동 생성되는 블록체인 지갑 시스템을 **서버리스**로 배포합니다!

## 🌐 서버리스 배포 옵션

### 1. **Vercel** (추천) ⭐
```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 배포
vercel

# 환경변수 설정
vercel env add SECRET_KEY
vercel env add WEB3_PROVIDER
```

### 2. **Netlify**
```bash
# Netlify CLI 설치
npm i -g netlify-cli

# 프로젝트 빌드
cd frontend && npm run build

# 배포
netlify deploy --prod
```

### 3. **AWS Lambda**
```bash
# Serverless Framework 설치
npm i -g serverless

# AWS 배포
serverless deploy
```

## 🏗️ 서버리스 구조

```
📁 프로젝트 구조
├── vercel.json              # Vercel 설정
├── backend/
│   ├── api/
│   │   └── index.py         # 서버리스 함수
│   └── requirements.txt      # Python 의존성
├── frontend/                # React 앱
│   ├── src/
│   └── package.json
└── README_SERVERLESS.md
```

## ✨ 서버리스 장점

1. **💰 비용 효율성**: 사용한 만큼만 과금
2. **🚀 자동 스케일링**: 트래픽에 따라 자동 확장
3. **🔧 관리 불필요**: 서버 관리 없이 코드만 배포
4. **🌍 글로벌 CDN**: 전 세계 빠른 접속
5. **🔒 보안**: 플랫폼에서 자동 보안 관리

## 🚀 Vercel 배포 방법

### 1단계: Vercel CLI 설치
```bash
npm i -g vercel
```

### 2단계: 프로젝트 배포
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

### 3단계: 환경변수 설정
```bash
# Vercel 대시보드에서 또는 CLI로 설정
vercel env add SECRET_KEY
vercel env add WEB3_PROVIDER
```

### 4단계: 자동 배포 설정
- GitHub 저장소 연결
- Push할 때마다 자동 배포

## 🔧 환경변수 설정

### 필수 환경변수
```bash
SECRET_KEY=your-jwt-secret-key-here
WEB3_PROVIDER=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

### 선택적 환경변수
```bash
CONTRACT_ADDRESS=0xf327d45c12abc5b9fbe963989f9acc7fa3bd6c60
```

## 📱 접속 방법

배포 완료 후:
- **프론트엔드**: `https://your-project.vercel.app`
- **API**: `https://your-project.vercel.app/api`

## 🔄 자동 배포 설정

### GitHub Actions (선택사항)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 🛠️ 로컬 개발

```bash
# 백엔드 개발 서버
cd backend
python main.py

# 프론트엔드 개발 서버
cd frontend
npm start
```

## 📊 모니터링

### Vercel Analytics
- 실시간 트래픽 모니터링
- 성능 지표 추적
- 오류 로그 확인

### 서버리스 함수 모니터링
- 함수 실행 시간
- 메모리 사용량
- 오류율 추적

## 🔒 보안 고려사항

1. **환경변수**: 민감한 정보는 환경변수로 관리
2. **CORS**: 서버리스 환경에서는 적절한 CORS 설정
3. **Rate Limiting**: API 호출 제한 설정
4. **JWT 토큰**: 안전한 토큰 관리

## 🚀 성능 최적화

1. **CDN**: Vercel의 글로벌 CDN 활용
2. **캐싱**: 적절한 캐싱 전략
3. **이미지 최적화**: 자동 이미지 최적화
4. **코드 분할**: React 코드 분할

## 💡 팁

- **무료 한도**: Vercel 무료 플랜으로도 충분
- **도메인**: 커스텀 도메인 연결 가능
- **SSL**: 자동 HTTPS 인증서
- **백업**: GitHub에 코드 백업 필수

이제 서버 관리 없이 글로벌하게 서비스할 수 있습니다! 🌍✨




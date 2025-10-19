# 데이터베이스 설정 가이드

## 1. PlanetScale 설정 (추천)

### 단계 1: 계정 생성
1. https://planetscale.com 방문
2. GitHub 계정으로 로그인
3. "Create a database" 클릭

### 단계 2: 데이터베이스 생성
1. 데이터베이스 이름 입력 (예: `blockchain_app`)
2. 리전 선택 (Asia Pacific - Seoul)
3. "Create database" 클릭

### 단계 3: 연결 정보 확인
1. 데이터베이스 대시보드에서 "Connect" 클릭
2. "Connect with" → "General" 선택
3. 연결 문자열 복사:
```
mysql://username:password@host:port/database_name
```

### 단계 4: Vercel 환경 변수 설정
Vercel 대시보드에서:
```
DATABASE_URL=mysql://username:password@host:port/database_name
```

## 2. 테이블 자동 생성

배포 후 자동으로 다음 테이블들이 생성됩니다:
- `users` - 사용자 정보
- `wallets` - 지갑 정보  
- `transactions` - 트랜잭션 기록
- `token_balances` - 토큰 잔액

## 3. 데이터베이스 확인 방법

### PlanetScale 대시보드에서:
1. 데이터베이스 선택
2. "Console" 탭 클릭
3. SQL 쿼리 실행:
```sql
SHOW TABLES;
SELECT * FROM users LIMIT 5;
```

### API를 통한 확인:
```bash
# 데이터베이스 초기화
curl -X POST https://your-app.vercel.app/api/init-db

# 사용자 목록 조회
curl -X GET https://your-app.vercel.app/api/users
```

## 4. 다른 서비스 사용 시

### Railway:
1. https://railway.app 방문
2. "New Project" → "Database" → "MySQL"
3. 연결 정보 복사

### Supabase:
1. https://supabase.com 방문
2. "New Project" 생성
3. Settings → Database → Connection string 복사
4. PostgreSQL이므로 약간의 설정 변경 필요

## 5. 로컬 개발용

로컬에서는 SQLite 사용 (파일 기반):
```bash
# 로컬 실행 시 자동으로 blockchain_app.db 파일 생성
python backend/local_server.py
```

"""
MongoDB Atlas 연결 설정
"""
import os
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB Atlas 연결 문자열
# MongoDB Atlas에서 연결 문자열을 복사해서 .env 파일에 MONGODB_URL로 설정하세요
# 예: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ART_BASE?retryWrites=true&w=majority
# 또는: mongodb://username:password@ac-8xj8ojf-shard-00-02.sd6jokn.mongodb.net:27017/ART_BASE?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority

# MongoDB Atlas 연결 문자열
# 사용자가 제공한 정확한 연결 문자열 사용
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://mintae3827_db_user:kmt2003!ab@cluster0.sd6jokn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")

# 클라이언트 인스턴스
client = None
database = None

def get_mongodb_client():
    """MongoDB 클라이언트 반환 (동기)"""
    global client
    if client is None:
        client = MongoClient(MONGODB_URL)
    return client

def get_mongodb_database():
    """MongoDB 데이터베이스 반환 (동기)"""
    global database
    if database is None:
        client = get_mongodb_client()
        database = client["ART_BASE"]  # 이미지에서 보이는 데이터베이스명
    return database

async def get_async_mongodb_client():
    """비동기 MongoDB 클라이언트 반환"""
    return AsyncIOMotorClient(MONGODB_URL)

async def get_async_mongodb_database():
    """비동기 MongoDB 데이터베이스 반환"""
    client = await get_async_mongodb_client()
    return client["ART_BASE"]

def test_connection():
    """MongoDB 연결 테스트"""
    try:
        client = get_mongodb_client()
        # 연결 테스트
        client.admin.command('ping')
        print("✅ MongoDB Atlas 연결 성공!")
        return True
    except Exception as e:
        print(f"❌ MongoDB Atlas 연결 실패: {e}")
        return False

async def test_async_connection():
    """비동기 MongoDB 연결 테스트"""
    try:
        client = await get_async_mongodb_client()
        # 연결 테스트
        await client.admin.command('ping')
        print("✅ MongoDB Atlas 비동기 연결 성공!")
        return True
    except Exception as e:
        print(f"❌ MongoDB Atlas 비동기 연결 실패: {e}")
        return False

if __name__ == "__main__":
    # 연결 테스트
    test_connection()

import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

# MongoDB connection (tlsCAFile + tlsAllowInvalidCertificates para Python 3.13 + Windows)
client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client[DB_NAME]

# JWT settings
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

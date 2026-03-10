from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials
from typing import List
import bcrypt

from utils.database import db, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from utils.auth import get_current_user
from models.user import UserCreate, UserLogin, UserResponse, TokenResponse, ChangePasswordRequest, User

from datetime import datetime, timezone, timedelta
import jwt

router = APIRouter(prefix="/api")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = User(email=user_data.email, name=user_data.name)
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    token = create_token(user.id, user.email)
    return TokenResponse(
        token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name, created_at=user_dict['created_at'])
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    password_hash = user.get('password_hash') or user.get('password', '') if user else ''
    if not user or not verify_password(credentials.password, password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_token(user['id'], user['email'])
    return TokenResponse(
        token=token,
        user=UserResponse(id=user['id'], email=user['email'], name=user['name'], created_at=user['created_at'])
    )


@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        name=current_user['name'],
        created_at=current_user['created_at']
    )


@router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['id']})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if not bcrypt.checkpw(request.current_password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    new_password_hash = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"password": new_password_hash}}
    )
    return {"message": "Senha alterada com sucesso"}


@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [UserResponse(id=u['id'], email=u['email'], name=u['name'], created_at=u['created_at']) for u in users]

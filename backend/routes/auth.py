from fastapi import APIRouter, Depends, HTTPException
from typing import List
import bcrypt

from models.user import UserCreate, UserLogin, User, UserResponse, TokenResponse, ChangePasswordRequest
from utils.database import db
from utils.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
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

@router.post("/login", response_model=TokenResponse)
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

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        name=current_user['name'],
        created_at=current_user['created_at']
    )

@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Alterar senha do usuário logado"""
    user = await db.users.find_one({"id": current_user['id']})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    password_field = user.get('password_hash') or user.get('password', '')
    if not bcrypt.checkpw(request.current_password.encode('utf-8'), password_field.encode('utf-8')):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    new_password_hash = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Senha alterada com sucesso"}

# Users list endpoint
users_router = APIRouter(prefix="/users", tags=["users"])

@users_router.get("", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "password": 0}).to_list(100)
    return [UserResponse(id=u['id'], email=u['email'], name=u['name'], created_at=u['created_at']) for u in users]

"""Tessera is local-first: all user data lives on-device.
This backend exists only for the platform health check and stores nothing."""
from fastapi import FastAPI, APIRouter

app = FastAPI()
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "tessera", "mode": "local-first", "stores_user_data": False}


app.include_router(api_router)

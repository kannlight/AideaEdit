from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.deps import service_registry

router = APIRouter()


@router.get("/settings/services")
async def get_services():
    """利用可能なLLMサービス一覧を返す"""
    return [
        {"id": s.id, "name": s.name, "type": s.type, "model": s.model}
        for s in service_registry.get_services()
    ]


@router.get("/settings/active")
async def get_active_service():
    """現在アクティブなサービスIDを返す"""
    return {"id": service_registry.get_active_id()}


class SetActiveRequest(BaseModel):
    id: str


@router.post("/settings/active")
async def set_active_service(request: SetActiveRequest):
    """アクティブなサービスを切り替える"""
    success = service_registry.set_active_id(request.id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Service '{request.id}' not found")
    return {"id": service_registry.get_active_id()}

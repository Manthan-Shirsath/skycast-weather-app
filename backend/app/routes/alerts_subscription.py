"""
Alert Subscription Management Routes
Handles user subscriptions for proactive weather alerts.
"""

import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from backend.app.core.database import async_session_factory, is_db_available
from backend.app.models.subscription import AlertSubscription, AlertDeliveryLog

router = APIRouter(prefix="/api", tags=["Alerts"])


class AlertSubscriptionRequest(BaseModel):
    location: str = Field(..., description="City/location name")
    user_role: Optional[str] = "general_public"
    language: Optional[str] = "en"
    channels: Optional[dict] = Field(default_factory=lambda: {"websocket": True, "sms": False, "ivr": False})
    min_risk_tier: Optional[str] = "Yellow"
    phone_number: Optional[str] = None
    email: Optional[str] = None


class AlertSubscriptionResponse(BaseModel):
    id: str
    location: str
    user_role: str
    language: str
    channels: dict
    min_risk_tier: str
    active: bool
    created_at: str


@router.post("/alerts/subscribe", response_model=AlertSubscriptionResponse)
async def subscribe_to_alerts(req: AlertSubscriptionRequest = Body(...)):
    """
    Create a new alert subscription for a location and user.
    Enables proactive alerts when risk tier crosses threshold.
    """
    if not req.location:
        raise HTTPException(status_code=400, detail="Location is required")

    if not is_db_available():
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        sub = AlertSubscription(
            location=req.location,
            user_role=req.user_role or "general_public",
            language=req.language or "en",
            channels=req.channels or {"websocket": True},
            min_risk_tier=req.min_risk_tier or "Yellow",
            phone_number=req.phone_number,
            email=req.email,
            active=True
        )

        async with async_session_factory() as session:
            session.add(sub)
            await session.commit()
            await session.refresh(sub)

            return AlertSubscriptionResponse(
                id=sub.id,
                location=sub.location,
                user_role=sub.user_role,
                language=sub.language,
                channels=sub.channels,
                min_risk_tier=sub.min_risk_tier,
                active=sub.active,
                created_at=sub.created_at.isoformat()
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Subscription failed: {str(exc)}")


@router.get("/alerts/subscriptions")
async def list_subscriptions(
    location: Optional[str] = Query(None, description="Filter by location"),
    active_only: bool = Query(True, description="Only active subscriptions")
):
    """
    List all alert subscriptions (optionally filtered).
    """
    if not is_db_available():
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from sqlalchemy import select

        async with async_session_factory() as session:
            query = select(AlertSubscription)

            if active_only:
                query = query.where(AlertSubscription.active == True)

            if location:
                query = query.where(AlertSubscription.location == location)

            result = await session.execute(query)
            subs = result.scalars().all()

            return [s.to_dict() for s in subs]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(exc)}")


@router.put("/alerts/subscriptions/{subscription_id}")
async def update_subscription(
    subscription_id: str,
    req: AlertSubscriptionRequest = Body(...)
):
    """
    Update an existing alert subscription.
    """
    if not is_db_available():
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from sqlalchemy import select

        async with async_session_factory() as session:
            stmt = select(AlertSubscription).where(AlertSubscription.id == subscription_id)
            result = await session.execute(stmt)
            sub = result.scalar_one_or_none()

            if not sub:
                raise HTTPException(status_code=404, detail="Subscription not found")

            # Update fields
            if req.location:
                sub.location = req.location
            if req.user_role:
                sub.user_role = req.user_role
            if req.language:
                sub.language = req.language
            if req.channels:
                sub.channels = req.channels
            if req.min_risk_tier:
                sub.min_risk_tier = req.min_risk_tier
            if req.phone_number is not None:
                sub.phone_number = req.phone_number
            if req.email is not None:
                sub.email = req.email

            sub.updated_at = datetime.datetime.now(datetime.timezone.utc)

            await session.commit()
            await session.refresh(sub)

            return sub.to_dict()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(exc)}")


@router.delete("/alerts/subscriptions/{subscription_id}")
async def delete_subscription(subscription_id: str):
    """
    Delete/deactivate an alert subscription.
    """
    if not is_db_available():
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from sqlalchemy import select

        async with async_session_factory() as session:
            stmt = select(AlertSubscription).where(AlertSubscription.id == subscription_id)
            result = await session.execute(stmt)
            sub = result.scalar_one_or_none()

            if not sub:
                raise HTTPException(status_code=404, detail="Subscription not found")

            # Soft delete: deactivate instead of removing
            sub.active = False
            sub.updated_at = datetime.datetime.now(datetime.timezone.utc)

            await session.commit()

            return {"status": "deactivated", "subscription_id": subscription_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(exc)}")

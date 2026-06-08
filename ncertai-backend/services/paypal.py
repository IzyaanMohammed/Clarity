import os
import httpx
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "").strip()
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "").strip()
PAYPAL_ENV = os.getenv("PAYPAL_ENV", "sandbox").strip().lower()

PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com" if PAYPAL_ENV == "sandbox" else "https://api-m.paypal.com"


async def get_paypal_access_token() -> Optional[str]:
    if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{PAYPAL_API_BASE}/v1/oauth2/token",
                auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
                data={"grant_type": "client_credentials"},
                headers={"Accept": "application/json", "Accept-Language": "en_US"}
            )
            if resp.status_code == 200:
                return resp.json().get("access_token")
            else:
                logger.error(f"PayPal oauth failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"PayPal oauth exception: {e}", exc_info=True)
    return None


async def create_paypal_subscription(username: str, plan: str, success_url: str, cancel_url: str) -> Optional[dict[str, Any]]:
    token = await get_paypal_access_token()
    if not token:
        return None

    plan_env_name = "PAYPAL_PLAN_ID_PRO_MAX" if plan == "pro_max" else "PAYPAL_PLAN_ID_PRO"
    plan_id = os.getenv(plan_env_name, "").strip()
    if not plan_id:
        logger.error(f"PayPal plan ID not configured for plan: {plan}")
        return None

    payload = {
        "plan_id": plan_id,
        "custom_id": username,
        "application_context": {
            "brand_name": "Clarity AI",
            "locale": "en-US",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "SUBSCRIBE_NOW",
            "return_url": success_url,
            "cancel_url": cancel_url
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{PAYPAL_API_BASE}/v1/billing/subscriptions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Prefer": "return=representation"
                }
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                approve_url = None
                for link in data.get("links", []):
                    if link.get("rel") == "approve":
                        approve_url = link.get("href")
                        break
                return {
                    "subscription_id": data.get("id"),
                    "approve_url": approve_url,
                    "status": data.get("status")
                }
            else:
                logger.error(f"PayPal create subscription failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"PayPal subscription exception: {e}", exc_info=True)
    return None


async def verify_paypal_webhook_signature(headers: dict, body: bytes, webhook_id: str) -> bool:
    token = await get_paypal_access_token()
    if not token or not webhook_id:
        return False

    import json
    try:
        event = json.loads(body.decode("utf-8"))
    except Exception:
        return False

    payload = {
        "auth_algo": headers.get("PAYPAL-AUTH-ALGO"),
        "cert_url": headers.get("PAYPAL-CERT-URL"),
        "transmission_id": headers.get("PAYPAL-TRANSMISSION-ID"),
        "transmission_sig": headers.get("PAYPAL-TRANSMISSION-SIG"),
        "transmission_time": headers.get("PAYPAL-TRANSMISSION-TIME"),
        "webhook_id": webhook_id,
        "webhook_event": event
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
            )
            if resp.status_code == 200:
                return resp.json().get("verification_status") == "SUCCESS"
    except Exception as e:
        logger.error(f"PayPal webhook verification exception: {e}", exc_info=True)
    return False

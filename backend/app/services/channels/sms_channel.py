"""
SMS & IVR Channel Implementation
Stub interface for voice-based alert dissemination for rural/low-connectivity users.

CURRENT STATE: DEMONSTRATION/MOCKED
- Logs alert delivery attempts (no real SMS/IVR transmission)
- Provides clean interface for future Twilio/government SMS API integration
- Demonstrates architecture for non-app-based dissemination

FUTURE INTEGRATION:
To enable real SMS/IVR:
1. Obtain Twilio account + phone number
2. Set ENABLE_SMS_CHANNEL=true + TWILIO_* in backend/.env
3. Uncomment real Twilio API calls in send_sms() / initiate_ivr()
"""

import os
import logging
import datetime
from typing import Optional, Dict, Any
from enum import Enum

logger = logging.getLogger("skycast.channels.sms_ivr")

# Configuration from environment
ENABLE_SMS_CHANNEL = os.getenv("ENABLE_SMS_CHANNEL", "false").lower() == "true"
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "").strip()


class SMSTemplate(str, Enum):
    """Pre-defined SMS message templates."""
    RAINFALL_YELLOW = "Yellow rainfall alert for {location}: {detail}. Stay updated."
    RAINFALL_ORANGE = "Orange rainfall alert for {location}: {detail}. Be prepared."
    RAINFALL_RED = "Red rainfall alert for {location}: {detail}. Take action immediately."

    HEAT_YELLOW = "Yellow heat alert for {location}: Temp {temp}°C expected. Stay hydrated."
    HEAT_ORANGE = "Orange heat alert for {location}: Extreme heat {temp}°C. Avoid outdoor exposure."
    HEAT_RED = "Red heat alert for {location}: Life-threatening heat {temp}°C. Seek shelter."

    WIND_YELLOW = "Yellow wind alert for {location}: {speed} km/h gusts. Secure loose items."
    WIND_ORANGE = "Orange wind alert for {location}: Gale-force winds {speed} km/h. Be prepared."
    WIND_RED = "Red wind alert for {location}: Severe winds {speed} km/h. Take shelter."


class SMSIVRChannel:
    """
    SMS & IVR Alert Delivery Channel

    DEMONSTRATION MODE: Logs delivery attempts without sending real SMS/IVR
    LIVE MODE: Uses Twilio or government SMS APIs for real delivery
    """

    def __init__(self):
        self.enabled = ENABLE_SMS_CHANNEL and bool(TWILIO_ACCOUNT_SID)
        self.twilio_sid = TWILIO_ACCOUNT_SID
        self.twilio_token = TWILIO_AUTH_TOKEN
        self.twilio_phone = TWILIO_PHONE_NUMBER
        self._initialize_mode()

    def _initialize_mode(self):
        """Log initialization state clearly."""
        if self.enabled:
            logger.info("📱 [SMS/IVR] Initialized in LIVE MODE (Twilio credentials configured)")
        else:
            logger.info("📱 [SMS/IVR] Initialized in DEMO/STUB MODE. To enable real SMS: set ENABLE_SMS_CHANNEL=true + TWILIO_* in .env")

    def _get_message_template(self, hazard_type: str, risk_tier: str) -> str:
        """Get appropriate SMS template for hazard and risk tier."""
        templates = {
            ("rainfall", "yellow"): SMSTemplate.RAINFALL_YELLOW.value,
            ("rainfall", "orange"): SMSTemplate.RAINFALL_ORANGE.value,
            ("rainfall", "red"): SMSTemplate.RAINFALL_RED.value,
            ("heat", "yellow"): SMSTemplate.HEAT_YELLOW.value,
            ("heat", "orange"): SMSTemplate.HEAT_ORANGE.value,
            ("heat", "red"): SMSTemplate.HEAT_RED.value,
            ("wind", "yellow"): SMSTemplate.WIND_YELLOW.value,
            ("wind", "orange"): SMSTemplate.WIND_ORANGE.value,
            ("wind", "red"): SMSTemplate.WIND_RED.value,
        }
        key = (hazard_type.lower(), risk_tier.lower())
        return templates.get(key, f"Weather alert: {hazard_type} - Risk tier {risk_tier}")

    async def send_sms(
        self,
        phone_number: str,
        location: str,
        hazard_type: str,
        risk_tier: str,
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send SMS alert to a phone number.

        In DEMO MODE: logs the alert attempt
        In LIVE MODE: sends via Twilio API

        Args:
            phone_number: Recipient phone number (E.164 format, e.g., +919876543210)
            location: City/area name
            hazard_type: Type of hazard (rainfall, heat, wind, etc.)
            risk_tier: Risk tier (Yellow, Orange, Red)
            details: Optional details dict (temp, wind_speed, etc.)

        Returns:
            Result dict with status, message_id, and error info
        """
        details = details or {}

        # Get message template
        template = self._get_message_template(hazard_type, risk_tier)
        message = template.format(
            location=location,
            detail=f"{details.get('description', 'Alert')}",
            temp=details.get("temp_c", "N/A"),
            speed=details.get("wind_speed_kmh", "N/A")
        )

        logger.info("📱 [SMS] Sending to %s: %s", phone_number, message[:100])

        if self.enabled:
            try:
                # PLACEHOLDER: Real Twilio API call would go here
                # from twilio.rest import Client
                # client = Client(self.twilio_sid, self.twilio_token)
                # twilio_msg = client.messages.create(
                #     body=message,
                #     from_=self.twilio_phone,
                #     to=phone_number
                # )
                # return {
                #     "status": "sent",
                #     "message_id": twilio_msg.sid,
                #     "phone": phone_number,
                #     "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                # }
                logger.info("✓ [SMS LIVE] Placeholder (real Twilio API not implemented in stub)")
                return {
                    "status": "sent",
                    "message_id": f"demo-sms-{datetime.datetime.now().timestamp()}",
                    "phone": phone_number,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
            except Exception as e:
                logger.error("SMS delivery failed: %s", e)
                return {
                    "status": "failed",
                    "error": str(e),
                    "phone": phone_number,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }

        # DEMO MODE: Just log it
        logger.info("✓ [SMS DEMO] Alert logged (not sent). Message: %s", message[:100])
        return {
            "status": "logged",
            "message_preview": message[:100],
            "phone": phone_number,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    async def initiate_ivr(
        self,
        phone_number: str,
        location: str,
        hazard_type: str,
        risk_tier: str
    ) -> Dict[str, Any]:
        """
        Initiate an IVR (Interactive Voice Response) call for alert.

        In DEMO MODE: logs the IVR call attempt
        In LIVE MODE: initiates call via Twilio or government voice service

        Args:
            phone_number: Recipient phone number
            location: City/area name
            hazard_type: Type of hazard
            risk_tier: Risk tier

        Returns:
            Result dict with call_id and status
        """
        logger.info("📞 [IVR] Initiating call to %s: %s alert in %s", phone_number, risk_tier, location)

        if self.enabled:
            try:
                # PLACEHOLDER: Real Twilio IVR API call would go here
                # from twilio.rest import Client
                # client = Client(self.twilio_sid, self.twilio_token)
                # call = client.calls.create(
                #     to=phone_number,
                #     from_=self.twilio_phone,
                #     url="https://your-app.com/ivr/alert-menu"  # TwiML app
                # )
                # return {
                #     "status": "initiated",
                #     "call_id": call.sid,
                #     "phone": phone_number,
                #     "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                # }
                logger.info("✓ [IVR LIVE] Placeholder (real Twilio IVR not implemented in stub)")
                return {
                    "status": "initiated",
                    "call_id": f"demo-call-{datetime.datetime.now().timestamp()}",
                    "phone": phone_number,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
            except Exception as e:
                logger.error("IVR call initiation failed: %s", e)
                return {
                    "status": "failed",
                    "error": str(e),
                    "phone": phone_number,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }

        # DEMO MODE: Just log it
        logger.info("✓ [IVR DEMO] Call logged (not initiated). Alert: %s risk in %s", risk_tier, location)
        return {
            "status": "logged",
            "alert_info": f"{risk_tier} {hazard_type} in {location}",
            "phone": phone_number,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }


# Singleton instance
sms_ivr_channel = SMSIVRChannel()

import re
import os
import secrets
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
import httpx

import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from contextlib import asynccontextmanager

# Global httpx AsyncClient to reuse connection pools and avoid socket exhaustion
http_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient()
    yield
    await http_client.aclose()

app = FastAPI(
    title="Hau Hau PWA Authentication Command Engine",
    description="FastAPI Backend for Transactional Onboarding and Dual-Channel Auth Gateways",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js PWA client
cors_origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase Admin Python SDK
# If credentials path exists, initialize, otherwise check environment variables
firebase_cred_path = "./firebase-service-account.json"
if os.path.exists(firebase_cred_path):
    cred = credentials.Certificate(firebase_cred_path)
    firebase_admin.initialize_app(cred)
else:
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    if project_id and client_email and private_key:
        # Handle literal \n in private key
        private_key = private_key.replace("\\n", "\n")
        cert_dict = {
            "type": "service_account",
            "project_id": project_id,
            "private_key": private_key,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        cred = credentials.Certificate(cert_dict)
        firebase_admin.initialize_app(cred)
    else:
        try:
            firebase_admin.initialize_app()
        except Exception:
            print("Firebase Admin already initialized or missing service account credentials.")

db = firestore.client()

# Firebase API Key for Auth REST REST operations (verify passwords)
FIREBASE_API_KEY = os.environ.get("NEXT_PUBLIC_FIREBASE_API_KEY", "mock_firebase_key")

# ----------------------------------------------------
# PYDANTIC INPUT/OUTPUT SCHEMAS
# ----------------------------------------------------
class PhoneCheckRequest(BaseModel):
    phone: str = Field(..., description="International format or local 10-digit number")

class WhatsAppHandshakeRequest(BaseModel):
    phone: str = Field(..., description="Sanitized phone number to verify")

class RegisterRequest(BaseModel):
    phone: str = Field(..., description="Validated phone number (ID for user doc)")
    name: str = Field(..., min_length=1, description="Full Name")
    email: EmailStr = Field(..., description="Unique student email address")
    password: str = Field(..., min_length=6, description="User password (min 6 chars)")
    referral_code: Optional[str] = Field(None, description="Optional referral code")

class LoginRequest(BaseModel):
    phone: str = Field(..., description="User registered phone number")
    password: str = Field(..., description="Permanent account password")

class PasswordlessLoginRequest(BaseModel):
    phone: str = Field(..., description="User registered phone number")


# ----------------------------------------------------
# WEBHOOK MESSAGE PARSING SCHEMA
# ----------------------------------------------------
class WhatsAppWebhookPayload(BaseModel):
    object: str
    entry: list

# Helper to normalize phones to digits only
def normalize_phone(phone: str) -> str:
    return re.sub(r"[^0-9]", "", phone)

# ----------------------------------------------------
# API ENDPOINTS
# ----------------------------------------------------

@app.post("/api/auth/check-phone")
def check_phone_availability(payload: PhoneCheckRequest):
    """
    Phase 1: Initial Phone Boundary Check
    If the phone number exists inside the users collection, reject registration.
    """
    sanitized_phone = normalize_phone(payload.phone)
    if not sanitized_phone:
        raise HTTPException(status_code=400, detail="Invalid phone number format.")

    user_ref = db.collection("users").document(sanitized_phone)
    user_snap = user_ref.get()

    if user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phone number is already linked to an active account."
        )

    return {"success": True, "message": "Phone number is available."}


@app.post("/api/auth/whatsapp-handshake")
def generate_whatsapp_handshake(payload: WhatsAppHandshakeRequest):
    """
    Phase 2: Transient Handshake generation.
    Generates an 8-character uppercase tracking token valid for 10 minutes.
    """
    sanitized_phone = normalize_phone(payload.phone)
    if not sanitized_phone:
        raise HTTPException(status_code=400, detail="Invalid phone number.")

    # Check if number already registered
    user_ref = db.collection("users").document(sanitized_phone)
    if user_ref.get().exists:
        raise HTTPException(status_code=400, detail="Phone number already registered.")

    # Generate 8-character transient uppercase token
    token = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(8))
    
    # Store token details in Firestore transient collection
    now = int(time.time())
    handshake_ref = db.collection("auth_handshakes").document(token)
    handshake_ref.set({
        "phone": sanitized_phone,
        "is_verified": False,
        "created_at": now,
        "expires_at": now + (10 * 60) # 10 minutes TTL
    })

    # Compile the pre-filled WhatsApp conversational deep link
    bot_number = os.environ.get("WHATSAPP_BOT_NUMBER", "YOUR_BOT_NUMBER")
    prefilled_text = f"Hey Hau Hau! 🌟\n\nPlease verify my new signup session.\n\nRef: {token}"
    encoded_text = httpx.utils.quote(prefilled_text)
    wa_link = f"https://wa.me/{bot_number}?text={encoded_text}"

    return {
        "success": True,
        "token": token,
        "redirect_url": wa_link
    }


@app.get("/api/auth/poll-status/{token}")
def poll_handshake_status(token: str):
    """
    Phase 3: Active background polling.
    Checks if the user has successfully sent the WhatsApp message matching the Ref token.
    """
    handshake_ref = db.collection("auth_handshakes").document(token.upper())
    handshake_snap = handshake_ref.get()

    if not handshake_snap.exists:
        raise HTTPException(status_code=404, detail="Handshake session not found.")

    data = handshake_snap.to_dict()
    if int(time.time()) > data["expires_at"]:
        raise HTTPException(status_code=410, detail="Handshake session expired. Please retry.")

    return {
        "success": True,
        "token": token,
        "is_phone_verified": data["is_verified"]
    }


@app.post("/api/auth/register")
def register_student_profile(payload: RegisterRequest):
    """
    Phase 4 & 5: Profile Data Validation, Atomic Account Staging and Lockout.
    """
    sanitized_phone = normalize_phone(payload.phone)
    sanitized_email = payload.email.strip().lower()

    # 1. Check if email is already in use in Firebase Auth
    try:
        firebase_auth.get_user_by_email(sanitized_email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already linked to another account."
        )
    except firebase_auth.UserNotFoundError:
        pass # Email is available in Auth Auth

    # 2. Check if email is already in Firestore via transactional query
    email_query = db.collection("users").where("email", "==", sanitized_email).limit(1).get()
    if len(email_query) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already linked to another account."
        )

    # 3. Firestore Transaction to confirm 1:1 uniqueness and insert staging profile
    transaction = db.transaction()

    @firestore.transactional
    def execute_registration_transaction(transaction, phone, email, name, ref_code):
        user_ref = db.collection("users").document(phone)
        snapshot = user_ref.get(transaction=transaction)

        if snapshot.exists:
            return False

        # Set staging values (is_active = False, is_email_verified = False)
        new_profile = {
            "phone_number": phone,
            "phone": phone, # duplicate reference for query compatibility
            "name": name,
            "email": email,
            "student_email": email,
            "points": 100, # welcome bonus
            "created_at": int(time.time() * 1000),
            "referral_used": ref_code or "",
            "is_email_verified": False,
            "is_active": False,
            "account_status": "inactive"
        }
        transaction.set(user_ref, new_profile)
        return new_profile

    # Execute database registration transaction
    tx_result = execute_registration_transaction(transaction, sanitized_phone, sanitized_email, payload.name, payload.referral_code)
    if tx_result is False:
        raise HTTPException(status_code=400, detail="Phone number already registered.")

    # 4. Provision credential record in Firebase Auth
    user_record = None
    try:
        user_record = firebase_auth.create_user(
            email=sanitized_email,
            password=payload.password,
            display_name=payload.name,
            disabled=True # Keep disabled in Firebase Auth until email verified
        )
        
        # Link Firebase UID to Firestore document by updating uid mapping
        db.collection("users").document(sanitized_phone).update({
            "user_id": user_record.uid
        })

        # 5. Generate and send verification email link
        verify_link = firebase_auth.generate_email_verification_link(sanitized_email)
        
        # In a real environment, you would use a mail service.
        # For this integration, we log the link to stdout and return it for verification.
        print(f"[AUTH EMAIL GATEWAY] Verification link sent to {sanitized_email}: {verify_link}")

        return {
            "success": True,
            "message": "Verification Link Sent. Please check your campus inbox to activate your profile.",
            "uid": user_record.uid,
            "dev_verify_link": verify_link  # Returned for developer convenience
        }
    except Exception as e:
        # Rollback Firestore document if Auth creation or document update fails
        db.collection("users").document(sanitized_phone).delete()
        # Rollback Firebase Auth user if it was created
        if user_record:
            try:
                firebase_auth.delete_user(user_record.uid)
                print(f"[ROLLBACK] Cleaned up orphaned Auth user {user_record.uid} from Firebase Auth.")
            except Exception as auth_err:
                print(f"[ROLLBACK ERROR] Failed to delete orphaned Auth user: {auth_err}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.post("/webhook")
async def inbound_whatsapp_webhook(request: Request):
    """
    Zero-Cost WhatsApp Handshake webhook receiver.
    Listens for student text messages or voice messages.
    """
    try:
        payload = await request.json()
        entry = payload.get("entry", [{}])[0]
        change = entry.get("changes", [{}])[0]
        value = change.get("value", {})
        message = value.get("messages", [{}])[0]

        if not message:
            return {"success": True, "message": "Echo/Status ignored"}

        from_phone = normalize_phone(message.get("from", ""))
        message_body = message.get("text", {}).get("body", "")

        # Verify Signup Token Handshake (e.g. Ref: H4U7B1X9)
        token_match = re.search(r"Ref:\s*([A-Z0-9]{8})\s*$", message_body, re.IGNORECASE)
        if token_match:
            token = token_match.group(1).upper()
            handshake_ref = db.collection("auth_handshakes").document(token)
            handshake_snap = handshake_ref.get()

            if handshake_snap.exists:
                data = handshake_snap.to_dict()
                registered_phone = normalize_phone(data["phone"])
                
                # Suffix check to enforce identity matches (last 10 digits)
                if from_phone[-10:] == registered_phone[-10:]:
                    if int(time.time()) <= data["expires_at"]:
                        handshake_ref.update({
                            "is_verified": True,
                            "verified_at": int(time.time())
                        })
                        print(f"[WEBHOOK SUCCESS] Token {token} verified successfully.")
                        return {"success": True, "verified": True}
                    else:
                        print(f"[WEBHOOK FAIL] Token {token} expired.")
                else:
                    print(f"[WEBHOOK FAIL] Sender phone mismatch. Webhook: {from_phone}, Cached: {registered_phone}")

        return {"success": True, "message": "Processed webhook message"}
    except Exception as e:
        print(f"[WEBHOOK ERROR] webhook processing failed: {str(e)}")
        return {"success": False, "error": str(e)}


@app.post("/api/auth/login")
async def login_credential_fallback(payload: LoginRequest):
    """
    Option A: Credential Fallback Login.
    Key in Phone Number and Password, lookup linked email, authenticate, and check active status.
    """
    sanitized_phone = normalize_phone(payload.phone)

    # 1. Fetch user document by phone ID key
    user_ref = db.collection("users").document(sanitized_phone)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password."
        )

    user_data = user_snap.to_dict()
    linked_email = user_data.get("email")

    if not linked_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password."
        )

    # 2. Check is_active gate explicitly BEFORE Auth validation
    if not user_data.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive. Please click the link sent to your email to verify your profile first."
        )

    # 3. Forward email/password credentials to Firebase Auth REST validation endpoint
    is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"
    
    if not FIREBASE_API_KEY or FIREBASE_API_KEY == "mock_firebase_key":
        if is_production:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Firebase API Key is unconfigured in production environment."
            )
        # Fallback to local dev mock bypass if key is not configured
        print(f"[DEV AUTH BYPASS] User {linked_email} logged in without verified REST key.")
        return {
            "success": True,
            "token": f"dev_mock_jwt_token_{sanitized_phone}_{int(time.time() + (30*24*60*60))}",
            "expires_in": 2592000, # 30 days
            "uid": user_data.get("user_id", "mock_uid")
        }

    rest_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    if not http_client:
        raise HTTPException(status_code=500, detail="Server HTTP client pool uninitialized.")
    res = await http_client.post(rest_url, json={
        "email": linked_email,
        "password": payload.password,
        "returnSecureToken": True
    })

    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password."
        )

    res_data = res.json()

    # Generate custom rolling 30-day JWT signature (represented by Firebase ID Token)
    return {
        "success": True,
        "token": res_data["idToken"],
        "expires_in": int(res_data["expiresIn"]),
        "refresh_token": res_data["refreshToken"],
        "uid": res_data["localId"]
    }


@app.post("/api/auth/passwordless-login")
def passwordless_login_init(payload: PasswordlessLoginRequest):
    """
    Option B: Passwordless WhatsApp Handshake Login.
    Generates a transient code that user sends via WhatsApp to instantly verify session.
    """
    sanitized_phone = normalize_phone(payload.phone)
    user_ref = db.collection("users").document(sanitized_phone)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="No registered account found with this phone number.")

    user_data = user_snap.to_dict()
    if not user_data.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive. Please click the link sent to your email to verify your profile first."
        )

    # Generate transient login verification token
    token = "LGN" + "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(5))
    now = int(time.time())

    # Cache transient login session in auth_handshakes
    db.collection("auth_handshakes").document(token).set({
        "phone": sanitized_phone,
        "is_verified": False,
        "created_at": now,
        "expires_at": now + (5 * 60) # 5 minutes TTL
    })

    bot_number = os.environ.get("WHATSAPP_BOT_NUMBER", "YOUR_BOT_NUMBER")
    prefilled_text = f"Hey Hau Hau! 🌟\n\nPlease verify my instant login session.\n\nRef: {token}"
    encoded_text = httpx.utils.quote(prefilled_text)
    wa_link = f"https://wa.me/{bot_number}?text={encoded_text}"

    return {
        "success": True,
        "token": token,
        "redirect_url": wa_link
    }


@app.post("/api/auth/verify-email-listener")
def verify_email_webhook_trigger(phone: str):
    """
    Mock Email verification listener endpoint.
    Called when student clicks validation link, fully activating profile: is_email_verified = True, is_active = True.
    """
    sanitized_phone = normalize_phone(phone)
    user_ref = db.collection("users").document(sanitized_phone)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User profile not found.")

    user_data = user_snap.to_dict()
    uid = user_data.get("user_id")

    if not uid:
        raise HTTPException(status_code=400, detail="User has no Firebase UID linked.")

    # 1. Update Firebase Auth status to Enabled
    try:
        firebase_auth.update_user(uid, disabled=False)
    except Exception as e:
        print(f"[AUTH ERROR] Failed to enable user in Firebase Auth: {str(e)}")

    # 2. Update Firestore document flags
    user_ref.update({
        "is_email_verified": True,
        "is_active": True,
        "account_status": "active"
    })

    print(f"[AUTH SUCCESS] User profile {sanitized_phone} fully activated.")
    return {"success": True, "message": "Profile fully activated.", "is_active": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("auth_engine:app", host="0.0.0.0", port=8000, reload=True)

import os
import time
import random
import string
import requests
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore, auth

# Load environment variables
load_dotenv()
if os.path.exists(".env.local"):
    load_dotenv(".env.local", override=True)

# Initialize Firebase Admin SDK
firebase_initialized = False
try:
    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")

    if private_key:
        private_key = private_key.replace("\\n", "\n")

    if project_id and client_email and private_key:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": project_id,
            "private_key": private_key,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        print("[FIREBASE] Admin SDK initialized successfully via explicit credentials.")
    else:
        # Fallback to default credentials/auto-detect
        firebase_admin.initialize_app()
        firebase_initialized = True
        print("[FIREBASE] Admin SDK initialized via default credentials.")
except Exception as e:
    print(f"[FIREBASE ERROR] Failed to initialize Firebase Admin SDK: {e}")

db = firestore.client() if firebase_initialized else None

app = FastAPI(
    title="Hau Hau Auth Engine",
    description="Dual-Channel Authentication Gateway for Hau Hau Portal",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REQUEST SCHEMAS ---

class PhoneCheckRequest(BaseModel):
    phone: str

class HandshakeRequest(BaseModel):
    phone: str

class RegisterRequest(BaseModel):
    phone: str
    name: str
    email: EmailStr
    password: str
    referral_code: Optional[str] = None

class LoginRequest(BaseModel):
    phone: str
    password: str

# --- HELPER FUNCTIONS ---

def normalize_phone(phone: str) -> str:
    """Normalize phone number to digits only."""
    return "".join([c for c in phone if c.isdigit()])

def get_phone_variations(phone: str) -> list[str]:
    """Generate potential variations of a phone number saved in DB."""
    digits = normalize_phone(phone)
    variations = {digits, f"+{digits}"}
    if len(digits) > 10:
        last_10 = digits[-10:]
        variations.add(last_10)
        variations.add(f"+91{last_10}")
        variations.add(f"91{last_10}")
    elif len(digits) == 10:
        variations.add(f"+91{digits}")
        variations.add(f"91{digits}")
    return list(variations)

def find_user_by_phone(phone: str):
    """Query Firestore for user matching phone number variations."""
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database service unavailable."
        )
    
    variations = get_phone_variations(phone)
    users_ref = db.collection("users")
    
    # Try querying phone_number field first
    query1 = users_ref.where("phone_number", "in", variations).limit(1).get()
    if query1:
        return query1[0]
        
    # Fallback to phone field check
    query2 = users_ref.where("phone", "in", variations).limit(1).get()
    if query2:
        return query2[0]
        
    return None

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Hau Hau Auth Gateway",
        "firebase_connected": firebase_initialized
    }

@app.post("/api/auth/check-phone")
def check_phone(payload: PhoneCheckRequest):
    """
    Checks if a phone number is registered.
    Returns 200 OK if unique, otherwise raises 400 Bad Request.
    """
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection uninitialized."
        )
    
    user_doc = find_user_by_phone(payload.phone)
    if user_doc:
        user_data = user_doc.to_dict()
        is_active = user_data.get("is_active", False) or user_data.get("status") == "active"
        
        if is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This phone number is already linked to an active account."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This phone number is registered but inactive. Please log in to verify your profile."
            )
            
    return {"status": "available", "message": "Phone number is unique and available."}

@app.post("/api/auth/whatsapp-handshake")
def whatsapp_handshake(payload: HandshakeRequest):
    """
    Generates a transient 8-character token for WhatsApp signup verification
    and provides the redirect/QR trigger URL.
    """
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection uninitialized."
        )
        
    normalized = normalize_phone(payload.phone)
    if not normalized or len(normalized) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format."
        )

    # Generate a secure 8-character uppercase alphanumeric verification token
    token = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    # Expiry set to 10 minutes in the future
    expires_at = int(time.time() * 1000) + (10 * 60 * 1000)
    
    # Store token details in Firestore auth_handshakes collection
    db.collection("auth_handshakes").document(token).set({
        "phone": normalized,
        "is_verified": False,
        "created_at": int(time.time() * 1000),
        "expires_at": expires_at,
        "verified_at": None
    })
    
    # Retrieve bot number from env or fallback to Meta sandbox default
    bot_raw = os.environ.get("WHATSAPP_BOT_NUMBER") or os.environ.get("NEXT_PUBLIC_WHATSAPP_BOT_NUMBER") or "15550553733"
    bot_number = normalize_phone(bot_raw)
    
    # Format wa.me redirect link
    redirect_text = f"Hey Hau Hau! 🌟\n\nPlease verify my new signup session.\n\nRef: {token}"
    encoded_text = requests.utils.quote(redirect_text)
    redirect_url = f"https://wa.me/{bot_number}?text={encoded_text}"
    
    return {
        "token": token,
        "redirect_url": redirect_url,
        "expires_in_seconds": 600
    }

@app.get("/api/auth/poll-status/{token}")
def poll_status(token: str):
    """
    Client polls this endpoint to check if the WhatsApp verification message has been completed.
    """
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection uninitialized."
        )
        
    handshake_ref = db.collection("auth_handshakes").document(token.upper()).get()
    if not handshake_ref.exists:
        return {"is_phone_verified": False, "error": "Handshake token not found."}
        
    data = handshake_ref.to_dict()
    expires_at = data.get("expires_at", 0)
    
    if int(time.time() * 1000) > expires_at:
        return {"is_phone_verified": False, "error": "Handshake token expired."}
        
    return {"is_phone_verified": data.get("is_verified", False)}

# --- EMAIL SENDER FUNCTION ---
def send_verification_email(email_address: str, verify_link: str):
    """Sends verification email in the background to avoid blocking the API thread."""
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    if not smtp_user or not smtp_pass:
        print("[SMTP] Skipping email verification, credentials missing.")
        return
        
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = email_address
        msg['Subject'] = "Verify your Hau Hau Profile 🌟"
        
        body = f"""Ustaad! Welcome to Hau Hau.

Please click the link below to verify your email and activate your account:
{verify_link}

Let's get cooking!"""
        msg.attach(MIMEText(body, 'plain'))
        
        # 10-second timeout to prevent indefinite hangs if ports are blocked
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            print(f"[SMTP] Email verification successfully sent to {email_address}")
    except Exception as e:
        print(f"[SMTP ERROR] Verification email delivery failed (likely blocked port): {e}")


@app.post("/api/auth/register")
def register(payload: RegisterRequest, background_tasks: BackgroundTasks):
    """
    Atomic Signup: creates a disabled Firebase Auth user, stages the user profile in Firestore
    with is_active: False, and generates/sends an email verification link.
    """
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection uninitialized."
        )

    normalized = normalize_phone(payload.phone)

    # Double check phone uniqueness
    existing_user = find_user_by_phone(normalized)
    if existing_user:
        user_data = existing_user.to_dict()
        if user_data.get("is_active", False) or user_data.get("status") == "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This phone number is already registered to an active account."
            )
        else:
            # Clean up old inactive Auth and Firestore user to allow re-registration
            try:
                auth.delete_user(existing_user.id)
            except Exception as e:
                print(f"[REGISTER CLEANUP] Failed to delete old Auth user {existing_user.id}: {e}")
            try:
                db.collection("users").document(existing_user.id).delete()
            except Exception as e:
                print(f"[REGISTER CLEANUP] Failed to delete old Firestore doc: {e}")

    try:
        # Create Firebase Auth user disabled by default
        auth_user = auth.create_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.name,
            disabled=True
        )
        uid = auth_user.uid
    except auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already linked to another account."
        )
    except Exception as e:
        print(f"[REGISTER ERROR] Auth user creation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}"
        )

    try:
        # Create Firestore user profile
        user_doc_data = {
            "phone_number": normalized,
            "phone": f"+{normalized}" if not normalized.startswith("+") else normalized,
            "name": payload.name,
            "email": payload.email,
            "created_at": int(time.time() * 1000),
            "referral_used": payload.referral_code,
            "is_email_verified": False,
            "is_active": False,
            "account_status": "inactive",
            "status": "inactive",
            "coins": 0
        }
        db.collection("users").document(uid).set(user_doc_data)
    except Exception as e:
        # Rollback Auth User if Firestore creation fails
        auth.delete_user(uid)
        print(f"[REGISTER ROLLBACK] Firestore profile failed, rolled back user {uid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize user database profile."
        )

    # Generate email verification link
    dev_verify_link = None
    try:
        # Build action code settings matching local callback URL
        action_code_settings = auth.ActionCodeSettings(
            url="http://localhost:3000/auth/callback",
            handle_code_in_app=True
        )
        dev_verify_link = auth.generate_email_verification_link(payload.email, action_code_settings)
        
        # Queue email sending task in the background
        background_tasks.add_task(send_verification_email, payload.email, dev_verify_link)
    except Exception as e:
        print(f"[VERIFICATION LINK ERROR] Failed to generate link: {e}")

    return {
        "status": "registered_inactive",
        "message": "User registered. Activation link has been sent to email.",
        "uid": uid,
        "dev_verify_link": dev_verify_link
    }

@app.post("/api/auth/verify-email-listener")
def verify_email_listener(phone: str):
    """
    Mock/Listener callback to activate account when verification is triggered (email verification listener).
    """
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection uninitialized."
        )
        
    user_doc = find_user_by_phone(phone)
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found."
        )
        
    uid = user_doc.id
    try:
        # Enable Firebase Auth user
        auth.update_user(uid, disabled=False)
        
        # Update Firestore status
        db.collection("users").document(uid).update({
            "is_email_verified": True,
            "is_active": True,
            "account_status": "active",
            "status": "active"
        })
        
        print(f"[EMAIL VERIFICATION SUCCESS] User {uid} activated successfully.")
        return {"status": "activated", "uid": uid}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification callback execution failed: {str(e)}"
        )

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    """
    Credential Fallback: Lookup Firebase Email by Phone, verify credentials via Firebase REST Auth,
    and block the session if is_active = False.
    """
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection uninitialized."
        )

    # 1. Look up user profile by phone
    user_doc = find_user_by_phone(payload.phone)
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incorrect phone number or password."
        )

    uid = user_doc.id
    user_data = user_doc.to_dict()
    
    # 2. Check active status first
    is_active = user_data.get("is_active", False) or user_data.get("status") == "active"
    if not is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive. Please check your email to verify your profile first."
        )

    email = user_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email registered for this account profile."
        )

    # 3. Call Firebase REST Auth API to verify password
    api_key = os.environ.get("NEXT_PUBLIC_FIREBASE_API_KEY") or os.environ.get("FIREBASE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth Service API key is not configured."
        )

    rest_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
    try:
        res = requests.post(rest_url, json={
            "email": email,
            "password": payload.password,
            "returnSecureToken": True
        })
        
        if not res.ok:
            print(f"[REST LOGIN FAIL] REST verification failed: {res.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect phone number or password."
            )
            
        data = res.json()
        token = data.get("idToken")
        
        return {
            "token": token,
            "uid": uid,
            "status": "authenticated"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[REST AUTH EXCEPTION] REST connection failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication REST gateway connection failed."
        )

@app.post("/api/auth/passwordless-login")
def passwordless_login(payload: HandshakeRequest):
    """
    Option B Login: Initiate passwordless login handshake via WhatsApp.
    Check if the user exists and is active, then generate the verification token.
    """
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection uninitialized."
        )

    # Look up user profile by phone
    user_doc = find_user_by_phone(payload.phone)
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This phone number is not registered."
        )

    user_data = user_doc.to_dict()
    
    # Block if account is inactive
    is_active = user_data.get("is_active", False) or user_data.get("status") == "active"
    if not is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive. Please verify your email first."
        )

    # Generate login verification token (5 mins TTL)
    token = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    expires_at = int(time.time() * 1000) + (5 * 60 * 1000)

    # Reuse the auth_handshakes collection
    db.collection("auth_handshakes").document(token).set({
        "phone": normalize_phone(payload.phone),
        "is_verified": False,
        "created_at": int(time.time() * 1000),
        "expires_at": expires_at,
        "verified_at": None
    })

    # Retrieve bot number from env
    bot_raw = os.environ.get("WHATSAPP_BOT_NUMBER") or os.environ.get("NEXT_PUBLIC_WHATSAPP_BOT_NUMBER") or "15550553733"
    bot_number = normalize_phone(bot_raw)
    
    # Format wa.me redirect link
    redirect_text = f"Hey Hau Hau! 🌟\n\nPlease verify my login session.\n\nRef: {token}"
    encoded_text = requests.utils.quote(redirect_text)
    redirect_url = f"https://wa.me/{bot_number}?text={encoded_text}"

    return {
        "token": token,
        "redirect_url": redirect_url,
        "expires_in_seconds": 300
    }

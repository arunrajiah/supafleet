#!/usr/bin/env python3
"""Generate a long-lived Supabase-compatible JWT (HS256)."""

import sys, json, hmac, hashlib, base64, time

def b64url(data):
    if isinstance(data, dict):
        data = json.dumps(data, separators=(',', ':')).encode()
    elif isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def make_jwt(secret: str, role: str) -> str:
    header  = {"alg": "HS256", "typ": "JWT"}
    now     = int(time.time())
    payload = {
        "role": role,
        "iss":  "supabase-local",
        "iat":  now,
        "exp":  now + 20 * 365 * 24 * 3600,   # 20 years
    }
    msg = f"{b64url(header)}.{b64url(payload)}"
    sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest()
    return f"{msg}.{b64url(sig)}"

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <jwt_secret> <role>", file=sys.stderr)
        sys.exit(1)
    print(make_jwt(sys.argv[1], sys.argv[2]))

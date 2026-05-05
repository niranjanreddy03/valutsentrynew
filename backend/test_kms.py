"""
Run this once to verify your KMS key is correctly wired up.
Usage:
    cd backend
    KMS_KEY_ID=<your-key-id> AWS_REGION=us-east-1 \
    AWS_ACCESS_KEY_ID=<id> AWS_SECRET_ACCESS_KEY=<secret> \
    python test_kms.py
"""

import os
import sys
import boto3
from botocore.exceptions import BotoCoreError, ClientError

KMS_KEY_ID = os.getenv("KMS_KEY_ID")
AWS_REGION  = os.getenv("AWS_REGION", "us-east-1")
AWS_KEY_ID  = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET  = os.getenv("AWS_SECRET_ACCESS_KEY")

PASS = "\033[92m PASS\033[0m"
FAIL = "\033[91m FAIL\033[0m"


def check(label: str, ok: bool, detail: str = ""):
    icon = PASS if ok else FAIL
    print(f"[{icon}] {label}" + (f" — {detail}" if detail else ""))
    return ok


def main():
    all_ok = True

    # 1. Env vars present
    all_ok &= check("KMS_KEY_ID set", bool(KMS_KEY_ID), KMS_KEY_ID or "MISSING")
    all_ok &= check("AWS_ACCESS_KEY_ID set", bool(AWS_KEY_ID))
    all_ok &= check("AWS_SECRET_ACCESS_KEY set", bool(AWS_SECRET))

    if not all_ok:
        print("\nSet the missing env vars and re-run.")
        sys.exit(1)

    # 2. Connect to KMS
    try:
        client = boto3.client(
            "kms",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_KEY_ID,
            aws_secret_access_key=AWS_SECRET,
        )
        info = client.describe_key(KeyId=KMS_KEY_ID)
        meta = info["KeyMetadata"]
        check("KMS key reachable", True, f"State={meta['KeyState']}, Usage={meta['KeyUsage']}")
        check("Key is ENABLED", meta["KeyState"] == "Enabled", meta["KeyState"])
        check("Key is ENCRYPT_DECRYPT", meta["KeyUsage"] == "ENCRYPT_DECRYPT", meta["KeyUsage"])
    except (BotoCoreError, ClientError) as e:
        check("KMS key reachable", False, str(e))
        sys.exit(1)

    # 3. GenerateDataKey
    try:
        resp = client.generate_data_key(
            KeyId=KMS_KEY_ID,
            KeySpec="AES_256",
            EncryptionContext={"user_id": "test-user-123"},
        )
        plaintext_key = resp["Plaintext"]
        encrypted_key = resp["CiphertextBlob"]
        check("generate_data_key", True, f"plaintext={len(plaintext_key)}B, encrypted={len(encrypted_key)}B")
    except (BotoCoreError, ClientError) as e:
        check("generate_data_key", False, str(e))
        sys.exit(1)

    # 4. Decrypt the data key back
    try:
        resp2 = client.decrypt(
            CiphertextBlob=encrypted_key,
            EncryptionContext={"user_id": "test-user-123"},
        )
        recovered = resp2["Plaintext"]
        check("decrypt data key", recovered == plaintext_key, "keys match" if recovered == plaintext_key else "MISMATCH")
    except (BotoCoreError, ClientError) as e:
        check("decrypt data key", False, str(e))
        sys.exit(1)

    # 5. Full round-trip through TokenEncryption
    try:
        # Set env so config picks up the values
        os.environ.setdefault("KMS_KEY_ID", KMS_KEY_ID)
        os.environ.setdefault("AWS_REGION", AWS_REGION)
        os.environ.setdefault("SECRET_KEY", "local-fallback-key-for-test")

        from app.core.encryption import TokenEncryption
        enc = TokenEncryption()

        sample = "ghp_TestTokenABCDEFGHIJKLMNOPQRSTUVWXYZ"
        user_id = "test-user-123"

        ciphertext = enc.encrypt(sample, context=user_id)
        check("encrypt() returns v3 prefix", ciphertext.startswith("v3:"), ciphertext[:30])

        recovered = enc.decrypt(ciphertext, context=user_id)
        check("decrypt() round-trip", recovered == sample)

        # Wrong context must fail
        try:
            enc.decrypt(ciphertext, context="wrong-user")
            check("wrong context rejected", False, "should have raised ValueError")
        except ValueError:
            check("wrong context rejected", True)

    except Exception as e:
        check("TokenEncryption round-trip", False, str(e))
        sys.exit(1)

    print()
    if all_ok:
        print("All checks passed — KMS is correctly configured.")
    else:
        print("Some checks failed — review the output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()

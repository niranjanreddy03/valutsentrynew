"""Quick KMS connectivity test — works around Python 3.14 Windows SSL issue."""
import os

# Fix SSL before importing boto3: point to certifi's CA bundle
import certifi
os.environ["AWS_CA_BUNDLE"] = certifi.where()

import boto3
from botocore.exceptions import BotoCoreError, ClientError

REGION = os.environ.get("AWS_REGION", "ap-south-1")
KEY_ID = os.environ.get("KMS_KEY_ID", "")

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

client = boto3.client(
    "kms",
    region_name=REGION,
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", ""),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
)

ok = True

# 1. describe_key
print("--- Test 1: describe_key ---")
try:
    info = client.describe_key(KeyId=KEY_ID)
    meta = info["KeyMetadata"]
    print("[{}] Key reachable".format(PASS))
    print("    State  = {}".format(meta["KeyState"]))
    print("    Usage  = {}".format(meta["KeyUsage"]))
    print("    Arn    = {}".format(meta["Arn"]))
    print("    Spec   = {}".format(meta.get("KeySpec", "?")))
except Exception as e:
    print("[{}] describe_key failed: {} - {}".format(FAIL, type(e).__name__, e))
    ok = False
    exit(1)

# 2. generate_data_key
print("\n--- Test 2: generate_data_key ---")
try:
    resp = client.generate_data_key(
        KeyId=KEY_ID,
        KeySpec="AES_256",
        EncryptionContext={"user_id": "test-user-123"},
    )
    pk = resp["Plaintext"]
    ek = resp["CiphertextBlob"]
    print("[{}] Data key generated: plaintext={}B, encrypted={}B".format(PASS, len(pk), len(ek)))
except Exception as e:
    print("[{}] generate_data_key failed: {} - {}".format(FAIL, type(e).__name__, e))
    ok = False
    exit(1)

# 3. decrypt the data key back
print("\n--- Test 3: decrypt data key ---")
try:
    resp2 = client.decrypt(
        CiphertextBlob=ek,
        EncryptionContext={"user_id": "test-user-123"},
    )
    recovered = resp2["Plaintext"]
    match = recovered == pk
    print("[{}] Keys match: {}".format(PASS if match else FAIL, match))
    if not match:
        ok = False
except Exception as e:
    print("[{}] decrypt failed: {} - {}".format(FAIL, type(e).__name__, e))
    ok = False

print()
if ok:
    print("All KMS tests passed!")
else:
    print("Some tests FAILED.")
    exit(1)

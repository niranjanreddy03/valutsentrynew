"""
Vault Sentry - Token Encryption Utility
Provides AES-256-GCM encryption for sensitive data like GitHub PATs.
NEVER store tokens in plaintext.
"""

import os
import base64
import hashlib
from typing import Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from loguru import logger

from app.core.config import settings


class TokenEncryption:
    """
    Secure encryption service for sensitive tokens.
    Uses AES-256-GCM for authenticated encryption.
    """
    
    # Nonce size for AES-GCM (96 bits = 12 bytes)
    NONCE_SIZE = 12
    # Salt size for key derivation
    SALT_SIZE = 16
    # AES-256 key size
    KEY_SIZE = 32
    
    def __init__(self):
        """Initialize with the application's secret key."""
        self._master_key = settings.SECRET_KEY.encode('utf-8')
        
    def _derive_key(self, salt: bytes) -> bytes:
        """
        Derive an AES-256 key from the master key using PBKDF2.
        Salt ensures unique keys for each encryption.
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.KEY_SIZE,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return kdf.derive(self._master_key)
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string (e.g., GitHub PAT).
        
        Returns:
            Base64-encoded string: salt + nonce + ciphertext + tag
            
        Security:
            - Uses random salt and nonce for each encryption
            - AES-GCM provides authentication (detects tampering)
            - Output is safe for database storage
        """
        if not plaintext:
            return ""
        
        try:
            # Generate random salt and nonce
            salt = os.urandom(self.SALT_SIZE)
            nonce = os.urandom(self.NONCE_SIZE)
            
            # Derive key from master key + salt
            key = self._derive_key(salt)
            
            # Encrypt with AES-256-GCM
            aesgcm = AESGCM(key)
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
            
            # Combine: salt + nonce + ciphertext (includes tag)
            encrypted_data = salt + nonce + ciphertext
            
            # Base64 encode for safe storage
            return base64.b64encode(encrypted_data).decode('utf-8')
            
        except Exception as e:
            logger.error(f"[ENCRYPTION] Encryption failed: {type(e).__name__}")
            raise ValueError("Failed to encrypt token")
    
    def decrypt(self, encrypted: str) -> str:
        """
        Decrypt an encrypted token.
        
        Args:
            encrypted: Base64-encoded encrypted string
            
        Returns:
            Original plaintext token
            
        Raises:
            ValueError: If decryption fails (tampered or wrong key)
        """
        if not encrypted:
            return ""
        
        try:
            # Decode from base64
            encrypted_data = base64.b64decode(encrypted.encode('utf-8'))
            
            # Extract components
            salt = encrypted_data[:self.SALT_SIZE]
            nonce = encrypted_data[self.SALT_SIZE:self.SALT_SIZE + self.NONCE_SIZE]
            ciphertext = encrypted_data[self.SALT_SIZE + self.NONCE_SIZE:]
            
            # Derive key
            key = self._derive_key(salt)
            
            # Decrypt with AES-256-GCM
            aesgcm = AESGCM(key)
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            
            return plaintext.decode('utf-8')
            
        except Exception as e:
            logger.error(f"[ENCRYPTION] Decryption failed: {type(e).__name__}")
            raise ValueError("Failed to decrypt token - data may be corrupted or tampered")
    
    def hash_token(self, token: str) -> str:
        """
        Create a SHA-256 hash of a token for comparison/lookup.
        This allows checking if a token exists without storing it in plaintext.
        """
        return hashlib.sha256(token.encode('utf-8')).hexdigest()
    
    def mask_token(self, token: str) -> str:
        """
        Create a masked version of the token for display.
        Example: ghp_xxxx...xxxx (first 8, last 4 chars visible)
        """
        if not token or len(token) < 12:
            return "***"
        return f"{token[:8]}...{token[-4:]}"


# Singleton instance
token_encryption = TokenEncryption()

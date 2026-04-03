#!/usr/bin/env python3
"""Quick test script for Vault Sentry scanner."""

import sys
import tempfile
from pathlib import Path
sys.path.insert(0, '.')

from app.scanner.engine import SecretScanner

def main():
    print("\n" + "="*60)
    print("🔒 Vault Sentry - Scanner Demo")
    print("="*60)
    
    scanner = SecretScanner()
    print(f"\n✅ Scanner initialized with {len(scanner.patterns)} detection patterns")
    
    # Create a test file with secrets
    test_content = '''# Example file with secrets
AWS_ACCESS_KEY_ID = "AKIA_EXAMPLE_KEY_12345"
secret_key = "example_secret_key_do_not_use_in_production"
api_key = "example_api_key_1234567890"
password = "super_secret_password123"
github_token = "ghp_example_token_placeholder_xxxxx"
STRIPE_SECRET = "example_stripe_key_placeholder"
'''
    
    # Write to temp file and scan
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(test_content)
        temp_path = f.name
    
    print("\n📄 Scanning test file with embedded secrets...")
    results = scanner.scan_file(Path(temp_path))
    
    print(f"\n🔐 Found {len(results)} potential secrets:\n")
    
    for r in results:
        risk_icon = {
            'critical': '🔴',
            'high': '🟠', 
            'medium': '🟡',
            'low': '🟢'
        }.get(r.severity, '⚪')
        
        print(f"  {risk_icon} [{r.severity.upper():8}] {r.type}")
        print(f"     Line {r.line_number}: {r.secret_masked[:50]}...")
        print()
    
    # Cleanup
    Path(temp_path).unlink()
    
    print("="*60)
    print("✅ Scanner demo complete!")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()

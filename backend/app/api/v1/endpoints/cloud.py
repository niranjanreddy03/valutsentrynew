"""
Vault Sentry - Cloud Integration Endpoints
Endpoints for AWS S3 scanning and environment variable analysis
"""

import tempfile
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.scanner.s3_scanner import S3Scanner, S3ScanConfig, scan_s3_bucket
from app.scanner.env_analyzer import EnvVarsAnalyzer, analyze_env_content
from app.integrations.aws_integration import AWSIntegration


router = APIRouter()


# ============================================
# Pydantic Schemas
# ============================================

class S3ScanRequest(BaseModel):
    """Request schema for S3 scanning"""
    bucket_name: str = Field(..., description="AWS S3 bucket name")
    prefix: str = Field("", description="Optional prefix to filter objects")
    max_files: int = Field(100, ge=1, le=1000, description="Maximum files to scan")
    aws_access_key_id: Optional[str] = Field(None, description="AWS access key (uses env if not provided)")
    aws_secret_access_key: Optional[str] = Field(None, description="AWS secret key (uses env if not provided)")
    aws_region: str = Field("us-east-1", description="AWS region")


class S3ScanResponse(BaseModel):
    """Response schema for S3 scan results"""
    scan_id: str
    bucket_name: str
    status: str
    objects_scanned: int
    total_findings: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    risk_score: float
    duration_seconds: float
    findings: List[dict]


class EnvAnalysisRequest(BaseModel):
    """Request schema for environment variable analysis"""
    content: str = Field(..., description="Environment file content")
    filename: str = Field(".env", description="Source filename for reporting")


class EnvVariableResponse(BaseModel):
    """Response schema for an analyzed environment variable"""
    key: str
    value: str
    line_number: int
    is_secret: bool
    secret_type: Optional[str]
    risk_level: str
    entropy_score: float
    is_placeholder: bool
    recommendations: List[str]


class EnvAnalysisResponse(BaseModel):
    """Response schema for environment analysis results"""
    file_path: str
    total_variables: int
    secrets_found: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    variables: List[EnvVariableResponse]
    recommendations: List[str]


# ============================================
# S3 Scanning Endpoints
# ============================================

@router.post("/s3/scan", response_model=S3ScanResponse)
async def scan_s3_bucket_endpoint(
    request: S3ScanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Scan an AWS S3 bucket for exposed secrets.
    
    This endpoint scans files in the specified S3 bucket using:
    - Pattern matching for known secret formats
    - Shannon entropy analysis for high-randomness strings
    - Keyword detection for sensitive variable names
    
    **Note**: AWS credentials can be provided in the request or configured via environment variables.
    For production use, prefer IAM roles and environment variables.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} starting S3 scan for bucket: {request.bucket_name}")
    
    try:
        # Initialize scanner
        scanner = S3Scanner(
            aws_access_key_id=request.aws_access_key_id,
            aws_secret_access_key=request.aws_secret_access_key,
            aws_region=request.aws_region,
            simulate=not request.aws_access_key_id  # Use simulation if no credentials provided
        )
        
        # Create scan config
        config = S3ScanConfig(
            bucket_name=request.bucket_name,
            prefix=request.prefix,
            max_files=request.max_files
        )
        
        # Run scan
        result = await scanner.scan_bucket(config)
        
        # Convert findings to dict for response
        findings = []
        for finding in result.findings:
            findings.append({
                "type": finding.type,
                "category": finding.category,
                "severity": finding.severity,
                "file_path": finding.file_path,
                "line_number": finding.line_number,
                "masked_value": finding.secret_masked,
                "risk_score": finding.risk_score,
                "entropy_score": finding.entropy_score,
                "match_rule": finding.match_rule
            })
        
        return S3ScanResponse(
            scan_id=result.scan_id,
            bucket_name=result.bucket_name,
            status=result.status,
            objects_scanned=result.objects_scanned,
            total_findings=result.total_findings,
            high_risk_count=result.high_risk_count,
            medium_risk_count=result.medium_risk_count,
            low_risk_count=result.low_risk_count,
            risk_score=result.risk_score,
            duration_seconds=result.duration_seconds,
            findings=findings
        )
        
    except Exception as e:
        logger.error(f"S3 scan error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"S3 scan failed: {str(e)}"
        )


@router.post("/s3/scan-demo", response_model=S3ScanResponse)
async def scan_s3_demo(
    bucket_name: str = "demo-bucket",
    current_user: User = Depends(get_current_user)
):
    """
    Run a demonstration S3 scan with simulated data.
    
    This endpoint is useful for testing and demonstration purposes.
    It uses simulated S3 objects with intentionally planted secrets.
    
    **No AWS credentials required.**
    """
    logger.info(f"User {current_user.email} running demo S3 scan")
    
    # Use simulated scanner
    result = await scan_s3_bucket(
        bucket_name=bucket_name,
        prefix="",
        max_files=50
    )
    
    findings = []
    for finding in result.findings:
        findings.append({
            "type": finding.type,
            "category": finding.category,
            "severity": finding.severity,
            "file_path": finding.file_path,
            "line_number": finding.line_number,
            "masked_value": finding.secret_masked,
            "risk_score": finding.risk_score,
            "entropy_score": finding.entropy_score,
            "match_rule": finding.match_rule
        })
    
    return S3ScanResponse(
        scan_id=result.scan_id,
        bucket_name=result.bucket_name,
        status=result.status,
        objects_scanned=result.objects_scanned,
        total_findings=result.total_findings,
        high_risk_count=result.high_risk_count,
        medium_risk_count=result.medium_risk_count,
        low_risk_count=result.low_risk_count,
        risk_score=result.risk_score,
        duration_seconds=result.duration_seconds,
        findings=findings
    )


# ============================================
# Environment Variable Analysis Endpoints
# ============================================

@router.post("/env/analyze", response_model=EnvAnalysisResponse)
async def analyze_environment_variables(
    request: EnvAnalysisRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze environment variable content for exposed secrets.
    
    This endpoint analyzes .env file content to:
    - Identify keys that typically contain secrets
    - Detect high-entropy values that may be credentials
    - Match against known secret patterns (AWS keys, API keys, etc.)
    - Distinguish between placeholders and real secrets
    - Provide security recommendations
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} analyzing environment variables")
    
    try:
        analyzer = EnvVarsAnalyzer()
        result = analyzer.analyze_content(request.content, request.filename)
        
        variables = []
        for var in result.variables:
            variables.append(EnvVariableResponse(
                key=var.key,
                value=var.value,
                line_number=var.line_number,
                is_secret=var.is_secret,
                secret_type=var.secret_type,
                risk_level=var.risk_level,
                entropy_score=var.entropy_score,
                is_placeholder=var.is_placeholder,
                recommendations=var.recommendations
            ))
        
        return EnvAnalysisResponse(
            file_path=result.file_path,
            total_variables=result.total_variables,
            secrets_found=result.secrets_found,
            high_risk_count=result.high_risk_count,
            medium_risk_count=result.medium_risk_count,
            low_risk_count=result.low_risk_count,
            variables=variables,
            recommendations=result.recommendations
        )
        
    except Exception as e:
        logger.error(f"Environment analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/env/upload")
async def upload_and_analyze_env_file(
    file: UploadFile = File(..., description="Environment file to analyze"),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and analyze an environment file.
    
    Accepts .env files up to 1MB in size.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} uploading env file: {file.filename}")
    
    # Validate file size (max 1MB)
    content = await file.read()
    if len(content) > 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 1MB."
        )
    
    # Validate content is text
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a valid text file."
        )
    
    # Analyze
    try:
        analyzer = EnvVarsAnalyzer()
        result = analyzer.analyze_content(text_content, file.filename)
        
        variables = []
        for var in result.variables:
            variables.append({
                "key": var.key,
                "value": var.value,
                "line_number": var.line_number,
                "is_secret": var.is_secret,
                "secret_type": var.secret_type,
                "risk_level": var.risk_level,
                "entropy_score": var.entropy_score,
                "is_placeholder": var.is_placeholder,
                "recommendations": var.recommendations
            })
        
        return {
            "file_path": result.file_path,
            "total_variables": result.total_variables,
            "secrets_found": result.secrets_found,
            "high_risk_count": result.high_risk_count,
            "medium_risk_count": result.medium_risk_count,
            "low_risk_count": result.low_risk_count,
            "variables": variables,
            "recommendations": result.recommendations
        }
        
    except Exception as e:
        logger.error(f"Environment analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/env/analyze-demo")
async def analyze_demo_env(
    current_user: User = Depends(get_current_user)
):
    """
    Run a demonstration environment variable analysis.
    
    Uses a sample .env file with various secret types for demonstration.
    """
    demo_content = """# Demo Environment File
# This file contains example secrets for testing

# Database
DATABASE_URL=postgres://admin:SuperSecretPass123@db.example.com:5432/production
REDIS_URL=redis://default:RedisPass456@cache.example.com:6379

# AWS Credentials
AWS_ACCESS_KEY_ID=EXAMPLE_AWS_KEY_ID_12345
AWS_SECRET_ACCESS_KEY=example_aws_secret_key_placeholder

# API Keys
STRIPE_SECRET_KEY=demo_stripe_api_key_placeholder_value
SENDGRID_API_KEY=SG.abcdefghijklmnop.qrstuvwxyz0123456789ABCDEFGH
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OAuth
JWT_SECRET=my-super-secret-jwt-signing-key-should-be-longer
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Safe values (not secrets)
NODE_ENV=production
DEBUG=false
LOG_LEVEL=info
PORT=3000

# Placeholder (not a real secret)
SLACK_TOKEN=<your-slack-token-here>
TWILIO_AUTH_TOKEN=REPLACE_ME
"""
    
    analyzer = EnvVarsAnalyzer()
    result = analyzer.analyze_content(demo_content, ".env.demo")
    
    return {
        "file_path": result.file_path,
        "total_variables": result.total_variables,
        "secrets_found": result.secrets_found,
        "high_risk_count": result.high_risk_count,
        "medium_risk_count": result.medium_risk_count,
        "low_risk_count": result.low_risk_count,
        "variables": [
            {
                "key": var.key,
                "value": var.value,
                "is_secret": var.is_secret,
                "secret_type": var.secret_type,
                "risk_level": var.risk_level,
                "entropy_score": round(var.entropy_score, 2),
                "is_placeholder": var.is_placeholder
            }
            for var in result.variables
        ],
        "recommendations": result.recommendations
    }


# ============================================
# AWS Integration Endpoints
# ============================================

class AWSCredentialsRequest(BaseModel):
    """AWS credentials for integration"""
    access_key_id: Optional[str] = Field(None, description="AWS access key ID")
    secret_access_key: Optional[str] = Field(None, description="AWS secret access key")
    region: str = Field("us-east-1", description="AWS region")


@router.post("/aws/validate")
async def validate_aws_credentials(
    request: AWSCredentialsRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Validate AWS credentials by calling STS GetCallerIdentity.
    
    If credentials are not provided, environment variables will be used.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} validating AWS credentials")
    
    try:
        integration = AWSIntegration(
            access_key_id=request.access_key_id,
            secret_access_key=request.secret_access_key,
            region=request.region
        )
        
        result = await integration.validate_credentials()
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=result.error or "AWS credentials validation failed"
            )
        
        return {
            "valid": True,
            "account_id": result.data.get("account_id"),
            "arn": result.data.get("arn"),
            "region": request.region
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AWS validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )


@router.get("/s3/buckets")
async def list_s3_buckets(
    access_key_id: Optional[str] = None,
    secret_access_key: Optional[str] = None,
    region: str = "us-east-1",
    current_user: User = Depends(get_current_user)
):
    """
    List all S3 buckets accessible with the provided credentials.
    
    If credentials are not provided, environment variables will be used.
    Returns bucket information including security settings.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} listing S3 buckets")
    
    try:
        integration = AWSIntegration(
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
            region=region
        )
        
        result = await integration.list_buckets()
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.error or "Failed to list buckets"
            )
        
        return {
            "buckets": result.data.get("buckets", []),
            "count": result.data.get("count", 0),
            "simulated": result.data.get("simulated", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"S3 list buckets error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list buckets: {str(e)}"
        )


@router.get("/s3/buckets/{bucket_name}/objects")
async def list_s3_objects(
    bucket_name: str,
    prefix: str = "",
    max_keys: int = 100,
    access_key_id: Optional[str] = None,
    secret_access_key: Optional[str] = None,
    region: str = "us-east-1",
    current_user: User = Depends(get_current_user)
):
    """
    List objects in an S3 bucket.
    
    Returns object metadata including key, size, and last modified date.
    Use prefix to filter objects by path.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} listing objects in bucket: {bucket_name}")
    
    try:
        integration = AWSIntegration(
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
            region=region
        )
        
        result = await integration.list_objects(
            bucket_name=bucket_name,
            prefix=prefix,
            max_keys=max_keys
        )
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.error or "Failed to list objects"
            )
        
        return {
            "bucket": bucket_name,
            "prefix": prefix,
            "objects": result.data.get("objects", []),
            "count": result.data.get("count", 0),
            "simulated": result.data.get("simulated", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"S3 list objects error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list objects: {str(e)}"
        )


@router.get("/s3/buckets/{bucket_name}/policy")
async def get_s3_bucket_policy(
    bucket_name: str,
    access_key_id: Optional[str] = None,
    secret_access_key: Optional[str] = None,
    region: str = "us-east-1",
    current_user: User = Depends(get_current_user)
):
    """
    Get the bucket policy for an S3 bucket.
    
    Returns the JSON bucket policy if one exists.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} getting policy for bucket: {bucket_name}")
    
    try:
        integration = AWSIntegration(
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
            region=region
        )
        
        result = await integration.get_bucket_policy(bucket_name)
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.error or "Failed to get bucket policy"
            )
        
        return {
            "bucket": bucket_name,
            "policy": result.data.get("policy"),
            "has_policy": result.data.get("policy") is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"S3 bucket policy error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bucket policy: {str(e)}"
        )


# ============================================
# AWS Secrets Manager Endpoints
# ============================================

@router.get("/aws/secrets")
async def list_aws_secrets(
    access_key_id: Optional[str] = None,
    secret_access_key: Optional[str] = None,
    region: str = "us-east-1",
    current_user: User = Depends(get_current_user)
):
    """
    List secrets stored in AWS Secrets Manager.
    
    Returns secret metadata (not the actual secret values).
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} listing AWS Secrets Manager secrets")
    
    try:
        integration = AWSIntegration(
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
            region=region
        )
        
        result = await integration.list_secrets()
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.error or "Failed to list secrets"
            )
        
        return {
            "secrets": result.data.get("secrets", []),
            "count": result.data.get("count", 0),
            "simulated": result.data.get("simulated", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AWS Secrets Manager error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list secrets: {str(e)}"
        )


class StoreSecretRequest(BaseModel):
    """Request to store a secret in AWS Secrets Manager"""
    name: str = Field(..., description="Secret name/path")
    value: str = Field(..., description="Secret value (string or JSON)")
    description: Optional[str] = Field(None, description="Secret description")
    access_key_id: Optional[str] = Field(None, description="AWS access key")
    secret_access_key: Optional[str] = Field(None, description="AWS secret access key")
    region: str = Field("us-east-1", description="AWS region")


@router.post("/aws/secrets")
async def store_aws_secret(
    request: StoreSecretRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Store a secret in AWS Secrets Manager.
    
    Creates a new secret or updates an existing one.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} storing secret: {request.name}")
    
    try:
        integration = AWSIntegration(
            access_key_id=request.access_key_id,
            secret_access_key=request.secret_access_key,
            region=request.region
        )
        
        result = await integration.store_secret(
            name=request.name,
            value=request.value,
            description=request.description
        )
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.error or "Failed to store secret"
            )
        
        return {
            "success": True,
            "name": request.name,
            "arn": result.data.get("arn"),
            "updated": result.data.get("updated", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AWS store secret error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store secret: {str(e)}"
        )


@router.get("/aws/iam/access-keys")
async def list_iam_access_keys(
    username: Optional[str] = None,
    access_key_id: Optional[str] = None,
    secret_access_key: Optional[str] = None,
    region: str = "us-east-1",
    current_user: User = Depends(get_current_user)
):
    """
    List IAM access keys for a user.
    
    If no username is provided, lists keys for the current IAM user.
    
    **Requires**: User authentication
    """
    logger.info(f"User {current_user.email} listing IAM access keys")
    
    try:
        integration = AWSIntegration(
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
            region=region
        )
        
        result = await integration.list_access_keys(username)
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.error or "Failed to list access keys"
            )
        
        return {
            "keys": result.data.get("keys", []),
            "count": result.data.get("count", 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"IAM access keys error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list access keys: {str(e)}"
        )

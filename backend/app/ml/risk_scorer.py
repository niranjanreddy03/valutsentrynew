"""
Vault Sentry - ML Risk Scorer
XGBoost/RandomForest-based risk scoring for secrets
"""

import os
import pickle
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np
from loguru import logger

from app.ml.feature_extractor import SecretFeatures, FeatureExtractor


class RiskScorer:
    """
    ML-based risk scoring for detected secrets.
    Uses XGBoost or RandomForest to predict risk scores (0-100).
    Falls back to heuristic scoring if model is not available.
    """
    
    MODEL_PATH = Path("app/ml/models")
    MODEL_FILE = "risk_model.pkl"
    CONFIG_FILE = "model_config.json"
    
    # Heuristic weights for fallback scoring
    HEURISTIC_WEIGHTS = {
        'entropy': 10.0,
        'is_aws_key': 25.0,
        'is_google_key': 20.0,
        'is_azure_key': 20.0,
        'is_github_token': 22.0,
        'is_private_key': 30.0,
        'is_jwt': 15.0,
        'is_password': 18.0,
        'is_database_url': 20.0,
        'is_api_key': 15.0,
        'is_test_file': -20.0,
        'is_example_file': -15.0,
        'is_production_file': 15.0,
        'is_env_file': 10.0,
        'is_cicd_file': 12.0,
        'repo_is_public': 25.0,
        'is_hardcoded': 10.0,
        'appears_in_git_history': 8.0,
    }
    
    # Risk level thresholds
    RISK_THRESHOLDS = {
        'critical': 80,
        'high': 60,
        'medium': 40,
        'low': 20,
    }
    
    def __init__(self, model_type: str = "xgboost"):
        """
        Initialize the risk scorer.
        
        Args:
            model_type: Type of model to use ("xgboost" or "random_forest")
        """
        self.model_type = model_type
        self.model = None
        self.feature_extractor = FeatureExtractor()
        self.logger = logger.bind(module="risk_scorer")
        self._load_model()
    
    def _load_model(self):
        """Load trained model from disk if available"""
        model_path = self.MODEL_PATH / self.MODEL_FILE
        
        if model_path.exists():
            try:
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                self.logger.info(f"Loaded risk scoring model from {model_path}")
            except Exception as e:
                self.logger.warning(f"Failed to load model: {e}. Using heuristic scoring.")
                self.model = None
        else:
            self.logger.info("No trained model found. Using heuristic scoring.")
    
    def score(self, features: SecretFeatures) -> float:
        """
        Calculate risk score for a secret.
        
        Args:
            features: Extracted features for the secret
            
        Returns:
            Risk score between 0-100
        """
        if self.model is not None:
            return self._ml_score(features)
        return self._heuristic_score(features)
    
    def _ml_score(self, features: SecretFeatures) -> float:
        """Score using trained ML model"""
        try:
            feature_vector = np.array([features.to_vector()])
            
            # Get probability prediction
            if hasattr(self.model, 'predict_proba'):
                # Classification model - use probability of high risk class
                proba = self.model.predict_proba(feature_vector)[0]
                # Assume binary classification: 0=low risk, 1=high risk
                score = proba[-1] * 100 if len(proba) > 1 else proba[0] * 100
            else:
                # Regression model - direct score prediction
                score = self.model.predict(feature_vector)[0]
            
            return max(0, min(100, round(score, 1)))
        except Exception as e:
            self.logger.warning(f"ML scoring failed: {e}. Falling back to heuristic.")
            return self._heuristic_score(features)
    
    def _heuristic_score(self, features: SecretFeatures) -> float:
        """Fallback heuristic scoring when no ML model is available"""
        score = 30.0  # Base score
        
        # Add entropy contribution (normalized)
        if features.entropy > 0:
            entropy_contrib = min(features.entropy / 5.0, 1.0) * self.HEURISTIC_WEIGHTS['entropy']
            score += entropy_contrib
        
        # Add secret type contributions
        feature_dict = features.to_dict()
        for key, weight in self.HEURISTIC_WEIGHTS.items():
            if key in feature_dict:
                value = feature_dict[key]
                if isinstance(value, bool) and value:
                    score += weight
                elif isinstance(value, (int, float)) and key == 'repo_sensitivity_score':
                    score += value * 20  # Scale to 0-20 contribution
        
        # Additional adjustments
        if features.confidence_score < 0.7:
            score *= 0.8  # Reduce score for low confidence
        
        if features.time_exposed_hours > 24 * 7:  # More than a week
            score += 10
        
        return max(0, min(100, round(score, 1)))
    
    def score_batch(self, features_list: List[SecretFeatures]) -> List[float]:
        """Score multiple secrets efficiently"""
        if self.model is not None:
            try:
                feature_vectors = np.array([f.to_vector() for f in features_list])
                
                if hasattr(self.model, 'predict_proba'):
                    probas = self.model.predict_proba(feature_vectors)
                    scores = [p[-1] * 100 if len(p) > 1 else p[0] * 100 for p in probas]
                else:
                    scores = self.model.predict(feature_vectors).tolist()
                
                return [max(0, min(100, round(s, 1))) for s in scores]
            except Exception as e:
                self.logger.warning(f"Batch ML scoring failed: {e}")
        
        return [self._heuristic_score(f) for f in features_list]
    
    def get_risk_level(self, score: float) -> str:
        """Convert numeric score to risk level"""
        if score >= self.RISK_THRESHOLDS['critical']:
            return 'critical'
        elif score >= self.RISK_THRESHOLDS['high']:
            return 'high'
        elif score >= self.RISK_THRESHOLDS['medium']:
            return 'medium'
        elif score >= self.RISK_THRESHOLDS['low']:
            return 'low'
        else:
            return 'info'
    
    def score_and_classify(
        self,
        features: SecretFeatures
    ) -> Tuple[float, str, Dict[str, Any]]:
        """
        Score a secret and return detailed classification.
        
        Returns:
            Tuple of (score, risk_level, explanation_dict)
        """
        score = self.score(features)
        risk_level = self.get_risk_level(score)
        
        # Generate explanation
        explanation = self._generate_explanation(features, score, risk_level)
        
        return score, risk_level, explanation
    
    def _generate_explanation(
        self,
        features: SecretFeatures,
        score: float,
        risk_level: str
    ) -> Dict[str, Any]:
        """Generate human-readable explanation for the risk score"""
        factors = []
        
        # Identify top contributing factors
        if features.is_aws_key:
            factors.append({"factor": "AWS Key Type", "impact": "high", "description": "AWS credentials have high blast radius"})
        if features.is_private_key:
            factors.append({"factor": "Private Key", "impact": "critical", "description": "Private keys should never be committed"})
        if features.repo_is_public:
            factors.append({"factor": "Public Repository", "impact": "high", "description": "Secret is exposed in public repo"})
        if features.is_production_file:
            factors.append({"factor": "Production File", "impact": "high", "description": "Located in production configuration"})
        if features.is_hardcoded:
            factors.append({"factor": "Hardcoded Value", "impact": "medium", "description": "Value appears to be hardcoded"})
        if features.entropy > 4.0:
            factors.append({"factor": "High Entropy", "impact": "medium", "description": f"Entropy: {features.entropy:.2f} bits"})
        if features.is_test_file:
            factors.append({"factor": "Test File", "impact": "low", "description": "Located in test file (reduced risk)"})
        if features.is_example_file:
            factors.append({"factor": "Example File", "impact": "low", "description": "Appears to be example/sample"})
        if features.time_exposed_hours > 24 * 30:
            factors.append({"factor": "Long Exposure", "impact": "high", "description": f"Exposed for {int(features.time_exposed_hours / 24)} days"})
        
        return {
            "score": score,
            "risk_level": risk_level,
            "factors": factors,
            "model_type": "ml" if self.model else "heuristic",
            "feature_count": len(features.to_vector()),
        }
    
    def calculate_business_impact(
        self,
        features: SecretFeatures,
        base_score: float,
        repo_type: str = "internal",
        data_classification: str = "internal"
    ) -> Dict[str, Any]:
        """
        Calculate business impact score considering organizational factors.
        
        Args:
            features: Secret features
            base_score: Base risk score
            repo_type: Repository classification (public, internal, confidential)
            data_classification: Data sensitivity level
            
        Returns:
            Business impact assessment
        """
        impact_multipliers = {
            'public': 1.5,
            'internal': 1.0,
            'confidential': 1.3,
            'restricted': 1.5,
        }
        
        data_multipliers = {
            'public': 0.8,
            'internal': 1.0,
            'confidential': 1.3,
            'restricted': 1.5,
        }
        
        repo_mult = impact_multipliers.get(repo_type, 1.0)
        data_mult = data_multipliers.get(data_classification, 1.0)
        
        business_score = min(100, base_score * repo_mult * data_mult)
        
        # Calculate potential blast radius
        blast_radius = "low"
        if features.is_aws_key or features.is_private_key:
            blast_radius = "critical"
        elif features.is_database_url or features.is_google_key:
            blast_radius = "high"
        elif features.is_api_key:
            blast_radius = "medium"
        
        return {
            "business_impact_score": round(business_score, 1),
            "blast_radius": blast_radius,
            "repo_classification": repo_type,
            "data_classification": data_classification,
            "remediation_priority": self.get_risk_level(business_score),
            "estimated_remediation_time": self._estimate_remediation_time(features),
        }
    
    def _estimate_remediation_time(self, features: SecretFeatures) -> str:
        """Estimate time needed to remediate based on secret type"""
        if features.is_private_key:
            return "2-4 hours"
        elif features.is_aws_key or features.is_database_url:
            return "30-60 minutes"
        elif features.is_api_key:
            return "15-30 minutes"
        else:
            return "15 minutes"
    
    def reload_model(self):
        """Reload model from disk (for hot-reloading after retraining)"""
        self._load_model()


# Global scorer instance (singleton pattern)
_scorer_instance: Optional[RiskScorer] = None


def get_risk_scorer() -> RiskScorer:
    """Get or create the global risk scorer instance"""
    global _scorer_instance
    if _scorer_instance is None:
        _scorer_instance = RiskScorer()
    return _scorer_instance

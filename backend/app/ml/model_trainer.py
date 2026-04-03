"""
Vault Sentry - ML Model Trainer
Train XGBoost/RandomForest models for risk scoring
"""

import os
import pickle
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np
from loguru import logger

try:
    from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score,
        classification_report, confusion_matrix, roc_auc_score
    )
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not installed. ML training unavailable.")

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    logger.warning("XGBoost not installed. Using RandomForest as fallback.")

from app.ml.feature_extractor import SecretFeatures


class ModelTrainer:
    """
    Trains ML models for secret risk scoring.
    Supports XGBoost and RandomForest classifiers.
    """
    
    MODEL_PATH = Path("app/ml/models")
    MODEL_FILE = "risk_model.pkl"
    SCALER_FILE = "scaler.pkl"
    CONFIG_FILE = "model_config.json"
    TRAINING_HISTORY_FILE = "training_history.json"
    
    def __init__(self, model_type: str = "xgboost"):
        """
        Initialize the model trainer.
        
        Args:
            model_type: "xgboost" or "random_forest"
        """
        if not SKLEARN_AVAILABLE:
            raise RuntimeError("scikit-learn is required for model training")
        
        self.model_type = model_type
        self.model = None
        self.scaler = None
        self.logger = logger.bind(module="model_trainer")
        
        # Ensure model directory exists
        self.MODEL_PATH.mkdir(parents=True, exist_ok=True)
    
    def _create_model(self, model_type: str = None):
        """Create a new model instance"""
        model_type = model_type or self.model_type
        
        if model_type == "xgboost" and XGBOOST_AVAILABLE:
            return xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                objective='binary:logistic',
                eval_metric='logloss',
                use_label_encoder=False,
                random_state=42
            )
        else:
            # Fallback to RandomForest
            return RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                class_weight='balanced',
                random_state=42,
                n_jobs=-1
            )
    
    def prepare_training_data(
        self,
        findings: List[Dict[str, Any]],
        labels: List[int]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare training data from findings.
        
        Args:
            findings: List of finding dictionaries
            labels: List of labels (0=low risk, 1=high risk)
            
        Returns:
            Tuple of (feature_matrix, labels)
        """
        from app.ml.feature_extractor import FeatureExtractor
        
        extractor = FeatureExtractor()
        features_list = extractor.extract_batch(findings)
        
        X = np.array([f.to_vector() for f in features_list])
        y = np.array(labels)
        
        return X, y
    
    def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        validation_split: float = 0.2,
        cross_validate: bool = True,
        hyperparameter_tuning: bool = False
    ) -> Dict[str, Any]:
        """
        Train the risk scoring model.
        
        Args:
            X: Feature matrix
            y: Labels
            validation_split: Fraction for validation set
            cross_validate: Whether to perform cross-validation
            hyperparameter_tuning: Whether to tune hyperparameters
            
        Returns:
            Training results dictionary
        """
        self.logger.info(f"Training {self.model_type} model with {len(X)} samples")
        
        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # Split data
        X_train, X_val, y_train, y_val = train_test_split(
            X_scaled, y,
            test_size=validation_split,
            random_state=42,
            stratify=y if len(np.unique(y)) > 1 else None
        )
        
        # Create model
        if hyperparameter_tuning:
            self.model = self._tune_hyperparameters(X_train, y_train)
        else:
            self.model = self._create_model()
        
        # Train
        start_time = datetime.utcnow()
        self.model.fit(X_train, y_train)
        training_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Evaluate
        y_pred = self.model.predict(X_val)
        y_proba = self.model.predict_proba(X_val)[:, 1] if hasattr(self.model, 'predict_proba') else None
        
        results = {
            "model_type": self.model_type,
            "training_samples": len(X_train),
            "validation_samples": len(X_val),
            "training_time_seconds": training_time,
            "accuracy": accuracy_score(y_val, y_pred),
            "precision": precision_score(y_val, y_pred, zero_division=0),
            "recall": recall_score(y_val, y_pred, zero_division=0),
            "f1_score": f1_score(y_val, y_pred, zero_division=0),
            "confusion_matrix": confusion_matrix(y_val, y_pred).tolist(),
        }
        
        if y_proba is not None:
            try:
                results["roc_auc"] = roc_auc_score(y_val, y_proba)
            except ValueError:
                results["roc_auc"] = None
        
        # Cross-validation
        if cross_validate and len(X) >= 10:
            cv_scores = cross_val_score(self.model, X_scaled, y, cv=5, scoring='f1')
            results["cv_f1_scores"] = cv_scores.tolist()
            results["cv_f1_mean"] = cv_scores.mean()
            results["cv_f1_std"] = cv_scores.std()
        
        # Feature importance
        if hasattr(self.model, 'feature_importances_'):
            feature_names = SecretFeatures.feature_names()
            importances = self.model.feature_importances_
            results["feature_importance"] = dict(zip(feature_names, importances.tolist()))
        
        self.logger.info(f"Training complete. F1: {results['f1_score']:.3f}, Accuracy: {results['accuracy']:.3f}")
        
        return results
    
    def _tune_hyperparameters(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray
    ):
        """Tune model hyperparameters using GridSearchCV"""
        self.logger.info("Tuning hyperparameters...")
        
        if self.model_type == "xgboost" and XGBOOST_AVAILABLE:
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [4, 6, 8],
                'learning_rate': [0.05, 0.1, 0.15],
                'subsample': [0.7, 0.8, 0.9],
            }
            base_model = xgb.XGBClassifier(
                objective='binary:logistic',
                eval_metric='logloss',
                use_label_encoder=False,
                random_state=42
            )
        else:
            param_grid = {
                'n_estimators': [50, 100, 200],
                'max_depth': [5, 10, 15],
                'min_samples_split': [2, 5, 10],
                'min_samples_leaf': [1, 2, 4],
            }
            base_model = RandomForestClassifier(
                class_weight='balanced',
                random_state=42,
                n_jobs=-1
            )
        
        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=3,
            scoring='f1',
            n_jobs=-1,
            verbose=1
        )
        
        grid_search.fit(X_train, y_train)
        
        self.logger.info(f"Best params: {grid_search.best_params_}")
        self.logger.info(f"Best F1 score: {grid_search.best_score_:.3f}")
        
        return grid_search.best_estimator_
    
    def save_model(self, additional_metadata: Dict[str, Any] = None):
        """Save trained model to disk"""
        if self.model is None:
            raise ValueError("No model to save. Train a model first.")
        
        # Save model
        model_path = self.MODEL_PATH / self.MODEL_FILE
        with open(model_path, 'wb') as f:
            pickle.dump(self.model, f)
        
        # Save scaler
        if self.scaler is not None:
            scaler_path = self.MODEL_PATH / self.SCALER_FILE
            with open(scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
        
        # Save config
        config = {
            "model_type": self.model_type,
            "feature_count": len(SecretFeatures.feature_names()),
            "feature_names": SecretFeatures.feature_names(),
            "saved_at": datetime.utcnow().isoformat(),
            "version": "1.0.0",
        }
        
        if additional_metadata:
            config.update(additional_metadata)
        
        config_path = self.MODEL_PATH / self.CONFIG_FILE
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        self.logger.info(f"Model saved to {model_path}")
    
    def load_model(self) -> bool:
        """Load model from disk"""
        model_path = self.MODEL_PATH / self.MODEL_FILE
        
        if not model_path.exists():
            return False
        
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            
            scaler_path = self.MODEL_PATH / self.SCALER_FILE
            if scaler_path.exists():
                with open(scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
            
            self.logger.info(f"Model loaded from {model_path}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load model: {e}")
            return False
    
    def retrain_with_feedback(
        self,
        existing_findings: List[Dict],
        existing_labels: List[int],
        new_findings: List[Dict],
        new_labels: List[int],
        learning_rate_decay: float = 0.9
    ) -> Dict[str, Any]:
        """
        Retrain model incorporating new feedback (false positives, etc.)
        
        Args:
            existing_findings: Previously used training data
            existing_labels: Labels for existing data
            new_findings: New feedback data
            new_labels: Labels for new data (0=false positive/low, 1=true positive/high)
            learning_rate_decay: Weight decay for old samples
            
        Returns:
            Training results
        """
        # Combine datasets
        all_findings = existing_findings + new_findings
        all_labels = existing_labels + new_labels
        
        # Prepare data
        X, y = self.prepare_training_data(all_findings, all_labels)
        
        # Create sample weights (newer data gets more weight)
        n_existing = len(existing_findings)
        n_new = len(new_findings)
        
        weights = np.ones(len(all_findings))
        weights[:n_existing] *= learning_rate_decay
        
        # Train new model
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        self.model = self._create_model()
        
        if hasattr(self.model, 'fit') and 'sample_weight' in self.model.fit.__code__.co_varnames:
            self.model.fit(X_scaled, y, sample_weight=weights)
        else:
            self.model.fit(X_scaled, y)
        
        # Save
        self.save_model(additional_metadata={
            "retrained_at": datetime.utcnow().isoformat(),
            "new_samples": n_new,
            "total_samples": len(all_findings),
        })
        
        # Record training history
        self._record_training_history({
            "timestamp": datetime.utcnow().isoformat(),
            "type": "retrain_with_feedback",
            "new_samples": n_new,
            "total_samples": len(all_findings),
        })
        
        return {
            "retrained": True,
            "total_samples": len(all_findings),
            "new_samples": n_new,
        }
    
    def _record_training_history(self, entry: Dict[str, Any]):
        """Record training event to history file"""
        history_path = self.MODEL_PATH / self.TRAINING_HISTORY_FILE
        
        history = []
        if history_path.exists():
            try:
                with open(history_path, 'r') as f:
                    history = json.load(f)
            except:
                pass
        
        history.append(entry)
        
        # Keep last 100 entries
        history = history[-100:]
        
        with open(history_path, 'w') as f:
            json.dump(history, f, indent=2)
    
    def generate_synthetic_data(
        self,
        n_samples: int = 1000,
        high_risk_ratio: float = 0.3
    ) -> Tuple[List[Dict], List[int]]:
        """
        Generate synthetic training data for initial model training.
        Based on realistic distributions of secret characteristics.
        
        Returns:
            Tuple of (findings_list, labels)
        """
        import random
        
        findings = []
        labels = []
        
        n_high_risk = int(n_samples * high_risk_ratio)
        n_low_risk = n_samples - n_high_risk
        
        # Generate high-risk samples
        for _ in range(n_high_risk):
            finding = self._generate_synthetic_finding(high_risk=True)
            findings.append(finding)
            labels.append(1)
        
        # Generate low-risk samples  
        for _ in range(n_low_risk):
            finding = self._generate_synthetic_finding(high_risk=False)
            findings.append(finding)
            labels.append(0)
        
        # Shuffle
        combined = list(zip(findings, labels))
        random.shuffle(combined)
        findings, labels = zip(*combined)
        
        return list(findings), list(labels)
    
    def _generate_synthetic_finding(self, high_risk: bool) -> Dict[str, Any]:
        """Generate a single synthetic finding"""
        import random
        import string
        
        if high_risk:
            secret_types = ['aws_access_key', 'github_token', 'private_key', 'database_url']
            file_paths = [
                'src/config/production.py',
                'deploy/secrets.yaml',
                'backend/settings.py',
                '.env.production',
            ]
            entropy_range = (4.0, 5.5)
        else:
            secret_types = ['api_key', 'generic_secret', 'password']
            file_paths = [
                'tests/test_config.py',
                'examples/demo.py',
                'docs/sample.md',
                'mock/fixtures.json',
            ]
            entropy_range = (2.0, 4.0)
        
        # Generate random secret value
        length = random.randint(20, 60)
        secret_value = ''.join(random.choices(string.ascii_letters + string.digits, k=length))
        
        return {
            'secret_value': secret_value,
            'type': random.choice(secret_types),
            'file_path': random.choice(file_paths),
            'line_number': random.randint(1, 500),
            'code_snippet': f'secret = "{secret_value[:10]}..."' if high_risk else f'# example: {secret_value[:10]}',
            'confidence': random.uniform(0.7, 0.99) if high_risk else random.uniform(0.5, 0.8),
            'commit_metadata': {
                'date': datetime.utcnow().isoformat(),
            }
        }

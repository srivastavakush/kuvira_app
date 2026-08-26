"""Evaluation contracts and runners for AI Coach."""
from .contracts import EvaluationThresholds, EvaluationResult, evaluate_report_grounding
from .dataset import load_dataset_manifest

__all__ = ["EvaluationThresholds", "EvaluationResult", "evaluate_report_grounding", "load_dataset_manifest"]

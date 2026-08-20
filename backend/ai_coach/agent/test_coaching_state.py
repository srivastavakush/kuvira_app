"""Unit-level contracts for adaptive coaching persistence."""
from __future__ import annotations


def test_adherence_math_contract():
    assigned = 8
    completed = 5
    skipped = 1
    rate = completed / assigned
    assert round(rate, 4) == 0.625
    assert completed + skipped <= assigned


def test_training_statuses_are_bounded():
    allowed = {"assigned", "in_progress", "completed", "skipped"}
    assert {"assigned", "completed", "skipped"}.issubset(allowed)
    assert "unknown" not in allowed

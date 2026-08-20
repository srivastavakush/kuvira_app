"""Command-line evaluation runner.

It intentionally fails when a real golden dataset is missing; placeholder data
cannot produce a passing score.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from .contracts import EvaluationThresholds, evaluate_report_grounding
from .dataset import load_dataset_manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--report", help="optional JSON report to grounding-check")
    args = parser.parse_args()
    manifest = load_dataset_manifest(args.manifest)
    missing_media = [v["id"] for v in manifest["videos"] if not Path(v["video_path"]).exists()]
    missing_labels = [v["id"] for v in manifest["videos"] if not Path(v["labels_path"]).exists()]
    if missing_media or missing_labels:
        print(json.dumps({"passed": False, "reason": "dataset_artifacts_missing", "missing_media": missing_media, "missing_labels": missing_labels}, indent=2))
        return 2
    result = {"dataset_videos": len(manifest["videos"]), "passed": True}
    if args.report:
        report = json.loads(Path(args.report).read_text(encoding="utf-8"))
        grounding = evaluate_report_grounding(report, EvaluationThresholds())
        result["grounding"] = {
            "passed": grounding.passed,
            "checks": grounding.checks,
            "metrics": grounding.metrics,
            "failures": grounding.failures,
        }
        result["passed"] = result["passed"] and grounding.passed
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

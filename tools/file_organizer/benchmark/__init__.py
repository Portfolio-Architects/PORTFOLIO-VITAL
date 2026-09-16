"""Public administrative benchmark mock dataset generator and testbed.

Exposes:
- generate_benchmark_dataset: Generates 60 realistic administrative mock documents
- BENCHMARK_ROSTER: Full Ground Truth specification for all 60 benchmark files
- BenchmarkItem: Dataclass tracking file metadata and Ground Truth classification
"""

from typing import Any


def __getattr__(name: str) -> Any:
    if name in ("generate_benchmark_dataset", "BENCHMARK_ROSTER", "BenchmarkItem"):
        from tools.file_organizer.benchmark.test_generator import (
            generate_benchmark_dataset,
            BENCHMARK_ROSTER,
            BenchmarkItem
        )
        exports = {
            "generate_benchmark_dataset": generate_benchmark_dataset,
            "BENCHMARK_ROSTER": BENCHMARK_ROSTER,
            "BenchmarkItem": BenchmarkItem
        }
        return exports[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "generate_benchmark_dataset",
    "BENCHMARK_ROSTER",
    "BenchmarkItem"
]

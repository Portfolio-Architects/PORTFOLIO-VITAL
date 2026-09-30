"""Comprehensive Test Suite for Option 1: Dedicated Media Hierarchy and EXIF Album Bundling.

Verifies:
1. EXIF DateTimeOriginal extraction from images.
2. Filename date pattern fallback (e.g. KakaoTalk_20260928_..., 20260515_...).
3. Dedicated '활동사진·미디어' 3rd-tier stage routing.
4. Dynamic date and event album bundling (e.g. '20260928_개막식_현장사진').
5. Duplicate media routing under _Duplicates prefix preserving album structure.
6. End-to-end physical migration and 100% SHA-256 rollback of media files.
"""

from datetime import datetime
import io
import json
import os
from pathlib import Path
from typing import Dict
import pytest
from PIL import Image

from tools.file_organizer.config import (
    STAGE_MEDIA,
    MEDIA_EXTENSIONS,
    MEDIA_IMAGE_EXTENSIONS
)
from tools.file_organizer.scanner.metadata_extractor import (
    FileInfo,
    extract_file_metadata,
    compute_sha256
)
from tools.file_organizer.classifier.rule_engine import classify_file
from tools.file_organizer.main import OrganizerEngine, MigrationPlan
from tools.file_organizer.rollback.rollback_engine import RollbackEngine


def create_mock_jpeg(path: Path, exif_dt: str = "", color: str = "blue") -> None:
    """Helper to create a valid JPEG file with optional EXIF timestamp."""
    img = Image.new("RGB", (30, 30), color=color)
    exif = img.getexif()
    if exif_dt:
        # Tag 306: DateTime, Tag 36867: DateTimeOriginal in IFD 0x8769
        exif[306] = exif_dt
        try:
            ifd = exif.get_ifd(0x8769)
            ifd[36867] = exif_dt
        except Exception:
            pass
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="JPEG", exif=exif)


@pytest.fixture
def mock_media_dataset(tmp_path: Path) -> Path:
    """Create a dataset containing photos and videos with different date sources."""
    src = tmp_path / "media_source"
    src.mkdir(parents=True, exist_ok=True)

    # 1. Image with valid EXIF date and event keyword
    p1 = src / "양재천페스티벌_개막식_스케치.jpg"
    create_mock_jpeg(p1, exif_dt="2026:09:28 10:30:00", color="red")

    # 2. Image with EXIF date but generic name (e.g. smartphone DCIM)
    p2 = src / "IMG_2026_0928_1001.jpg"
    create_mock_jpeg(p2, exif_dt="2026:09:28 11:15:20", color="green")

    # 3. Image without EXIF, but filename date (e.g. KakaoTalk share)
    p3 = src / "KakaoTalk_20260515_142301_체력측정.jpg"
    create_mock_jpeg(p3, exif_dt="", color="yellow")

    # 4. Duplicate photo (identical bytes, different name)
    dup_path = src / "양재천페스티벌_개막식_스케치_복사본.jpg"
    dup_path.write_bytes(p1.read_bytes())

    # 5. Non-image media (e.g. video)
    v1 = src / "20260928_양재천페스티벌_걷기대회_영상.mp4"
    v1.write_bytes(b"MOCK_MP4_VIDEO_STREAM_BYTES_20260928")

    return src


class TestMediaMetadataAndClassification:
    """Unit tests for metadata extraction and classification rules on media files."""

    def test_exif_metadata_extraction(self, tmp_path: Path):
        """Verify EXIF date is extracted accurately from image."""
        img_path = tmp_path / "test_exif.jpg"
        create_mock_jpeg(img_path, exif_dt="2026:09:28 14:00:00")

        info = extract_file_metadata(img_path)
        assert info.is_media is True
        assert info.exif_date == "2026:09:28 14:00:00"
        assert "EXIF_EXTRACTED" in info.status_flags

    def test_media_classification_hierarchy_and_album_bundling(self, tmp_path: Path):
        """Verify media is classified into '활동사진·미디어' with date and event album."""
        img_path = tmp_path / "양재천_건강페스티벌_개막식_01.jpg"
        create_mock_jpeg(img_path, exif_dt="2026:09:28 09:30:00")

        info = extract_file_metadata(img_path)
        res = classify_file(info)

        assert res.year == "2026년"
        assert res.project == "양재천_건강축제_페스티벌"
        assert res.stage == STAGE_MEDIA
        assert "20260928" in res.doc_type
        assert "개막식" in res.doc_type
        assert "현장사진" in res.doc_type
        assert "MEDIA_ASSET" in res.status_flags

    def test_filename_date_fallback_when_no_exif(self, tmp_path: Path):
        """Verify filename date is parsed when EXIF metadata is absent."""
        img_path = tmp_path / "KakaoTalk_20260515_142301_체력인증센터.jpg"
        create_mock_jpeg(img_path, exif_dt="")

        info = extract_file_metadata(img_path)
        res = classify_file(info)

        assert res.year == "2026년"
        assert res.project == "서울체력장_체력인증센터"
        assert res.stage == STAGE_MEDIA
        assert "20260515" in res.doc_type
        assert "현장사진" in res.doc_type


class TestMediaPhysicalMigrationAndRollback:
    """Integration tests for planning, physical migration, and rollback of media assets."""

    def test_media_migration_plan_and_execution(self, mock_media_dataset: Path, tmp_path: Path):
        """Verify media files are physically moved into media hierarchy and can be 100% rolled back."""
        archive_dir = tmp_path / "media_archive"
        engine = OrganizerEngine(dry_run=False)

        # Baseline SHA-256 snapshot
        pre_files = {p.name: compute_sha256(p) for p in mock_media_dataset.iterdir() if p.is_file()}
        assert len(pre_files) == 5

        # 1. Plan
        plan = engine.plan(mock_media_dataset, archive_dir)
        assert len(plan.items) == 5
        assert plan.phase_breakdown["media_activity"] == 5

        # 2. Execute
        exec_result = engine.execute(plan, target_dir=archive_dir, dry_run=False)
        assert exec_result["status"] == "SUCCESS"
        assert exec_result["moved_count"] == 5

        # Verify archive directory structure
        # All media files must be under '활동사진·미디어'
        archived_files = list(archive_dir.rglob("*.jpg")) + list(archive_dir.rglob("*.mp4"))
        assert len(archived_files) == 5

        for af in archived_files:
            parts = af.relative_to(archive_dir).parts
            if parts[0] == "_Duplicates":
                # _Duplicates / year / project / 활동사진·미디어 / album / filename
                assert parts[3] == STAGE_MEDIA
                assert "현장사진" in parts[4]
            else:
                # year / project / 활동사진·미디어 / album / filename
                assert parts[2] == STAGE_MEDIA
                assert "현장사진" in parts[3]

        # 3. Rollback
        journal_path = Path(exec_result["journal_path"])
        rollback_engine = RollbackEngine()
        rb_result = rollback_engine.rollback(journal_path)

        assert rb_result["status"] == "SUCCESS"
        assert rb_result["restored_count"] == 5

        # Verify 100% SHA-256 restoration
        post_files = {p.name: compute_sha256(p) for p in mock_media_dataset.iterdir() if p.is_file()}
        assert pre_files == post_files

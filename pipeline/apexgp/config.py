"""Paths and constants shared by the pipeline."""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PIPELINE_DIR = REPO_ROOT / "pipeline"
CACHE_DIR = PIPELINE_DIR / ".cache"
BUILD_DIR = PIPELINE_DIR / "build"
# The Kaggle "Formula 1 World Championship" archive (Ergast-derived CSVs).
# Not committed: download it from Kaggle and place it at the repo root.
KAGGLE_ARCHIVE = REPO_ROOT / "archive.zip"
APP_DATA_DIR = REPO_ROOT / "public" / "data"

JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1"
OPENF1_BASE = "https://api.openf1.org/v1"

USER_AGENT = "apexgp-pipeline/3.0 (offline research build)"

# Seasons with an interactive replay. Training uses the Kaggle archive only.
REPLAY_SEASONS = (2025,)

# Training window for the in-race models. Pit-stop data starts in 2011; the
# 2014+ window is the turbo-hybrid era, whose reliability and race structure
# are the closest match for the replay seasons.
TRAIN_FIRST_SEASON = 2014
TRAIN_LAST_SEASON = 2024

# Points tables by regulation era (grand prix; sprint). The pipeline verifies
# these against the points published in the official results.
RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
SPRINT_POINTS_2022 = [8, 7, 6, 5, 4, 3, 2, 1]

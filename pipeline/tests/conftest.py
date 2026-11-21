import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apexgp import config  # noqa: E402
from apexgp.sources import jolpica, kaggle, openf1  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def offline():
    """Tests never touch the network: they run against the warm source cache."""
    jolpica.client.offline = True
    openf1.client.offline = True


@pytest.fixture(scope="session")
def archive_races():
    if not config.KAGGLE_ARCHIVE.exists():
        pytest.skip("Kaggle archive not present (see pipeline/README.md)")
    return kaggle.race_timings(2022, 2024)


@pytest.fixture(scope="session")
def season_2025():
    from apexgp import replay
    try:
        return replay.build_season(2025)
    except FileNotFoundError:
        pytest.skip("source cache is cold: run `python pipeline/fetch.py 2025` first")

import pytest
import pandas as pd
import pathlib
import numpy


@pytest.mark.asyncio
async def test_get_data(api_client, setup_db):
    response = await api_client.post(
        f"/projects/{setup_db['project_id_2']}/samples/{setup_db['sample_id_4']}/data"
    )
    # Should collect data from '10000.parquet' file
    # Should only collect Ip, not dalpha
    assert response.status_code == 200
    data = response.json()
    assert data["values"].get("Ip")
    assert not data["values"].get("dalpha")
    assert data["values"]["Ip"]["time"] == list(range(100))
    # Load data from parquet, check it matches
    df = pd.read_parquet(pathlib.Path(__file__).parents[2].joinpath("10000.parquet"))
    assert data["values"]["Ip"]["values"] == df.Ip.tolist()


@pytest.mark.asyncio
async def test_get_data_summary(api_client, setup_db):
    response = await api_client.post(
        f"/projects/{setup_db['project_id_2']}/samples/{setup_db['sample_id_4']}/data/summary"
    )
    # Should collect data from '10000.parquet' file
    # Should only collect Ip, not dalpha
    assert response.status_code == 200
    data = response.json()

    assert data["type"] == "time-series"
    assert (
        data["description"]
        == "Time series signals from one or more diagnostics inside a Tokamak."
    )
    assert data["num_signals"] == 1

    assert data["signals"].get("Ip")
    assert not data["signals"].get("dalpha")

    assert data["signals"]["Ip"]["time"]["count"] == 100
    assert data["signals"]["Ip"]["time"]["min"] == 0
    assert data["signals"]["Ip"]["time"]["max"] == 99

    # Load data from parquet, check it matches
    df = pd.read_parquet(pathlib.Path(__file__).parents[2].joinpath("10000.parquet"))
    expected = df.Ip.tolist()

    assert data["signals"]["Ip"]["values"]["count"] == len(expected)
    assert data["signals"]["Ip"]["values"]["min"] == min(expected)
    assert data["signals"]["Ip"]["values"]["max"] == max(expected)
    assert data["signals"]["Ip"]["values"]["mean"] == numpy.mean(expected)

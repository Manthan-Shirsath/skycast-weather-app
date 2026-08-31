import datetime
import pytest
from backend.app.utils.timezone import parse_to_utc

def test_parse_to_utc_naive_string():
    # Naive string (e.g. from open-meteo)
    dt = parse_to_utc("2026-08-31T00:00:00")
    assert dt.tzinfo == datetime.timezone.utc
    assert dt.hour == 0
    assert dt.day == 31

def test_parse_to_utc_z_suffix():
    dt = parse_to_utc("2026-08-31T12:00:00Z")
    assert dt.tzinfo == datetime.timezone.utc
    assert dt.hour == 12

def test_parse_to_utc_offset_string():
    # +05:30 (IST)
    dt = parse_to_utc("2026-08-31T12:00:00+05:30")
    assert dt.tzinfo == datetime.timezone.utc
    # 12:00 IST is 06:30 UTC
    assert dt.hour == 6
    assert dt.minute == 30

def test_parse_to_utc_naive_datetime():
    dt_in = datetime.datetime(2026, 8, 31, 10, 0, 0)
    dt = parse_to_utc(dt_in)
    assert dt.tzinfo == datetime.timezone.utc
    assert dt.hour == 10

def test_parse_to_utc_aware_datetime():
    tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    dt_in = datetime.datetime(2026, 8, 31, 12, 0, 0, tzinfo=tz)
    dt = parse_to_utc(dt_in)
    assert dt.tzinfo == datetime.timezone.utc
    assert dt.hour == 6
    assert dt.minute == 30

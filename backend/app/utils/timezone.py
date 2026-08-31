import datetime

def parse_to_utc(dt_input) -> datetime.datetime:
    """
    Robustly parses an ISO string or normalizes a datetime object into an authoritative UTC datetime.
    
    Rules:
    - If it's a string, it parses it using fromisoformat.
    - If the resulting datetime is timezone-aware, it is safely converted to UTC.
    - If the datetime is naive, it explicitly assumes UTC and sets the tzinfo.
    - The database and analytics engine must only operate on UTC aware datetimes.
    """
    if isinstance(dt_input, str):
        # Handle 'Z' suffix which fromisoformat in older pythons might struggle with without replacement
        if dt_input.endswith('Z'):
            dt_input = dt_input[:-1] + '+00:00'
        dt = datetime.datetime.fromisoformat(dt_input)
    elif isinstance(dt_input, datetime.datetime):
        dt = dt_input
    else:
        raise TypeError("Input must be a string or datetime object.")

    if dt.tzinfo is not None and dt.tzinfo.utcoffset(dt) is not None:
        # It's timezone aware, normalize to UTC
        return dt.astimezone(datetime.timezone.utc)
    else:
        # It's naive. Assume UTC as per architecture requirements.
        return dt.replace(tzinfo=datetime.timezone.utc)

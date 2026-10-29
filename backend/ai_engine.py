
from statistics import median


def detect_milk_anomalies(values: list[float]) -> list[dict]:
    """Flag unusual milk-yield records for human review."""

    if len(values) < 5:
        return [{
            "status": "insufficient_data",
            "message": "At least 5 milk records are required.",
            "alerts": []
        }]

    center = median(values)
    deviations = [abs(value - center) for value in values]
    mad = median(deviations)

    alerts = []

    for index, value in enumerate(values):
        deviation = abs(value - center)

        # Handle identical or nearly identical baseline readings.
        if mad == 0:
            is_anomaly = deviation > max(1.0, center * 0.20)
        else:
            robust_score = deviation / (1.4826 * mad)
            is_anomaly = robust_score > 3.5

        if is_anomaly:
            alerts.append({
                "record_index": index,
                "milk_liters": value,
                "median_liters": round(center, 2),
                "message": (
                    "Unusual milk-yield value; verify the record."
                )
            })

    return alerts

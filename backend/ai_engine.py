
from statistics import median
from math import isfinite

from sklearn.ensemble import IsolationForest


MIN_RECORDS = 10


def detect_milk_anomalies(values: list[float]) -> list[dict]:
    """
    Detect unusual milk-yield records using Isolation Forest.

    This model identifies statistical outliers. It does not diagnose
    animal disease or determine the cause of a production change.
    """

    # Validate input records.
    clean_values = []

    for value in values:
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue

        if isfinite(number) and number >= 0:
            clean_values.append(number)

    if len(clean_values) < MIN_RECORDS:
        return [{
            "status": "insufficient_data",
            "message": (
                f"At least {MIN_RECORDS} valid milk records "
                "are required for ML analysis."
            ),
            "alerts": []
        }]

    center = median(clean_values)

    # Train Isolation Forest on the available milk-yield records.
    training_data = [[value] for value in clean_values]

    model = IsolationForest(
        n_estimators=200,
        contamination=0.10,
        random_state=42
    )

    model.fit(training_data)

    predictions = model.predict(training_data)
    scores = model.decision_function(training_data)

    alerts = []

    for index, prediction in enumerate(predictions):
        if prediction == -1:
            alerts.append({
                "record_index": index,
                "milk_liters": clean_values[index],
                "median_liters": round(center, 2),
                "anomaly_score": round(float(scores[index]), 4),
                "message": (
                    "ML model detected an unusual milk-yield value. "
                    "Please verify the record."
                )
            })

    return alerts

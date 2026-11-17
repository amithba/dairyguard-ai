
import mlflow
import mlflow.sklearn

from collections import defaultdict
from math import isfinite
from statistics import median
from sklearn.ensemble import IsolationForest

from backend.database import SessionLocal
from backend import models


EXPERIMENT_NAME = "DairyGuard_Milk_Anomaly_Detection"
MIN_RECORDS = 10
CONTAMINATION = 0.10
ESTIMATORS = 200

mlflow.set_tracking_uri("sqlite:///mlflow.db")
mlflow.set_experiment(EXPERIMENT_NAME)


def main():
    db = SessionLocal()

    try:
        rows = (
            db.query(
                models.Cow.id,
                models.MilkRecord.liters
            )
            .join(
                models.MilkRecord,
                models.MilkRecord.cow_id == models.Cow.id
            )
            .order_by(
                models.Cow.id,
                models.MilkRecord.record_date
            )
            .all()
        )

        cow_records = defaultdict(list)

        for cow_id, liters in rows:
            try:
                value = float(liters)
            except (TypeError, ValueError):
                continue

            if isfinite(value) and value >= 0:
                cow_records[cow_id].append(value)

        eligible_cows = {
            cow_id: values
            for cow_id, values in cow_records.items()
            if len(values) >= MIN_RECORDS
        }

        if not eligible_cows:
            print("No cows have enough valid milk records yet.")
            print(f"At least {MIN_RECORDS} records per cow are required.")
            return

        for cow_id, milk_data in eligible_cows.items():
            X = [[value] for value in milk_data]

            with mlflow.start_run(
                run_name=f"Cow_{cow_id}_IsolationForest"
            ):
                model = IsolationForest(
                    n_estimators=ESTIMATORS,
                    contamination=CONTAMINATION,
                    random_state=42
                )

                model.fit(X)
                predictions = model.predict(X)

                anomaly_count = int((predictions == -1).sum())
                normal_count = int((predictions == 1).sum())

                mlflow.log_param("algorithm", "IsolationForest")
                mlflow.log_param("cow_id", cow_id)
                mlflow.log_param("n_estimators", ESTIMATORS)
                mlflow.log_param("contamination", CONTAMINATION)
                mlflow.log_param("features", "milk_liters")
                mlflow.log_param("random_state", 42)

                mlflow.log_metric("records_analyzed", len(milk_data))
                mlflow.log_metric("anomaly_count", anomaly_count)
                mlflow.log_metric("normal_count", normal_count)
                mlflow.log_metric(
                    "median_milk_liters",
                    median(milk_data)
                )

                mlflow.set_tag("project", "DairyGuard AI")
                mlflow.set_tag(
                    "experiment_type",
                    "Real Database Milk Anomaly Detection"
                )

                mlflow.sklearn.log_model(
                    sk_model=model,
                    name="milk_anomaly_model",
                    skops_trusted_types=["sklearn.tree._tree.Tree"]
                )

                print(f"\nCow ID: {cow_id}")
                print(f"Records analysed: {len(milk_data)}")
                print(f"Anomalies: {anomaly_count}")
                print(f"Normal records: {normal_count}")

        print("\nMLflow database experiment completed!")
        print("Experiment:", EXPERIMENT_NAME)

    finally:
        db.close()


if __name__ == "__main__":
    main()

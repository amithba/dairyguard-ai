
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np
import tensorflow as tf
import mlflow
import mlflow.tensorflow

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error


SEED = 42
np.random.seed(SEED)
tf.random.set_seed(SEED)

EXPERIMENT_NAME = "DairyGuard_Deep_Learning"
mlflow.set_tracking_uri("sqlite:///mlflow.db")
mlflow.set_experiment(EXPERIMENT_NAME)


def create_demo_data(samples=500):
    """Generate clearly labelled synthetic milk-yield demo data."""
    rng = np.random.default_rng(SEED)

    previous_yield = rng.uniform(5, 30, samples)
    feed_kg = rng.uniform(2, 12, samples)
    age_months = rng.integers(18, 100, samples)
    days_in_milk = rng.integers(1, 300, samples)

    age_effect = np.exp(-((age_months - 60) / 45) ** 2)
    lactation_effect = np.exp(-((days_in_milk - 90) / 180) ** 2)

    target = (
        0.55 * previous_yield
        + 0.65 * feed_kg
        + 4.0 * age_effect
        + 3.0 * lactation_effect
        + rng.normal(0, 1.2, samples)
    )

    target = np.clip(target, 0, None)

    features = np.column_stack(
        [previous_yield, feed_kg, age_months, days_in_milk]
    )

    return features.astype("float32"), target.astype("float32")


def main():
    X, y = create_demo_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=SEED
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train).astype("float32")
    X_test = scaler.transform(X_test).astype("float32")

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(4,)),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(1)
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="mse",
        metrics=["mae"]
    )

    with mlflow.start_run(run_name="TensorFlow_Milk_Yield_v1"):
        history = model.fit(
            X_train,
            y_train,
            validation_split=0.2,
            epochs=40,
            batch_size=16,
            verbose=0
        )

        predictions = model.predict(X_test, verbose=0).flatten()

        mae = float(mean_absolute_error(y_test, predictions))
        rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))

        mlflow.log_param("model", "TensorFlow Dense Neural Network")
        mlflow.log_param("epochs", 40)
        mlflow.log_param("batch_size", 16)
        mlflow.log_param("hidden_layers", "32,16")
        mlflow.log_param("features", "previous_yield,feed_kg,age_months,days_in_milk")
        mlflow.log_param("dataset", "synthetic_demo_data")

        mlflow.log_metric("test_mae", mae)
        mlflow.log_metric("test_rmse", rmse)
        mlflow.log_metric("final_training_loss", float(history.history["loss"][-1]))

        mlflow.set_tag("project", "DairyGuard AI")
        mlflow.set_tag("data_type", "Synthetic demonstration data")
        mlflow.set_tag("task", "Milk yield regression")

        mlflow.tensorflow.log_model(
            model,
            name="dairyguard_dl_model"
        )

        print("Deep Learning experiment completed!")
        print("Training samples:", len(X_train))
        print("Testing samples:", len(X_test))
        print("Test MAE:", round(mae, 3))
        print("Test RMSE:", round(rmse, 3))


if __name__ == "__main__":
    main()



import numpy as np
import pennylane as qml
import pennylane.numpy as pnp
import mlflow

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score


SEED = 42
np.random.seed(SEED)

N_QUBITS = 4
N_LAYERS = 2
STEPS = 60

EXPERIMENT_NAME = "DairyGuard_Quantum_ML"
mlflow.set_tracking_uri("sqlite:///mlflow.db")
mlflow.set_experiment(EXPERIMENT_NAME)

dev = qml.device("default.qubit", wires=N_QUBITS)


@qml.qnode(dev, interface="autograd", diff_method="backprop")
def quantum_circuit(inputs, weights):
    qml.AngleEmbedding(inputs, wires=range(N_QUBITS), rotation="Y")
    qml.StronglyEntanglingLayers(weights, wires=range(N_QUBITS))
    return qml.expval(qml.PauliZ(0))


def create_demo_data(samples=240):
    """Create labelled synthetic data for a QML demonstration."""
    rng = np.random.default_rng(SEED)

    X = rng.uniform(-1, 1, size=(samples, N_QUBITS))

    score = (
        0.8 * X[:, 0]
        + 0.6 * X[:, 1]
        - 0.5 * X[:, 2]
        + 0.4 * X[:, 3]
    )

    y = np.where(score > 0, 1.0, -1.0)

    return X.astype("float64"), y.astype("float64")


def main():
    X, y = create_demo_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=SEED,
        stratify=y
    )

    weights = pnp.array(
        0.01 * np.random.randn(N_LAYERS, N_QUBITS, 3),
        requires_grad=True
    )

    optimizer = qml.AdamOptimizer(stepsize=0.05)

    def cost_function(current_weights):
        outputs = pnp.stack([
            quantum_circuit(pnp.array(row), current_weights)
            for row in X_train
        ])
        return pnp.mean((outputs - pnp.array(y_train)) ** 2)

    with mlflow.start_run(run_name="PennyLane_Quantum_Classifier_v1"):
        for step in range(STEPS):
            weights = optimizer.step(cost_function, weights)

            if (step + 1) % 20 == 0:
                print(
                    f"Training step {step + 1}/{STEPS} "
                    f"Loss: {float(cost_function(weights)):.4f}"
                )

        raw_predictions = [
            float(quantum_circuit(pnp.array(row), weights))
            for row in X_test
        ]

        predictions = np.where(np.array(raw_predictions) >= 0, 1.0, -1.0)

        accuracy = float(accuracy_score(y_test, predictions))

        mlflow.log_param("algorithm", "Variational Quantum Classifier")
        mlflow.log_param("framework", "PennyLane")
        mlflow.log_param("qubits", N_QUBITS)
        mlflow.log_param("quantum_layers", N_LAYERS)
        mlflow.log_param("training_steps", STEPS)
        mlflow.log_param("dataset", "synthetic_demo_data")

        mlflow.log_metric("test_accuracy", accuracy)
        mlflow.log_metric("final_training_loss", float(cost_function(weights)))

        mlflow.set_tag("project", "DairyGuard AI")
        mlflow.set_tag("data_type", "Synthetic demonstration data")
        mlflow.set_tag("task", "Milk anomaly pattern classification")
        mlflow.set_tag("quantum_device", "default.qubit simulator")

        np.save("qml_weights.npy", np.array(weights))
        mlflow.log_artifact("qml_weights.npy")

        print("\nQuantum ML experiment completed!")
        print("Training samples:", len(X_train))
        print("Testing samples:", len(X_test))
        print("Test accuracy:", round(accuracy, 4))
        print("Saved quantum model weights: qml_weights.npy")


if __name__ == "__main__":
    main()


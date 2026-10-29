
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Beef,
  CircleDollarSign,
  Droplets,
  RefreshCw,
  Sprout,
} from "lucide-react";
import "./App.css";

const API = "http://127.0.0.1:8001";

export default function App() {
  const [farms, setFarms] = useState([]);
  const [cows, setCows] = useState([]);
  const [milk, setMilk] = useState([]);
  const [costs, setCosts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all([
        fetch(`${API}/farms`),
        fetch(`${API}/cows`),
        fetch(`${API}/milk-records`),
        fetch(`${API}/feed-costs`),
      ]);

      if (responses.some((response) => !response.ok)) {
        throw new Error("Backend returned an error. Check the API server.");
      }

      const [farmData, cowData, milkData, costData] =
        await Promise.all(responses.map((response) => response.json()));

      setFarms(farmData);
      setCows(cowData);
      setMilk(milkData);
      setCosts(costData);
    } catch {
      setError(
        "Cannot connect to the backend. Ensure FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalMilk = milk.reduce(
    (sum, record) => sum + Number(record.liters || 0),
    0
  );

  const totalFeedCost = costs.reduce(
    (sum, record) => sum + Number(record.amount || 0),
    0
  );

  const cards = [
    {
      label: "Registered Farms",
      value: farms.length,
      icon: Sprout,
      color: "green",
    },
    {
      label: "Total Cattle",
      value: cows.length,
      icon: Beef,
      color: "blue",
    },
    {
      label: "Milk Recorded",
      value: `${totalMilk.toFixed(1)} L`,
      icon: Droplets,
      color: "cyan",
    },
    {
      label: "Recorded Feed Cost",
      value: `₹${totalFeedCost.toLocaleString("en-IN")}`,
      icon: CircleDollarSign,
      color: "orange",
    },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Sprout size={25} /></div>
          <div>
            <h2>DairyGuard <span>AI</span></h2>
            <p>SMART DAIRY MANAGEMENT</p>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active"><Activity size={18} /> Overview</div>
        <div className="nav-item"><Beef size={18} /> Herd Management</div>
        <div className="nav-item"><Droplets size={18} /> Milk Production</div>
        <div className="nav-item"><Sprout size={18} /> Feed & Costs</div>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <strong>Farm system</strong>
            <p>Dashboard preview</p>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">DAIRY INTELLIGENCE PLATFORM</p>
            <h1>Farm Overview</h1>
            <p className="subtitle">
              Monitor your farm data and make informed decisions.
            </p>
          </div>
          <button className="refresh-button" onClick={loadData}>
            <RefreshCw size={16} /> Refresh data
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <div className="section-heading">
          <div>
            <h2>Performance at a glance</h2>
            <p>Your figures are calculated from saved database records.</p>
          </div>
          <span className="live-label">
            <span className="status-dot" /> API DATA
          </span>
        </div>

        <div className="stats-grid">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <article className="stat-card" key={label}>
              <div className={`stat-icon ${color}`}><Icon size={21} /></div>
              <p>{label}</p>
              <h3>{loading ? "…" : value}</h3>
              <span className="stat-note">From recorded data</span>
            </article>
          ))}
        </div>

        <div className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Recent milk records</h2>
                <p>Latest production entries</p>
              </div>
              <Droplets size={20} />
            </div>

            {milk.length === 0 ? (
              <div className="empty-state">
                <Droplets size={28} />
                <strong>No milk records yet</strong>
                <p>Add records through the API to see production here.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Record ID</th><th>Cow ID</th><th>Date</th><th>Yield</th></tr>
                  </thead>
                  <tbody>
                    {[...milk].reverse().slice(0, 6).map((record) => (
                      <tr key={record.id}>
                        <td>#{record.id}</td>
                        <td>{record.cow_id}</td>
                        <td>{String(record.record_date).slice(0, 10)}</td>
                        <td><strong>{record.liters} L</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="panel insight-panel">
            <div className="panel-heading">
              <div>
                <h2>Farm insights</h2>
                <p>Current system snapshot</p>
              </div>
              <Activity size={20} />
            </div>

            <div className="insight-row">
              <div className="insight-icon green"><Sprout size={18} /></div>
              <div><strong>Farm records</strong><p>{farms.length} farm(s) registered</p></div>
            </div>
            <div className="insight-row">
              <div className="insight-icon blue"><Beef size={18} /></div>
              <div><strong>Herd records</strong><p>{cows.length} cow(s) registered</p></div>
            </div>
            <div className="insight-row">
              <div className="insight-icon orange"><AlertTriangle size={18} /></div>
              <div>
                <strong>Data quality</strong>
                <p>
                  {milk.length < 5
                    ? "More milk records needed for anomaly screening."
                    : "Records available for anomaly screening."}
                </p>
              </div>
            </div>

            <div className="notice">
              <strong>AI safety note</strong>
              <p>
                Unusual production values are review alerts, not veterinary
                diagnoses. Verify records before taking action.
              </p>
            </div>
          </article>
        </div>

        <footer>
          <span>DairyGuard AI · Farm decision support</span>
          <span>Prototype · Not for veterinary diagnosis</span>
        </footer>
      </section>
    </main>
  );
}

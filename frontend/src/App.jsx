
import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

const EMPTY_FORMS = {
  farms: { name: "", location: "" },
  cows: { tag_number: "", breed: "", age: "", farm_id: "" },
  milk: { cow_id: "", quantity_liters: "", date: new Date().toISOString().slice(0, 10) },
  feed: { farm_id: "", feed_type: "", amount: "", date: new Date().toISOString().slice(0, 10) },
};

const NAV_ITEMS = [
  { id: "dashboard", icon: "⌂", label: "Dashboard" },
  { id: "herd", icon: "♧", label: "Herd Management" },
  { id: "milk", icon: "◉", label: "Milk Records" },
  { id: "feed", icon: "▤", label: "Feed Costs" },
];

function getId(item) {
  return item?.id ?? item?._id ?? item?.farm_id ?? item?.cow_id ?? "";
}

function getName(item) {
  return item?.name ?? item?.farm_name ?? item?.tag_number ?? item?.cow_name ?? "Unnamed";
}

function getMilkQuantity(item) {
  return Number(
    item?.quantity_liters ??
    item?.quantity ??
    item?.liters ??
    item?.milk_yield ??
    0
  );
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
  });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function Icon({ children }) {
  return <span className="dg-icon" aria-hidden="true">{children}</span>;
}

function Logo({ onError }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="brand-mark">
      {!imageFailed ? (
        <img
          className="brand-image"
          src="C:\Users\amith\OneDrive\Pictures\IMG-20241227-WA0030.jpg"
          alt="DairyGuard AI logo"
          onError={() => {
            setImageFailed(true);
            onError?.();
          }}
        />
      ) : (
        <div className="brand-fallback" aria-label="DairyGuard logo placeholder">
          DG
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, note, accent }) {
  return (
    <article className={`stat-card ${accent || ""}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon"><Icon>{icon}</Icon></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◇</div>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dairyguard_user") || "null"); }
    catch { return null; }
  });
  const [farms, setFarms] = useState([]);
  const [cows, setCows] = useState([]);
  const [milkRecords, setMilkRecords] = useState([]);
  const [feedCosts, setFeedCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [forms, setForms] = useState(EMPTY_FORMS);
  const [formOpen, setFormOpen] = useState("");
  const [search, setSearch] = useState("");

  function handleLogin(event) {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Enter your email and password to continue.");
      return;
    }
    // Front-end demo only. Replace this with your backend authentication endpoint for production.
    const nextUser = {
      email: loginEmail.trim(),
      name: loginEmail.trim().split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
    localStorage.setItem("dairyguard_user", JSON.stringify(nextUser));
    setUser(nextUser);
    setLoginError("");
  }

  function handleLogout() {
    localStorage.removeItem("dairyguard_user");
    setUser(null);
    setLoginPassword("");
    setActivePage("dashboard");
  }

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        apiRequest("/farms"),
        apiRequest("/cows"),
        apiRequest("/milk-records"),
        apiRequest("/feed-costs"),
      ]);

      const setters = [setFarms, setCows, setMilkRecords, setFeedCosts];
      const labels = ["farms", "cows", "milk records", "feed costs"];
      const failures = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          setters[index](normalizeList(result.value));
        } else {
          failures.push(labels[index]);
        }
      });

      if (failures.length) {
        setError(
          `Could not load ${failures.join(", ")}. Check that your backend is running and the API endpoints are available.`
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalMilk = useMemo(
    () => milkRecords.reduce((sum, record) => sum + getMilkQuantity(record), 0),
    [milkRecords]
  );

  const totalFeedCost = useMemo(
    () =>
      feedCosts.reduce(
        (sum, item) => sum + Number(item.amount ?? item.cost ?? item.total_cost ?? 0),
        0
      ),
    [feedCosts]
  );

  const averageMilk = milkRecords.length ? totalMilk / milkRecords.length : 0;

  const filteredCows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cows;
    return cows.filter((cow) =>
      [getName(cow), cow.tag_number, cow.breed, cow.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [cows, search]);

  function updateForm(type, field, value) {
    setForms((previous) => ({
      ...previous,
      [type]: { ...previous[type], [field]: value },
    }));
  }

  function openForm(type) {
    setError("");
    setSuccess("");
    setFormOpen(type);
  }

  function closeForm() {
    setFormOpen("");
  }

  async function submitForm(event, type) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const endpoints = {
      farms: "/farms",
      cows: "/cows",
      milk: "/milk-records",
      feed: "/feed-costs",
    };

    // Payloads use conventional field names. Match them to your backend
    // Pydantic/SQLAlchemy schema if your API uses different names.
    const payload = { ...forms[type] };

    if (type === "cows") {
      payload.age = payload.age === "" ? null : Number(payload.age);
      payload.farm_id = payload.farm_id === "" ? null : Number(payload.farm_id);
    }

    if (type === "milk") {
      payload.cow_id = payload.cow_id === "" ? null : Number(payload.cow_id);
      payload.quantity_liters = Number(payload.quantity_liters);
    }

    if (type === "feed") {
      payload.farm_id = payload.farm_id === "" ? null : Number(payload.farm_id);
      payload.amount = Number(payload.amount);
    }

    try {
      await apiRequest(endpoints[type], {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const labels = {
        farms: "Farm",
        cows: "Cow",
        milk: "Milk record",
        feed: "Feed cost",
      };

      setSuccess(`${labels[type]} submitted successfully.`);
      setForms((previous) => ({
        ...previous,
        [type]: {
          ...EMPTY_FORMS[type],
          date: new Date().toISOString().slice(0, 10),
        },
      }));
      setFormOpen("");
      await loadData(false);
    } catch (err) {
      setError(
        `${getErrorMessage(err)} If the backend is running, check its required field names and validation rules.`
      );
    } finally {
      setSaving(false);
    }
  }

  function navigate(page) {
    setActivePage(page);
    setError("");
    setSuccess("");
    setFormOpen("");
    setSearch("");
  }

  function renderFarmOptions() {
    return (
      <>
        <option value="">Select a farm (optional)</option>
        {farms.map((farm, index) => (
          <option key={getId(farm) || index} value={getId(farm)}>
            {getName(farm)}
          </option>
        ))}
      </>
    );
  }

  function renderCowOptions() {
    return (
      <>
        <option value="">Select a cow</option>
        {cows.map((cow, index) => (
          <option key={getId(cow) || index} value={getId(cow)}>
            {cow.tag_number || getName(cow)}
          </option>
        ))}
      </>
    );
  }

  function renderForm() {
    if (!formOpen) return null;

    const titles = {
      farms: "Add a farm",
      cows: "Register a cow",
      milk: "Add milk record",
      feed: "Record feed cost",
    };

    return (
      <div className="modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeForm();
      }}>
        <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
          <div className="modal-header">
            <div>
              <span className="eyebrow">DAIRYGUARD WORKSPACE</span>
              <h2 id="form-title">{titles[formOpen]}</h2>
            </div>
            <button className="close-button" type="button" onClick={closeForm} aria-label="Close form">×</button>
          </div>

          <form onSubmit={(event) => submitForm(event, formOpen)} className="record-form">
            {formOpen === "farms" && (
              <>
                <label>Farm name *
                  <input required value={forms.farms.name} onChange={(e) => updateForm("farms", "name", e.target.value)} placeholder="e.g. Green Valley Dairy" />
                </label>
                <label>Location
                  <input value={forms.farms.location} onChange={(e) => updateForm("farms", "location", e.target.value)} placeholder="Village, district" />
                </label>
              </>
            )}

            {formOpen === "cows" && (
              <>
                <label>Tag / identification number *
                  <input required value={forms.cows.tag_number} onChange={(e) => updateForm("cows", "tag_number", e.target.value)} placeholder="e.g. DG-COW-001" />
                </label>
                <label>Breed *
                  <input required value={forms.cows.breed} onChange={(e) => updateForm("cows", "breed", e.target.value)} placeholder="e.g. Holstein Friesian" />
                </label>
                <label>Age (years)
                  <input type="number" min="0" step="1" value={forms.cows.age} onChange={(e) => updateForm("cows", "age", e.target.value)} placeholder="e.g. 3" />
                </label>
                <label>Farm
                  <select value={forms.cows.farm_id} onChange={(e) => updateForm("cows", "farm_id", e.target.value)}>
                    {renderFarmOptions()}
                  </select>
                </label>
              </>
            )}

            {formOpen === "milk" && (
              <>
                <label>Cow *
                  <select required value={forms.milk.cow_id} onChange={(e) => updateForm("milk", "cow_id", e.target.value)}>
                    {renderCowOptions()}
                  </select>
                </label>
                <label>Milk quantity (litres) *
                  <input required type="number" min="0.01" step="0.01" value={forms.milk.quantity_liters} onChange={(e) => updateForm("milk", "quantity_liters", e.target.value)} placeholder="e.g. 12.5" />
                </label>
                <label>Record date *
                  <input required type="date" value={forms.milk.date} onChange={(e) => updateForm("milk", "date", e.target.value)} />
                </label>
              </>
            )}

            {formOpen === "feed" && (
              <>
                <label>Feed type *
                  <input required value={forms.feed.feed_type} onChange={(e) => updateForm("feed", "feed_type", e.target.value)} placeholder="e.g. Green fodder" />
                </label>
                <label>Cost amount (₹) *
                  <input required type="number" min="0" step="0.01" value={forms.feed.amount} onChange={(e) => updateForm("feed", "amount", e.target.value)} placeholder="e.g. 1500" />
                </label>
                <label>Farm
                  <select value={forms.feed.farm_id} onChange={(e) => updateForm("feed", "farm_id", e.target.value)}>
                    {renderFarmOptions()}
                  </select>
                </label>
                <label>Record date *
                  <input required type="date" value={forms.feed.date} onChange={(e) => updateForm("feed", "date", e.target.value)} />
                </label>
              </>
            )}

            <div className="form-actions">
              <button className="btn-secondary" type="button" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save record"}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  function renderTable(headers, rows, emptyTitle, emptyMessage) {
    if (!rows.length) {
      return <EmptyState title={emptyTitle} message={emptyMessage} />;
    }

    return (
      <div className="table-wrap">
        <table>
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }

  function renderDashboard() {
    return (
      <>
        <section className="welcome-panel">
          <div className="welcome-copy">
            <span className="eyebrow orange-text">YOUR FARM. YOUR DATA. YOUR CONTROL.</span>
            <h2><span className="orange-text">Welcome back,</span><br />let's grow smarter.</h2>
            <p>Monitor your herd, track milk production, and keep farm costs in view — all in one place.</p>
            <button className="btn-primary" onClick={() => navigate("herd")}>Explore herd management <span>→</span></button>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-ring ring-one"></div>
            <div className="art-ring ring-two"></div>
            <div className="cow-art">🐄</div>
            <div className="art-tag tag-top"><span className="status-dot"></span> Farm overview</div>
            <div className="art-tag tag-bottom"><span className="orange-text">AI</span> · Smarter dairy</div>
          </div>
        </section>

        <div className="section-heading">
          <div><span className="eyebrow">AT A GLANCE</span><h2>Farm overview</h2></div>
          <button className="btn-secondary refresh-btn" onClick={() => loadData()} disabled={loading}>
            ↻ {loading ? "Refreshing…" : "Refresh data"}
          </button>
        </div>

        <section className="stats-grid">
          <StatCard icon="♧" label="Registered farms" value={farms.length} note="Farms in your workspace" accent="accent-orange" />
          <StatCard icon="🐄" label="Total herd" value={cows.length} note="Registered cows" accent="accent-blue" />
          <StatCard icon="◉" label="Milk recorded" value={`${formatNumber(totalMilk)} L`} note={`${milkRecords.length} milk entries`} accent="accent-orange" />
          <StatCard icon="₹" label="Feed expenses" value={`₹${formatNumber(totalFeedCost, 2)}`} note={`${feedCosts.length} cost entries`} accent="accent-blue" />
        </section>

        <section className="dashboard-lower">
          <article className="panel recent-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">PRODUCTION</span><h3>Recent milk records</h3></div>
              <button className="text-button" onClick={() => navigate("milk")}>View all →</button>
            </div>
            {milkRecords.length ? renderTable(
              ["Cow", "Quantity", "Date"],
              [...milkRecords].slice(-5).reverse().map((record, index) => (
                <tr key={getId(record) || index}>
                  <td><div className="table-primary">{record.tag_number || record.cow_name || record.cow_id || "Cow record"}</div></td>
                  <td><span className="quantity-pill">{formatNumber(getMilkQuantity(record))} L</span></td>
                  <td>{formatDate(record.date || record.record_date || record.created_at)}</td>
                </tr>
              )),
              "No milk records", "Add your first milk record to see production here."
            ) : <EmptyState title="No milk records yet" message="Record milk production to start tracking your herd." />}
          </article>

          <article className="panel quick-panel">
            <div className="panel-heading"><div><span className="eyebrow">QUICK ACTIONS</span><h3>What would you like to do?</h3></div></div>
            <button className="quick-action" onClick={() => openForm("farms")}><span className="quick-icon orange-bg">＋</span><span><strong>Add a farm</strong><small>Create a farm profile</small></span><b>→</b></button>
            <button className="quick-action" onClick={() => openForm("cows")}><span className="quick-icon blue-bg">♧</span><span><strong>Register a cow</strong><small>Add an animal to your herd</small></span><b>→</b></button>
            <button className="quick-action" onClick={() => openForm("milk")}><span className="quick-icon orange-bg">◉</span><span><strong>Log milk production</strong><small>Record milk in litres</small></span><b>→</b></button>
            <button className="quick-action" onClick={() => openForm("feed")}><span className="quick-icon blue-bg">₹</span><span><strong>Add feed expenses</strong><small>Track your farm costs</small></span><b>→</b></button>
            <div className="insight-note"><span>✦</span><p><strong>Keep records up to date.</strong><br />Consistent data helps you understand production and expenses.</p></div>
          </article>
        </section>
      </>
    );
  }

  function renderHerd() {
    return (
      <section className="panel page-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">ANIMAL DATABASE</span><h2>Herd Management</h2><p className="panel-subtitle">Manage farms and registered cows in one place.</p></div>
          <button className="btn-primary" onClick={() => openForm("cows")}>＋ Register cow</button>
        </div>

        <div className="subsection-heading">
          <h3>Farm profiles <span className="count-badge">{farms.length}</span></h3>
          <button className="btn-secondary" onClick={() => openForm("farms")}>＋ Add farm</button>
        </div>
        {farms.length ? (
          <div className="farm-grid">
            {farms.map((farm, index) => (
              <article className="farm-card" key={getId(farm) || index}>
                <div className="farm-card-icon">⌂</div>
                <div><h4>{getName(farm)}</h4><p>{farm.location || farm.address || "Location not specified"}</p></div>
                <span className="farm-status">Registered</span>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No farms added yet" message="Create a farm profile to organize your dairy records." />}

        <div className="subsection-heading cow-heading">
          <h3>Registered cows <span className="count-badge">{cows.length}</span></h3>
          <div className="table-tools"><input aria-label="Search cows" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tag or breed…" /><button className="btn-secondary" onClick={() => openForm("cows")}>＋ Add cow</button></div>
        </div>

        {renderTable(
          ["Tag number", "Breed", "Age", "Farm"],
          filteredCows.map((cow, index) => (
            <tr key={getId(cow) || index}>
              <td><strong className="table-primary">{cow.tag_number || getName(cow)}</strong></td>
              <td>{cow.breed || "—"}</td>
              <td>{cow.age != null ? `${cow.age} years` : "—"}</td>
              <td>{cow.farm_name || farms.find((farm) => String(getId(farm)) === String(cow.farm_id))?.name || cow.farm_id || "—"}</td>
            </tr>
          )),
          "No cows registered", "Use Register cow to add your first animal."
        )}
      </section>
    );
  }

  function renderMilk() {
    return (
      <section className="panel page-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">PRODUCTION TRACKER</span><h2>Milk Records</h2><p className="panel-subtitle">Track milk production entries for your herd.</p></div>
          <button className="btn-primary" onClick={() => openForm("milk")}>＋ Add milk record</button>
        </div>
        <div className="mini-summary"><span>Total recorded milk</span><strong>{formatNumber(totalMilk)} L</strong><span>{milkRecords.length} records</span></div>
        {renderTable(
          ["Cow", "Quantity", "Date"],
          [...milkRecords].reverse().map((record, index) => (
            <tr key={getId(record) || index}>
              <td><strong className="table-primary">{record.tag_number || record.cow_name || cows.find((cow) => String(getId(cow)) === String(record.cow_id))?.tag_number || record.cow_id || "Cow record"}</strong></td>
              <td><span className="quantity-pill">{formatNumber(getMilkQuantity(record))} L</span></td>
              <td>{formatDate(record.date || record.record_date || record.created_at)}</td>
            </tr>
          )),
          "No milk records", "Add a record to start tracking production."
        )}
      </section>
    );
  }

  function renderFeed() {
    return (
      <section className="panel page-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">EXPENSE TRACKER</span><h2>Feed Costs</h2><p className="panel-subtitle">Record feed purchases and monitor costs.</p></div>
          <button className="btn-primary" onClick={() => openForm("feed")}>＋ Add feed cost</button>
        </div>
        <div className="mini-summary"><span>Total recorded expenses</span><strong>₹{formatNumber(totalFeedCost, 2)}</strong><span>{feedCosts.length} entries</span></div>
        {renderTable(
          ["Feed type", "Farm", "Amount", "Date"],
          [...feedCosts].reverse().map((record, index) => (
            <tr key={getId(record) || index}>
              <td><strong className="table-primary">{record.feed_type || record.name || record.description || "Feed"}</strong></td>
              <td>{record.farm_name || farms.find((farm) => String(getId(farm)) === String(record.farm_id))?.name || record.farm_id || "—"}</td>
              <td><span className="cost-value">₹{formatNumber(record.amount ?? record.cost ?? record.total_cost, 2)}</span></td>
              <td>{formatDate(record.date || record.record_date || record.created_at)}</td>
            </tr>
          )),
          "No feed costs recorded", "Add a feed expense to begin tracking costs."
        )}
      </section>
    );
  }

  const pageTitles = {
    dashboard: "Dashboard",
    herd: "Herd Management",
    milk: "Milk Records",
    feed: "Feed Costs",
  };

  if (!user) {
    return (
      <div className="dg-login-shell">
        <div className="dg-login-glow dg-login-glow-orange" />
        <div className="dg-login-glow dg-login-glow-blue" />
        <header className="dg-login-brand">
          <Logo />
          <div><strong>DairyGuard <span>AI</span></strong><small>SMART DAIRY MANAGEMENT</small></div>
        </header>
        <main className="dg-login-layout">
          <section className="dg-login-intro">
            <span className="dg-login-eyebrow"><i /> FARM MANAGEMENT WORKSPACE</span>
            <h1>Better farming.<br /><em>Smarter decisions.</em></h1>
            <p>Manage your herd, track milk production, and keep farm expenses organized in one secure-looking workspace.</p>
            <div className="dg-login-benefits">
              <div><span className="dg-benefit-icon orange">◉</span><div><b>Track milk production</b><small>Keep daily milk records in one place.</small></div></div>
              <div><span className="dg-benefit-icon blue">♧</span><div><b>Manage your herd</b><small>Organize farms and registered cows.</small></div></div>
              <div><span className="dg-benefit-icon orange">₹</span><div><b>Monitor farm expenses</b><small>Review feed costs and records.</small></div></div>
            </div>
          </section>
          <section className="dg-login-card">
            <div className="dg-login-card-head"><div className="dg-login-mini-logo"><Logo /></div><span className="dg-access-pill"><i /> WORKSPACE ACCESS</span></div>
            <h2>Welcome back</h2>
            <p className="dg-login-muted">Sign in to continue to your dairy dashboard.</p>
            <form className="dg-login-form" onSubmit={handleLogin}>
              <label htmlFor="dg-login-email">Email address</label>
              <input id="dg-login-email" type="email" placeholder="you@example.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} autoComplete="username" required />
              <label htmlFor="dg-login-password">Password</label>
              <div className="dg-login-password-wrap"><input id="dg-login-password" type={showLoginPassword ? "text" : "password"} placeholder="Enter your password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShowLoginPassword((value) => !value)} aria-label={showLoginPassword ? "Hide password" : "Show password"}>{showLoginPassword ? "HIDE" : "SHOW"}</button></div>
              {loginError && <p className="dg-login-error" role="alert">{loginError}</p>}
              <button className="dg-login-submit" type="submit">Sign in to dashboard <span>↗</span></button>
            </form>
            <div className="dg-login-note"><span>◇</span> Demo login · connect backend authentication before deployment</div>
          </section>
        </main>
        <footer className="dg-login-footer"><span>© {new Date().getFullYear()} DAIRYGUARD AI</span><span>BUILT FOR SMARTER FARMING <i>✦</i></span></footer>
      </div>
    );
  }

  return (
    <div className="dg-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
          <div className="brand-copy">
            <h1><span>DairyGuard</span> <b>AI</b></h1>
            <p>SMART DAIRY MANAGEMENT</p>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              <Icon>{item.icon}</Icon>
              <span>{item.label}</span>
              {activePage === item.id && <span className="nav-active-mark" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-spark">✦</span>
            <strong>Farm smarter.</strong>
            <p>Better records. Better decisions.</p>
          </div>
          <div className="connection-status"><span className={`status-dot ${loading ? "dot-loading" : ""}`} /> {loading ? "Connecting to API…" : error ? "Check connection" : "Workspace ready"}</div>
          <div className="sidebar-footer">DAIRYGUARD AI <span>•</span> v1.0</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">DAIRYGUARD AI / WORKSPACE</span>
            <h2>{pageTitles[activePage]}</h2>
          </div>
          <div className="topbar-right">
            <div className="live-indicator"><span className="status-dot" /> LIVE WORKSPACE</div>
            <div className="dg-user-chip"><span className="avatar">{(user.name || user.email || "D").slice(0, 1).toUpperCase()}</span><span className="dg-user-name">{user.name || user.email}</span></div>
            <button className="dg-logout-button" onClick={handleLogout} title="Sign out">Sign out ↗</button>
          </div>
        </header>

        <div className="content-area">
          {error && (
            <div className="alert alert-error" role="alert">
              <span>!</span><p>{error}</p><button onClick={() => setError("")} aria-label="Dismiss error">×</button>
            </div>
          )}
          {success && (
            <div className="alert alert-success" role="status">
              <span>✓</span><p>{success}</p><button onClick={() => setSuccess("")} aria-label="Dismiss success">×</button>
            </div>
          )}

          {loading && (
            <div className="loading-banner"><span className="loading-spinner" /> Loading your farm data…</div>
          )}

          {!loading && activePage === "dashboard" && renderDashboard()}
          {!loading && activePage === "herd" && renderHerd()}
          {!loading && activePage === "milk" && renderMilk()}
          {!loading && activePage === "feed" && renderFeed()}

          <footer className="main-footer">
            <span>© {new Date().getFullYear()} <strong>DairyGuard <b>AI</b></strong></span>
            <span>Built for smarter dairy farming <span className="footer-heart">♥</span></span>
          </footer>
        </div>
      </main>

      {renderForm()}
    </div>
  );
}

export default App;

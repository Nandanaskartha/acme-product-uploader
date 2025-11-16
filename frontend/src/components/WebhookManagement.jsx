import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Power, Zap, CheckCircle, XCircle, Clock, Activity } from "lucide-react";
import { API_BASE_URL } from "../config";
export default function WebhookManagement() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editWebhook, setEditWebhook] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await  fetch(`${API_BASE_URL}/webhooks`, { method: "GET" });
      const data = await res.json();
      setWebhooks(data);
    } catch (err) {
      console.error("Failed to fetch webhooks", err);
      showNotification("error", "Failed to load webhooks");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    try {
      const res = await  fetch(`${API_BASE_URL}/webhooks/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("success", "Webhook deleted successfully");
        fetchWebhooks();
      } else {
        showNotification("error", "Failed to delete webhook");
      }
    } catch (err) {
      showNotification("error", "Failed to delete webhook");
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await  fetch(`${API_BASE_URL}/webhooks/${id}/toggle`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showNotification("success", data.message);
        fetchWebhooks();
      } else {
        showNotification("error", "Failed to toggle webhook");
      }
    } catch (err) {
      showNotification("error", "Failed to toggle webhook");
    }
  };

  const handleTest = async (id) => {
    setTestResult({ loading: true, id });
    try {
      const res = await  fetch(`${API_BASE_URL}/webhooks/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({ ...data, id, loading: false });
      if (data.success) {
        showNotification("success", `Test successful! Response time: ${data.response_time_ms}ms`);
      } else {
        showNotification("error", `Test failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message, id, loading: false });
      showNotification("error", "Failed to test webhook");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa", padding: "2rem" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Header />
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
        
        <div style={{ background: "white", borderRadius: "12px", padding: "2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600", color: "#1a202c" }}>
              Webhook Configuration
            </h2>
            <button
              onClick={() => { setEditWebhook(null); setShowModal(true); }}
              style={{
                padding: "0.5rem 1rem",
                border: "none",
                borderRadius: "8px",
                background: "#10b981",
                color: "white",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <Plus size={16} /> Add Webhook
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>Loading...</div>
          ) : webhooks.length === 0 ? (
            <EmptyState onAdd={() => { setEditWebhook(null); setShowModal(true); }} />
          ) : (
            <WebhookList
              webhooks={webhooks}
              onEdit={(w) => { setEditWebhook(w); setShowModal(true); }}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onTest={handleTest}
              testResult={testResult}
            />
          )}
        </div>

        {showModal && (
          <WebhookModal
            webhook={editWebhook}
            onClose={() => setShowModal(false)}
            onSave={() => { setShowModal(false); fetchWebhooks(); }}
            showNotification={showNotification}
          />
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{
      background: "white",
      borderRadius: "12px",
      padding: "1.5rem 2rem",
      marginBottom: "2rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
    }}>
      <h1 style={{ margin: 0, fontSize: "1.875rem", fontWeight: "700", color: "#1a202c" }}>
        Webhook Management
      </h1>
      <p style={{ margin: "0.5rem 0 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
        Configure webhooks to receive real-time notifications about product events
      </p>
    </div>
  );
}

function Notification({ type, message, onClose }) {
  const config = {
    success: { bg: "#dcfce7", border: "#86efac", text: "#166534", Icon: CheckCircle },
    error: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", Icon: XCircle }
  };

  const { bg, border, text, Icon } = config[type] || config.success;

  return (
    <div style={{
      position: "fixed",
      top: "2rem",
      right: "2rem",
      zIndex: 9999,
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "8px",
      padding: "1rem 1.5rem",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      minWidth: "300px",
      maxWidth: "500px",
      animation: "slideIn 0.3s ease-out"
    }}>
      <Icon size={20} color={text} />
      <span style={{ flex: 1, color: text, fontSize: "0.875rem", fontWeight: "500" }}>
        {message}
      </span>
      <button
        onClick={onClose}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "0.25rem",
          color: text
        }}
      >
        <X size={16} />
      </button>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
      <div style={{
        width: "80px",
        height: "80px",
        margin: "0 auto 1.5rem",
        borderRadius: "50%",
        background: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <Zap size={40} color="#9ca3af" />
      </div>
      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.125rem", fontWeight: "600", color: "#1a202c" }}>
        No Webhooks Configured
      </h3>
      <p style={{ margin: "0 0 1.5rem 0", color: "#6b7280", fontSize: "0.875rem" }}>
        Add your first webhook to start receiving real-time event notifications
      </p>
      <button
        onClick={onAdd}
        style={{
          padding: "0.625rem 1.5rem",
          border: "none",
          borderRadius: "8px",
          background: "#3b82f6",
          color: "white",
          fontWeight: "600",
          cursor: "pointer",
          fontSize: "0.875rem"
        }}
      >
        Add Your First Webhook
      </button>
    </div>
  );
}

function WebhookList({ webhooks, onEdit, onDelete, onToggle, onTest, testResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {webhooks.map((webhook) => (
        <WebhookCard
          key={webhook.id}
          webhook={webhook}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          onTest={onTest}
          testResult={testResult?.id === webhook.id ? testResult : null}
        />
      ))}
    </div>
  );
}

function WebhookCard({ webhook, onEdit, onDelete, onToggle, onTest, testResult }) {
  const eventColors = {
    'product.created': { bg: '#dbeafe', text: '#1e40af' },
    'product.updated': { bg: '#fef3c7', text: '#92400e' },
    'product.deleted': { bg: '#fee2e2', text: '#991b1b' },
    'product.bulk_deleted': { bg: '#fde8e8', text: '#7f1d1d' },
    'csv.completed': { bg: '#dcfce7', text: '#166534' }
  };

  const eventColor = eventColors[webhook.event_type] || { bg: '#f3f4f6', text: '#374151' };

  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      padding: "1.5rem",
      background: webhook.enabled ? "white" : "#f9fafb"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: "600", color: "#1a202c" }}>
              {webhook.name}
            </h3>
            <span style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: "600",
              background: eventColor.bg,
              color: eventColor.text
            }}>
              {webhook.event_type}
            </span>
            <span style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: "600",
              background: webhook.enabled ? "#dcfce7" : "#fee2e2",
              color: webhook.enabled ? "#166534" : "#991b1b"
            }}>
              {webhook.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p style={{ margin: "0 0 0.5rem 0", color: "#6b7280", fontSize: "0.875rem", wordBreak: "break-all" }}>
            {webhook.url}
          </p>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.75rem", color: "#9ca3af" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <CheckCircle size={14} /> {webhook.success_count} successful
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <XCircle size={14} /> {webhook.failure_count} failed
            </span>
            {webhook.last_triggered_at && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Clock size={14} /> Last: {new Date(webhook.last_triggered_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => onTest(webhook.id)}
            disabled={testResult?.loading}
            style={{
              padding: "0.5rem",
              border: "none",
              borderRadius: "6px",
              background: "#eff6ff",
              color: "#2563eb",
              cursor: testResult?.loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: "600"
            }}
            title="Test webhook"
          >
            <Zap size={14} /> {testResult?.loading ? "Testing..." : "Test"}
          </button>
          <button
            onClick={() => onToggle(webhook.id)}
            style={{
              padding: "0.5rem",
              border: "none",
              borderRadius: "6px",
              background: webhook.enabled ? "#fef2f2" : "#dcfce7",
              color: webhook.enabled ? "#dc2626" : "#166534",
              cursor: "pointer"
            }}
            title={webhook.enabled ? "Disable" : "Enable"}
          >
            <Power size={14} />
          </button>
          <button
            onClick={() => onEdit(webhook)}
            style={{
              padding: "0.5rem",
              border: "none",
              borderRadius: "6px",
              background: "#eff6ff",
              color: "#2563eb",
              cursor: "pointer"
            }}
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(webhook.id)}
            style={{
              padding: "0.5rem",
              border: "none",
              borderRadius: "6px",
              background: "#fef2f2",
              color: "#dc2626",
              cursor: "pointer"
            }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {testResult && !testResult.loading && (
        <div style={{
          marginTop: "1rem",
          padding: "1rem",
          borderRadius: "6px",
          background: testResult.success ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${testResult.success ? "#bbf7d0" : "#fecaca"}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            {testResult.success ? (
              <CheckCircle size={16} color="#166534" />
            ) : (
              <XCircle size={16} color="#991b1b" />
            )}
            <strong style={{ color: testResult.success ? "#166534" : "#991b1b", fontSize: "0.875rem" }}>
              Test {testResult.success ? "Successful" : "Failed"}
            </strong>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            {testResult.status_code && <div>Status Code: {testResult.status_code}</div>}
            {testResult.response_time_ms && <div>Response Time: {testResult.response_time_ms}ms</div>}
            {testResult.error && <div style={{ color: "#991b1b" }}>Error: {testResult.error}</div>}
            {testResult.response_body && (
              <details style={{ marginTop: "0.5rem" }}>
                <summary style={{ cursor: "pointer", fontWeight: "600" }}>Response Body</summary>
                <pre style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  background: "white",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  overflow: "auto",
                  maxHeight: "150px"
                }}>
                  {testResult.response_body}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WebhookModal({ webhook, onClose, onSave, showNotification }) {
  const [form, setForm] = useState({
    name: webhook?.name || "",
    url: webhook?.url || "",
    event_type: webhook?.event_type || "product.created",
    enabled: webhook?.enabled ?? true,
    secret: webhook?.secret || "",
    headers: webhook?.headers || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!form.name || !form.url || !form.event_type) {
      setError("Name, URL, and Event Type are required");
      return;
    }

    // Validate URL
    try {
      new URL(form.url);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    // Validate headers JSON if provided
    if (form.headers) {
      try {
        JSON.parse(form.headers);
      } catch {
        setError("Headers must be valid JSON");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const url = webhook
        ? `http://localhost:8000/webhooks/${webhook.id}`
        : "http://localhost:8000/webhooks";
      const method = webhook ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save webhook");
      }
      showNotification("success", webhook ? "Webhook updated successfully" : "Webhook created successfully");
      onSave();
    } catch (err) {
      setError(err.message);
      showNotification("error", err.message);
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "2rem",
        width: "90%",
        maxWidth: "600px",
        maxHeight: "90vh",
        overflow: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "600" }}>
            {webhook ? "Edit Webhook" : "Add Webhook"}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: "0.25rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6b7280"
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Webhook"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>URL *</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/webhook"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Event Type *</label>
            <select
              value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value })}
              style={inputStyle}
            >
              <option value="product.created">Product Created</option>
              <option value="product.updated">Product Updated</option>
              <option value="product.deleted">Product Deleted</option>
              <option value="product.bulk_deleted">Product Bulk Deleted</option>
              <option value="csv.completed">CSV Import Completed</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>
              Secret (Optional)
              <span style={{ fontWeight: "normal", color: "#6b7280", marginLeft: "0.5rem" }}>
                - Used to sign webhook payloads
              </span>
            </label>
            <input
              type="text"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
              placeholder="your-secret-key"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>
              Custom Headers (Optional)
              <span style={{ fontWeight: "normal", color: "#6b7280", marginLeft: "0.5rem" }}>
                - JSON format
              </span>
            </label>
            <textarea
              value={form.headers}
              onChange={(e) => setForm({ ...form, headers: e.target.value })}
              placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
              rows={3}
              style={{...inputStyle, fontFamily: "monospace", fontSize: "0.8rem"}}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                style={{ marginRight: "0.5rem", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
                Enabled
              </span>
            </label>
          </div>

          {error && (
            <div style={{
              padding: "0.75rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#991b1b",
              fontSize: "0.875rem"
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                padding: "0.625rem 1.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                background: "white",
                color: "#374151",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                padding: "0.625rem 1.5rem",
                border: "none",
                borderRadius: "8px",
                background: saving ? "#9ca3af" : "#3b82f6",
                color: "white",
                fontWeight: "600",
                cursor: saving ? "not-allowed" : "pointer"
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "0.5rem",
  fontSize: "0.875rem",
  fontWeight: "600",
  color: "#374151"
};

const inputStyle = {
  width: "100%",
  padding: "0.625rem",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "0.875rem"
};
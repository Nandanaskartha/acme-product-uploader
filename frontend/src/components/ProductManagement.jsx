import React, { useState, useRef, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, X, Check, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, XCircle } from "lucide-react";

export default function ProductManagement() {
  const [view, setView] = useState("upload"); 
  const [notification, setNotification] = useState(null);
  
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };
  
  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa", padding: "2rem" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Header view={view} setView={setView} />
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
        {view === "upload" ? (
          <UploadView showNotification={showNotification} />
        ) : (
          <ProductsView showNotification={showNotification} />
        )}
      </div>
      </div>
  );
}
function Notification({ type, message, onClose }) {
  const config = {
    success: { bg: "#dcfce7", border: "#86efac", text: "#166534", Icon: CheckCircle },
    error: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", Icon: XCircle },
    warning: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e", Icon: AlertCircle }
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
function Header({ view, setView }) {
  return (
    <div style={{ 
      background: "white", 
      borderRadius: "12px", 
      padding: "1.5rem 2rem", 
      marginBottom: "2rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
    }}>
      <h1 style={{ margin: 0, fontSize: "1.875rem", fontWeight: "700", color: "#1a202c" }}>
        Acme Product Manager
      </h1>
      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        <button
          onClick={() => setView("upload")}
          style={{
            padding: "0.5rem 1.5rem",
            border: "none",
            borderRadius: "8px",
            background: view === "upload" ? "#3b82f6" : "#e5e7eb",
            color: view === "upload" ? "white" : "#374151",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Upload CSV
        </button>
        <button
          onClick={() => setView("products")}
          style={{
            padding: "0.5rem 1.5rem",
            border: "none",
            borderRadius: "8px",
            background: view === "products" ? "#3b82f6" : "#e5e7eb",
            color: view === "products" ? "white" : "#374151",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Manage Products
        </button>
      </div>
    </div>
  );
}

function UploadView({ showNotification }) {
  const [jobId, setJobId] = useState(null);
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    const file = fileRef.current.files[0];
    if (!file){
      showNotification("error", "Please select a CSV file first");
      return;
    }
    setStatus("uploading");
    setPercent(0);
    setMessage("Uploading file...");
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:8000/upload", {method: "POST",body: formData});
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.detail || "Upload failed");
        showNotification("error", data.detail || "Upload failed");
        return;
      }
      const id = data.job_id;
      setJobId(id);
      setStatus("processing");
      showNotification("success", "File uploaded successfully, processing...");
      listenProgress(id);
    } catch (err) {
      setStatus("error");
      setError(err.message);
      showNotification("error", `Upload error: ${err.message}`);
    }
  };

  const listenProgress = (id) => {
    const sse = new EventSource(`http://localhost:8000/progress/${id}`);
    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.percent !== undefined) setPercent(payload.percent);
        if (payload.status) setStatus(payload.status);
        if (payload.message) setMessage(payload.message);
        if (payload.status === "complete") {
          setMessage("Import complete");
          showNotification("success", `Successfully imported ${payload.processed || 0} products!`);
          sse.close();
        }
        if (payload.status === "error") {
          setError(payload.message || "Error during import");
          showNotification("error", payload.message || "Error during import");
          sse.close();
        }
      } catch (err) {
        console.error("Invalid SSE data", e.data);
      }
    };
    sse.onerror = (err) => {
      console.error("SSE error", err);
      sse.close();
    };
  };

  return (
    <div style={{ background: "white", borderRadius: "12px", padding: "2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      <h2 style={{ margin: "0 0 1.5rem 0", fontSize: "1.5rem", fontWeight: "600", color: "#1a202c" }}>
        Bulk Upload Products
      </h2>
      
      <div style={{ marginBottom: "2rem" }}>
        <input 
          type="file" 
          accept=".csv" 
          ref={fileRef}
          style={{
            padding: "0.75rem",
            border: "2px dashed #d1d5db",
            borderRadius: "8px",
            width: "100%",
            cursor: "pointer"
          }}
        />
        <button 
          onClick={handleUpload}
          disabled={status === "processing" || status === "uploading"}
          style={{
            marginTop: "1rem",
            padding: "0.75rem 2rem",
            border: "none",
            borderRadius: "8px",
            background: status === "processing" || status === "uploading" ? "#9ca3af" : "#3b82f6",
            color: "white",
            fontWeight: "600",
            cursor: status === "processing" || status === "uploading" ? "not-allowed" : "pointer",
            fontSize: "1rem"
          }}
        >
          {status === "uploading" ? "Uploading..." : status === "processing" ? "Processing..." : "Upload CSV"}
        </button>
      </div>

      {(status !== "idle") && (
        <div style={{ 
          padding: "1.5rem", 
          background: "#f9fafb", 
          borderRadius: "8px",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{ marginBottom: "1rem" }}>
            <strong style={{ color: "#374151" }}>Status:</strong> 
            <span style={{ 
              marginLeft: "0.5rem",
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.875rem",
              fontWeight: "600",
              background: status === "complete" ? "#dcfce7" : status === "error" ? "#fee2e2" : "#dbeafe",
              color: status === "complete" ? "#166534" : status === "error" ? "#991b1b" : "#1e40af"
            }}>
              {status}
            </span>
          </div>
          
          {status === "processing" && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                color: "#6b7280"
              }}>
                <span>Progress</span>
                <span>{percent}%</span>
              </div>
              <div style={{ 
                width: "100%", 
                height: "8px", 
                background: "#e5e7eb", 
                borderRadius: "9999px",
                overflow: "hidden"
              }}>
                <div style={{ 
                  width: `${percent}%`, 
                  height: "100%", 
                  background: "#3b82f6",
                  transition: "width 0.3s"
                }} />
              </div>
            </div>
          )}
          
          {message && (
            <div style={{ color: "#374151", fontSize: "0.875rem" }}>
              {message}
            </div>
          )}
          
          {status === "error" && (
            <button 
              onClick={() => { setError(null); setStatus("idle"); setPercent(0); setMessage(""); }}
              style={{
                marginTop: "1rem",
                padding: "0.5rem 1.5rem",
                border: "none",
                borderRadius: "6px",
                background: "#ef4444",
                color: "white",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Retry Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProductsView({ showNotification }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search: "", active: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [page, filters]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page,
        limit: 20,
        ...(filters.search && { search: filters.search }),
        ...(filters.active !== "all" && { active: filters.active })
      });
      const res = await fetch(`http://localhost:8000/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotalPages(Math.ceil((data.total || 0) / 20));
    } catch (err) {
      console.error("Failed to fetch products", err);
      showNotification("error", "Failed to load products");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`http://localhost:8000/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("success", "Product deleted successfully");
        fetchProducts();
      } else {
        const data = await res.json();
        showNotification("error", data.detail || "Failed to delete product");
      }
    } catch (err) {
      console.error("Failed to delete", err);
      showNotification("error", "Failed to delete product");
    }
  };

  const handleDeleteAll = async () => {
    try {
      const res = await fetch("http://localhost:8000/products/bulk-delete", { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok) {
        showNotification("success", data.message || `Deleted ${data.deleted_count} products`);
        setShowDeleteAll(false);
        setPage(1);
        fetchProducts();
      } else {
        showNotification("error", data.detail || "Failed to delete products");
      }
    } catch (err) {
      console.error("Failed to delete all", err);
      showNotification("error", "Failed to delete products");
    }
  };
  return (
    <div style={{ background: "white", borderRadius: "12px", padding: "2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600", color: "#1a202c" }}>
          Products
        </h2>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => { setEditProduct(null); setShowModal(true); }}
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
            <Plus size={16} /> Add Product
          </button>
          <button
            onClick={() => setShowDeleteAll(true)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #ef4444",
              borderRadius: "8px",
              background: "white",
              color: "#ef4444",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}
          >
            <Trash2 size={16} /> Delete All
          </button>
        </div>
      </div>

      <Filters filters={filters} setFilters={setFilters} onSearch={fetchProducts} />

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>Loading...</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>No products found</div>
      ) : (
        <>
          <ProductTable 
            products={products} 
            onEdit={(p) => { setEditProduct(p); setShowModal(true); }}
            onDelete={handleDelete}
          />
          <Pagination page={page} totalPages={totalPages} setPage={setPage} />
        </>
      )}

      {showModal && (
        <ProductModal 
          product={editProduct} 
          onClose={() => setShowModal(false)} 
          onSave={() => { setShowModal(false); fetchProducts(); }}
          showNotification={showNotification}
        />
      )}

      {showDeleteAll && (
        <ConfirmDialog
          title="Delete All Products"
          message="Are you sure you want to delete ALL products? This action cannot be undone."
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAll(false)}
        />
      )}
    </div>
  );
}

function Filters({ filters, setFilters, onSearch }) {
  return (
    <div style={{ 
      display: "flex", 
      gap: "1rem", 
      marginBottom: "1.5rem",
      flexWrap: "wrap",
      alignItems: "stretch"
    }}>
      <div style={{ flex: "1", minWidth: "250px", position: "relative", display: "flex" }}>
        <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none", zIndex: 1 }} />
        <input
          type="text"
          placeholder="Search by SKU, name, or description..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          onKeyPress={(e) => e.key === "Enter" && onSearch()}
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem 0.625rem 2.5rem",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontSize: "0.875rem",
            height: "100%"
          }}
        />
      </div>
      <select
        value={filters.active}
        onChange={(e) => setFilters({ ...filters, active: e.target.value })}
        style={{
          padding: "0.625rem 0.75rem",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          fontSize: "0.875rem",
          background: "white",
          cursor: "pointer"
        }}
      >
        <option value="all">All Status</option>
        <option value="true">Active Only</option>
        <option value="false">Inactive Only</option>
      </select>
      <button
        onClick={onSearch}
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
        Search
      </button>
    </div>
  );
}

function ProductTable({ products, onEdit, onDelete }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
            <th style={thStyle}>SKU</th>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Description</th>
            <th style={thStyle}>Price</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={tdStyle}>{p.sku}</td>
              <td style={tdStyle}>{p.name}</td>
              <td style={{...tdStyle, maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                {p.description || "-"}
              </td>
              <td style={tdStyle}>${parseFloat(p.price || 0).toFixed(2)}</td>
              <td style={tdStyle}>
                <span style={{
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  background: p.active ? "#dcfce7" : "#fee2e2",
                  color: p.active ? "#166534" : "#991b1b"
                }}>
                  {p.active ? "Active" : "Inactive"}
                </span>
              </td>
              <td style={tdStyle}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => onEdit(p)}
                    style={{
                      padding: "0.375rem",
                      border: "none",
                      borderRadius: "6px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      cursor: "pointer"
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    style={{
                      padding: "0.375rem",
                      border: "none",
                      borderRadius: "6px",
                      background: "#fef2f2",
                      color: "#dc2626",
                      cursor: "pointer"
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: "0.75rem",
  textAlign: "left",
  fontSize: "0.75rem",
  fontWeight: "700",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em"
};

const tdStyle = {
  padding: "1rem 0.75rem",
  fontSize: "0.875rem",
  color: "#374151"
};

function Pagination({ page, totalPages, setPage }) {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      marginTop: "1.5rem",
      paddingTop: "1.5rem",
      borderTop: "1px solid #e5e7eb"
    }}>
      <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
        Page {page} of {totalPages}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            background: page === 1 ? "#f9fafb" : "white",
            cursor: page === 1 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center"
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            background: page === totalPages ? "#f9fafb" : "white",
            cursor: page === totalPages ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center"
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ProductModal({ product, onClose, onSave, showNotification  }) {
  const [form, setForm] = useState({
    sku: product?.sku || "",
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price || "",
    active: product?.active ?? true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!form.sku || !form.name || !form.price) {
      setError("SKU, Name, and Price are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = product 
        ? `http://localhost:8000/products/${product.id}`
        : "http://localhost:8000/products";
      const method = product ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save product");
      }
      showNotification("success", product ? "Product updated successfully" : "Product created successfully");
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
        maxWidth: "500px",
        maxHeight: "90vh",
        overflow: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "600" }}>
            {product ? "Edit Product" : "Add Product"}
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
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
              SKU *
            </label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              style={{
                width: "100%",
                padding: "0.625rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem"
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
              Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{
                width: "100%",
                padding: "0.625rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem"
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              style={{
                width: "100%",
                padding: "0.625rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontFamily: "inherit"
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
              Price *
            </label>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              style={{
                width: "100%",
                padding: "0.625rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem"
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                style={{ marginRight: "0.5rem", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
                Active
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

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
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
        maxWidth: "400px"
      }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: "600", color: "#1a202c" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 1.5rem 0", color: "#6b7280", fontSize: "0.875rem" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
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
            onClick={onConfirm}
            style={{
              padding: "0.625rem 1.5rem",
              border: "none",
              borderRadius: "8px",
              background: "#ef4444",
              color: "white",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
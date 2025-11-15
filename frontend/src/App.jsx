import React, { useState } from "react";
import ProductManagement from "./components/ProductManagement";
import WebhookManagement from "./components/WebhookManagement";

export default function App() {
  const [page, setPage] = useState("upload");

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      
      {/* Heading + Subheading */}
      <h1 style={{ marginBottom: 5 }}>Acme Inc</h1>
      <h2 style={{ marginTop: 0, marginBottom: 20, fontWeight: "normal", color: "#555" }}>
        Product Importer
      </h2>

      <div style={{ marginBottom: 20, display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={() => setPage("webhook")}>
          Manage WebHooks
        </button>

        <button onClick={() => setPage("products")}>
          Manage Products
        </button>
      </div>

      {/* Pages */}
      {page === "webhook" && <WebhookManagement />}
      {page === "products" && <ProductManagement />}
    </div>
  );
}

import React, { useState } from "react";
import Upload from "./components/Upload";
import ProductManagement from "./components/ProductManagement";

export default function App() {
  const [page, setPage] = useState("upload");

  return (
    <div style={{ padding: 20 }}>

      {/* Navigation */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <button onClick={() => setPage("upload")}>
          Upload CSV
        </button>

        <button onClick={() => setPage("products")}>
          Manage Products
        </button>
      </div>

      {/* Pages */}
      {page === "upload" && <Upload />}
      {page === "products" && <ProductManagement />}
    </div>
  );
}

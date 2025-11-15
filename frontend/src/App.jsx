// import ProductManagement from "./components/ProductManagement";
// export default function App() {
//   return <ProductManagement />;
// } 


import React, { useState } from "react";
// import Upload from "./components/WebhookManagement";
import ProductManagement from "./components/ProductManagement";
import WebhookManagement from "./components/WebhookManagement";

export default function App() {
//   return <Upload />;
// }
  const [page, setPage] = useState("upload");

  return (
    <div style={{ padding: 20 }}>

      {/* Navigation */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
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

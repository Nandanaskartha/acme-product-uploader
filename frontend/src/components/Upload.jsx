import React, { useState, useRef } from "react";
import { API_BASE_URL } from "../config";
export default function Upload() {
  const [jobId, setJobId] = useState(null);
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    const file = fileRef.current.files[0];
    if (!file) return;
    setStatus("uploading");
    setPercent(0);
    setMessage("Uploading file...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {method: "POST",body: formData,});
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.detail || "Upload failed");
        return;
      }
      const id = data.job_id;
      setJobId(id);
      setStatus("processing");
      listenProgress(id);
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  const listenProgress = (id) => {
    const sse = new EventSource(`${API_BASE_URL}/progress/${id}`);
    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.percent !== undefined) setPercent(payload.percent);
        if (payload.status) setStatus(payload.status);
        if (payload.message) setMessage(payload.message);
        if (payload.status === "complete") {
          setMessage("Import complete");
          sse.close();
        }
        if (payload.status === "error") {
          setError(payload.message || "Error during import");
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
    <div style={{maxWidth: 600}}>
      <h3>Upload CSV (up to 500k rows)</h3>
      <input type="file" accept=".csv" ref={fileRef} />
      <button onClick={handleUpload}>Upload</button>

      <div style={{marginTop: 20}}>
        <div>Status: {status}</div>
        <div>Percent: {percent}%</div>
        <div>{message}</div>
        {error && <div style={{color:"red"}}>Error: {error}</div>}
      </div>

      {status === "error" && (
        <div>
          <button onClick={() => { setError(null); setStatus("idle"); }}>Retry</button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import "./App.css";

const statuses = ["Open", "In Progress", "Resolved", "Closed"];

export default function App() {
  const [issues, setIssues] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  const [description, setDescription] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function loadData() {
    const query = new URLSearchParams({
      keyword,
      ...(statusFilter ? { status: statusFilter } : {}),
    });

    const [issuesRes, dashboardRes] = await Promise.all([
      fetch(`/api/issues?${query}`),
      fetch("/api/dashboard"),
    ]);

    setIssues(await issuesRes.json());
    setDashboard(await dashboardRes.json());
  }

  useEffect(() => {
    loadData();
  }, [keyword, statusFilter]);

  async function analyzeIssue() {
    if (!title.trim()) {
      alert("請先輸入 Issue 標題");
      return;
    }

    setAnalyzing(true);
    setAiResult(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "AI 分析失敗");
      }

      setAiResult(result);

      // 將 AI 建議的優先級自動帶入下拉選單
      setPriority(result.suggestedPriority);
    } catch (error) {
      alert(error.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function addIssue(event) {
    event.preventDefault();

    await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority, assignee: "Demo User" }),
    });

    setTitle("");
    setPriority("Medium");
    loadData();
  }

  async function updateStatus(id, status) {
    await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    loadData();
  }

  return (
    <main>
      <h1>Issue 管理與測試追蹤平台</h1>

      <section className="cards">
        <div>全部 Issue：<strong>{dashboard.total ?? 0}</strong></div>
        <div>未結案：<strong>{dashboard.open ?? 0}</strong></div>
        <div>高優先級未結案：<strong>{dashboard.high ?? 0}</strong></div>
      </section>

      <form onSubmit={addIssue}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="輸入 Issue 標題"
          required
        />
         <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述問題發生條件、預期結果與實際結果"
          rows="4"
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <button type="button" onClick={analyzeIssue} disabled={analyzing}>
          {analyzing ? "AI 分析中…" : "AI 分析 Issue"}
        </button>
        <button type="submit">新增 Issue</button>
      </form>
      
      {aiResult && (
        <section className="ai-result">
        <h2>AI 分析結果</h2>
        <p><strong>分類：</strong>{aiResult.category}</p>
        <p><strong>建議優先級：</strong>{aiResult.suggestedPriority}</p>
        <p><strong>問題摘要：</strong>{aiResult.summary}</p>
        <p><strong>待補資訊：</strong>{aiResult.missingInformation}</p>

        <h3>建議測試案例</h3>
        <ol>
          {aiResult.testCases.map((testCase, index) => (
            <li key={index}>{testCase}</li>
          ))}
        </ol>
      </section>
      )}

      <section className="filters">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜尋 Issue"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全部狀態</option>
          {statuses.map((status) => <option key={status}>{status}</option>)}
        </select>
      </section>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>標題</th>
            <th>優先級</th>
            <th>負責人</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>{issue.id}</td>
              <td>{issue.title}</td>
              <td>{issue.priority}</td>
              <td>{issue.assignee || "-"}</td>
              <td>
                <select
                  value={issue.status}
                  onChange={(e) => updateStatus(issue.id, e.target.value)}
                >
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
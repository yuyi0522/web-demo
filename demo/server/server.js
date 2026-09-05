require("dotenv").config();

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("issues.db");

app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Open',
    assignee TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const count = db.prepare("SELECT COUNT(*) AS total FROM issues").get().total;

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO issues (title, priority, status, assignee)
    VALUES (?, ?, ?, ?)
  `);

  insert.run("登入頁面按鈕無反應", "High", "Open", "Amy");
  insert.run("API 回傳格式統一", "Medium", "In Progress", "Ben");
  insert.run("完成週報統計功能", "Low", "Resolved", "Chris");
}

// 取得所有 Issue
app.get("/api/issues", (req, res) => {
  const keyword = req.query.keyword || "";
  const status = req.query.status || "";

  let sql = "SELECT * FROM issues WHERE title LIKE ?";
  const params = [`%${keyword}%`];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY id DESC";
  res.json(db.prepare(sql).all(...params));
});

// 新增 Issue
app.post("/api/issues", (req, res) => {
  const { title, priority = "Medium", assignee = "" } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: "標題不可空白" });
  }

  const result = db.prepare(`
    INSERT INTO issues (title, priority, assignee)
    VALUES (?, ?, ?)
  `).run(title.trim(), priority, assignee);

  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(issue);
});

// 更新 Issue 狀態
app.patch("/api/issues/:id", (req, res) => {
  const { status } = req.body;
  const validStatuses = ["Open", "In Progress", "Resolved", "Closed"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "不合法的狀態" });
  }

  db.prepare("UPDATE issues SET status = ? WHERE id = ?")
    .run(status, req.params.id);

  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.id);

  if (!issue) {
    return res.status(404).json({ message: "找不到 Issue" });
  }

  res.json(issue);
});

// Dashboard 統計
app.get("/api/dashboard", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS count FROM issues").get().count;
  const open = db.prepare(
    "SELECT COUNT(*) AS count FROM issues WHERE status != 'Closed'"
  ).get().count;
  const high = db.prepare(
    "SELECT COUNT(*) AS count FROM issues WHERE priority = 'High' AND status != 'Closed'"
  ).get().count;

  res.json({ total, open, high });
});

// openai 串接
app.post("/api/ai/analyze", async (req, res) => {
  const { title, description } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: "Issue 標題不可空白" });
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-5",
      instructions: `
你是一位軟體測試與 Issue 管理助理。
請根據 Issue 標題與描述，協助測試團隊分類、評估優先級並產生測試案例。
請只依輸入內容判斷；不確定時要標示需要確認。
      `,
      input: `
Issue 標題：${title}
Issue 描述：${description || "未提供"}
      `,
      text: {
        format: {
          type: "json_schema",
          name: "issue_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["Frontend", "Backend", "API", "Database", "Testing", "Other"]
              },
              suggestedPriority: {
                type: "string",
                enum: ["High", "Medium", "Low"]
              },
              summary: { type: "string" },
              missingInformation: { type: "string" },
              testCases: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: [
              "category",
              "suggestedPriority",
              "summary",
              "missingInformation",
              "testCases"
            ],
            additionalProperties: false
          }
        }
      }
    });

    res.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "AI 分析失敗，請確認 API Key 與網路連線。"
    });
  }
});

app.listen(3001, () => {
  console.log("後端 API 已啟動：http://localhost:3001");
});
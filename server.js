const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ========== 数据库连接 ==========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 本地开发无 DATABASE_URL 时降级到 JSON 文件
const USE_DB = !!process.env.DATABASE_URL;
const fs = require('fs');
const DB_PATH = path.join(__dirname, 'worklog.db.json');

function loadItemsLocal() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); } catch { return []; }
}
function saveItemsLocal(items) {
  fs.writeFileSync(DB_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

// 初始化数据库表
async function initDB() {
  if (!USE_DB) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      "createdAt" BIGINT NOT NULL,
      date TEXT NOT NULL
    )
  `);
}

// ========== 通用数据操作（自动适配数据库/本地） ==========

async function loadItems() {
  if (!USE_DB) return loadItemsLocal();
  const res = await pool.query('SELECT * FROM items ORDER BY "createdAt" DESC');
  return res.rows;
}

async function addItem(id, content, status, createdAt, date) {
  if (!USE_DB) {
    const items = loadItemsLocal();
    items.push({ id, content, status, createdAt, date });
    saveItemsLocal(items);
    return;
  }
  await pool.query(
    'INSERT INTO items (id, content, status, "createdAt", date) VALUES ($1, $2, $3, $4, $5)',
    [id, content, status, createdAt, date]
  );
}

async function toggleItemStatus(id) {
  if (!USE_DB) {
    const items = loadItemsLocal();
    const item = items.find(i => i.id === id);
    if (item) { item.status = item.status === 'pending' ? 'completed' : 'pending'; saveItemsLocal(items); }
    return item;
  }
  const res = await pool.query('SELECT status FROM items WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  const newStatus = res.rows[0].status === 'pending' ? 'completed' : 'pending';
  await pool.query('UPDATE items SET status = $1 WHERE id = $2', [newStatus, id]);
  return { status: newStatus };
}

async function updateItem(id, content, date) {
  if (!USE_DB) {
    const items = loadItemsLocal();
    const item = items.find(i => i.id === id);
    if (item) { if (content !== undefined) item.content = content; if (date !== undefined) item.date = date; saveItemsLocal(items); }
    return;
  }
  await pool.query('UPDATE items SET content = $1, date = $2 WHERE id = $3', [content, date, id]);
}

async function deleteItemById(id) {
  if (!USE_DB) {
    const items = loadItemsLocal().filter(i => i.id !== id);
    saveItemsLocal(items);
    return;
  }
  await pool.query('DELETE FROM items WHERE id = $1', [id]);
}

// ========== API 路由 ==========

app.get('/api/items', async (req, res) => {
  try { res.json(await loadItems()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/items', async (req, res) => {
  try {
    const { id, content, status, createdAt, date } = req.body;
    if (!content || !id || !createdAt || !date) return res.status(400).json({ error: '缺少必填字段' });
    await addItem(id, content, status || 'pending', createdAt, date);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/items/:id', async (req, res) => {
  try {
    const result = await toggleItemStatus(req.params.id);
    if (!result) return res.status(404).json({ error: '未找到' });
    res.json({ success: true, status: result.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const { content, date } = req.body;
    await updateItem(req.params.id, content, date);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await deleteItemById(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 所有非 API 路由返回 index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 随时记服务已启动: http://localhost:${PORT}`);
    console.log(`📦 存储模式: ${USE_DB ? 'PostgreSQL（云数据库）' : '本地 JSON 文件'}`);
  });
});

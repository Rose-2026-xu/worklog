const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// 静态文件目录
const PUBLIC_DIR = path.join(__dirname);

// 中间件
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ========== 数据存储 ==========
const DB_PATH = path.join(__dirname, 'worklog.db.json');

function loadItems() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveItems(items) {
  fs.writeFileSync(DB_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

// ========== API 路由 ==========

// 获取所有项目
app.get('/api/items', (req, res) => {
  const items = loadItems();
  res.json(items);
});

// 添加项目
app.post('/api/items', (req, res) => {
  const { id, content, status, createdAt, date } = req.body;
  if (!content || !id || !createdAt || !date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const items = loadItems();
  items.push({
    id,
    content,
    status: status || 'pending',
    createdAt,
    date
  });
  saveItems(items);
  res.json({ success: true });
});

// 切换状态
app.patch('/api/items/:id', (req, res) => {
  const items = loadItems();
  const item = items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: '未找到' });
  item.status = item.status === 'pending' ? 'completed' : 'pending';
  saveItems(items);
  res.json({ success: true, status: item.status });
});

// 删除项目
app.delete('/api/items/:id', (req, res) => {
  let items = loadItems();
  items = items.filter(i => i.id !== req.params.id);
  saveItems(items);
  res.json({ success: true });
});

// 所有非 API 路由都返回 index.html（确保 SPA 路由正常）
app.get('*', (req, res) => {
  const htmlPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Page not found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 随时记服务已启动: http://localhost:${PORT}`);
  console.log(`📁 静态目录: ${PUBLIC_DIR}`);
  console.log(`📄 index.html 存在: ${fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))}`);
});

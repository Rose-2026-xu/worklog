const { Pool } = require('pg');

// 数据库连接（Vercel Serverless 需要每次创建连接）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function getItems() {
  const res = await pool.query('SELECT * FROM items ORDER BY "createdAt" DESC');
  return res.rows;
}

async function addItem(id, content, status, createdAt, date) {
  await pool.query(
    'INSERT INTO items (id, content, status, "createdAt", date) VALUES ($1, $2, $3, $4, $5)',
    [id, content, status, createdAt, date]
  );
}

async function toggleStatus(id) {
  const res = await pool.query('SELECT status FROM items WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  const newStatus = res.rows[0].status === 'pending' ? 'completed' : 'pending';
  await pool.query('UPDATE items SET status = $1 WHERE id = $2', [newStatus, id]);
  return newStatus;
}

async function updateItem(id, content, date) {
  await pool.query('UPDATE items SET content = $1, date = $2 WHERE id = $3', [content, date, id]);
}

async function deleteItem(id) {
  await pool.query('DELETE FROM items WHERE id = $1', [id]);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method } = req;

  try {
    // GET - 获取所有项目
    if (method === 'GET') {
      const items = await getItems();
      return res.status(200).json(items);
    }

    // POST - 添加项目
    if (method === 'POST') {
      const { id, content, status, createdAt, date } = req.body;
      if (!content || !id || !createdAt || !date) {
        return res.status(400).json({ error: '缺少必填字段' });
      }
      await addItem(id, content, status || 'pending', createdAt, date);
      return res.status(200).json({ success: true });
    }

    // PUT - 编辑项目
    if (method === 'PUT') {
      const id = req.query.id;
      const { content, date } = req.body;
      await updateItem(id, content, date);
      return res.status(200).json({ success: true });
    }

    // PATCH - 切换状态
    if (method === 'PATCH') {
      const id = req.query.id;
      const newStatus = await toggleStatus(id);
      if (!newStatus) return res.status(404).json({ error: '未找到' });
      return res.status(200).json({ success: true, status: newStatus });
    }

    // DELETE - 删除项目
    if (method === 'DELETE') {
      const id = req.query.id;
      await deleteItem(id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

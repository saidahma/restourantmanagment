const express = require('express');
const path = require('path');
const { createDatabase, seedDatabase } = require('./db/schema');

const app = express();
const PORT = 3000;

// ── Setup DB ─────────────────────────────────────────────────────────────────
const db = createDatabase();
seedDatabase(db);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════════════════════════════
// Generic CRUD helper
// ════════════════════════════════════════════════════════════════════════════
//
// Builds standard REST endpoints for a table:
//   GET    /api/<resource>       -> list all
//   GET    /api/<resource>/:id   -> get one
//   POST   /api/<resource>       -> create
//   PUT    /api/<resource>/:id   -> update (partial)
//   DELETE /api/<resource>/:id   -> delete
//
// `columns` defines the insertable/updatable fields (in order, used for INSERT).
// `table` is the SQL table name. `idCol` defaults to 'id'.

function registerCrud(app, resource, table, columns, idCol = 'id') {
  const base = `/api/${resource}`;

  // LIST
  app.get(base, (req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${idCol}`).all();
      res.json(rows);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET ONE
  app.get(`${base}/:id`, (req, res) => {
    try {
      const row = db.prepare(`SELECT * FROM ${table} WHERE ${idCol} = ?`).get(req.params.id);
      if (!row) return res.status(404).json({ error: `${resource} not found` });
      res.json(row);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // CREATE
  app.post(base, (req, res) => {
    try {
      const values = columns.map(c => (req.body[c] !== undefined ? req.body[c] : null));
      const placeholders = columns.map(() => '?').join(',');
      const info = db.prepare(
        `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`
      ).run(...values);
      res.json({ id: info.lastInsertRowid, message: `${resource} created` });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // UPDATE (partial)
  app.put(`${base}/:id`, (req, res) => {
    try {
      const updatable = columns.filter(c => req.body[c] !== undefined);
      if (updatable.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      const setClause = updatable.map(c => `${c} = ?`).join(', ');
      const values = updatable.map(c => req.body[c]);
      const info = db.prepare(
        `UPDATE ${table} SET ${setClause} WHERE ${idCol} = ?`
      ).run(...values, req.params.id);
      if (info.changes === 0) return res.status(404).json({ error: `${resource} not found` });
      res.json({ message: `${resource} updated` });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE
  app.delete(`${base}/:id`, (req, res) => {
    try {
      const info = db.prepare(`DELETE FROM ${table} WHERE ${idCol} = ?`).run(req.params.id);
      if (info.changes === 0) return res.status(404).json({ error: `${resource} not found` });
      res.json({ message: `${resource} deleted` });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// USERS  (custom: handle role on create, enriched list)
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.*, GROUP_CONCAT(ur.role) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    GROUP BY u.id
    ORDER BY u.id
  `).all();
  res.json(users);
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare(`
    SELECT u.*, GROUP_CONCAT(ur.role) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    WHERE u.id = ?
    GROUP BY u.id
  `).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/users', (req, res) => {
  const { name, email, phone, password_hash, role } = req.body;
  try {
    const info = db.prepare(
      `INSERT INTO users (name, email, phone, password_hash) VALUES (?,?,?,?)`
    ).run(name, email, phone, password_hash || 'hashed_pw');
    db.prepare(`INSERT INTO user_roles VALUES (?,?)`).run(info.lastInsertRowid, role || 'customer');
    res.json({ id: info.lastInsertRowid, message: 'User created' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  const { name, email, phone, password_hash, role } = req.body;
  try {
    const updatable = [];
    const values = [];
    if (name !== undefined) { updatable.push('name = ?'); values.push(name); }
    if (email !== undefined) { updatable.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updatable.push('phone = ?'); values.push(phone); }
    if (password_hash !== undefined) { updatable.push('password_hash = ?'); values.push(password_hash); }

    if (updatable.length > 0) {
      const info = db.prepare(`UPDATE users SET ${updatable.join(', ')} WHERE id = ?`)
        .run(...values, req.params.id);
      if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
    }

    if (role !== undefined) {
      db.prepare(`DELETE FROM user_roles WHERE user_id = ?`).run(req.params.id);
      db.prepare(`INSERT INTO user_roles VALUES (?,?)`).run(req.params.id, role);
    }

    res.json({ message: 'User updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── USER ROLES (separate CRUD for the join table) ──────────────────────────
app.get('/api/user-roles', (req, res) => {
  const rows = db.prepare(`
    SELECT ur.*, u.name as user_name FROM user_roles ur
    JOIN users u ON ur.user_id = u.id
    ORDER BY ur.user_id
  `).all();
  res.json(rows);
});

app.post('/api/user-roles', (req, res) => {
  const { user_id, role } = req.body;
  try {
    db.prepare(`INSERT INTO user_roles VALUES (?,?)`).run(user_id, role);
    res.json({ message: 'Role added' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/user-roles/:user_id/:role', (req, res) => {
  try {
    const info = db.prepare(`DELETE FROM user_roles WHERE user_id = ? AND role = ?`)
      .run(req.params.user_id, req.params.role);
    if (info.changes === 0) return res.status(404).json({ error: 'Role not found' });
    res.json({ message: 'Role removed' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RESTAURANTS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/restaurants', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.name as owner_name,
      (SELECT ROUND(AVG(rt.score),1) FROM ratings rt WHERE rt.ratee_id = r.id AND rt.target_type='restaurant') as avg_rating
    FROM restaurants r
    JOIN users u ON r.owner_id = u.id
    ORDER BY r.id
  `).all();
  res.json(rows);
});

app.get('/api/restaurants/:id', (req, res) => {
  const row = db.prepare(`
    SELECT r.*, u.name as owner_name,
      (SELECT ROUND(AVG(rt.score),1) FROM ratings rt WHERE rt.ratee_id = r.id AND rt.target_type='restaurant') as avg_rating
    FROM restaurants r
    JOIN users u ON r.owner_id = u.id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Restaurant not found' });
  res.json(row);
});

registerCrud(app, 'restaurants', 'restaurants', ['owner_id', 'name', 'address', 'latitude', 'longitude']);
// Override GET list/one with the enriched versions above by registering
// generic CRUD AFTER (Express matches first-registered route, so the
// enriched GETs above take priority; POST/PUT/DELETE from registerCrud apply).

app.get('/api/restaurants/:id/menu', (req, res) => {
  const categories = db.prepare(`
    SELECT * FROM menu_categories WHERE restaurant_id = ? ORDER BY sort_order
  `).all(req.params.id);

  const result = categories.map(cat => {
    const items = db.prepare(`
      SELECT * FROM menu_items WHERE category_id = ? ORDER BY name
    `).all(cat.id);

    const itemsWithOptions = items.map(item => {
      const options = db.prepare(`
        SELECT * FROM item_options WHERE item_id = ? ORDER BY group_name, price_delta
      `).all(item.id);
      return { ...item, options };
    });

    return { ...cat, items: itemsWithOptions };
  });

  res.json(result);
});

// ════════════════════════════════════════════════════════════════════════════
// RESTAURANT HOURS
// ════════════════════════════════════════════════════════════════════════════
registerCrud(app, 'restaurant-hours', 'restaurant_hours', ['restaurant_id', 'day_of_week', 'opens_at', 'closes_at']);

// ════════════════════════════════════════════════════════════════════════════
// MENU CATEGORIES
// ════════════════════════════════════════════════════════════════════════════
registerCrud(app, 'menu-categories', 'menu_categories', ['restaurant_id', 'name', 'sort_order']);

// ════════════════════════════════════════════════════════════════════════════
// MENU ITEMS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/menu-items', (req, res) => {
  const rows = db.prepare(`
    SELECT mi.*, mc.name as category_name, r.name as restaurant_name
    FROM menu_items mi
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN restaurants r ON mc.restaurant_id = r.id
    ORDER BY mi.id
  `).all();
  res.json(rows);
});

app.get('/api/menu-items/:id', (req, res) => {
  const row = db.prepare(`
    SELECT mi.*, mc.name as category_name, r.name as restaurant_name
    FROM menu_items mi
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN restaurants r ON mc.restaurant_id = r.id
    WHERE mi.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Menu item not found' });
  const options = db.prepare(`SELECT * FROM item_options WHERE item_id = ?`).all(req.params.id);
  res.json({ ...row, options });
});

registerCrud(app, 'menu-items', 'menu_items', ['category_id', 'name', 'description', 'base_price', 'is_available']);

// ════════════════════════════════════════════════════════════════════════════
// ITEM OPTIONS
// ════════════════════════════════════════════════════════════════════════════
registerCrud(app, 'item-options', 'item_options', ['item_id', 'group_name', 'option_label', 'price_delta']);

// ════════════════════════════════════════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/orders', (req, res) => {
  const { status, customer_id } = req.query;
  let sql = `
    SELECT o.*,
      c.name as customer_name,
      r.name as restaurant_name,
      cr.name as courier_name
    FROM orders o
    JOIN users c ON o.customer_id = c.id
    JOIN restaurants r ON o.restaurant_id = r.id
    LEFT JOIN users cr ON o.courier_id = cr.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ` AND o.status = ?`; params.push(status); }
  if (customer_id) { sql += ` AND o.customer_id = ?`; params.push(customer_id); }
  sql += ` ORDER BY o.placed_at DESC`;

  const orders = db.prepare(sql).all(...params);

  const result = orders.map(order => {
    const items = db.prepare(`
      SELECT oi.*, mi.name as item_name
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `).all(order.id);

    const history = db.prepare(`
      SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at
    `).all(order.id);

    return { ...order, items, history };
  });

  res.json(result);
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare(`
    SELECT o.*,
      c.name as customer_name,
      r.name as restaurant_name,
      cr.name as courier_name
    FROM orders o
    JOIN users c ON o.customer_id = c.id
    JOIN restaurants r ON o.restaurant_id = r.id
    LEFT JOIN users cr ON o.courier_id = cr.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare(`
    SELECT oi.*, mi.name as item_name
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
  `).all(order.id);

  const history = db.prepare(`
    SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at
  `).all(order.id);

  const payment = db.prepare(`SELECT * FROM payments WHERE order_id = ?`).get(order.id);

  res.json({ ...order, items, history, payment });
});

app.post('/api/orders', (req, res) => {
  const { customer_id, restaurant_id, items, promo_code } = req.body;
  try {
    let subtotal = 0;
    const resolvedItems = items.map(item => {
      const menuItem = db.prepare(`SELECT * FROM menu_items WHERE id = ?`).get(item.menu_item_id);
      if (!menuItem) throw new Error(`Item ${item.menu_item_id} not found`);
      let optionsDelta = 0;
      if (item.option_ids) {
        item.option_ids.forEach(optId => {
          const opt = db.prepare(`SELECT * FROM item_options WHERE id = ?`).get(optId);
          if (opt) optionsDelta += opt.price_delta;
        });
      }
      const unitPrice = menuItem.base_price + optionsDelta;
      subtotal += unitPrice * item.quantity;
      return { ...item, unitPrice, optionsDelta };
    });

    const delivery_fee = 5000;
    let discount_amount = 0;
    let promo_id = null;

    if (promo_code) {
      const promo = db.prepare(`
        SELECT * FROM promo_codes
        WHERE code = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (max_uses IS NULL OR used_count < max_uses)
        AND min_order_amount <= ?
      `).get(promo_code, subtotal);

      if (promo) {
        discount_amount = promo.discount_type === 'percent'
          ? subtotal * (promo.discount_value / 100)
          : promo.discount_value;
        promo_id = promo.id;
        db.prepare(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?`).run(promo.id);
      }
    }

    const total = subtotal + delivery_fee - discount_amount;

    const insertOrder = db.transaction(() => {
      const orderInfo = db.prepare(`
        INSERT INTO orders (customer_id, restaurant_id, subtotal, delivery_fee, discount_amount, total)
        VALUES (?,?,?,?,?,?)
      `).run(customer_id, restaurant_id, subtotal, delivery_fee, discount_amount, total);

      const orderId = orderInfo.lastInsertRowid;

      resolvedItems.forEach(item => {
        const itemInfo = db.prepare(`
          INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
          VALUES (?,?,?,?)
        `).run(orderId, item.menu_item_id, item.quantity, item.unitPrice);

        if (item.option_ids) {
          item.option_ids.forEach(optId => {
            const opt = db.prepare(`SELECT * FROM item_options WHERE id = ?`).get(optId);
            if (opt) {
              db.prepare(`
                INSERT INTO order_item_options (order_item_id, item_option_id, price_delta)
                VALUES (?,?,?)
              `).run(itemInfo.lastInsertRowid, optId, opt.price_delta);
            }
          });
        }
      });

      db.prepare(`
        INSERT INTO order_status_history (order_id, status) VALUES (?, 'pending')
      `).run(orderId);

      db.prepare(`
        INSERT INTO payments (order_id, method, amount, platform_commission, courier_payout, restaurant_payout)
        VALUES (?, 'card', ?, ?, ?, ?)
      `).run(orderId, total, total * 0.1, 8000, total * 0.9 - 8000);

      if (promo_id) {
        db.prepare(`INSERT INTO order_promos (order_id, promo_id, applied_discount) VALUES (?,?,?)`)
          .run(orderId, promo_id, discount_amount);
      }

      return orderId;
    });

    const orderId = insertOrder();
    res.json({ id: orderId, total, discount_amount, message: 'Order placed!' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// General order update (fields like subtotal, delivery_fee, discount_amount, total, courier_id, status)
app.put('/api/orders/:id', (req, res) => {
  const fields = ['customer_id', 'restaurant_id', 'courier_id', 'status', 'subtotal', 'delivery_fee', 'discount_amount', 'total'];
  try {
    const updatable = fields.filter(f => req.body[f] !== undefined);
    if (updatable.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const setClause = updatable.map(f => `${f} = ?`).join(', ');
    const values = updatable.map(f => req.body[f]);
    const info = db.prepare(`UPDATE orders SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { status, courier_id, note } = req.body;
  try {
    db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, req.params.id);
    if (courier_id) db.prepare(`UPDATE orders SET courier_id = ? WHERE id = ?`).run(courier_id, req.params.id);
    db.prepare(`INSERT INTO order_status_history (order_id, status, note) VALUES (?,?,?)`)
      .run(req.params.id, status, note || null);
    if (status === 'delivered') {
      db.prepare(`UPDATE payments SET status='completed', paid_at=datetime('now') WHERE order_id=?`)
        .run(req.params.id);
    }
    res.json({ message: `Status updated to ${status}` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/orders/:id', (req, res) => {
  try {
    const info = db.prepare(`DELETE FROM orders WHERE id = ?`).run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── ORDER ITEMS (direct CRUD) ───────────────────────────────────────────────
registerCrud(app, 'order-items', 'order_items', ['order_id', 'menu_item_id', 'quantity', 'unit_price']);

// ── ORDER ITEM OPTIONS ──────────────────────────────────────────────────────
registerCrud(app, 'order-item-options', 'order_item_options', ['order_item_id', 'item_option_id', 'price_delta']);

// ── ORDER STATUS HISTORY ────────────────────────────────────────────────────
registerCrud(app, 'order-status-history', 'order_status_history', ['order_id', 'status', 'note']);

// ── ORDER PROMOS ─────────────────────────────────────────────────────────────
registerCrud(app, 'order-promos', 'order_promos', ['order_id', 'promo_id', 'applied_discount']);

// ════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/payments', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, o.total as order_total, c.name as customer_name, r.name as restaurant_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN users c ON o.customer_id = c.id
    JOIN restaurants r ON o.restaurant_id = r.id
    ORDER BY p.id DESC
  `).all();
  res.json(rows);
});

app.get('/api/payments/:id', (req, res) => {
  const row = db.prepare(`
    SELECT p.*, o.total as order_total, c.name as customer_name, r.name as restaurant_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN users c ON o.customer_id = c.id
    JOIN restaurants r ON o.restaurant_id = r.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Payment not found' });
  res.json(row);
});

registerCrud(app, 'payments', 'payments', [
  'order_id', 'method', 'amount', 'platform_commission', 'courier_payout', 'restaurant_payout', 'status', 'paid_at'
]);

// ════════════════════════════════════════════════════════════════════════════
// RATINGS
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/ratings', (req, res) => {
  const rows = db.prepare(`
    SELECT rt.*, u.name as rater_name,
      CASE WHEN rt.target_type='courier' THEN (SELECT name FROM users WHERE id=rt.ratee_id)
           ELSE (SELECT name FROM restaurants WHERE id=rt.ratee_id) END as ratee_name
    FROM ratings rt
    JOIN users u ON rt.rater_id = u.id
    ORDER BY rt.created_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/ratings/:id', (req, res) => {
  const row = db.prepare(`
    SELECT rt.*, u.name as rater_name,
      CASE WHEN rt.target_type='courier' THEN (SELECT name FROM users WHERE id=rt.ratee_id)
           ELSE (SELECT name FROM restaurants WHERE id=rt.ratee_id) END as ratee_name
    FROM ratings rt
    JOIN users u ON rt.rater_id = u.id
    WHERE rt.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rating not found' });
  res.json(row);
});

registerCrud(app, 'ratings', 'ratings', ['order_id', 'rater_id', 'ratee_id', 'target_type', 'score', 'comment']);

// ════════════════════════════════════════════════════════════════════════════
// PROMO CODES
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/promos/validate/:code', (req, res) => {
  const promo = db.prepare(`
    SELECT * FROM promo_codes
    WHERE code = ?
    AND (expires_at IS NULL OR expires_at > datetime('now'))
    AND (max_uses IS NULL OR used_count < max_uses)
  `).get(req.params.code);
  res.json(promo ? { valid: true, promo } : { valid: false, message: 'Invalid or expired code' });
});

registerCrud(app, 'promos', 'promo_codes', [
  'code', 'discount_type', 'discount_value', 'restaurant_id', 'min_order_amount', 'max_uses', 'used_count', 'expires_at'
]);

// ════════════════════════════════════════════════════════════════════════════
// STATS (dashboard)
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/stats', (req, res) => {
  const stats = {
    total_orders:      db.prepare(`SELECT COUNT(*) as c FROM orders`).get().c,
    delivered_orders:  db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='delivered'`).get().c,
    pending_orders:    db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pending'`).get().c,
    total_revenue:     db.prepare(`SELECT ROUND(SUM(amount),0) as s FROM payments WHERE status='completed'`).get().s || 0,
    total_users:       db.prepare(`SELECT COUNT(*) as c FROM users`).get().c,
    total_restaurants: db.prepare(`SELECT COUNT(*) as c FROM restaurants`).get().c,
    total_menu_items:  db.prepare(`SELECT COUNT(*) as c FROM menu_items`).get().c,
    avg_order_value:   db.prepare(`SELECT ROUND(AVG(total),0) as a FROM orders`).get().a || 0,
  };
  res.json(stats);
});

// ════════════════════════════════════════════════════════════════════════════
// SCHEMA INFO
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/schema', (req, res) => {
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  ).all().map(t => t.name);

  const schema = tables.map(name => {
    const columns = db.prepare(`PRAGMA table_info(${name})`).all();
    const fks = db.prepare(`PRAGMA foreign_key_list(${name})`).all();
    const rowCount = db.prepare(`SELECT COUNT(*) as c FROM ${name}`).get().c;
    return { name, columns, fks, rowCount };
  });

  res.json(schema);
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🍔 Food Delivery DB running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API:       http://localhost:${PORT}/api/stats\n`);
});
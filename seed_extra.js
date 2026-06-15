const Database = require('better-sqlite3');
const db = new Database('./food_delivery.sqlite');

db.pragma('foreign_keys = ON');

// ───────── USERS (20) ─────────
for (let i = 1; i <= 20; i++) {
  db.prepare(`
    INSERT INTO users (name,email,phone,password_hash)
    VALUES (?,?,?,?)
  `).run(
    `User_${i}`,
    `user${i}@mail.com`,
    `+99890${100000 + i}`,
    'hash'
  );

  const role = i % 5 === 0 ? 'courier' : i % 3 === 0 ? 'owner' : 'customer';
  db.prepare(`INSERT INTO user_roles VALUES (?,?)`).run(i, role);
}

// ───────── RESTAURANTS (10) ─────────
for (let i = 1; i <= 10; i++) {
  db.prepare(`
    INSERT INTO restaurants (owner_id,name,address,latitude,longitude)
    VALUES (?,?,?,?,?)
  `).run(
    i,
    `Restaurant_${i}`,
    `Street ${i}, Tashkent`,
    41.30 + i * 0.01,
    69.24 + i * 0.01
  );
}

// ───────── MENU CATEGORIES ─────────
for (let r = 1; r <= 10; r++) {
  ['Foods', 'Drinks', 'Desserts'].forEach((cat, idx) => {
    db.prepare(`
      INSERT INTO menu_categories (restaurant_id,name,sort_order)
      VALUES (?,?,?)
    `).run(r, `${cat}_${r}`, idx);
  });
}

// ───────── MENU ITEMS (60+) ─────────
let itemId = 0;
for (let c = 1; c <= 30; c++) {
  for (let i = 1; i <= 2; i++) {
    itemId++;
    db.prepare(`
      INSERT INTO menu_items (category_id,name,description,base_price,is_available)
      VALUES (?,?,?,?,1)
    `).run(
      c,
      `Item_${itemId}`,
      `Tasty food ${itemId}`,
      10000 + itemId * 500
    );
  }
}

// ───────── ITEM OPTIONS ─────────
for (let i = 1; i <= 50; i++) {
  db.prepare(`
    INSERT INTO item_options (item_id,group_name,option_label,price_delta)
    VALUES (?,?,?,?)
  `).run(
    (i % 60) + 1,
    'Size',
    `Option_${i}`,
    i * 100
  );
}

// ───────── ORDERS (40+) ─────────
for (let i = 1; i <= 40; i++) {
  const customer_id = (i % 20) + 1;
  const restaurant_id = (i % 10) + 1;
  const courier_id = i % 2 === 0 ? ((i % 20) + 1) : null;

  const subtotal = 20000 + i * 1000;
  const delivery_fee = 5000;
  const discount = i % 3 === 0 ? 2000 : 0;
  const total = subtotal + delivery_fee - discount;

  const order = db.prepare(`
    INSERT INTO orders
    (customer_id,restaurant_id,courier_id,status,subtotal,delivery_fee,discount_amount,total)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    customer_id,
    restaurant_id,
    courier_id,
    'pending',
    subtotal,
    delivery_fee,
    discount,
    total
  );

  db.prepare(`
    INSERT INTO order_status_history (order_id,status)
    VALUES (?, 'pending')
  `).run(order.lastInsertRowid);
}

// ───────── RATINGS ─────────
for (let i = 1; i <= 30; i++) {
  db.prepare(`
    INSERT INTO ratings (order_id,rater_id,ratee_id,target_type,score,comment)
    VALUES (?,?,?,?,?,?)
  `).run(
    (i % 40) + 1,
    (i % 20) + 1,
    (i % 10) + 1,
    'restaurant',
    (i % 5) + 1,
    `Review ${i}`
  );
}

// ───────── PROMOS ─────────
for (let i = 1; i <= 10; i++) {
  db.prepare(`
    INSERT INTO promo_codes (code,discount_type,discount_value,restaurant_id,min_order_amount,max_uses,used_count)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    `CODE${i}`,
    i % 2 === 0 ? 'percent' : 'fixed',
    i % 2 === 0 ? 10 : 3000,
    (i % 10) + 1,
    10000,
    100,
    0
  );
}

console.log('✅ 80+ seed data inserted successfully');
db.close();
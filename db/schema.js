const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ======================
// DB FOLDER + PATH
// ======================
const dbDir = path.join(__dirname);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const DB_PATH = path.join(dbDir, 'food_delivery.sqlite');

// ======================
// CREATE DATABASE
// ======================
function createDatabase() {
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer','courier','owner','admin')),
      PRIMARY KEY (user_id, role),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS restaurant_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      opens_at TEXT NOT NULL,
      closes_at TEXT NOT NULL,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      base_price REAL NOT NULL,
      is_available INTEGER DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS item_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      option_label TEXT NOT NULL,
      price_delta REAL DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      restaurant_id INTEGER NOT NULL,
      courier_id INTEGER,
      status TEXT DEFAULT 'pending',
      subtotal REAL NOT NULL,
      delivery_fee REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      placed_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
      FOREIGN KEY (courier_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    );

    CREATE TABLE IF NOT EXISTS order_item_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL,
      item_option_id INTEGER NOT NULL,
      price_delta REAL DEFAULT 0,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
      FOREIGN KEY (item_option_id) REFERENCES item_options(id)
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      changed_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      method TEXT,
      amount REAL,
      platform_commission REAL DEFAULT 0,
      courier_payout REAL DEFAULT 0,
      restaurant_payout REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      paid_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      rater_id INTEGER NOT NULL,
      ratee_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('restaurant','courier')),
      score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      comment TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (rater_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percent','fixed')),
      discount_value REAL NOT NULL,
      restaurant_id INTEGER,
      min_order_amount REAL DEFAULT 0,
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0,
      expires_at DATETIME,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    );

    CREATE TABLE IF NOT EXISTS order_promos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      promo_id INTEGER NOT NULL,
      applied_discount REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (promo_id) REFERENCES promo_codes(id)
    );
  `);

  return db;
}

// ======================
// SEED DATABASE
// ======================
function seedDatabase(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  db.exec(`
    -- USERS
    INSERT INTO users (name, email, phone, password_hash) VALUES
    ('Admin', 'admin@test.com', '+998900000000', 'hash'),
    ('Aziz Bek','aziz@mail.uz','+998901112001','hash'),
    ('Kamola Nur','kamola@mail.uz','+998901112002','hash'),
    ('Jamshid Aliyev','jamshid@mail.uz','+998901112003','hash'),
    ('Sarvinoz Karimova','sarvinoz@mail.uz','+998901112004','hash'),
    ('Bekzod Rahimov','bekzod@mail.uz','+998901112005','hash'),
    ('Asal Mirzaeva','asal@mail.uz','+998901112006','hash'),
    ('Diyor Ismoilov','diyor@mail.uz','+998901112007','hash'),
    ('Nilufar Tursunova','nilufar@mail.uz','+998901112008','hash'),
    ('Otabek Yusupov','otabek@mail.uz','+998901112009','hash'),
    ('Madina Sharipova','madina@mail.uz','+998901112010','hash'),
    ('Sherzod Tashkentov','sherzod@mail.uz','+998901112011','hash'),
    ('Gulnora Yoldasheva','gulnora@mail.uz','+998901112012','hash'),
    ('Farrukh Olimov','farrukh@mail.uz','+998901112013','hash');

    -- ROLES
    INSERT INTO user_roles VALUES
    (1,'admin'),
    (2,'customer'),
    (3,'customer'),
    (4,'customer'),
    (5,'customer'),
    (6,'courier'),
    (7,'courier'),
    (8,'owner'),
    (9,'customer'),
    (10,'customer'),
    (11,'customer'),
    (12,'courier'),
    (13,'owner'),
    (14,'customer');

    -- RESTAURANTS
    INSERT INTO restaurants (owner_id,name,address,latitude,longitude) VALUES
    (8,'Asian Wok','Yunusobod',41.34,69.28),
    (8,'Sushi Town','Chilonzor',41.29,69.22),
    (13,'Bella Pizza','Mirzo Ulugbek',41.33,69.30);

    -- RESTAURANT HOURS
    INSERT INTO restaurant_hours (restaurant_id, day_of_week, opens_at, closes_at) VALUES
    (1, 1, '09:00', '22:00'),
    (1, 2, '09:00', '22:00'),
    (2, 1, '10:00', '23:00'),
    (2, 2, '10:00', '23:00'),
    (3, 1, '11:00', '23:00'),
    (3, 2, '11:00', '23:00');

    -- CATEGORIES
    INSERT INTO menu_categories (restaurant_id,name,sort_order) VALUES
    (1,'Main',1),
    (1,'Drinks',2),
    (2,'Sushi',1),
    (2,'Desserts',2),
    (2,'Drinks',3),
    (3,'Pizza',1),
    (3,'Salads',2),
    (3,'Drinks',3);

    -- MENU ITEMS
    INSERT INTO menu_items (category_id,name,description,base_price,is_available) VALUES
    -- Asian Wok - Main (cat 1)
    (1,'Chicken Rice','Chicken + rice',42000,1),
    (1,'Beef Noodles','Asian noodles',55000,1),
    (1,'Steak Bowl','Rice bowl',73000,1),
    (1,'Chicken Curry','Hot curry',60000,1),
    (1,'Vegetable Stir Fry','Mixed veggies with soy sauce',38000,1),
    (1,'Spring Rolls','Crispy rolls, 6 pcs',28000,1),
    -- Asian Wok - Drinks (cat 2)
    (2,'Ice Tea','Cold drink',12000,1),
    (2,'Pepsi','500ml',9000,1),
    (2,'Fanta','500ml',9000,1),
    (2,'Mango Lassi','Fresh mango yogurt drink',18000,1),
    -- Sushi Town - Sushi (cat 3)
    (3,'California Roll','8 pcs',65000,1),
    (3,'Philadelphia Roll','Salmon roll',78000,1),
    (3,'Dragon Roll','Premium',89000,1),
    (3,'Spicy Tuna Roll','8 pcs, spicy mayo',72000,1),
    (3,'Vegetable Roll','Cucumber, avocado, carrot',55000,1),
    -- Sushi Town - Desserts (cat 4)
    (4,'Mochi','Japanese dessert',25000,1),
    (4,'Cheesecake','Classic',29000,1),
    (4,'Matcha Ice Cream','Green tea flavor',22000,1),
    -- Sushi Town - Drinks (cat 5)
    (5,'Green Tea','Hot or cold',10000,1),
    (5,'Ramune Soda','Japanese soda, assorted flavors',15000,1),
    -- Bella Pizza - Pizza (cat 6)
    (6,'Margherita','Tomato, mozzarella, basil',55000,1),
    (6,'Pepperoni','Pepperoni, mozzarella, tomato sauce',68000,1),
    (6,'Quattro Formaggi','Four cheese pizza',75000,1),
    (6,'BBQ Chicken Pizza','BBQ sauce, chicken, onion',72000,1),
    -- Bella Pizza - Salads (cat 7)
    (7,'Caesar Salad','Chicken, parmesan, croutons',38000,1),
    (7,'Greek Salad','Feta, olives, tomato, cucumber',32000,1),
    -- Bella Pizza - Drinks (cat 8)
    (8,'Coca-Cola','500ml',10000,1),
    (8,'Lemonade','Fresh homemade',15000,1),
    (8,'Espresso','Single shot',12000,1);

    -- OPTIONS
    INSERT INTO item_options (item_id,group_name,option_label,price_delta) VALUES
    (1,'Extra','Cheese',8000),
    (2,'Extra','Double Meat',12000),
    (11,'Size','Large',15000),
    (12,'Extra','Sauce',5000),
    (13,'Extra','Wasabi',3000),
    (10,'Extra','Extra Salmon',12000),
    (21,'Size','Large (16")',20000),
    (22,'Extra','Extra Cheese',10000),
    (24,'Extra','Extra Chicken',15000);

    -- ORDERS
    INSERT INTO orders (customer_id,restaurant_id,courier_id,status,subtotal,delivery_fee,discount_amount,total) VALUES
    (2,1,6,'delivered',42000,5000,0,47000),
    (3,1,7,'delivered',67000,5000,5000,67000),
    (4,2,6,'picked_up',78000,5000,0,83000),
    (5,2,NULL,'pending',89000,5000,0,94000),
    (9,2,7,'cooking',65000,5000,0,70000),
    (2,1,6,'delivered',102000,5000,10000,97000),
    (4,2,NULL,'accepted',143000,5000,0,148000);

    -- ORDER ITEMS
    INSERT INTO order_items (order_id,menu_item_id,quantity,unit_price) VALUES
    (1,1,1,42000),
    (2,2,1,55000),
    (3,5,1,78000),
    (4,6,1,89000),
    (5,4,1,65000),
    (6,1,2,42000),
    (6,2,1,55000),
    (7,6,1,89000),
    (7,7,2,29000);

    -- ORDER ITEM OPTIONS
    INSERT INTO order_item_options (order_item_id,item_option_id,price_delta) VALUES
    (1,1,8000),
    (3,5,5000),
    (4,3,12000);

    -- STATUS HISTORY
    INSERT INTO order_status_history (order_id,status) VALUES
    (1,'pending'),(1,'delivered'),
    (2,'pending'),(2,'accepted'),(2,'delivered'),
    (3,'pending'),(3,'accepted'),(3,'picked_up'),
    (4,'pending'),
    (5,'pending'),(5,'cooking'),
    (6,'pending'),(6,'delivered'),
    (7,'pending'),(7,'accepted');

    -- PAYMENTS
    INSERT INTO payments (order_id,method,amount,platform_commission,courier_payout,restaurant_payout,status,paid_at) VALUES
    (1,'card',47000,4700,8000,34300,'completed',datetime('now')),
    (2,'cash',67000,6700,8000,52300,'completed',datetime('now')),
    (3,'card',83000,8300,8000,66700,'pending',NULL),
    (4,'wallet',94000,9400,0,84600,'pending',NULL),
    (5,'card',70000,7000,8000,55000,'pending',NULL),
    (6,'card',97000,9700,8000,79300,'completed',datetime('now')),
    (7,'wallet',148000,14800,8000,125200,'pending',NULL);

    -- RATINGS
    INSERT INTO ratings (order_id,rater_id,ratee_id,target_type,score,comment) VALUES
    (1,2,1,'restaurant',5,'Excellent'),
    (2,3,1,'restaurant',4,'Good'),
    (6,2,6,'courier',5,'Fast delivery');

    -- PROMO CODES
    INSERT INTO promo_codes (code,discount_type,discount_value,restaurant_id,min_order_amount,max_uses,used_count) VALUES
    ('WELCOME10','percent',10,NULL,20000,100,1),
    ('SAVE5K','fixed',5000,1,30000,50,1),
    ('SUSHI15','percent',15,2,50000,20,0);

    -- ORDER PROMOS
    INSERT INTO order_promos (order_id,promo_id,applied_discount) VALUES
    (2,2,5000),
    (6,1,10000);
  `);
}

module.exports = {
  createDatabase,
  seedDatabase
};
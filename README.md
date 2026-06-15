# 🍔 Food Delivery Platform — SQLite + Node.js

Real database loyihasi. Barcha jadvallar, ma'lumotlar, va API.

## O'rnatish

### 1. Node.js kerak
https://nodejs.org dan yuklab o'rnating (LTS versiya)

### 2. Papkani oching
```bash
cd food_delivery
```

### 3. Kutubxonalar o'rnatish
```bash
npm install
```

### 4. Ishga tushirish
```bash
npm start
```

### 5. Brauzerni oching
```
http://localhost:3000
```

---

## Nima bor?

### API endpoints:
| Method | URL | Nima qiladi |
|--------|-----|-------------|
| GET | /api/stats | Dashboard statistika |
| GET | /api/users | Barcha foydalanuvchilar |
| POST | /api/users | Yangi foydalanuvchi |
| GET | /api/restaurants | Barcha restoranlar |
| GET | /api/restaurants/:id/menu | Restoran menyusi |
| GET | /api/menu-items | Barcha taomlar |
| POST | /api/menu-items | Yangi taom |
| GET | /api/orders | Barcha buyurtmalar |
| POST | /api/orders | Yangi buyurtma |
| PATCH | /api/orders/:id/status | Status yangilash |
| GET | /api/payments | To'lovlar |
| GET | /api/ratings | Reytinglar |
| GET | /api/promos | Promo kodlar |
| GET | /api/promos/validate/:code | Promo tekshirish |
| GET | /api/schema | DB schema |

### Jadvallar (15 ta):
1. users
2. user_roles
3. restaurants
4. restaurant_hours
5. menu_categories
6. menu_items
7. item_options
8. orders
9. order_items
10. order_item_options
11. order_status_history
12. payments
13. courier_locations
14. ratings
15. promo_codes + order_promos

### Test promo kodlar:
- `GLOVO10` — 10% chegirma
- `OSH5000` — 5000 so'm chegirma
- `PIZZA15` — 15% chegirma
- `NEWUSER` — 20% chegirma

---

## Texnologiyalar
- **Node.js** — server
- **Express** — API framework
- **better-sqlite3** — SQLite driver (sinxron, tez)
- **SQLite** — database fayl (food_delivery.sqlite)

# Охорона праці — Веб-додаток для лікарень (Україна)

Повноцінний full-stack додаток для обліку охорони праці в медичних закладах України.

## Структура проєкту

```
occupational-safety-app/
├── backend/          # Node.js + Express + better-sqlite3
└── frontend/         # React + Vite + Tailwind CSS
```

## Деплой на Render (безкоштовно)

### Автоматичний деплой через Blueprint

1. Запуште цей репозиторій на GitHub
2. Зайдіть на [render.com](https://render.com)
3. Натисніть **"New +"** → **"Blueprint"**
4. Виберіть ваш GitHub репозиторій
5. Render автоматично прочитає `render.yaml` і створить 2 сервіси:
   - **safety-backend** — Node.js API (https://safety-backend.onrender.com)
   - **safety-frontend** — React статичний сайт (https://safety-frontend.onrender.com)
6. Натисніть **"Apply"** — через 5-10 хвилин все буде онлайн!

### Ручний деплой (якщо Blueprint не спрацював)

**Бекенд:**
- Create Web Service → Connect GitHub repo
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: `NODE_ENV=production`, `JWT_SECRET=your-secret`, `PORT=10000`

**Фронтенд:**
- Create Static Site → Connect GitHub repo
- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

## Швидкий старт

### Бекенд

```bash
cd backend
npm install
npm start
```

Сервер запуститься на `http://localhost:3001`.

### Фронтенд

```bash
cd frontend
npm install
npm start
```

Додаток відкриється на `http://localhost:5173`.

## Тестові користувачі

| Роль | Email | Пароль |
|------|-------|--------|
| Суперадмін | admin@system.ua | admin123 |
| Адміністратор лікарні | manager@hospital1.ua | manager123 |

## Імпорт з Excel

Адміністратор може масово завантажувати дані через Excel-файли.

### Шаблони

| Тип | Колонки | Endpoint |
|-----|---------|----------|
| Сотрудники | ПІБ, Посада, Відділення | `GET /api/import/template/employees` |
| Записи журналу | ПІБ / Об'єкт, Категорія, Остання дата | `GET /api/import/template/records` |

### Імпорт

| Endpoint | Опис |
|----------|------|
| `POST /api/import/employees` | Масове додавання сотрудників. Нові відділення створюються автоматично. |
| `POST /api/import/records` | Масове додавання записів журналу. Автоматичний перерахунок next_date. |

### Приклад файлу для сотрудників

| ПІБ | Посада | Відділення |
|-----|--------|------------|
| Іваненко І.І. | Лікар | Хірургічне |
| Петренко П.П. | Медсестра | Терапевтичне |

### Приклад файлу для записів

| ПІБ | Об'єкт | Категорія | Остання дата |
|-----|--------|-----------|-------------|
| Іваненко І.І. | | інструктаж | 2025-05-15 |
| | Вогнегасник №1 | вогнегасник | 2025-01-10 |

## API Endpoints

| Метод | Endpoint | Опис |
|-------|----------|------|
| POST | /api/auth/login | Авторизація |
| GET | /api/dashboard | Статистика та події |
| GET/POST/PUT/DELETE | /api/employees | Управління співробітниками |
| GET/POST | /api/settings | Налаштування періодичності |
| GET/POST/PUT/DELETE | /api/records | Журнал обліку |
| POST | /api/records/:id/complete | Відмітити як пройдено |

## Архітектура бази даних

6 таблиць з повноцінними зовнішніми ключами — легко мігрувати на PostgreSQL:

- `hospitals` — лікарні
- `departments` — відділення
- `users` — користувачі з ролями
- `employees` — співробітники
- `periodicity_settings` — налаштування періодичності
- `control_records` — журнал обліку

## Особливості

- Автоматичний перерахунок `next_date` при зміні періодичності
- Ролева модель (superadmin / hospital_manager)
- JWT-авторизація
- Фільтрація даних по категоріям та відділенням
- Кнопка «Пройдено» з автоматичним оновленням дат

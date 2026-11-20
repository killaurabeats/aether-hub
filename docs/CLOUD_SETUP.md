# Подключение облака Aether Hub

Облако опционально: без него лаунчер работает в локальном демо-режиме. С
Supabase каталог, рейтинги, комментарии, профили и заявки становятся общими
для всех пользователей, а лаунчер не нужно переустанавливать при обновлении
контента.

## Архитектура

```
Aether Hub (React)                       Supabase
┌────────────────────┐    anon key    ┌──────────────────────────────┐
│ каталог / отзывы   │ ─────────────► │ REST: releases, comments     │
│ рейтинг / заявка   │ ─────────────► │ RPC: rate, my_*, request     │
└────────────────────┘                │                              │
┌────────────────────┐  admin token   │ Edge Function aether-admin   │
│ Admin Studio (Mac) │ ─────────────► │  ├─ signed upload URLs       │
│ Keygen & Requests  │                │  ├─ publish / delete         │
└────────────────────┘                │  ├─ moderation               │
                                      │  └─ approve / reject         │
        Rust uploader ──────────────► │ Storage: aether-assets       │
                                      └──────────────────────────────┘
```

- **Публичные чтения** идут напрямую в REST с anon-ключом.
- **Публичные записи** ограничены RPC и insert-политикой комментариев.
- **Любое админ-действие** требует `ADMIN_TOKEN` (Edge Function) и запускается
  только из локальной сборки создателя.
- **Файлы** загружаются по signed upload URL, выданному функцией; приватный
  service role key никогда не покидает Supabase.

## Шаг 1 — проект

1. [supabase.com](https://supabase.com) → **New project** (Free tier достаточно).
2. Запомните пароль БД.
3. **Project Settings → API**:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
4. **Project Settings → API → JWT Settings** не меняйте без необходимости.

## Шаг 2 — схема

**SQL Editor → New query** → вставьте весь `supabase/schema.sql` → **Run**.

Создаются:

| Объект | Назначение |
|---|---|
| `releases` | каталог: категория, версия, файлы по ОС, рейтинг, featured |
| `profiles` | ник, аватар, Machine ID (закрыта) |
| `comments` | публичная лента с аватаром и ником |
| `ratings` | одна оценка на HWID и релиз |
| `license_requests` | заявки на ключи |
| `licenses` | выданные ключи |
| `support_tickets` | обращения пользователей для админки |
| bucket `aether-assets` | обложки и ZIP-архивы, публичное чтение |

RLS:

- `releases` — select только `published = true`; поля `description_ru` /
  `description_en` хранят двуязычное описание;
- `comments` — select + insert с ограничением длины;
- `ratings`, `profiles`, `license_requests`, `licenses` — **никакого** прямого
  доступа у anon; только SECURITY DEFINER RPC;
- Storage — публичное чтение, запись только service role.

RPC:

| Функция | Что делает |
|---|---|
| `aether_rate_release` | upsert оценки, пересчёт среднего и количества |
| `aether_my_rating` | оценка текущего HWID |
| `aether_upsert_profile` | профиль по id |
| `aether_request_license` | заявка с дедупликацией pending |
| `aether_my_requests` | заявки текущего HWID |
| `aether_my_licenses` | выданные ключи текущего HWID |

## Шаг 3 — Edge Function

Локально:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy aether-admin --no-verify-jwt
```

`--no-verify-jwt` нужен, потому что функция сама проверяет `ADMIN_TOKEN`;
запросы всё равно идут с anon JWT в заголовке `Authorization`.

Секрет (обязательно длинный случайный):

```bash
supabase secrets set ADMIN_TOKEN=$(openssl rand -hex 32)
```

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет сам.

Проверка:

```bash
curl -s -X POST "https://<project>.supabase.co/functions/v1/aether-admin" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"token":"<admin-token>","action":"overview"}'
# {"requests":[],"comments":[]}
```

Неверный токен → HTTP 401.

## Шаг 4 — .env

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_AETHER_ADMIN_TOKEN=<ADMIN_TOKEN>
```

- `VITE_AETHER_ADMIN_TOKEN` — **только на Mac создателя**. Публичные сборки
  должны иметь пустое значение; GitHub Actions его не получает.
- Значения Vite вшиваются в JS-бандл на этапе сборки. После изменения `.env`
  перезапустите `npm run tauri:dev` или пересоберите приложение.

## Шаг 5 — первая публикация

1. Запустите лаунчер на Mac с приватным ключом в
   `~/PRIVATE_KEYGEN_DO_NOT_SHARE/private_key`.
2. Слева появится **Admin Studio**.
3. Заполните форму, перетащите macOS/Windows ZIP и обложку.
4. **Опубликовать**.
5. Откройте приложение на другом устройстве → каталог подтянется при запуске.

Проверьте в Supabase:

- **Table Editor → releases** — появилась строка;
- **Storage → aether-assets** — `releases/<slug>/…` и `covers/<slug>/…`.

## Шаг 6 — модерация и ключи

- **Admin Studio → Модерация** удаляет комментарии через service role.
- **Support Tickets → Обращения пользователей** читает `support_tickets`,
  закрывает/удаляет тикеты и очищает закрытые. Обновление — каждые 8 секунд.
- **Keygen & Requests → Одобрить**:
  1. Rust подписывает Machine ID приватным ключом;
  2. ключ отправляется в функцию (`approve_request`);
  3. строка `license_requests` становится `approved`;
  4. ключ попадает в `licenses`;
  5. профиль пользователя получает его при следующем опросе (до 45 с).

Ключ можно продублировать в Telegram `@whofriends1`.

## Ротация и безопасность

- Сменить `ADMIN_TOKEN`: `supabase secrets set ADMIN_TOKEN=...`, затем обновить
  `.env` и пересобрать **только свою** сборку. Старые публичные сборки и так
  не имеют токена.
- Не коммитьте `.env`, `PRIVATE_KEYGEN_DO_NOT_SHARE`, `admin.secret`.
  Они уже в `.gitignore`.
- Service role key не нужен фронтенду; не добавляйте его в `.env`.
- Публичный anon key безопасен при корректных RLS (он и так виден в приложении).
- Приватный ключ лицензий нельзя ротировать без обновления публичного ключа в
  плагине: все будущие ключи перестанут подходить.

## Ограничения текущей модели

- Нет OAuth: профиль — локальный id + снимок в комментариях/заявках. Это
  осознанный компромисс для лаунчера без регистрации.
- HWID не является секретом, но и не публикуется: таблицы закрыты RLS, доступ
  только по точному ID через RPC.
- Оценки привязаны к HWID, поэтому переустановка ОС может позволить повторную
  оценку.
- Для полноценной античит-защиты понадобился бы серверный аккаунт; для
  community-хаба текущей схемы достаточно.

## Диагностика

| Симптом | Причина |
|---|---|
| `relation "releases" does not exist` | не выполнен `schema.sql` |
| `new row violates row-level security policy` | прямой insert в закрытую таблицу; используйте RPC |
| `Invalid admin token` | `ADMIN_TOKEN` не совпадает с `.env` |
| `Function secrets are not configured` | не заданы secrets функции |
| 404 при загрузке файла | bucket `aether-assets` не создан или path с `..` |
| `Could not sign upload` | функция не задеплоена / нет service role |
| Каталог пуст, но релизы есть | `published = false` |
| Комментарии не видны | релиз не опубликован (RLS) |

Логи: **Supabase → Edge Functions → aether-admin → Logs**, **Storage → Logs**.

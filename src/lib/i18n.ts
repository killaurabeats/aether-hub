/**
 * Lightweight i18n for Aether Hub.
 *
 * Keys are the original Russian UI strings, so the Russian interface stays the
 * single source of truth and adding a language only needs a dictionary entry.
 * `t()` interpolates `{name}` style variables and falls back to the source
 * string when a translation is missing.
 */

export type Language = "ru" | "en";

const en: Record<string, string> = {
  // ---------------------------------------------------------------- common
  "Закрыть": "Close",
  "Свернуть": "Minimize",
  "Развернуть": "Maximize",
  "Отмена": "Cancel",
  "Сохранить": "Save",
  "Удалить": "Delete",
  "Открыть": "Open",
  "Обновить": "Update",
  "Скопировать": "Copy",
  "Скопировать ещё раз": "Copy again",
  "Скопировать ключ": "Copy key",
  "Скопировать ID": "Copy ID",
  "Скопировать Machine ID": "Copy Machine ID",
  "Machine ID скопирован": "Machine ID copied",
  "Ключ скопирован": "Licence key copied",
  "Не удалось скопировать": "Couldn't copy",
  "Поиск": "Search",
  "Очистить": "Clear",
  "Профиль": "Profile",
  "Настройки": "Settings",
  "Установить": "Install",
  "Установлено": "Installed",
  "Скачать": "Download",
  "Прослушать демо": "Preview demo",
  "Тест": "Test",
  "Назад": "Back",
  "Далее": "Next",
  "Готово": "Done",
  "Все": "All",
  "Ещё": "More",

  // ------------------------------------------------------------------- nav
  "Главное меню": "Home",
  "Библиотека": "Library",
  "Приватный ключ найден. Панель создателя активна.":
    "Private key found. Creator panel is active.",
  "Каталог синхронизирован с облаком.": "Catalog synced with the cloud.",
  "Облако не подключено — каталог работает локально.":
    "Cloud is not connected — the catalog runs locally.",
  "{count} установлено": "{count} installed",

  // ---------------------------------------------------------------- topbar
  "С возвращением, {name}": "Welcome back, {name}",
  "Поиск по хабу…": "Search the hub…",
  "Выключить звук": "Mute sound",
  "Включить звук": "Enable sound",
  "Звук": "Sound",
  "Обновить каталог": "Refresh catalog",

  // ------------------------------------------------------------------ home
  "Локальный каталог.": "Local catalog.",
  "Приложение полностью работает, но рейтинги, комментарии и заявки сохраняются только на этом Mac.":
    "The app is fully functional, but ratings, comments and requests are stored only on this Mac.",
  "Подключить Supabase": "Connect Supabase",
  "Звук, который": "Sound that",
  "не хочется трогать.": "you'll never want to touch.",
  "Плагины, драм-киты и пресеты в одном приватном хабе. Установка в один клик, живые оценки, мгновенные обновления — без переустановки лаунчера.":
    "Plugins, drumkits and presets in one private hub. One-click installs, live ratings and instant updates — without reinstalling the launcher.",
  "Смотреть плагины": "Browse plugins",
  "релизов": "releases",
  "установлено": "installed",
  "рейтинг": "rating",
  "лицензий": "licences",
  "Ручной выбор команды Aether": "Hand-picked by the Aether team",
  "готово для {os}": "ready for {os}",
  "другая ОС": "other OS",
  "Свежие дропы": "Fresh drops",
  "Обновляется из облака при каждом запуске": "Updated from the cloud on every launch",
  "Вся библиотека": "Full library",
  "Каталог пуст": "The catalog is empty",
  "Нажмите «Обновить» сверху или опубликуйте первый релиз в Admin Studio.":
    "Press Refresh above or publish the first release in Admin Studio.",
  "Активация лицензии": "Licence activation",
  "Machine ID для лицензий этого компьютера": "Machine ID for licences on this computer",
  "Machine ID для лицензий · из плагина": "Machine ID for licences · from plugin",
  "Запросить ключ": "Request a key",
  "Ключ подписывает именно этот Machine ID. Пока админ не одобрит заявку, ключ появится в профиле со статусом «ожидает».":
    "The key signs this exact Machine ID. Until an admin approves the request, it will appear in your profile as pending.",
  "Установлено на этом Mac": "Installed on this Mac",
  "Установлено на этом ПК": "Installed on this PC",
  "Приложение полностью работает, но рейтинги, комментарии и заявки сохраняются только на этом ПК.":
    "The app is fully functional, but ratings, comments and requests are stored only on this PC.",
  "Локальный демо-режим · обращения сохраняются на этом устройстве":
    "Local demo · tickets are stored on this device",
  "Приватный ключ никогда не покидает это устройство и не попадает в сборку. Публичная часть зашита в плагин.":
    "The private key never leaves this device and never enters the build. The public half is embedded in the plugin.",
  "задеплойте Edge Function и пересоберите приложение. Сейчас изменения сохраняются в локальный каталог этого устройства.":
    "deploy the Edge Function and rebuild the app. For now changes are saved to this device's local catalog.",
  "Установка идёт в системные папки плагинов. Может потребоваться подтверждение прав.":
    "Installs into the system plugin folders. You may need to confirm permissions.",
  "{count} из {total} релизов": "{count} of {total} releases",
  "Пути": "Paths",
  "Пока ничего не установлено. Откройте любой релиз и нажмите «Установить» — файлы встанут в системные папки автоматически.":
    "Nothing installed yet. Open any release and press “Install” — files will be placed into the system folders automatically.",
  "Драм-киты": "Drumkits",
  "Пресеты": "Presets",
  "Обновления каталога приходят из облака. Сам лаунчер переустанавливать не нужно.":
    "Catalog updates come from the cloud. The launcher itself never needs reinstalling.",

  // -------------------------------------------------------------- category
  "Библиотека Aether": "Aether Library",
  "Релизов: {count}": "Releases: {count}",
  "Установленные": "Installed",
  "Новые": "New",
  "Рейтинг": "Rating",
  "Здесь пока пусто": "Nothing here yet",
  "Релизов пока нет": "No releases yet",
  "Установите что-нибудь из общей библиотеки — и это появится здесь.":
    "Install something from the shared library and it will show up here.",
  "Админ ещё не опубликовал контент в этой категории. Загляните позже.":
    "The admin hasn't published anything in this category yet. Check back later.",
  "«{query}»": "“{query}”",
  "{count} совпадений по каталогу": "{count} matches in the catalog",
  "Ничего не найдено": "Nothing found",
  "Попробуйте короче: «vocal», «808», «preset».":
    "Try something shorter: “vocal”, “808”, “preset”.",

  // ----------------------------------------------------------------- cards
  "УСТАНОВЛЕНО": "INSTALLED",
  "VST3 / AU": "VST3 / AU",
  "FL / Aether": "FL / Aether",
  "WAV 24-bit": "WAV 24-bit",
  "Windows soon": "Windows soon",
  "macOS soon": "macOS soon",

  // ------------------------------------------------------------- release modal
  "оценок": "ratings",
  "сборка для другой ОС": "build for another OS",
  "Установка в 1 клик": "One-click install",
  "VST3 + AU → системные папки": "VST3 + AU → system folders",
  "Сэмплы → выбранная папка": "Samples → selected folder",
  "Сборка для {os} ещё не загружена": "No {os} build uploaded yet",
  "для другой ОС": "for another OS",
  "Установлено {time}": "Installed {time}",
  "Открыть папку": "Open folder",
  "Точно удалить": "Delete anyway",
  "Оценка релиза": "Rate this release",
  "Спасибо — ваша оценка уже учтена.": "Thanks — your rating is already counted.",
  "Поставьте от 1 до 5 звёзд, чтобы поддержать релиз.":
    "Rate it from 1 to 5 stars to support the release.",
  "{count} оценок · ваша {mine} ★": "{count} ratings · yours {mine} ★",
  "• ваша {mine} ★": "· yours {mine} ★",
  "Лицензия Aether": "Aether licence",
  "Ключ подписывает Machine ID этого компьютера. Он не переносится на другое устройство и проверяется плагином каждые 7 секунд.":
    "The key signs this computer's Machine ID. It cannot be moved to another device and is re-checked by the plugin every 7 seconds.",
  "Если плагин показывает другой ID — вставьте его сюда. Пустое поле вернёт автоматический HWID.":
    "If the plugin shows a different ID, paste it here. An empty field restores the automatic HWID.",
  "Machine ID обновлён": "Machine ID updated",
  "Указать ID из плагина": "Use the plugin's ID",
  "Лицензия активна": "Licence active",
  "Вставьте его в окно активации плагина": "Paste it into the plugin's activation window",
  "Заявка отправлена — ждём одобрения": "Request sent — awaiting approval",
  "Заявка на рассмотрении": "Request pending",
  "Запросить ключ активации": "Request activation key",
  "Заявка уйдёт от имени {name}.": "The request will be sent as {name}.",
  "Комментарии": "Comments",
  "Загружаем комментарии…": "Loading comments…",
  "Пока тихо. Оставьте первый комментарий — это увидят все.":
    "Quiet so far. Leave the first comment — everyone will see it.",
  "Написать комментарий…": "Write a comment…",
  "Отправить": "Send",
  "Удалить комментарий": "Delete comment",

  // ---------------------------------------------------------------- profile
  "Ник, аватар и лицензии Aether": "Nickname, avatar and Aether licences",
  "Никнейм": "Nickname",
  "Аватар обрезается в квадрат и сжимается до 256 px — файл остаётся на устройстве.":
    "The avatar is cropped to a square and compressed to 256 px — the file stays on this device.",
  "Используется ID из плагина. Автоматический HWID: {id}":
    "Using the plugin's ID. Automatic HWID: {id}",
  "Вставьте Machine ID, который показывает плагин в окне активации. Пустое значение — автоматический HWID этого компьютера.":
    "Paste the Machine ID shown in the plugin's activation window. Leave empty to use this computer's automatic HWID.",
  "Вопросы по лицензии, приватные дропы и поддержка — Telegram":
    "Licence questions, private drops and support — Telegram",
  "Связь": "Contact",
  "Мои лицензии": "My licences",
  "синхронизировано с облаком": "synced with the cloud",
  "локальный демо-режим": "local demo",
  "Пока нет выданных ключей. Откройте плагин и нажмите «Запросить ключ активации» — после одобрения ключ появится здесь автоматически.":
    "No keys issued yet. Open a plugin and press “Request activation key” — once approved, the key will appear here automatically.",
  "Заявки": "Requests",
  "ожидает": "pending",
  "одобрено": "approved",
  "отклонено": "rejected",

  // --------------------------------------------------------------- settings
  "Звук, папки, облако и приватность": "Sound, folders, cloud and privacy",
  "Общие": "General",
  "Вид": "Appearance",
  "Установка": "Install",
  "Облако": "Cloud",
  "О приложении": "About",
  "Язык / Language": "Language",
  "Мгновенно переключает весь интерфейс лаунчера.":
    "Instantly switches the entire launcher interface.",
  "Звук заставки": "Startup sound",
  "Звук запуска / Startup Sound": "Startup Sound",
  "Тёплый аккорд Am9 при старте. Выключите, если хотите запускать лаунчер в тишине.":
    "A warm Am9 chord on launch. Turn it off if you want a silent start.",
  "Нажмите, чтобы пропустить": "Click to skip",
  "Ничего лишнего. Только звук.": "Nothing extra. Just sound.",
  "Глубокий студийный саунд-дизайн при запуске: мягкий аккорд Am9, тёплый саб и бархатный хвост. Громкость — ровно −15 dBFS.":
    "A deep studio sting on launch: a soft Am9 chord, warm sub and a velvet tail. Level — exactly −15 dBFS.",
  "Громкость": "Volume",
  "Применяется к заставке и превью драм-китов.":
    "Applies to the startup sting and drumkit previews.",
  "Эффекты стекла / Glass Blur": "Glass Blur",
  "Включает размытие фона на карточках и всплывающих окнах. Выключите для максимального FPS на слабых GPU: размытие заменится на плотные тёмные градиенты.":
    "Enables background blur on cards and pop-up windows. Turn it off for maximum FPS on weaker GPUs: blur is replaced by dense dark gradients.",
  "Анимации фона": "Background animation",
  "Медленный дрейф неоновых пятен и парящий логотип. Отключите для экономии батареи.":
    "Slow neon drift and the floating logo. Turn it off to save battery.",
  "Плавность и эффекты": "Smoothness and effects",
  "Отключает backdrop-blur и фоновые анимации. Полезно на слабых GPU — интерфейс остаётся полностью рабочим.":
    "Disables backdrop blur and background animation. Useful on weaker GPUs — the interface stays fully functional.",
  "Все анимации построены на transform/opacity и композитятся на GPU. Целевые 60–120 FPS достигаются без нагрузки на CPU.":
    "All animation is transform/opacity and composited on the GPU. The 60–120 FPS target is reached without loading the CPU.",
  "Фон и неон": "Background and neon",
  "Глубокий фиолетовый градиент, стеклянные панели и мягкое свечение — фирменный стиль Aether.":
    "A deep violet gradient, glass panels and a soft glow — the Aether signature.",
  "Режим экономии": "Performance mode",
  "Убирает размытие стекла и анимации фона, сохраняя оформление.":
    "Removes glass blur and background animation while keeping the look.",
  "Плотность библиотеки": "Library density",
  "Сетка карточек автоматически подстраивается под ширину окна.":
    "The card grid adapts to the window width automatically.",
  "Пресеты FL Studio": "FL Studio presets",
  "Сюда распаковываются пресет-паки. По умолчанию — Documents/Image-Line/FL Studio/Presets/Aether Plugins.":
    "Preset packs are unpacked here. Defaults to Documents/Image-Line/FL Studio/Presets/Aether Plugins.",
  "Выбрать папку": "Choose folder",
  "Папка для сэмплов. Можно указать свою библиотеку — установщик создаст подпапку с названием кита.":
    "Sample folder. Point it at your own library — the installer creates a subfolder named after the kit.",
  "Плагины VST3 / AU": "VST3 / AU plugins",
  "Установка идёт в системные папки плагинов. На macOS это требует прав пользователя, но не администратора.":
    "Installs into the system plugin folders. On macOS this needs user rights, not administrator.",
  "Журнал установок": "Install log",
  "{count} релизов · {size} на диске": "{count} releases · {size} on disk",
  "Данные": "Data",
  "Сбросить демо-каталог": "Reset demo catalog",
  "Да, сбросить демо": "Yes, reset the demo",
  "Состояние облака": "Cloud status",
  "Подключено к {host}. Каталог, оценки, комментарии и заявки синхронизируются.":
    "Connected to {host}. Catalog, ratings, comments and requests are synced.",
  "Supabase не настроен — используется локальный каталог и localStorage. Все функции интерфейса доступны.":
    "Supabase is not configured — the local catalog and localStorage are used. Every interface feature still works.",
  "Admin API": "Admin API",
  "Токен админа присутствует в этой сборке. Публикация и модерация включены.":
    "The admin token is present in this build. Publishing and moderation are enabled.",
  "Токен админа отсутствует — эта сборка безопасна для публикации. Admin Studio работает локально и через приватный ключ.":
    "No admin token — this build is safe to distribute. Admin Studio works locally through the private key.",
  "Каталог": "Catalog",
  "Источник: {source} · обновляется при запуске и по кнопке.":
    "Source: {source} · refreshes on launch and on demand.",
  "Supabase": "Supabase",
  "локальный кэш": "local cache",
  "демо-каталог": "demo catalog",
  "Таблицы и Storage": "Tables & storage",
  "Проверить": "Check",
  "Проверьте, что схема supabase/schema.sql применена к проекту.":
    "Verify that supabase/schema.sql has been applied to the project.",
  "Проверено: {time}": "Checked: {time}",
  "доступна": "reachable",
  "защищена · RPC": "secured · RPC",
  "не найдена": "missing",
  "ошибка": "error",
  "Подключение Supabase": "Connecting Supabase",
  "Создайте проект на supabase.com, выполните": "Create a project on supabase.com, run",
  "задеплойте функцию": "deploy the",
  "и впишите ключи в": "function and put the keys into",
  "Затем пересоберите приложение. Подробная инструкция — в":
    "Then rebuild the app. Full instructions are in",
  "Копировать конфиг": "Copy config",
  "Конфиг скопирован": "Config copied",
  "Открыть Supabase": "Open Supabase",
  "Платформа": "Platform",
  "Machine ID для лицензий": "Machine ID for licences",
  "Ключ создателя": "Creator key",
  "Ключ создателя (Admin Token)": "Creator key (Admin Token)",
  "Скрытый вход в админ-панель на этом ПК": "Hidden admin panel unlock for this PC",
  "Ключ сохраняется только в localStorage этого ПК и не попадает в публичную сборку.":
    "The key is stored only in this PC's localStorage and never ships in the public build.",
  "Включить админ-режим": "Enable admin mode",
  "Удалить ключ": "Remove key",
  "Неверный ключ": "Invalid key",
  "Админ-режим включён": "Admin mode enabled",
  "Ключ удалён": "Key removed",
  "Ключ вшит в эту сборку": "The key is baked into this build",
  "Токен админа активен на этом ПК. Публикация и модерация включены.":
    "The admin token is active on this PC. Publishing and moderation are enabled.",
  "Токен админа не задан — эта сборка безопасна для публикации. Admin Studio работает локально и через приватный ключ.":
    "No admin token — this build is safe to distribute. Admin Studio works locally through the private key.",
  "Admin Token активен на этом ПК — Admin Studio и Support Tickets открыты.":
    "Admin Token is active on this PC — Admin Studio and Support Tickets are unlocked.",
  "Admin Token активен на этом ПК — панель создателя открыта.":
    "Admin Token is active on this PC — the creator panel is open.",
  "Приватный Ed25519 ключ найден. Панель создателя видна только на этом устройстве.":
    "The private Ed25519 key is present. The creator panel is visible only on this device.",
  "Не найден — админ-панель скрыта. Обычный пользователь видит только библиотеку.":
    "Not found — the admin panel is hidden. A regular user only sees the library.",
  "Хранилище приложения": "App storage",
  "Проверить обновления": "Check for updates",
  "Обновление Aether Hub": "Aether Hub update",
  "сейчас v{version}": "currently v{version}",
  "Новая версия уже готова. Скачайте её и приложение перезапустится само.":
    "The new version is ready. Download it and the app will restart automatically.",
  "Скачивание…": "Downloading…",
  "Установлено — перезапускаем…": "Installed — restarting…",
  "Скачать и установить": "Download and install",
  "Перезапуск…": "Restarting…",
  "Позже": "Later",
  "Обновлений нет": "No updates",
  "Установлена последняя версия Aether Hub.": "You are on the latest Aether Hub version.",
  "Не удалось проверить обновления": "Could not check for updates",
  "Автообновление доступно в приложении": "Auto-update is available in the app",
  "Запустите установленную версию Aether Hub для проверки обновлений.":
    "Run the installed Aether Hub app to check for updates.",
  "Каталог и релизы обновляются из облака — переустановка лаунчера не требуется. Приложение не собирает телеметрию. Аватар хранится локально и в вашем профиле Supabase.":
    "Catalog and releases update from the cloud — the launcher never needs reinstalling. No telemetry is collected. The avatar is stored locally and in your Supabase profile.",
  "Проигрываем интро": "Playing the startup sting",

  // ------------------------------------------------------------------ admin
  "Creator mode · только это устройство": "Creator mode · this device only",
  "Приватный ключ:": "Private key:",
  "Публикация только локально.": "Publishing is local only.",
  "Чтобы релизы видели все пользователи, добавьте Supabase URL, anon key и":
    "To make releases visible to everyone, add the Supabase URL, anon key and",
  "задеплойте Edge Function и пересоберите приложение. Сейчас изменения сохраняются в локальный каталог этого Mac.":
    "deploy the Edge Function and rebuild the app. For now changes are saved to this Mac's local catalog.",
  "Автовыдача лицензий (Auto-Approve)": "Auto-approve licenses",
  "Автовыдача всех лицензий": "Auto-approve all licences",
  "Автовыдача по PRO-плагинам": "Auto-approve by PRO plugin",
  "Переключатель действует на новые заявки выбранного плагина.":
    "The switch applies to new requests for the selected plugin.",
  "Нет PRO-плагинов — переключатели появятся здесь автоматически при публикации PRO-версий.":
    "No PRO plugins yet — switches will appear here automatically when PRO versions are published.",
  "Автовыдача для {name}": "Auto-approve for {name}",
  "Автовыдача включена для {name}": "Auto-approve enabled for {name}",
  "Автовыдача выключена для {name}": "Auto-approve disabled for {name}",
  "Не удалось изменить плагин": "Could not change the plugin",
  "ВСЕ": "ALL",
  "АВТО": "AUTO",
  "Очистить свободные": "Clear unused",
  "Удалить свободные": "Delete unused",
  "Удалить свободный инвайт": "Delete unused invite",
  "Инвайт удалён": "Invite deleted",
  "Не удалось удалить инвайт": "Could not delete invite",
  "Удалено свободных инвайтов: {count}": "Unused invites deleted: {count}",
  "Не удалось очистить инвайты": "Could not clear invites",
  "Новые заявки подписываются на сервере автоматически и сразу попадают в профиль пользователя.":
    "New requests are signed on the server automatically and land in the user's profile immediately.",
  "Для автовыдачи нужен Cloud admin token.":
    "Auto-approve requires a Cloud admin token.",
  "Одобрить все ожидающие": "Approve all pending",
  "Автовыдача лицензий включена": "Auto-approve enabled",
  "Автовыдача лицензий выключена": "Auto-approve disabled",
  "Не удалось изменить автовыдачу": "Could not change auto-approve",
  "Одобрено заявок: {count}": "Approved requests: {count}",
  "Не удалось подписать: {count}": "Failed to sign: {count}",
  "Очередь обработана.": "Queue processed.",
  "Не удалось одобрить заявки": "Could not approve requests",
  "Тип доступа": "Access type",
  "Без лицензии: ключ создаётся автоматически при установке.":
    "No licence: the key is created automatically during install.",
  "С лицензией: пользователь запрашивает ключ по Machine ID.":
    "Licensed: the user requests a key for their Machine ID.",
  "FREE · лицензия не требуется": "FREE · no licence required",
  "Этот плагин бесплатный. Лицензия создаётся автоматически при установке и записывается в папку плагина — никаких заявок и ожиданий.":
    "This plugin is free. A licence is created automatically during install and written into the plugin folder — no requests or waiting.",
  "FREE ACCESS": "FREE ACCESS",
  "FREE-лицензия активирована": "FREE licence activated",
  "Ключ записан локально — плагин готов к работе.":
    "The key is written locally — the plugin is ready.",
  "Не удалось активировать FREE-лицензию": "Could not activate the FREE licence",
  "Beta-инвайты": "Beta invites",
  "Одноразовые коды AETHER-BETA-XXXX. Активированный код закрепляется за HWID и даёт бейдж BETA TESTER в профиле.":
    "One-time AETHER-BETA-XXXX codes. An activated code is bound to the HWID and grants the BETA TESTER badge in the profile.",
  "Заметка (например, имя тестера)": "Note (e.g. tester name)",
  "Сколько": "How many",
  "Сгенерировать": "Generate",
  "без заметки": "no note",
  "АКТИВИРОВАН": "ACTIVATED",
  "СВОБОДЕН": "AVAILABLE",
  "Скопировать код": "Copy code",
  "Инвайтов пока нет": "No invites yet",
  "Сгенерируйте первую партию кодов для закрытого теста.":
    "Generate the first batch of codes for a closed test.",
  "Не удалось загрузить бета-инвайты": "Could not load beta invites",
  "Создано инвайтов: {count}": "Invites created: {count}",
  "Не удалось создать инвайты": "Could not create invites",
  "Инвайт скопирован": "Invite copied",
  "BETA TESTER активирован": "BETA TESTER activated",
  "Не удалось активировать инвайт": "Could not activate the invite",
  "Этот код уже использован на другом устройстве.":
    "This code has already been used on another device.",
  "Код не найден.": "Code not found.",
  "Инвайт-код Beta Tester": "Beta Tester invite code",
  "Активировать": "Activate",
  "Одноразовый код привязывается к вашему Machine ID.":
    "The one-time code is bound to your Machine ID.",
  "Доступно обновление v{version}": "Update v{version} available",
  "Новый релиз": "New release",
  "Редактирование": "Editing",
  "Релизы": "Releases",
  "Модерация": "Moderation",
  "Публикация релиза": "Publish a release",
  "Живое редактирование": "Live editing",
  "Отпустите файлы": "Drop the files",
  "Перетащите ZIP-архивы и обложку прямо в это окно (или выберите файлы). Для macOS положите в архив": 
    "Drag ZIP archives and a cover straight into this window (or pick files). For macOS put",
  "для Windows —": "inside the archive; for Windows —",
  "уже в облаке": "already in the cloud",
  "Перетащите ZIP": "Drop a ZIP",
  "Перетащите JPG": "Drop a JPG",
  "Текущая обложка": "Current cover",
  "Обложка": "Cover",
  "Название": "Title",
  "Slug": "Slug",
  "Версия": "Version",
  "Категория": "Category",
  "Product tag (лицензия)": "Product tag (licence)",
  "Бейдж": "Badge",
  "Описание": "Description",
  "Featured на главной": "Featured on Home",
  "Опубликовать": "Publish",
  "Сохранить в облако": "Save to cloud",
  "Быстрые факты": "Quick facts",
  "Так релиз увидят пользователи прямо сейчас.": "This is how users will see the release right now.",
  "не задано": "not set",
  "Аудитория": "Audience",
  "{count} заявок ждут": "{count} requests waiting",
  "нет новых заявок": "no new requests",
  "Живой каталог": "Live catalog",
  "Карандаш открывает live-редактирование. Изменения уходят в облако сразу после сохранения.":
    "The pencil opens live editing. Changes go to the cloud as soon as you save.",
  "Новый": "New",
  "Модерация комментариев": "Comment moderation",
  "Удаление мгновенно убирает комментарий из облака у всех пользователей.":
    "Deleting removes the comment from the cloud for everyone instantly.",
  "Опубликуйте первый релиз — он сразу появится у всех пользователей.":
    "Publish the first release — it will appear for all users instantly.",
  "Нужно название релиза": "A release title is required",
  "Нужен slug": "A slug is required",
  "Добавьте хотя бы один ZIP": "Add at least one ZIP",
  "macOS или Windows сборку.": "a macOS or Windows build.",
  "Подготовка облака…": "Preparing the cloud…",
  "Сохранение локального каталога…": "Saving the local catalog…",
  "Загрузка {os} сборки…": "Uploading the {os} build…",
  "Загрузка обложки…": "Uploading the cover…",
  "Публикация в каталог…": "Publishing to the catalog…",
  "Релиз обновлён": "Release updated",
  "Релиз опубликован": "Release published",
  "{name} уже доступен всем пользователям.": "{name} is now live for everyone.",
  "{name} сохранён в локальном каталоге (облако не подключено).":
    "{name} was saved to the local catalog (cloud not configured).",
  "Публикация не удалась": "Publishing failed",
  "{name} удалён": "{name} deleted",
  "Удаление не удалось": "Deleting failed",
  "Неподдерживаемый файл": "Unsupported file",
  "{name}: нужен ZIP-архив или изображение обложки.":
    "{name}: a ZIP archive or a cover image is required.",
  "ZIP добавлен: {os}": "ZIP added: {os}",

  // ----------------------------------------------------------------- keygen
  "Creator mode закрыт": "Creator mode is locked",
  "На этом устройстве нет приватного ключа.": "This device has no private key.",
  "Keygen & Requests": "Keygen & Requests",
  "совместимо с": "compatible with",
  "Ключ подписывает Machine ID и не переносится.":
    "The key signs the Machine ID and cannot be transferred.",
  "{count} PENDING": "{count} PENDING",
  "Облако только для чтения.": "Cloud is read-only.",
  "Локальный режим.": "Local mode.",
  "Ключи выдаются и проверяются локально, журнал пишется в папку приложения. Чтобы ключ автоматически появился у пользователя, подключите Supabase и токен админа.":
    "Keys are issued and verified locally and the log is written to the app folder. To deliver keys to users automatically, connect Supabase and an admin token.",
  "Входящие заявки": "Incoming requests",
  "Одобрение генерирует подпись приватным ключом и отправляет ключ в профиль пользователя.":
    "Approval signs with the private key and sends the key to the user's profile.",
  "{count} ждут": "{count} waiting",
  "Все заявки обработаны": "All requests processed",
  "Новые появятся здесь автоматически после запроса из плагина.":
    "New ones will appear here automatically after a request from the plugin.",
  "История заявок": "Request history",
  "Последние решения.": "Latest decisions.",
  "Private key": "Private key",
  "Public key": "Public key",
  "Открыть папку ключа": "Open key folder",
  "Мой Machine ID": "My Machine ID",
  "Приватный ключ никогда не покидает этот Mac и не попадает в сборку. Публичная часть зашита в плагин.":
    "The private key never leaves this Mac and never enters the build. The public half is embedded in the plugin.",
  "Журнал выдачи": "Issue log",
  "Локальный журнал, последние 200 ключей.": "Local log, latest 200 keys.",
  "Пока ни одного ключа. Выданные ключи появятся здесь и в профиле пользователя.":
    "No keys yet. Issued keys will appear here and in the user's profile.",
  "Пользователь получает ключ автоматически, но может написать в Telegram.":
    "The user receives the key automatically, but can also reach out on Telegram.",
  "Ключ выдан и скопирован": "Key issued and copied",
  "Не удалось выдать ключ": "Couldn't issue the key",
  "Заявка отклонена": "Request rejected",
  "Не удалось отклонить": "Couldn't reject the request",
  "ждёт": "waiting",
  "Ключ выдан": "Key issued",
  "Одобрить и выдать ключ": "Approve and issue key",
  "Отклонить": "Reject",

  // ------------------------------------------------------------- toasts/store
  "Не удалось загрузить каталог": "Couldn't load the catalog",
  "Облако недоступно": "Cloud unavailable",
  "Облако пока пустое": "Cloud is still empty",
  "В Supabase нет опубликованных релизов — показан демо-каталог.":
    "No published releases in Supabase yet — showing the demo catalogue.",
  "Облако подключено, но каталог пуст — показан демо-набор.":
    "Cloud is linked but the catalogue is empty — showing the demo shelf.",
  "Показан резервный каталог. Проверьте интернет и ключи Supabase.":
    "Showing the fallback catalog. Check your connection and Supabase keys.",
  "Не удалось обновить панель": "Couldn't refresh the panel",
  "Нет сборки для этой ОС": "No build for this OS",
  "{name} пока не собран для {os}.": "{name} is not built for {os} yet.",
  "Установка доступна в приложении": "Installation is available in the app",
  "Запустите Aether Hub.app.": "Launch Aether Hub.app.",
  "{name} установлен": "{name} installed",
  "VST3 / AU скопированы в системные папки плагинов.":
    "VST3 / AU copied into the system plugin folders.",
  "{size} распакованы.": "{size} unpacked.",
  "Установка не удалась": "Installation failed",
  "Не удалось удалить": "Couldn't delete",
  "Сначала задайте никнейм в профиле": "Set a nickname in your profile first",
  "Комментарий не отправлен": "Comment not sent",
  "Комментарий удалён": "Comment deleted",
  "Оценка {value} ★ сохранена": "Rating {value} ★ saved",
  "Оценка не сохранена": "Rating not saved",
  "Профиль сохранён": "Profile saved",
  "Профиль сохранён локально": "Profile saved locally",
  "Заявка отправлена": "Request sent",
  "Ключ появится в профиле, как только его одобрят.":
    "The key will appear in your profile once approved.",
  "Заявка не отправлена": "Request not sent",
  "Не удалось выбрать папку": "Couldn't choose the folder",
  "Демо-каталог восстановлен": "Demo catalog restored",
  "Каталог обновлён": "Catalog refreshed",
  "Не удалось обработать аватар": "Couldn't process the avatar",
  "Нужен файл изображения": "An image file is required",
  "Machine ID для лицензий обновлён": "Licence Machine ID updated",
  "Не удалось сохранить": "Couldn't save",

  // -------------------------------------------------------------------- misc
  "Aether Plugins · by. @killaurabeats": "Aether Plugins · by. @killaurabeats",
  "AETHER HUB · 1.3.0 · CINEMATIC INTRO": "AETHER HUB · 1.3.0 · CINEMATIC INTRO",
  "Эффекты стекла": "Glass effects",
  "Размытие": "Blur",
  "Включено": "On",
  "Выключено": "Off",
  "Система": "System",
  "Разрешение": "Resolution",
  "Проверка": "Verification",

  // ------------------------------------------------------------- additions
  "Публикация": "Publishing",
  "Лицензии": "Licensing",
  "Пауза": "Pause",
  "Рейтинг {value} из 5": "Rating {value} out of 5",
  "{star} звёзд": "{star} stars",
  "Нет сборки для {os}": "No build for {os}",
  "XXXX-XXXX-… из окна плагина": "XXXX-XXXX-… from the plugin window",
  "Machine ID из окна плагина": "Machine ID from the plugin window",
  "Скопировано": "Copied",
  "автоматический HWID": "automatic HWID",
  "Параметры сохраняются автоматически в localStorage.":
    "Settings are saved automatically in localStorage.",
  "Для максимального FPS отключите «Эффекты стекла» на вкладке «Общие» — интерфейс заменит blur на плотные тёмные градиенты.":
    "For maximum FPS, turn off “Glass Blur” on the General tab — the interface replaces blur with dense dark gradients.",
  "Выключить звук заставки": "Mute the startup sound",
  "Включить звук заставки": "Enable the startup sound",
  "Русский": "Russian",
  "не задан": "not set",
  "Aether Hub · 1.3.0 · CINEMATIC INTRO": "AETHER HUB · 1.3.0 · CINEMATIC INTRO",
  "Чат с создателем": "Creator chat",
  "Скоро здесь появится встроенная поддержка.":
    "Built-in support is coming soon.",
  "Поддержка уже в разработке": "Support is in development",
  "Совсем скоро здесь появится встроенная техподдержка Aether Hub: обращения, переписка с создателем и статусы тикетов — всё внутри хаба.":
    "Built-in Aether Hub support is coming very soon: requests, conversations with the creator and ticket statuses — all inside the hub.",
  "Следите за обновлениями": "Stay tuned",
  "Открыть чат / Ответить": "Open chat / Reply",
  "Чат по тикету": "Ticket chat",
  "Сообщений пока нет.": "No messages yet.",
  "Написать ответ…": "Write a reply…",
  "Оригинальное обращение": "Original request",
  "Не удалось загрузить чат": "Couldn't load the chat",
  "Сообщение не отправлено": "Message not sent",
  "Загрузка сообщений…": "Loading messages…",
  "обновляется каждые 5 секунд": "refreshes every 5 seconds",
  "локальный демо-чат": "local demo chat",
  "Обращения пользователей": "Support Tickets",
  "Обновление каждые 8 секунд · таблица support_tickets":
    "Refreshes every 8 seconds · support_tickets table",
  "Локальный демо-режим · обращения сохраняются на этом Mac":
    "Local demo · tickets are stored on this Mac",
  "Нет доступа к облачным тикетам.": "No access to cloud tickets.",
  "В этой сборке отсутствует ADMIN_TOKEN — список тикетов доступен только в локальном демо-режиме.":
    "This build has no ADMIN_TOKEN — the ticket list is available only in local demo mode.",
  "Все обращения": "All tickets",
  "Открытые": "Open",
  "Закрытые": "Closed",
  "Да, очистить": "Yes, clear",
  "Очистить все закрытые": "Clear all closed",
  "Загрузка обращений…": "Loading tickets…",
  "Открыт": "Open",
  "Закрыт": "Closed",
  "Закрыть тикет": "Close ticket",
  "Да, удалить": "Yes, delete",
  "Удалить / Очистить": "Delete / Clear",
  "Тикетов нет": "No tickets yet",
  "Новые обращения появятся здесь.": "New tickets will appear here.",
  "Тикет закрыт": "Ticket closed",
  "Не удалось обновить тикет": "Couldn't update the ticket",
  "Тикет удалён": "Ticket deleted",
  "Закрытые тикеты очищены": "Closed tickets cleared",
  "Не удалось загрузить тикеты": "Couldn't load tickets",
  "Поддержка": "Support",
  "Мы на связи — выберите удобный способ.": "We're here — choose a way to reach us.",
  "Мы на связи": "We're here",
  "Напишите нам напрямую — ответим в Telegram или на почту.":
    "Message us directly — we'll reply on Telegram or by email.",
  "Написать в Telegram": "Message on Telegram",
  "Написать на Email": "Send an Email",
  "Встроенная форма тикета": "Built-in ticket form",
  "Прямое обращение из хаба": "Direct request from the hub",
  "В процессе создания": "In development",
  "Скоро здесь можно будет отправить обращение прямо из хаба. Пока напишите нам в Telegram или на Email — так мы ответим быстрее.":
    "Soon you'll be able to send a request right from the hub. For now, message us on Telegram or by email — it's faster.",
  "Отправить тикет": "Send ticket",
  "Установка…": "Installing…",
  "Выберите платформу": "Choose a platform",
  "Установите сборку для нужной ОС": "Install the build for your platform",
  "Установить для {os}": "Install for {os}",
  "Скачать для {os}": "Download for {os}",
  "Рекомендуется для вашей ОС": "Recommended for your OS",
  "Для другой ОС": "For another OS",
  "Нет сборки": "No build",
  "Скачано": "Downloaded",
  "Файл сохранён в {path}": "File saved to {path}",
  "Скачать не удалось": "Download failed",
  "Скачивание доступно в приложении": "Downloading is available in the app",
  "Описание (RU)": "Description (RU)",
  "Описание (EN)": "Description (EN)",
  "What's inside, who it's for and what changed…": "What's inside, who it's for and what changed…",
  "Ничего лишнего.": "Nothing extra.",
  "Только звук.": "Just sound.",
  "Избранный релиз": "Featured drop",
  "Скоро здесь появятся пресеты": "Presets coming soon",
  "Вид:": "View:",
  "Редактор аватарки": "Avatar cropper",
  "1:1 · 256 × 256 px": "1:1 · 256 × 256 px",
  "Перетащите фото и настройте масштаб": "Drag the photo and adjust the zoom",
  "Масштаб": "Zoom",
  "Применить": "Apply",
  "Не удалось загрузить изображение": "Couldn't load the image",
  "Нажмите на аватар, чтобы открыть редактор. Итог — квадрат 256 × 256 px.":
    "Click the avatar to open the cropper. Result — a 256 × 256 px square.",
  "Режим просмотра": "View mode",
  "Админ": "Admin",
  "Юзер": "User",
  "Режим пользователя": "User view",
  "Режим админа включён": "Admin view enabled",
  "Режим пользователя включён": "User view enabled",
  "Интерфейс как у пользователя. Вернуть админ-режим можно здесь.":
    "Regular user interface. Switch back to Admin here.",
  "Скоро здесь появятся драм-киты": "Drumkits coming soon",
  "Полный экран": "Fullscreen",
  "Выйти из полноэкранного режима": "Exit fullscreen",

  "Telegram": "Telegram",
  "https://…/demo.mp3 — для мини-плеера в карточке драм-кита":
    "https://…/demo.mp3 — for the mini-player in a drumkit card",
  "{count} оценок": "{count} ratings",
  "Здесь появятся все сообщения пользователей для модерации.":
    "All user messages will appear here for moderation.",
  "Комментариев нет": "No comments",
  "Папка драм-китов": "Drumkit folder",
  "Папка пресетов": "Preset folder",
  "Подготовка…": "Preparing…",
  "Подтвердить": "Confirm",
  "Редактировать": "Edit",
  "Что внутри, для кого, чем отличается версия…":
    "What's inside, who it's for and what changed…",

  // ------------------------------------------------------------ v1.3.0 UI
  "Уведомления": "Notifications",
  "Всё прочитано": "All caught up",
  "{count} новых": "{count} new",
  "Пока нет событий. Релизы и модерация появятся здесь.":
    "No events yet. Releases and moderation updates will appear here.",
  "Новый релиз · {name}": "New release · {name}",
  "BETA-обновление · {name}": "BETA update · {name}",
  "Версия {version} · ранний доступ для Beta-тестеров.":
    "Version {version} · early access for Beta testers.",
  "Версия {version} уже в каталоге Aether Hub.":
    "Version {version} is now in the Aether Hub catalog.",
  "PRO-лицензия одобрена": "PRO licence approved",
  "{name} · ключ записан автоматически.": "{name} · key written automatically.",
  "Заявка на PRO-лицензию отклонена": "PRO licence request rejected",
  "Сэмпл одобрен": "Sample approved",
  "{name} опубликован в Samples & Loops.": "{name} is live in Samples & Loops.",
  "Сэмпл отклонён модерацией": "Sample rejected by moderation",
  "Beta-доступ активен": "Beta access active",
  "Установка BETA-плагинов открыта в один клик.":
    "One-click install for BETA plugins is unlocked.",
  "Лицензия записана автоматически": "Licence written automatically",
  "Не удалось записать лицензию": "Couldn't write the licence",
  "Лицензия активирована": "Licence activated",
  "Файл license.aether записан в {path}": "license.aether written to {path}",
  "BETA-лицензия активирована": "BETA licence activated",
  "Ключ записан в {path}": "Key written to {path}",
  "Не удалось активировать BETA-лицензию": "Couldn't activate the BETA licence",
  "В разработке • Доступно только Beta-тестерам":
    "In Development • Beta Testers Only",
  "Активируйте одноразовый Beta-инвайт в профиле — и установка откроется в один клик.":
    "Activate a one-time Beta invite in your profile and one-click install unlocks.",
  "Активируйте Beta-инвайт в профиле, чтобы открыть установку.":
    "Activate a Beta invite in your profile to unlock installation.",
  "Ввести инвайт": "Enter invite",
  "Доступ по инвайту": "Invite only",
  "BETA · по инвайту": "BETA · invite only",
  "Активировать и установить": "Activate & install",
  "BETA-лицензия тестера": "Tester BETA licence",
  "Для Beta-тестеров лицензия выдаётся автоматически при установке. Zero-Copy записывает ключ в системную папку плагина.":
    "Beta testers get a licence automatically on install. Zero-Copy writes the key into the plugin's system folder.",
  "Ключ подписывает Machine ID этого компьютера. После одобрения он записывается в папку плагина автоматически — копировать вручную не нужно.":
    "The key signs this computer's Machine ID. Once approved it is written into the plugin folder automatically — no manual copying.",
  "license.aether уже записан в системную папку лицензий плагина.":
    "license.aether is already in the plugin's system licence folder.",
  "Нужен активированный Beta-инвайт в профиле.":
    "An activated Beta invite is required in your profile.",
  "Открыть профиль": "Open profile",
  "BETA-ключ выдаётся при установке": "BETA key is issued on install",
  "Ранний доступ: установка только для HWID с активированным Beta-инвайтом, лицензия выдаётся автоматически.":
    "Early access: installs only for HWIDs with an activated Beta invite; the licence is issued automatically.",

  // --------------------------------------------------------------- samples
  "Звуки": "Sounds",
  "комьюнити.": "by the community.",
  "Загрузить сэмпл": "Upload sample",
  "Библиотека обновлена": "Library refreshed",
  "сэмплов": "samples",
  "выбор комьюнити": "community picks",
  "мгновенный preview": "instant preview",
  "Топ недели": "Top of the week",
  "Выбор комьюнити": "Community picks",
  "Лупы": "Loops",
  "Ваншоты": "One-shots",
  "Любая тональность": "Any key",
  "Любой BPM": "Any BPM",
  "Под эти фильтры пока ничего нет": "Nothing matches these filters yet",
  "Сбросьте фильтры или загрузите свой первый луп — после премодерации он появится здесь.":
    "Reset the filters or upload your first loop — it will appear here after moderation.",
  "Все загрузки проходят премодерацию. Перетаскивание работает в установленном Aether Hub: файл кэшируется локально и передаётся в DAW как обычный WAV.":
    "Every upload is moderated. Dragging works in the installed Aether Hub: the file is cached locally and handed to the DAW as a regular WAV.",
  "Перетащите в FL Studio или прослушайте": "Drag into FL Studio or preview",
  "Локальный файл доступен только в приложении":
    "Local files are available in the desktop app only",
  "Файл готов — потяните карточку в FL Studio":
    "File ready — drag the card into FL Studio",
  "Локальный кэш: {path}": "Local cache: {path}",
  "Не удалось начать перетаскивание": "Couldn't start the drag",
  "Сэмпл сохранён": "Sample saved",
  "Не удалось скачать": "Couldn't download",
  "Лайк": "Like",
  "Не удалось поставить лайк": "Couldn't like the sample",
  "Нужен файл .wav или .mp3": "A .wav or .mp3 file is required",
  "Введите название сэмпла": "Enter a sample title",
  "Выберите .wav или .mp3 файл": "Choose a .wav or .mp3 file",
  "Перетащите или выберите .wav / .mp3": "Drop or choose a .wav / .mp3",
  "Максимум 96 МБ · WAV 24-bit или MP3 320":
    "Up to 96 MB · 24-bit WAV or 320 kbps MP3",
  "Анализируем волновую форму…": "Analysing the waveform…",
  "Волновая форма готова": "Waveform ready",
  "Название сэмпла": "Sample title",
  "Тип": "Type",
  "Луп": "Loop",
  "Ваншот": "One-shot",
  "Тональность": "Key",
  "Без тональности": "No key",
  "Загрузка появится в разделе только после одобрения модератором.":
    "The upload appears in the section only after moderator approval.",
  "Отправить на модерацию": "Submit for moderation",
  "Сэмпл отправлен на модерацию": "Sample submitted for moderation",
  "Он появится в разделе после одобрения.": "It will appear after approval.",
  "Не удалось загрузить сэмпл": "Couldn't upload the sample",
  "Загрузка не удалась": "Upload failed",

  // ------------------------------------------------------- sample moderation
  "Модерация сэмплов": "Sample moderation",
  "Модерация Samples & Loops": "Samples & Loops moderation",
  "Прослушайте загрузку и одобрите её, добавьте в выбор комьюнити или отклоните.":
    "Preview the upload and approve it, feature it for the community or reject it.",
  "На модерации": "Pending",
  "Одобренные": "Approved",
  "Отклонённые": "Rejected",
  "Одобрить": "Approve",
  "В выбор комьюнити": "Feature",
  "Убрать из выбора": "Unfeature",
  "Сэмпл отклонён": "Sample rejected",
  "Добавлено в выбор комьюнити": "Added to community picks",
  "Убрано из выбора комьюнити": "Removed from community picks",
  "Сэмпл удалён": "Sample deleted",
  "Действие не выполнено": "Action failed",
  "Не удалось загрузить сэмплы": "Couldn't load samples",
  "Очередь пуста": "The queue is empty",
  "Новые загрузки комьюнити появятся здесь для премодерации.":
    "New community uploads will appear here for pre-moderation.",
  "ЛУП": "LOOP",
  "ВАНШОТ": "ONE-SHOT",
  "ОДОБРЕН": "APPROVED",
  "ОТКЛОНЁН": "REJECTED",
  "ОЖИДАЕТ": "PENDING",
  "Прослушать": "Preview",
  "ВЫБОР КОМЬЮНИТИ": "COMMUNITY PICK",
};

export function translate(
  language: Language,
  text: string,
  vars?: Record<string, string | number>,
): string {
  let output = language === "en" ? en[text] ?? text : text;

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      output = output.replaceAll(`{${key}}`, String(value));
    }
  }

  return output;
}

export function isTranslated(text: string): boolean {
  return Object.prototype.hasOwnProperty.call(en, text);
}

export type { Language as I18nLanguage };

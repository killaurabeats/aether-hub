# HWID и лицензии Aether

Лаунчер использует **тот же** алгоритм, что и `AetherVocal Strip`, поэтому
Machine ID и ключи полностью взаимозаменяемы: заявка из хаба открывает плагин,
а ключ, выданный старым `aether-keygen`, принимается лаунчером.

## Machine ID

Канонический вид — 32 uppercase hex без разделителей. В интерфейсе показывается
группами по 4: `4F2A-91BC-77D0-3E15-8AC6-0B44-19EE-5D73`.

```
macOS:
  AetherVocalStrip.HWID.v1|uuid=<gethostuuid>|mac=<en0 MAC>|device=<IOPlatformUUID>

Windows:
  AetherVocalStrip.HWID.v1|guid=<MachineGuid>|volume=<C: serial>|name=<COMPUTERNAME>|device=<SMBIOS hash>

ID = uppercase hex (SHA-256(material)[0..16])
```

Особенности, повторяющие `MachineID.cpp`:

- `uuid` — `gethostuuid` с таймаутом 1 с, hex без дефисов;
- `mac` — первый ненулевой AF_LINK-интерфейс, `en0` в приоритете;
  формат `AA:BB:CC:DD:EE:FF` (интерфейсы с `02:00:00:00:00:00` не отбрасываются,
  как и в плагине);
- `device` на macOS — `IOPlatformUUID` без дефисов, регистр сохраняется;
- `device` на Windows — JUCE-совместимый хеш SMBIOS (типы 1/2/4),
  `uint64 = uint64 * 101 + codepoint`, затем signed decimal;
- `volume` — серийный номер тома `C:` в десятичном виде;
- `MachineGuid` читается из
  `HKLM\SOFTWARE\Microsoft\Cryptography`.

Проверка на текущей машине:

```bash
cd src-tauri
cargo test --lib prints_machine_id_for_cross_check -- --nocapture
```

Для сверки можно использовать `AetherPreview.app` из проекта плагина:

```bash
".../AetherPreview.app/Contents/MacOS/AetherPreview" --print-machine-id
```

Значения должны совпасть символ в символ.

> **macOS network privacy.** На некоторых сборках macOS процесс, запущенный
> из терминала или агента, видит маскированные MAC-адреса (`02:00:00:…`), а
> GUI-приложения — реальные/приватные. Machine ID, снятый в терминале, может
> отличаться от того, что показывает плагин внутри DAW. **Авторитетный ID —
> тот, что виден в окне активации плагина или в лаунчере**, потому что оба
> запущены как GUI-приложения. Если автоматический ID не совпадает с плагином,
> вставьте ID из окна активации карандашом в карточке лицензии — лаунчер будет
> использовать его для заявок и профиля. Ключ всегда подписывайте по ID из
> заявки.

## Формат ключа

```
message   = "<PRODUCT_TAG>|v1|<32 hex>"
signature = Monocypher EdDSA(message, private_key)
payload   = [0x01] ++ signature[64]
key       = "AETHER-" + BASE32(payload), группы по 4
```

- `PRODUCT_TAG` по умолчанию `AETHER-VOCAL-STRIP`;
- base32 — RFC 4648 (`A–Z`, `2–7`), без padding;
- итог — 65 байт → 104 символа → 26 групп;
- плагин игнорирует пробелы, дефисы и переводы строк при вставке.

### Важно: это не стандартный Ed25519

Monocypher использует **BLAKE2b** вместо SHA-512 в EdDSA. Поэтому
`ed25519-dalek`, `libsodium` (ed25519) и OpenSSL **не совместимы** с ключами
плагина. В лаунчере для этого вендорен Monocypher
(`src-tauri/vendor/monocypher`), а вызовы идут через FFI
`crypto_eddsa_sign` / `crypto_eddsa_check`.

## Приватный ключ

Файл `PRIVATE_KEYGEN_DO_NOT_SHARE/private_key.txt` — 128 hex-символов:
первые 32 байта — seed, вторые 32 — публичный ключ. Лаунчер принимает:

- 64 байта (`seed || public`), как в keygen;
- 32 байта (только seed) — публичная часть выводится заново.

Поиск:

```
~/PRIVATE_KEYGEN_DO_NOT_SHARE/private_key[.txt]
~/admin.secret                (hex, путь к файлу или JSON {"privateKey": "..."})
<app-data>/admin.secret
./PRIVATE_KEYGEN_DO_NOT_SHARE/private_key[.txt]   (dev)
```

Права: `chmod 600`. Файл никогда не попадает в сборку и не читается
пользователями без него — вкладки админа просто отсутствуют.

## Выдача и активация

1. Пользователь открывает плагин в LAUNCHER → **Запросить ключ активации**.
2. Заявка (ник, аватар, плагин, Machine ID) уходит в `license_requests`.
3. На Mac создателя: **Keygen & Requests → Одобрить и выдать ключ**.
4. Rust подписывает `AETHER-VOCAL-STRIP|v1|<HWID>`, ключ копируется в буфер,
   сохраняется в облако и локальный журнал.
5. Профиль пользователя подтягивает ключ; кнопка копирования — в один клик.
6. Пользователь вставляет ключ в окно активации плагина.

Файл лицензии плагина:

```
macOS:   ~/Library/Application Support/AetherVocalStrip/license.aether
Windows: %APPDATA%\AetherVocalStrip\license.aether
```

Плагин перепроверяет подпись каждые 7 секунд, поэтому копирование файла
лицензии на другой компьютер не работает.

## Тест-вектор

Проверка на машине создателя:

```
Machine ID : <ваш HWID из плагина / AetherPreview --print-machine-id>
Key        : AETHER-… (первые и последние группы совпадают с ./aether-keygen)
```

Ключ детерминирован (Ed25519 без случайного nonce), поэтому подпись всегда
побайтово одинакова. Юнит-тест `keygen_matches_plugin_reference_key`
проверяет подпись реальным публичным ключом из
`public_key_reference.txt`.

## Ротация

Менять приватный ключ нельзя без выпуска новой версии плагина с новым публичным
ключом: старые ключи останутся валидными, но новые перестанут приниматься
старой сборкой. Храните резервную копию приватного ключа офлайн.

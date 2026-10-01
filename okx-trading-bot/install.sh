#!/usr/bin/env bash
# Установка и запуск OKX-бота на Ubuntu/Debian одной командой:
#   curl -fsSL https://raw.githubusercontent.com/NNnn11094554/bounty-/ccr-89fb83dc-nmy9lt/okx-trading-bot/install.sh -o install.sh && bash install.sh
# Повторный запуск обновляет код и перезапускает бота (.env и ваш config.yaml сохраняются).
set -euo pipefail
trap 'printf "\n\033[1;31mОшибка: команда в строке %s завершилась неудачно (см. сообщение выше)\033[0m\n" "$LINENO" >&2' ERR

REPO="${BOT_REPO:-https://github.com/NNnn11094554/bounty-.git}"
BRANCH="${BOT_BRANCH:-ccr-89fb83dc-nmy9lt}"
DIR="${BOT_DIR:-$HOME/okx-bot}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

command -v apt-get >/dev/null 2>&1 || die "скрипт рассчитан на Ubuntu/Debian (нужен apt-get)"
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || die "запустите от root или установите sudo"
  SUDO="sudo"
fi

# ввод с клавиатуры работает и при запуске через пайп
if ! { exec 3</dev/tty; } 2>/dev/null; then exec 3<&0; fi

say "Синхронизация времени (OKX отклоняет запросы при расхождении часов)"
$SUDO timedatectl set-ntp true 2>/dev/null || echo "timedatectl недоступен — проверьте время вручную"

if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  say "Установка git и curl"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq git curl ca-certificates
fi

if ! command -v docker >/dev/null 2>&1; then
  say "Установка Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
$SUDO systemctl enable --now docker >/dev/null 2>&1 || true
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="$SUDO docker"
$DOCKER compose version >/dev/null 2>&1 || die "не найден плагин docker compose"

say "Код бота → $DIR"
if [ -d "$DIR/.git" ]; then
  CFG="okx-trading-bot/config.yaml"
  BACKUP=""
  if ! git -C "$DIR" diff --quiet -- "$CFG"; then  # ваши настройки не мешают обновлению кода
    BACKUP="$(mktemp)"
    cp "$DIR/$CFG" "$BACKUP"
    git -C "$DIR" checkout -q -- "$CFG"
  fi
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  if ! git -C "$DIR" pull -q --ff-only origin "$BRANCH"; then
    [ -n "$BACKUP" ] && cp "$BACKUP" "$DIR/$CFG"
    die "не удалось обновить код: в $DIR есть изменённые файлы (git -C $DIR status)"
  fi
  if [ -n "$BACKUP" ]; then
    cp "$BACKUP" "$DIR/$CFG" && rm -f "$BACKUP"
    echo "Ваш config.yaml сохранён (новые параметры из обновления берутся по умолчанию)."
  fi
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/okx-trading-bot"
mkdir -p data logs reports
$SUDO chown -R 1000:1000 data logs reports  # в контейнере бот работает от uid 1000

ask() {  # ask VAR "вопрос" [secret]
  local __value
  if [ "${3:-}" = "secret" ]; then
    read -r -s -u 3 -p "$2" __value || true
    echo
  else
    read -r -u 3 -p "$2" __value || true
  fi
  case "$__value" in *"'"*) die "значение не должно содержать одинарную кавычку — впишите его в .env вручную" ;; esac
  printf -v "$1" '%s' "$__value"
}

if [ ! -f .env ]; then
  IP="$(curl -4 -fsS --max-time 10 https://ifconfig.me 2>/dev/null || echo 'не удалось определить')"
  say "Ключи (сохраняются только в $PWD/.env на этом сервере)"
  cat <<EOF
IP этого сервера: $IP — укажите его при создании API-ключа OKX.
Права ключа: Read + Trade, БЕЗ Withdraw.
Ключ для DEMO создаётся в демо-режиме OKX: Trade → Demo trading → профиль → Demo Trading API.
EOF
  ask OKX_KEY "OKX API key: "
  ask OKX_SECRET "OKX Secret key (ввод скрыт): " secret
  ask OKX_PASS "OKX Passphrase (ввод скрыт): " secret
  [ -n "$OKX_KEY" ] && [ -n "$OKX_SECRET" ] && [ -n "$OKX_PASS" ] || die "ключ, secret и passphrase OKX обязательны"
  ask TG_TOKEN "Telegram bot token от @BotFather (Enter — без Telegram): "
  TG_CHAT=""
  if [ -n "$TG_TOKEN" ]; then
    ask TG_CHAT "Ваш Telegram chat_id (узнать у @userinfobot): "
    case "$TG_CHAT" in ''|*[!0-9-]*) die "chat_id — это число, например 123456789" ;; esac
  fi
  (
    umask 077
    cat > .env <<EOF
OKX_API_KEY='$OKX_KEY'
OKX_API_SECRET='$OKX_SECRET'
OKX_API_PASSPHRASE='$OKX_PASS'
# DEMO. Реальная торговля — только LIVE_TRADING=true и ключ от реального счёта
LIVE_TRADING=false
TELEGRAM_BOT_TOKEN='$TG_TOKEN'
TELEGRAM_CHAT_ID=$TG_CHAT
EOF
  )
  echo "Сохранено в .env (права 600)."
else
  echo ".env уже есть — использую его (изменить: nano $PWD/.env)"
fi

say "Сборка образа"
$DOCKER compose build -q

say "Проверка ключей, связи с OKX, WebSocket и Telegram"
if ! $DOCKER compose run --rm bot check; then
  die "проверка не пройдена — см. строки с ❌ выше. Ключи меняются в $PWD/.env (nano), время — sudo timedatectl set-ntp true. Затем снова: bash install.sh"
fi

say "Запуск"
$DOCKER compose up -d
$DOCKER compose ps

cat <<EOF

Бот запущен и будет перезапускаться сам (в т.ч. после перезагрузки сервера).
Папка: $PWD
  Логи:        cd $PWD && $DOCKER compose logs -f
  Остановить:  cd $PWD && $DOCKER compose down
  Обновить:    bash install.sh
  Закрыть всё: cd $PWD && $DOCKER compose exec bot python -m bot closeall --yes
В Telegram: /status /stop /start /closeall /report
EOF

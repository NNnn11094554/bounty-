FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=UTC

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# непривилегированный пользователь; data/ и logs/ монтируются томами
RUN useradd --create-home --uid 1000 bot && mkdir -p /app/data /app/logs /app/reports && chown -R bot:bot /app
COPY --chown=bot:bot bot ./bot
COPY --chown=bot:bot config.yaml .
USER bot

# здоров, если торговый цикл обновлял heartbeat за последние 10 минут
HEALTHCHECK --interval=60s --timeout=10s --start-period=180s --retries=3 \
    CMD python -c "import sys,time; t=float(open('/app/data/heartbeat').read()); sys.exit(0 if time.time()-t<600 else 1)"

ENTRYPOINT ["python", "-m", "bot"]
CMD ["run"]

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["python", "server/main.py"]

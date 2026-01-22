FROM python:3.12-slim

WORKDIR /app

# Install deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code (this folder contains app/)
COPY . /app

# Cloud Run sets PORT; default to 8080 for local Docker runs
ENV PORT=8080

CMD ["sh", "-lc", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
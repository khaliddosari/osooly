# Osooly Namtheg sidecar (PRD 3.7). Deployed alongside the Workers app on
# Cloudflare Containers or a small Render service (decided in S10); in
# production it reaches D1 over the HTTP API, so the only state on this
# container is the per-run scratch disk.
FROM python:3.12-slim

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV DATA_DIR=/srv/storage
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

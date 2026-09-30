FROM public.ecr.aws/docker/library/python:3.12-slim
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN playwright install --with-deps chromium
COPY app.py /app/app.py
COPY config /app/config
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8102"]

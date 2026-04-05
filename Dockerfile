FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements_phase2.txt .
RUN pip install --no-cache-dir -r requirements_phase2.txt

# Copy required application files
COPY main.py .
COPY dataset.parquet .

# Expose port
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Используем официальный образ Python 3.12
FROM python:3.12-slim

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

# Копируем файлы зависимостей
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальные файлы проекта
COPY . .

# Указываем порт, который будет использоваться приложением
ARG PORT=5001
ENV PORT=$PORT
EXPOSE $PORT

# Запускаем Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:${PORT}", "wsgi:app", "--workers", "4", "--timeout", "120"]

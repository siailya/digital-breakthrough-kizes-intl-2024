.PHONY: build-service build-mlservice build-frontend build-all

# Сборка образа service
build-service:
	cd ./app/service && docker build -t siailyadev/sleepinsight-service:latest .

# Сборка образа mlservice
build-mlservice:
	cd ./mlservice && docker build -t siailyadev/sleepinsight-mlservice:latest .

# Сборка образа frontend
build-frontend:
	cd ./app/web && docker build -t siailyadev/sleepinsight-frontend:latest .

# Сборка всех образов
build-all: build-service build-mlservice build-frontend

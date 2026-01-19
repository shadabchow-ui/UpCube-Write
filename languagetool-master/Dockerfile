# ---- Build stage ----
FROM maven:3.9.6-eclipse-temurin-17 AS build

WORKDIR /build
COPY . .

# Install git, then create a real commit so git-commit-id plugin can resolve HEAD
RUN apt-get update \
 && apt-get install -y git \
 && rm -rf /var/lib/apt/lists/*

RUN git init \
 && git config user.email "ci@example.com" \
 && git config user.name "CI" \
 && git add -A \
 && git commit -m "ci" --allow-empty

RUN mvn -q -DskipTests package

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre

WORKDIR /app
COPY --from=build /build/languagetool-server/target/languagetool-server.jar /app/languagetool-server.jar

EXPOSE 8010

CMD ["java", "-jar", "/app/languagetool-server.jar"]

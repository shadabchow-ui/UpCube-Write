# ---- Build stage ----
FROM maven:3.9.6-eclipse-temurin-17 AS build

WORKDIR /build
COPY . .

# Minimal .git so git-commit-id plugin can read HEAD
RUN mkdir -p .git/refs/heads \
 && echo "ref: refs/heads/main" > .git/HEAD \
 && echo "0000000000000000000000000000000000000000" > .git/refs/heads/main

RUN mvn -q -DskipTests package

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre

WORKDIR /app
COPY --from=build /build/languagetool-server/target/languagetool-server.jar /app/languagetool-server.jar

EXPOSE 8010

CMD ["java", "-jar", "/app/languagetool-server.jar"]

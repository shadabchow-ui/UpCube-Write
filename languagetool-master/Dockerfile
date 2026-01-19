# ---- Build stage ----
FROM maven:3.9.6-eclipse-temurin-17 AS build

WORKDIR /build
COPY . .
RUN mvn -q -DskipTests package

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre

WORKDIR /app
COPY --from=build /build/languagetool-server/target/languagetool-server.jar /app/languagetool-server.jar

EXPOSE 8010

CMD ["java", "-jar", "/app/languagetool-server.jar"]


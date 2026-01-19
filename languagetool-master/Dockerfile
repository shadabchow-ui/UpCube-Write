# ---- Build stage ----
FROM maven:3.9.6-eclipse-temurin-17 AS build

WORKDIR /build
COPY . .

# git-commit-id plugin needs a real git repo
RUN apt-get update \
 && apt-get install -y git \
 && rm -rf /var/lib/apt/lists/*

RUN git init \
 && git config user.email "ci@example.com" \
 && git config user.name "CI" \
 && git add -A \
 && git commit -m "ci" --allow-empty

# Build LanguageTool
RUN mvn -q -DskipTests package

# Find an EXECUTABLE jar (one with Main-Class in MANIFEST)
RUN set -eux; \
  JAR=""; \
  for f in $(find languagetool-server -type f -path '*/target/*.jar' \
      ! -name '*-sources.jar' ! -name '*-javadoc.jar' ! -name '*-tests.jar'); do \
    if unzip -p "$f" META-INF/MANIFEST.MF 2>/dev/null | grep -qi '^Main-Class:'; then \
      JAR="$f"; break; \
    fi; \
  done; \
  echo "Executable jar: $JAR"; \
  test -n "$JAR"; \
  cp "$JAR" /build/languagetool-server.jar

# ---- Runtime stage ----
FROM eclipse-temurin:17-jre

WORKDIR /app
COPY --from=build /build/languagetool-server.jar /app/languagetool-server.jar

EXPOSE 8010

CMD ["java", "-jar", "/app/languagetool-server.jar", "--port", "8010", "--host", "0.0.0.0"]

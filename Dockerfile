FROM maven:3.9.6-eclipse-temurin-17

WORKDIR /app
COPY . .

# git-commit-id plugin needs a real git repo
RUN apt-get update \
 && apt-get install -y git \
 && rm -rf /var/lib/apt/lists/* \
 && git init \
 && git config user.email "ci@example.com" \
 && git config user.name "CI" \
 && git add -A \
 && git commit -m "ci" --allow-empty

# Build once so runtime start is fast
RUN mvn -q -DskipTests package

EXPOSE 8010

# Start LanguageTool server (bind to 0.0.0.0:8010)
CMD ["mvn", "-q", "-pl", "languagetool-server", "-am", "-DskipTests", "exec:java", "-Dexec.mainClass=org.languagetool.server.HTTPServer", "-Dexec.args=--port 8010 --host 0.0.0.0"]

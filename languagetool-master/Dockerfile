FROM eclipse-temurin:17-jre

WORKDIR /app

COPY . .

RUN mvn -q -DskipTests package

EXPOSE 8010

CMD ["java", "-jar", "languagetool-server/target/languagetool-server.jar"]


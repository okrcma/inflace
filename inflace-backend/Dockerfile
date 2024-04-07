FROM openjdk:21-jdk-slim

COPY build.gradle.kts gradlew settings.gradle.kts /inflace-backend/
COPY gradle /inflace-backend/gradle
COPY src /inflace-backend/src

WORKDIR /inflace-backend
RUN ./gradlew build

CMD ["java", "-jar", "/inflace-backend/build/libs/inflace-backend-1.0-SNAPSHOT.jar"]

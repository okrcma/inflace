group = "org.example"
version = "1.0-SNAPSHOT"

kotlin {
    jvmToolchain(20)
}

repositories {
    mavenCentral()
}

plugins {
    kotlin("jvm") version "1.9.21"
    kotlin("plugin.spring") version "1.9.21"
    id("org.springframework.boot") version "3.2.2"
    id("io.spring.dependency-management") version "1.1.0"
}

dependencies {
    testImplementation("org.jetbrains.kotlin:kotlin-test")
    implementation("org.jsoup:jsoup:1.17.1")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.5.0")
}

tasks.test {
    useJUnitPlatform()
}



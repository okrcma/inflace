package org.example.inflace.backend.api

import org.example.inflace.backend.Downloader
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class ApiController(private val downloader: Downloader) {
    @GetMapping("/data/cpi/ecoicop")
    fun getEcoicopCpiData(): EcoicopCpiDataSchema {
        // TODO persist the data so that users don't spam the scraped website
        return EcoicopCpiDataSchema.fromEcoicopCpiData( downloader.downloadEcoicopCpiData())
    }

    // TODO endpoints for other data calculated from the cpi, e.g. inflation over some period
}
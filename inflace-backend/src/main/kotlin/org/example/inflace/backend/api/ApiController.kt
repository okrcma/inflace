package org.example.inflace.backend.api

import org.example.inflace.backend.data.provider.DataProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.YearMonth

@RestController
class ApiController(private val dataProvider: DataProvider) {
    @GetMapping("/data/cpi")
    fun getCpiData(
        @RequestParam(required = false) from: YearMonth?,
        @RequestParam(required = false) to: YearMonth?,
    ): CpiDataSchema {
        return CpiDataSchema(
            from = from,
            to = to,
            data = dataProvider.getEcoicopCpi(from = from, to = to)
                .map { CpiDatapointSchema(yearMonth = it.yearMonth, value = it.value) }
        )
    }

    @GetMapping("/data/inflation-rate")
    fun getInflationRate(
        @RequestParam from: YearMonth,
        @RequestParam to: YearMonth,
    ): InflationRateValueSchema {
        return InflationRateValueSchema(
            from = from,
            to = to,
            value = dataProvider.getEcoicopInflationRate(from = from, to = to),
        )
    }
}

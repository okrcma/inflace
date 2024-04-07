package org.example.inflace.backend.data.provider

import org.example.inflace.backend.YearMonthSeries
import org.example.inflace.backend.data.source.CzsoClient
import org.springframework.stereotype.Service
import java.time.YearMonth

@Service
class DataProvider(private val czsoClient: CzsoClient) {
    fun getEcoicopCpi(from: YearMonth?, to: YearMonth?): YearMonthSeries<Float> {
        // TODO persist the data so that users don't spam the scraped website
        // TODO check that data for from and to are available
        val cpi = czsoClient.scrapeEcoicopCpiData()
            .filter { (if (from != null) from <= it.yearMonth else true) && (if (to != null) it.yearMonth <= to else true) }
            .sortedBy { it.yearMonth }
        return cpi
    }

    fun getEcoicopInflationRate(from: YearMonth, to: YearMonth): Float {
        // TODO check that data for from and to are available
        val cpi = this.getEcoicopCpi(from=from, to=to)
        val first = cpi.first().value
        val last = cpi.last().value
        return last / first
    }
}

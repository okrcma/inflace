package org.example.inflace.backend

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.time.format.DateTimeFormatter


typealias EcoicopCpiData = List<Pair<LocalDate, Float>>

@Service
class Downloader {
    companion object {
        const val ECOICOP_CPI_URL =
            "https://vdb.czso.cz/vdbvo2/faces/cs/index.jsf?page=vystup-objekt&z=T&f=TABULKA&ds=ds2329&pvo=C" +
                    "EN083A&skupId=2218&katalog=31779&o=false&evo=v2504_%21_CEN-SPO-BAZIC2015-EM_1&str=v514"
    }

    fun downloadEcoicopCpiData(): EcoicopCpiData {
        val document: Document = Jsoup.connect(ECOICOP_CPI_URL).get()
        return parseEcoicopCpiDocument(document)
    }

    private fun parseEcoicopCpiDocument(document: Document): EcoicopCpiData {
        val data: MutableList<Pair<LocalDate, Float>> = mutableListOf()

        val rows = document.select("#tabData>tbody>tr")
        for (row in rows) {
            val cols = row.select("td>span")
            if (cols.size != 14)
                throw Exception(
                    "There's ${cols.size} columns. Expected number of columns is 14. " +
                            "This indicates change in the table's structure."
                )

            val formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            val date = LocalDate.parse("01/" + cols[0].text(), formatter)
            val value = cols[1].text().replace(",", ".").toFloat()

            data.add(Pair(date, value))
        }

        return data
    }
}

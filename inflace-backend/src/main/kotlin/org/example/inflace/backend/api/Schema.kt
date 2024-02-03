package org.example.inflace.backend.api

import org.example.inflace.backend.EcoicopCpiData
import java.time.LocalDate

data class EcoicopCpiDataSchema(
    val data: List<EcoicopCpiDatapointSchema>
) {
    companion object {
        fun fromEcoicopCpiData(data: EcoicopCpiData): EcoicopCpiDataSchema {
            return EcoicopCpiDataSchema(data.map { EcoicopCpiDatapointSchema(date = it.first, value = it.second) })
        }
    }
}

data class EcoicopCpiDatapointSchema(
    val date: LocalDate, val value: Float
)

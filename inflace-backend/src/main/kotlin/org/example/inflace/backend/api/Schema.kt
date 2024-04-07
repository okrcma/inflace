package org.example.inflace.backend.api

import java.time.YearMonth

data class CpiDataSchema(
    val from: YearMonth?,
    val to: YearMonth?,
    val data: List<CpiDatapointSchema>
)

data class CpiDatapointSchema(
    val yearMonth: YearMonth, val value: Float
)

data class InflationRateValueSchema(
    val from: YearMonth,
    val to: YearMonth,
    val value: Float,
)

package org.example.inflace.backend

import java.time.YearMonth

typealias YearMonthSeries<T> = List<YearMonthValue<T>>

data class YearMonthValue<T>(val yearMonth: YearMonth, val value: T)

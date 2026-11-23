import { asDate, dayOf, shiftDay } from './dates'
import type { Task } from './model'

export function nearTasks(tasks: Task[], day: string) {
  return tasks
    .filter((t) => !t.done && t.date <= shiftDay(day, 7))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'pt-BR'),
    )
}
export function monthDays(month: string) {
  const first = asDate(month + '-01')
  const last = new Date(first)
  last.setMonth(first.getMonth() + 1, 0)
  return [
    ...Array<string | null>(first.getDay()).fill(null),
    ...Array.from(
      { length: last.getDate() },
      (_, i) => month + '-' + String(i + 1).padStart(2, '0'),
    ),
  ]
}
export function moveMonth(month: string, step: number) {
  const date = asDate(month + '-01')
  date.setMonth(date.getMonth() + step)
  return date.getFullYear() < 1 || date.getFullYear() > 9999
    ? month
    : dayOf(date).slice(0, 7)
}

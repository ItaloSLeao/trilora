export function dayOf(value: number | Date = Date.now()) {
  const date = new Date(value)
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
export function asDate(day: string) {
  return new Date(day + 'T12:00:00')
}
export function shiftDay(day: string, count: number) {
  const date = asDate(day)
  date.setDate(date.getDate() + count)
  if (date.getFullYear() > 9999) return '9999-12-31'
  if (date.getFullYear() < 1) return '0001-01-01'
  return dayOf(date)
}
export function dateLabel(
  day: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  return asDate(day).toLocaleDateString('pt-BR', options)
}
export function duration(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

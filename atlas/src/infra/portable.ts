import { requireRule, type Atlas } from '../domain/model'
import { migrateLegacy } from './legacy'
import { verified } from './repository'

export function encode(data: Atlas) {
  return JSON.stringify(
    { format: 'trilora-atlas', version: 1, data: verified(data) },
    null,
    2,
  )
}
export function decode(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('O arquivo contém JSON corrompido.')
  }
  requireRule(
    typeof parsed === 'object' && parsed !== null,
    'Arquivo incompatível.',
  )
  if (!('format' in parsed)) return migrateLegacy(raw)
  requireRule(
    parsed.format === 'trilora-atlas' &&
      'version' in parsed &&
      parsed.version === 1,
    'Versão ou formato de arquivo incompatível.',
  )
  requireRule('data' in parsed, 'Arquivo sem dados.')
  return verified(parsed.data)
}
export function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

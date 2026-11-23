import Dexie, { type Table } from 'dexie'
import { blank, requireRule, type Atlas } from '../domain/model'
import { validate } from '../domain/integrity'
import { migrateLegacy } from './legacy'

export interface Snapshot { revision: number; data: Atlas }
interface Row extends Snapshot { key: 'current' | 'backup' }

export function verified(value: unknown) {
  const data = validate(value)
  if (data.legacySource !== null) migrateLegacy(data.legacySource)
  return data
}
function snapshot(row: Row | undefined): Snapshot {
  if (row === undefined) return { revision: 0, data: blank() }
  requireRule(Number.isSafeInteger(row.revision) && row.revision > 0, 'Registro local corrompido. Preserve o banco para recuperação.')
  return { revision: row.revision, data: verified(row.data) }
}
export class AtlasRepository extends Dexie {
  private records!: Table<Row, string>
  constructor(name = 'trilora-atlas') {
    super(name)
    this.version(1).stores({ records: 'key' })
  }
  async load() { return snapshot(await this.records.get('current')) }
  async backup() {
    const row = await this.records.get('backup')
    requireRule(row, 'Ainda não há cópia anterior à importação.')
    return snapshot(row).data
  }
  async write(expected: number, change: (data: Atlas) => Atlas, backup = false): Promise<Snapshot> {
    return this.transaction('rw', this.records, async () => {
      const current = snapshot(await this.records.get('current'))
      requireRule(current.revision === expected, 'Outra aba alterou os dados. Recarregue antes de continuar.')
      const data = verified(change(current.data))
      if (backup && current.revision) await this.records.put({ ...current, key: 'backup' })
      const next = { data, revision: current.revision + 1 }
      await this.records.put({ ...next, key: 'current' })
      return next
    })
  }
}
export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === 'VersionError') return 'Versão do banco incompatível. Abra com a versão correspondente do Atlas.'
    if (['QuotaExceededError', 'SecurityError', 'InvalidStateError', 'OpenFailedError', 'MissingAPIError', 'DatabaseClosedError', 'UnknownError', 'AbortError'].includes(error.name)) return 'Armazenamento indisponível. Verifique espaço e permissões e tente novamente.'
    return error.message
  }
  return 'Não foi possível concluir a operação.'
}

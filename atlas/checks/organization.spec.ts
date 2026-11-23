import { expect, it } from 'vitest'
import { draftFor, removeSubject, storeEntity } from '../src/domain/catalog'
import { blank } from '../src/domain/model'
import { validate } from '../src/domain/integrity'
import { monthDays, moveMonth, nearTasks } from '../src/domain/agenda'
import { shiftDay } from '../src/domain/dates'

it('preserva IDs ao editar e bloqueia disciplina em uso, pré-requisito circular e vínculos cruzados', () => {
  const d = blank()
  const f = draftFor(d,'subjects')
  const s = storeEntity(d,'subjects','s',{ ...f,name:'Química' })
  const c = storeEntity(s,'concepts','c',{ ...f,subject:'s',name:'Átomos',unit:'Matéria' })
  expect(validate(c).concepts).toHaveLength(1)
  expect(() => removeSubject(c,'s')).toThrow(/vínculos/)
  expect(() => validate(storeEntity(c,'concepts','c',{ ...draftFor(c,'concepts','c'),prerequisite:'c' }))).toThrow(/ciclo/)
  expect(() => validate(storeEntity(c,'tasks','t',{ ...f,name:'Prática',subject:'s',goal:'g' }))).toThrow(/objetivo/)
  expect(validate(storeEntity(c,'subjects','s',{ ...f,name:'Física' })).concepts[0]?.subject).toBe('s')
})
it('respeita dias civis, virada do mês, anos baixos e anos bissextos', () => {
  expect(monthDays('2024-02').at(-1)).toBe('2024-02-29')
  expect(moveMonth('0099-12',1)).toBe('0100-01')
  expect(moveMonth('0001-01',-1)).toBe('0001-01')
  expect(shiftDay('2024-03-09',2)).toBe('2024-03-11')
  const t = { id:'t',subject:'s',goal:null,name:'Prática',date:'2024-03-11',priority:'Alta' as const,done:false }
  expect(nearTasks([t,{ ...t,done:true },{ ...t,date:'2024-03-12' }],'2024-03-04')).toEqual([t])
})

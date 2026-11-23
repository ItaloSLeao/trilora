import { expect, it } from 'vitest'
import { blank } from '../src/domain/model'
import { asDate, dayOf } from '../src/domain/dates'
import { dueCards, finishStudy, measured, rate, startStudy, updateActive } from '../src/domain/practice'
import { validate } from '../src/domain/integrity'

export function fixture() {
  return validate({ ...blank(), subjects:[{id:'s',name:'Biologia',color:'#336644'}],
    goals:[{id:'g',subject:'s',name:'Explicar mitose',done:false}], activities:[{id:'a',goal:'g',name:'Desenhar as fases'}],
    decks:[{id:'d',subject:'s',name:'Células',description:''}],cards:[{id:'c',deck:'d',concept:null,question:'Qual a fase?',answer:'Prófase'}] })
}
it('exige revelação, evita tentativa duplicada, aplica progressão, teto e reinício', () => {
  let d = fixture()
  let at = asDate('2024-02-28').getTime()
  expect(() => rate(d,'c','r',false,true,at)).toThrow(/Revele/)
  expect(dueCards(d,dayOf(at))).toHaveLength(1)
  d = rate(d,'c','r',true,true,at)
  expect(d.reviews[0]?.due).toBe('2024-03-01')
  expect(rate(d,'c','r',true,true,at)).toBe(d)
  expect(() => rate(d,'c','early',true,true,at)).toThrow(/venceu/)
  expect(dueCards(d,'2024-02-29')).toHaveLength(0)
  for (const [round,stage] of [2,3,4,4,0].entries()) {
    at = asDate(d.reviews.at(-1)!.due).getTime()
    d = rate(d,'c','next'+round,true,stage > 0,at)
    expect(d.reviews.at(-1)?.stage).toBe(stage)
  }
  expect(validate(d).reviews).toHaveLength(6)
})
it('exclui pausas e lacunas, retoma checkpoint e encerra uma única vez', () => {
  const plan = { id:'session',subject:'s',goal:'g',activity:'a',timed:true }
  let d = startStudy(fixture(),plan,1000)
  expect(() => startStudy(d,plan,2000)).toThrow(/existe/)
  d = updateActive(d,plan.id,measured({start:20,base:0},1250.8))
  const recovered = validate(JSON.parse(JSON.stringify(d)))
  const resumed = { start:9000,base:recovered.active!.elapsedMs }
  d = updateActive(recovered,plan.id,measured(resumed,10010.5),'reflect')
  const reflection = { achieved:'Desenhei a mitose',difficulty:'',revisit:'',adjustment:'' }
  d = validate(finishStudy(d,plan.id,reflection,22000))
  expect(d.sessions[0]?.elapsedMs).toBe(2240)
  expect(d.active).toBeNull()
  expect(d.reflections[0]?.session).toBe(plan.id)
  expect(finishStudy(d,plan.id,reflection,23000)).toBe(d)
})
it('permite prática sem cronômetro e rejeita tempo atribuído indevidamente', () => {
  const d = startStudy(fixture(),{id:'sess',subject:'s',goal:'g',activity:'a',timed:false},800)
  expect(validate(d).active?.timed).toBe(false)
  expect(() => validate(updateActive(d,'sess',30))).toThrow(/sem cronômetro/)
})

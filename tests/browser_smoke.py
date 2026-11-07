"""Testa o Trilora em Chromium com HTTP e perfil descartáveis."""

import argparse
import http.server
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {
    "/index.html": ("index.html", "text/html"),
    "/js/app.js": ("js/app.js", "text/javascript"),
    "/js/data.js": ("js/data.js", "text/javascript"),
    "/js/flashcards.js": ("js/flashcards.js", "text/javascript"),
    "/js/flashcards-view.js": ("js/flashcards-view.js", "text/javascript"),
    "/css/style.css": ("css/style.css", "text/css"),
    "/css/improvements.css": ("css/improvements.css", "text/css"),
    "/css/flashcards.css": ("css/flashcards.css", "text/css"),
}
HTML = r"""<!doctype html><meta charset="utf-8"><pre id="result">PENDING</pre>
<script type="module">
const result = document.querySelector('#result');
const key = 'trilora-v1';
const checks = [];
const check = (label, condition) => {
  if (!condition) throw Error(label);
  checks.push(label);
};
const initial = await fetch('/index.html').then(r => r.text());
const data = () => JSON.parse(localStorage.getItem(key));
const fixture = {
  subjects: [{id:'Todas', name:'Lógica', color:'#7363dc'}, {id:'s2', name:'Física', color:'#51b7a2'}, {id:'s3', name:'Química', color:'#654321'}],
  tasks: [
    {id:'t1', title:'Lista de lógica', subject:'Todas', date:'2026-11-08', priority:'Alta', done:false},
    {id:'t2', title:'Prova de física', subject:'s2', date:'2026-11-09', priority:'Média', done:true},
    {id:'t3', title:'Prazo de outubro', subject:'s2', date:'2026-10-31', priority:'Baixa', done:false},
  ],
  extra: { legacy: true },
};
let frame, d, w;
const q = (selector) => d.querySelector(selector);
const click = (selector) => q(selector).click();
const nav = (page) => click('[data-page="' + page + '"]');
const change = (selector, value) => {
  const field = q(selector);
  field.value = value;
  field.dispatchEvent(new w.Event('change', {bubbles:true}));
};
const fill = (form, values) => {
  for (const [name, value] of Object.entries(values)) form.elements.namedItem(name).value = value;
};
const mount = async ({width=1200, mode='normal'} = {}) => {
  frame?.remove();
  frame = document.createElement('iframe');
  frame.style.cssText = 'width:' + width + 'px;height:900px;border:0';
  const injected = "window.alerts=[];window.alert=m=>alerts.push(m);window.confirm=()=>true;"
    + "const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[2026,10,7,12]));}};"
    + (mode==='denied' ? "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});" : "");
  frame.srcdoc = initial.replace('<head>', '<head><base href="/"><script>' + injected + '<' + '/script>');
  await new Promise(resolve => {
    frame.addEventListener('load', resolve, {once:true});
    document.body.append(frame);
  });
  w = frame.contentWindow;
  d = frame.contentDocument;
};
try {
  await mount();
  check('chave ausente apresenta demonstração sem gravação', q('#page').textContent.includes('Engenharia de Software') && localStorage.getItem(key) === null);
  localStorage.setItem(key, JSON.stringify(fixture));
  await mount();
  nav('tasks');
  change('#subjectFilter', 'Todas');
  check('ID Todas seleciona só a disciplina correspondente', !!q('[data-toggle=t1]') && !q('[data-toggle=t2]'));
  change('#subjectFilter', '');
  const search = q('#searchTasks');
  search.focus();
  search.value = 'FÍSICA';
  search.dispatchEvent(new w.Event('input',{bubbles:true}));
  check('pesquisa preserva foco e filtra pelo título', d.activeElement === search && !!q('[data-toggle=t2]') && !q('[data-toggle=t1]'));
  search.value = '';
  search.dispatchEvent(new w.Event('input',{bubbles:true}));
  change('#subjectFilter', 's3');
  nav('subjects');
  click('[data-delete-subject=s3]');
  nav('tasks');
  check('exclusão limpa o filtro e preserva tarefas de outras disciplinas', q('#subjectFilter').value === '' && !!q('[data-toggle=t1]') && data().tasks.length === 3);
  nav('subjects');
  click('[data-add-subject]');
  const subjectForm = q('#subjectForm');
  fill(subjectForm,{name:'Biologia QA',color:'#123456'});
  subjectForm.requestSubmit();
  check('cadastro de disciplina preserva vínculos', data().subjects.some(s=>s.name==='Biologia QA') && data().tasks.length===3);
  nav('tasks');
  click('[data-add-task]');
  const form = q('#taskForm');
  check('modal foca o título e formulário vazio é inválido', d.activeElement === form.elements.title && !form.checkValidity());
  const values = {title:'Atividade QA', subject:'Todas', date:'2026-11-10', priority:'Alta'};
  fill(form, values);
  const before = localStorage.getItem(key);
  const write = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => { throw new w.DOMException('Quota','QuotaExceededError'); };
  form.requestSubmit();
  check('falha de gravação preserva os valores reais e o armazenamento', q('#taskForm') === form && Object.entries(values).every(([k,v])=>form.elements.namedItem(k).value===v) && localStorage.getItem(key)===before && q('.notice').textContent.includes('não salva'));
  w.Storage.prototype.setItem = write;
  form.requestSubmit();
  const id = data().tasks.find(t=>t.title==='Atividade QA').id;
  check('nova tentativa grava e fecha o formulário', !q('#taskForm') && data().tasks.length===4);
  click('[data-edit-task="'+id+'"]');
  const edit = q('#taskForm');
  fill(edit,{title:'Atividade revisada'});
  edit.requestSubmit();
  check('editar preserva os demais registros', data().tasks.find(t=>t.id===id).title==='Atividade revisada' && JSON.stringify(data().tasks.slice(0,3))===JSON.stringify(fixture.tasks));
  click('[data-toggle="'+id+'"]');
  check('concluir tarefa persiste', data().tasks.find(t=>t.id===id).done===true);
  click('[data-toggle="'+id+'"]');
  check('reabrir tarefa persiste', data().tasks.find(t=>t.id===id).done===false);
  await mount();
  nav('tasks');
  check('recarregar preserva tarefa e metadados legados', !!q('[data-toggle="'+id+'"]') && data().extra.legacy===true);
  click('[data-delete-task="'+id+'"]');
  check('exclusão individual preserva as demais tarefas', JSON.stringify(data().tasks)===JSON.stringify(fixture.tasks));
  nav('calendar');
  check('calendário exibe o mês atual sem prazos em células vazias', q('.calendar').textContent.includes('Lista de lógica') && !q('.calendar').textContent.includes('Prazo de outubro'));
  click('[data-month="-1"]');
  check('mês anterior exibe seu próprio prazo', q('.calendar').textContent.includes('Prazo de outubro'));
  for (const width of [375, 768]) {
    await mount({width});
    for (const page of ['dashboard','tasks','subjects','calendar']) {
      nav(page);
      check('layout '+width+'px '+page+' sem rolagem horizontal', d.documentElement.scrollWidth<=width);
    }
  }
  const saved = localStorage.getItem(key);
  localStorage.setItem(key,'{recuperável');
  await mount();
  click('[data-add-task]');
  check('JSON inválido mantém o valor original e bloqueia formulário', !q('#taskForm') && q('.notice').textContent.includes('corrompidos') && localStorage.getItem(key)==='{recuperável');
  localStorage.setItem(key,saved);
  await mount({mode:'denied'});
  check('acesso bloqueado é distinguido de chave ausente', q('.notice').textContent.includes('Não foi possível ler') && localStorage.getItem(key)===saved);
  await mount();
  localStorage.setItem(key,JSON.stringify({...data(),extra:{other:true}}));
  click('[data-add-subject]');
  fill(q('#subjectForm'),{name:'Conflito QA',color:'#123456'});
  q('#subjectForm').requestSubmit();
  check('gravação obsoleta preserva atualização externa', q('.notice').textContent.includes('outra aba') && data().extra.other===true && !data().subjects.some(s=>s.name==='Conflito QA'));

  localStorage.setItem(key, JSON.stringify({ subjects: [], tasks: [] }));
  await mount();
  nav('flashcards');
  check('flashcards sem disciplinas encaminham ao cadastro', !!q('[data-go=subjects]') && !q('[data-flash-action=new-deck]'));
  localStorage.setItem(key, JSON.stringify(fixture));
  await mount();
  nav('flashcards');
  const flash = (action, id) => click('[data-flash-action="'+action+'"]' + (id ? '[data-flash-id="'+id+'"]' : ''));
  const dialogForm = () => q('dialog[open] form');
  const saveFlash = values => {
    const form = dialogForm();
    fill(form, values);
    form.requestSubmit();
  };
  flash('new-deck');
  check('diálogo de baralho foca o nome e exige preenchimento', d.activeElement === dialogForm().elements.name && !dialogForm().checkValidity());
  const legacyRaw = localStorage.getItem(key);
  const storageWrite = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => { throw new w.DOMException('Quota','QuotaExceededError'); };
  saveFlash({ name: 'Álgebra QA', subject: 'Todas', description: '' });
  check('falha ao criar baralho mantém diálogo, valores e dados legados', dialogForm().elements.name.value === 'Álgebra QA' && localStorage.getItem(key) === legacyRaw);
  w.Storage.prototype.setItem = storageWrite;
  dialogForm().requestSubmit();
  const deckId = data().flashcards.decks[0].id;
  check('baralho aberto após salvar e associado à disciplina', !dialogForm() && q('[data-flash-heading]').textContent === 'Álgebra QA' && data().flashcards.decks[0].subject === 'Todas');
  flash('new-card');
  const question = 'Compare <a> e <b>';
  const answer = 'Primeira linha\nSegunda linha';
  saveFlash({ question, answer });
  const cardId = data().flashcards.cards[0].id;
  check('cartão mantém texto literal e exibe a quantidade', q('.flash-cards').textContent.includes(question) && q('.flash-cards').textContent.includes(answer) && q('.flash-item').textContent.includes('1 cartão'));
  flash('edit-card', cardId);
  check('edição preenche os campos do cartão', dialogForm().elements.question.value === question && dialogForm().elements.answer.value === answer);
  saveFlash({ question: 'Pergunta revisada', answer: 'Resposta revisada' });
  flash('edit-deck', deckId);
  saveFlash({ name: 'Revisão QA', subject: 's3', description: 'Mudança de disciplina' });
  check('edição altera textos e disciplina sem romper vínculo do cartão', data().flashcards.decks[0].id === deckId && data().flashcards.decks[0].subject === 's3' && data().flashcards.cards[0].deck === deckId && data().flashcards.cards[0].answer === 'Resposta revisada');
  nav('subjects');
  click('[data-delete-subject=s3]');
  check('disciplina com baralho é protegida contra exclusão', data().subjects.some(s => s.id === 's3') && w.alerts.at(-1).includes('baralhos'));
  for (const width of [320, 375, 768, 1200]) {
    await mount({width});
    nav('flashcards');
    check('lista de baralhos responsiva a '+width+'px', d.documentElement.scrollWidth <= width && !!q('[data-flash-id="'+deckId+'"]'));
    flash('open', deckId);
    flash('edit-card', cardId);
    const rect = q('dialog[open]').getBoundingClientRect();
    check('cartão e diálogo responsivos a '+width+'px', d.documentElement.scrollWidth <= width && rect.left >= 0 && rect.right <= width && dialogForm().elements.answer.value === 'Resposta revisada');
    click('[data-flash-cancel]');
    check('cancelar fecha o diálogo a '+width+'px', !dialogForm());
  }
  flash('new-card');
  saveFlash({ question: 'Outro cartão', answer: 'Outro texto' });
  const rawWithCards = localStorage.getItem(key);
  w.confirm = () => false;
  flash('delete-deck', deckId);
  flash('delete-card', cardId);
  check('cancelar exclusões preserva os dados', localStorage.getItem(key) === rawWithCards);
  w.confirm = () => true;
  flash('delete-card', cardId);
  check('exclusão de cartão preserva o outro cartão', data().flashcards.cards.length === 1 && data().flashcards.cards[0].question === 'Outro cartão');
  flash('back');
  flash('new-deck');
  saveFlash({ name: 'Baralho preservado', subject: 's2' });
  flash('back');
  flash('open', deckId);
  flash('delete-deck', deckId);
  check('exclusão de baralho remove seus cartões e preserva demais dados', data().flashcards.cards.length === 0 && data().flashcards.decks.length === 1 && data().flashcards.decks[0].name === 'Baralho preservado' && JSON.stringify(data().tasks) === JSON.stringify(fixture.tasks));
  result.textContent='PASS ' + checks.length + ' | ' + checks.join(' | ');
} catch (error) {
  result.textContent='FAIL ' + error.message + ' | ' + checks.join(' | ');
}
</script>"""

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/qa":
            payload = HTML.encode("utf-8")
            mime = "text/html"
        elif self.path in ALLOWED:
            filename, mime = ALLOWED[self.path]
            payload = (ROOT / filename).read_bytes()
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass

parser = argparse.ArgumentParser()
parser.add_argument("browser")
args = parser.parse_args()
with http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    temp = Path(tempfile.gettempdir()).resolve()
    profile = Path(tempfile.mkdtemp(prefix="trilora-browser-qa-", dir=temp)).resolve()
    try:
        proc = subprocess.run(
            [args.browser, "--headless", "--disable-background-networking", "--no-first-run",
             f"--user-data-dir={profile}", "--virtual-time-budget=12000", "--dump-dom",
             f"http://127.0.0.1:{server.server_port}/qa"],
            capture_output=True, timeout=45,
        )
        dom = proc.stdout.decode("utf-8", "replace")
        match = re.search(r'<pre id="result">([^<]+)</pre>', dom)
        if proc.returncode != 0 or not match or not match[1].startswith("PASS"):
            print(match[1] if match else proc.stderr.decode("utf-8", "replace")[-2500:])
            raise SystemExit(1)
        print(match[1])
    finally:
        if profile.parent == temp and profile.name.startswith("trilora-browser-qa-"):
            shutil.rmtree(profile, ignore_errors=True)

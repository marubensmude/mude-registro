/* Mude Registro · área administrativa */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { brl, dec, pct, num, esc, lim, rotuloFaixa, dataHoraBR } = MR;

  const LS_TOKEN = 'mudeRegistro_gh';
  const LS_RASCUNHO = 'mudeRegistro_rascunho';
  const LS_PREVIA = 'mudeRegistro_previa';

  let PUBLICADO = null;  // dados como estão publicados
  let W = null;          // cópia de trabalho
  let SENHA = null;      // mantida só em memória durante a sessão
  let ORIGEM = '';

  const clone = o => JSON.parse(JSON.stringify(o));
  let tToast;
  function toast(msg, erro, tempo) {
    const t = $('toast'); t.textContent = msg; t.classList.toggle('erro', !!erro); t.classList.add('ver');
    clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove('ver'), tempo || 3000);
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

  /* ================= criptografia ================= */
  const enc = new TextEncoder();
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const deHex = h => new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16)));
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
  const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function pbkdf2Bits(senha, saltHex, iter) {
    const k = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: deHex(saltHex), iterations: iter, hash: 'SHA-256' }, k, 256);
  }
  async function hashSenha(senha, saltHex, iter) { return hex(await pbkdf2Bits(senha, saltHex, iter)); }
  async function chaveAES(senha, saltHex) {
    const k = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: deHex(saltHex), iterations: 150000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function cifrarToken(token, senha) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveAES(senha, salt), enc.encode(token));
    return JSON.stringify({ salt, iv: b64(iv), ct: b64(ct) });
  }
  async function decifrarToken(senha) {
    const raw = lsGet(LS_TOKEN); if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(o.iv) }, await chaveAES(senha, o.salt), deB64(o.ct));
      return new TextDecoder().decode(pt);
    } catch (e) { return null; }
  }

  /* ================= login ================= */
  async function entrar(ev) {
    ev.preventDefault();
    const senha = $('senha').value;
    $('btEntrar').disabled = true; $('btEntrar').textContent = 'Verificando…'; $('erroLogin').textContent = '';
    try {
      const a = PUBLICADO.admin || {};
      const h = await hashSenha(senha, a.salt, a.iter || 150000);
      if (h !== a.hash) { $('erroLogin').textContent = 'Senha incorreta.'; $('senha').select(); return; }
      SENHA = senha;
      abrirPainel();
    } catch (e) {
      $('erroLogin').textContent = 'Este navegador não permite a verificação segura. Use o endereço https do sistema.';
    } finally { $('btEntrar').disabled = false; $('btEntrar').textContent = 'Entrar'; }
  }

  async function abrirPainel() {
    $('telaLogin').hidden = true; $('telaAdm').hidden = false;
    W = clone(PUBLICADO);
    const r = lsGet(LS_RASCUNHO);
    if (r) {
      try {
        const o = JSON.parse(r);
        if (o.base === PUBLICADO.atualizadoEm && confirm('Existe um rascunho não publicado, salvo em ' + dataHoraBR(o.quando) + '. Deseja retomá-lo?')) W = o.dados;
        else lsDel(LS_RASCUNHO);
      } catch (e) { lsDel(LS_RASCUNHO); }
    }
    preencher();
    atualizarInfo();
    const tk = await decifrarToken(SENHA);
    $('tokenStatus').textContent = tk ? 'Token salvo neste navegador (termina em …' + tk.slice(-4) + ').' : (lsGet(LS_TOKEN) ? 'Existe um token salvo, mas ele foi cifrado com outra senha. Cadastre novamente.' : 'Nenhum token salvo neste navegador.');
  }

  function atualizarInfo() {
    $('admInfo').innerHTML = 'Dados publicados em <b>' + dataHoraBR(PUBLICADO.atualizadoEm) + '</b>' +
      (PUBLICADO.atualizadoPor ? ' por ' + esc(PUBLICADO.atualizadoPor) : '') + ' · versão ' + (PUBLICADO.versao || 1) +
      (ORIGEM !== 'online' ? ' · <span style="color:var(--dourado)">arquivo publicado indisponível, exibindo os dados de reserva</span>' : '');
    const mudou = JSON.stringify(W) !== JSON.stringify(PUBLICADO);
    $('pendente').hidden = !mudou;
  }

  /* ================= edição ================= */
  const getK = (o, k) => k.split('.').reduce((a, p) => a == null ? a : a[p], o);
  const setK = (o, k, v) => { const ps = k.split('.'); const u = ps.pop(); ps.reduce((a, p) => a[p] = a[p] || {}, o)[u] = v; };

  function alterou() {
    lsSet(LS_RASCUNHO, JSON.stringify({ base: PUBLICADO.atualizadoEm, quando: Date.now(), dados: W }));
    atualizarInfo();
  }

  function preencher() {
    document.querySelectorAll('[data-k]').forEach(el => {
      const v = getK(W, el.dataset.k);
      el.value = el.dataset.t === 'num' ? (v === undefined || v === null ? '' : dec(v, 0, 4)) : (v ?? '');
    });
    document.querySelectorAll('.editor-tab').forEach(montarEditorTabela);
    montarListas();
    $('fatorAtual').textContent = dec(MR.fatorRegistro(W), 2, 4);
  }

  function ligarCampos() {
    document.querySelectorAll('[data-k]').forEach(el => {
      el.addEventListener('change', () => {
        setK(W, el.dataset.k, el.dataset.t === 'num' ? num(el.value) : el.value);
        if (el.dataset.t === 'num') el.value = dec(getK(W, el.dataset.k), 0, 4);
        alterou();
      });
    });
  }

  /* ---------- listas ---------- */
  function montarLista(cont, arr, grade, campos, novo) {
    const el = $(cont);
    el.innerHTML = arr.map((it, i) => `<div class="item-lista ${grade}" data-i="${i}">` + campos.map(c => {
      if (c.t === 'chk') return `<label class="chk"><input type="checkbox" data-c="${c.k}" ${it[c.k] ? 'checked' : ''}>${c.r}</label>`;
      const v = c.t === 'num' ? dec(it[c.k] || 0, 0, 2) : esc(it[c.k] || '');
      return `<div class="campo"><label>${c.r}</label><input type="text" data-c="${c.k}" ${c.t === 'num' ? 'inputmode="decimal" data-t="num"' : ''} value="${v}"></div>`;
    }).join('') + `<button class="remover" title="Remover">Remover</button></div>`).join('') || '<p class="nota">Nenhum item cadastrado.</p>';
    el.querySelectorAll('.item-lista').forEach(row => {
      const i = +row.dataset.i;
      row.querySelectorAll('[data-c]').forEach(inp => inp.addEventListener('change', () => {
        const c = inp.dataset.c;
        arr[i][c] = inp.type === 'checkbox' ? inp.checked : inp.dataset.t === 'num' ? num(inp.value) : inp.value.trim();
        if (inp.dataset.t === 'num') inp.value = dec(arr[i][c], 0, 2);
        if (cont === 'lstAcrescimos') $('fatorAtual').textContent = dec(MR.fatorRegistro(W), 2, 4);
        alterou();
      }));
      row.querySelector('.remover').onclick = () => { if (confirm('Remover este item?')) { arr.splice(i, 1); montarListas(); alterou(); } };
    });
  }
  const idNovo = p => p + '_' + Date.now().toString(36);
  function montarListas() {
    W.registro.acrescimos = W.registro.acrescimos || []; W.reducoes = W.reducoes || []; W.extras = W.extras || []; W.corretores = W.corretores || [];
    montarLista('lstAcrescimos', W.registro.acrescimos, 'g-acr', [{ k: 'nome', r: 'Nome' }, { k: 'pct', r: 'Percentual (%)', t: 'num' }]);
    montarLista('lstReducoes', W.reducoes, 'g-red', [{ k: 'nome', r: 'Enquadramento' }, { k: 'pct', r: 'Redução (%)', t: 'num' }, { k: 'dispensaCertidao', r: 'Inclui certidão', t: 'chk' }]);
    montarLista('lstExtras', W.extras, 'g-ext', [{ k: 'nome', r: 'Nome do custo' }, { k: 'valor', r: 'Valor (R$)', t: 'num' }, { k: 'descricao', r: 'Descrição curta' }, { k: 'padrao', r: 'Marcado', t: 'chk' }]);
    montarLista('lstCorretores', W.corretores, 'g-cor', [{ k: 'nome', r: 'Nome' }, { k: 'creci', r: 'CRECI' }, { k: 'telefone', r: 'Telefone' }]);
    $('fatorAtual').textContent = dec(MR.fatorRegistro(W), 2, 4);
  }

  /* ---------- editor de tabelas por faixa ---------- */
  function validarTabela(tab) {
    const erros = [];
    tab.forEach((f, i) => {
      const l = lim(f);
      if (!(Number(f[1]) > 0)) erros.push(i);
      else if (i < tab.length - 1 && l === Infinity) erros.push(i);
      else if (i > 0 && l <= lim(tab[i - 1])) erros.push(i);
    });
    return erros;
  }
  function montarEditorTabela(box) {
    const k = box.dataset.tab;
    const tab = getK(W, k);
    const regEmol = k.startsWith('registro');
    const erros = validarTabela(tab);
    box.innerHTML = `
      <div class="et-ferr">
        <span class="nota" style="margin:0">${tab.length} faixas · deixe o limite da última faixa em branco (sem teto).</span>
        <span style="flex:1"></span>
        <div class="et-reaj"><input type="text" inputmode="decimal" placeholder="% reajuste" class="reaj"><button class="discreto mini bt-reaj">Aplicar reajuste</button></div>
        <button class="discreto mini bt-add">Adicionar faixa</button>
        <button class="discreto mini bt-colar">Colar da planilha</button>
      </div>
      <div class="et-tab"><table><thead><tr><th>Faixa</th><th>Limite superior (R$)</th><th>${regEmol ? 'Emolumentos (R$)' : 'Valor (R$)'}</th>${regEmol ? '<th>Total com taxas</th>' : ''}<th></th></tr></thead><tbody>
      ${tab.map((f, i) => `<tr data-i="${i}" class="${erros.includes(i) ? 'erro' : ''}">
        <td class="faixa">${rotuloFaixa(tab, i)}</td>
        <td><input type="text" inputmode="decimal" data-c="0" value="${lim(f) === Infinity ? '' : dec(lim(f))}" placeholder="sem teto"></td>
        <td><input type="text" inputmode="decimal" data-c="1" value="${dec(f[1])}"></td>
        ${regEmol ? `<td>${brl(MR.totalRegistro(W, Number(f[1]), 0))}</td>` : ''}
        <td><button class="x" title="Remover faixa">×</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="et-colar" hidden>
        <label>Cole duas colunas (limite e valor) ou uma coluna só com os valores, na mesma ordem das faixas atuais.
          <small>Aceita dados copiados do Excel, do PDF da tabela ou separados por ponto e vírgula. Uma coluna só atualiza os valores e mantém as faixas.</small></label>
        <textarea rows="8" placeholder="5.000,00	85,31&#10;10.000,00	171,76&#10;…"></textarea>
        <div class="linha-bt"><button class="discreto mini bt-aplicar">Aplicar</button><button class="discreto mini bt-cancelar">Cancelar</button></div>
      </div>`;
    const redesenhar = () => { montarEditorTabela(box); alterou(); };
    box.querySelectorAll('tbody tr').forEach(tr => {
      const i = +tr.dataset.i;
      tr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        const c = +inp.dataset.c;
        tab[i][c] = c === 0 ? (inp.value.trim() === '' ? null : num(inp.value)) : num(inp.value);
        redesenhar();
      }));
      tr.querySelector('.x').onclick = () => { if (tab.length > 1 && confirm('Remover esta faixa?')) { tab.splice(i, 1); tab[tab.length - 1][0] = null; redesenhar(); } };
    });
    box.querySelector('.bt-add').onclick = () => {
      const ult = tab[tab.length - 1]; const pen = tab.length > 1 ? lim(tab[tab.length - 2]) : 0;
      tab.splice(tab.length - 1, 0, [pen > 0 ? pen * 2 : 1000, Number(ult[1])]);
      redesenhar();
    };
    box.querySelector('.bt-reaj').onclick = () => {
      const p = num(box.querySelector('.reaj').value);
      if (!p) { toast('Informe o percentual de reajuste.', true); return; }
      if (!confirm('Aplicar reajuste de ' + dec(p, 0, 4) + '% sobre todos os valores desta tabela?')) return;
      tab.forEach(f => f[1] = Math.round(Number(f[1]) * (1 + p / 100) * 100) / 100);
      redesenhar(); toast('Reajuste aplicado. Confira os valores antes de publicar.');
    };
    const cx = box.querySelector('.et-colar');
    box.querySelector('.bt-colar').onclick = () => { cx.hidden = !cx.hidden; if (!cx.hidden) cx.querySelector('textarea').focus(); };
    box.querySelector('.bt-cancelar').onclick = () => { cx.hidden = true; };
    box.querySelector('.bt-aplicar').onclick = () => {
      const linhas = cx.querySelector('textarea').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const lidas = linhas.map(l => {
        const nums = (l.match(/(acima|sem teto)/i) ? ['__SEM__'] : []).concat((l.match(/\d[\d.]*(,\d+)?/g) || []));
        return nums;
      }).filter(n => n.length);
      if (!lidas.length) { toast('Nenhum valor reconhecido.', true); return; }
      const umaColuna = lidas.every(n => n.length === 1 && n[0] !== '__SEM__');
      if (umaColuna) {
        if (lidas.length !== tab.length) { toast('Foram colados ' + lidas.length + ' valores, mas a tabela tem ' + tab.length + ' faixas.', true, 4500); return; }
        lidas.forEach((n, i) => tab[i][1] = num(n[0]));
      } else {
        const nova = lidas.map(n => {
          const sem = n[0] === '__SEM__'; const v = n.filter(x => x !== '__SEM__');
          return [sem ? null : num(v[v.length - 2]), num(v[v.length - 1])];
        });
        nova[nova.length - 1][0] = null;
        tab.splice(0, tab.length, ...nova);
      }
      cx.hidden = true; redesenhar();
      const e = validarTabela(tab);
      toast(e.length ? 'Tabela aplicada com ' + e.length + ' faixa(s) a revisar (destacadas).' : 'Tabela aplicada. Confira antes de publicar.', !!e.length, 4000);
    };
  }

  /* ================= validação e publicação ================= */
  function validarTudo() {
    const p = [];
    W.corretores = (W.corretores || []).filter(c => (c.nome || '').trim());
    W.reducoes = (W.reducoes || []).filter(r => (r.nome || '').trim());
    W.extras = (W.extras || []).filter(x => (x.nome || '').trim());
    W.registro.acrescimos = (W.registro.acrescimos || []).filter(a => (a.nome || '').trim());
    [['registro.tabC', 'Tabela III.C'], ['registro.tabB', 'Tabela III.B'], ['escritura.tab', 'Tabela de escrituração']].forEach(([k, n]) => {
      const e = validarTabela(getK(W, k)); if (e.length) p.push(n + ': ' + e.length + ' faixa(s) com problema');
    });
    if (!(W.itbi.aliquota >= 0 && W.itbi.aliquota < 20)) p.push('Alíquota do ITBI fora do intervalo esperado');
    if (!(W.corretores || []).length) p.push('Cadastre ao menos um corretor');
    (W.reducoes || []).forEach(r => { if (!r.id) r.id = idNovo('red'); });
    (W.extras || []).forEach(x => { if (!x.id) x.id = idNovo('ext'); });
    return p;
  }

  const utf8b64 = s => btoa(unescape(encodeURIComponent(s)));

  async function gh(token, metodo, url, corpo) {
    const r = await fetch('https://api.github.com' + url, {
      method: metodo,
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || 'HTTP ' + r.status); e.status = r.status; throw e; }
    return j;
  }
  const caminho = g => `/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${g.path.split('/').map(encodeURIComponent).join('/')}`;
  function explicarErro(e) {
    if (e.status === 401) return 'Token inválido ou expirado.';
    if (e.status === 403) return 'O token não tem permissão de escrita neste repositório (Contents: Read and write).';
    if (e.status === 404) return 'Repositório ou arquivo não encontrado. Confira usuário, repositório e branch.';
    if (e.status === 409) return 'O arquivo mudou no GitHub durante a publicação. Tente de novo.';
    return 'Falha na comunicação com o GitHub: ' + e.message;
  }

  async function publicar() {
    const problemas = validarTudo();
    if (problemas.length) { alert('Corrija antes de publicar:\n\n• ' + problemas.join('\n• ')); return; }
    const token = await decifrarToken(SENHA);
    if (!token) {
      if (confirm('Nenhum token do GitHub está salvo neste navegador. Deseja baixar o dados.json para subir manualmente no repositório?')) baixar();
      else mostrarAba('publicacao');
      return;
    }
    if (!confirm('Publicar as alterações agora? Os corretores passam a usar os novos valores em cerca de um minuto.')) return;
    const bt = $('btPublicar'); bt.disabled = true; bt.textContent = 'Publicando…';
    try {
      const novo = clone(W);
      novo.versao = (Number(PUBLICADO.versao) || 1) + 1;
      novo.atualizadoEm = new Date().toISOString();
      novo.atualizadoPor = 'Mário Rubens Ferraz de Paula';
      const g = novo.github;
      let sha;
      try { sha = (await gh(token, 'GET', caminho(g) + '?ref=' + encodeURIComponent(g.branch))).sha; }
      catch (e) { if (e.status !== 404) throw e; }
      await gh(token, 'PUT', caminho(g), {
        message: 'Mude Registro · atualização das tabelas (versão ' + novo.versao + ')',
        content: utf8b64(JSON.stringify(novo, null, 1) + '\n'), branch: g.branch, ...(sha ? { sha } : {})
      });
      PUBLICADO = novo; W = clone(novo); lsDel(LS_RASCUNHO);
      preencher(); atualizarInfo();
      toast('Publicado com sucesso. O simulador é atualizado em cerca de um minuto.', false, 5000);
    } catch (e) { console.error(e); toast(explicarErro(e), true, 6000); }
    finally { bt.disabled = false; bt.textContent = 'Publicar'; }
  }

  function baixar() {
    validarTudo();
    const o = clone(W); o.atualizadoEm = new Date().toISOString(); o.versao = (Number(PUBLICADO.versao) || 1) + 1;
    const blob = new Blob([JSON.stringify(o, null, 1) + '\n'], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dados.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ================= abas e botões ================= */
  function mostrarAba(n) {
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === n));
    document.querySelectorAll('section.aba').forEach(s => s.hidden = s.dataset.aba !== n);
    window.scrollTo({ top: 0 });
  }

  function ligar() {
    $('formLogin').addEventListener('submit', entrar);
    document.querySelectorAll('#abas button').forEach(b => b.onclick = () => mostrarAba(b.dataset.aba));
    ligarCampos();
    $('addAcrescimo').onclick = () => { W.registro.acrescimos.push({ nome: '', pct: 0 }); montarListas(); alterou(); };
    $('addReducao').onclick = () => { W.reducoes.push({ id: idNovo('red'), nome: '', pct: 0, dispensaCertidao: false }); montarListas(); alterou(); };
    $('addExtra').onclick = () => { W.extras.push({ id: idNovo('ext'), nome: '', valor: 0, descricao: '', padrao: false }); montarListas(); alterou(); };
    $('addCorretor').onclick = () => { W.corretores.push({ nome: '', creci: '', telefone: '' }); montarListas(); alterou(); };

    $('btPublicar').onclick = publicar;
    $('btSair').onclick = () => { SENHA = null; location.reload(); };
    $('btPrevia').onclick = () => {
      validarTudo();
      lsSet(LS_PREVIA, JSON.stringify(W));
      window.open('index.html?previa=1', '_blank');
    };
    $('btBaixar').onclick = baixar;
    $('arqImportar').onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return;
      try {
        const o = JSON.parse(await f.text());
        if (!o.registro || !o.escritura || !o.itbi) throw new Error('estrutura');
        if (!confirm('Substituir a cópia de trabalho pelo arquivo importado? Nada é publicado até você clicar em Publicar.')) return;
        o.admin = W.admin; W = o; preencher(); alterou(); toast('Arquivo importado.');
      } catch (e) { toast('Arquivo inválido.', true); }
      ev.target.value = '';
    };
    $('btDescartar').onclick = () => {
      if (!confirm('Descartar todas as alterações não publicadas?')) return;
      W = clone(PUBLICADO); lsDel(LS_RASCUNHO); preencher(); atualizarInfo(); toast('Alterações descartadas.');
    };
    $('btSalvarToken').onclick = async () => {
      const t = $('token').value.trim();
      if (!/^(github_pat_|ghp_)/.test(t)) { toast('Informe um token válido do GitHub.', true); return; }
      lsSet(LS_TOKEN, await cifrarToken(t, SENHA)); $('token').value = '';
      $('tokenStatus').textContent = 'Token salvo neste navegador (termina em …' + t.slice(-4) + ').';
      toast('Token salvo com criptografia.');
    };
    $('btEsquecerToken').onclick = () => { if (confirm('Remover o token deste navegador?')) { lsDel(LS_TOKEN); $('tokenStatus').textContent = 'Nenhum token salvo neste navegador.'; } };
    $('btTestar').onclick = async () => {
      const token = $('token').value.trim() || await decifrarToken(SENHA);
      if (!token) { toast('Nenhum token informado.', true); return; }
      try {
        const g = W.github;
        const repo = await gh(token, 'GET', `/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}`);
        const pode = repo.permissions ? repo.permissions.push : undefined;
        toast(pode === false ? 'Conectado, mas o token não tem permissão de escrita.' : 'Conexão confirmada com ' + repo.full_name + '.', pode === false, 4500);
      } catch (e) { toast(explicarErro(e), true, 6000); }
    };
    $('btTrocarSenha').onclick = async () => {
      const a = $('novaSenha').value, b = $('novaSenha2').value;
      if (a.length < 8) { toast('A nova senha precisa ter ao menos 8 caracteres.', true); return; }
      if (a !== b) { toast('As senhas não conferem.', true); return; }
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      W.admin = { salt, iter: 150000, hash: await hashSenha(a, salt, 150000) };
      const tk = await decifrarToken(SENHA);
      if (tk) lsSet(LS_TOKEN, await cifrarToken(tk, a));
      SENHA = a; $('novaSenha').value = ''; $('novaSenha2').value = '';
      alterou(); toast('Senha trocada. Clique em Publicar para que ela passe a valer.', false, 5000);
    };
    window.addEventListener('beforeunload', e => { if (W && SENHA && JSON.stringify(W) !== JSON.stringify(PUBLICADO)) { e.preventDefault(); e.returnValue = ''; } });
  }

  async function iniciar() {
    $('logoLogin').src = MR.LOGO; $('logoAdm').src = MR.LOGO;
    const { dados, origem } = await MR.carregarDados();
    PUBLICADO = dados; ORIGEM = origem;
    ligar();
    $('senha').focus();
  }
  iniciar();
})();

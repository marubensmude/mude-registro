/* Mude Registro · aplicação dos corretores */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { brl, dec, pct, num, esc, faixa, rotuloFaixa, totalRegistro, nomeBase, dataBR, dataHoraBR } = MR;

  let D = null;          // dados vigentes
  let R = null;          // último resultado
  const HIST = 'mudeRegistro_historico';
  const ULT_CORRETOR = 'mudeRegistro_corretor';

  const CAMPOS_TXT = ['cliente', 'imovel', 'matricula', 'vTransacao', 'vAvaliado', 'fracao', 'vFinanciado', 'obs'];
  const CAMPOS_SEL = ['corretor', 'tipoImovel', 'ato', 'reducao'];
  const CAMPOS_CHK = ['redEscritura', 'semEscritura', 'certidao', 'abertura'];

  /* ---------------- utilidades de interface ---------------- */
  let tToast;
  function toast(msg, erro) {
    const t = $('toast'); t.textContent = msg; t.classList.toggle('erro', !!erro); t.classList.add('ver');
    clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove('ver'), 2600);
  }
  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  function formatarMoeda(el) {
    const v = num(el.value);
    if (el.value.trim() === '') return;
    el.value = dec(v);
  }

  /* ---------------- estado do formulário ---------------- */
  function lerEstado() {
    const s = {};
    CAMPOS_TXT.forEach(c => s[c] = $(c).value);
    CAMPOS_SEL.forEach(c => s[c] = $(c).value);
    CAMPOS_CHK.forEach(c => s[c] = $(c).checked);
    s.extras = [...document.querySelectorAll('#extras input:checked')].map(i => i.value);
    return s;
  }
  function aplicarEstado(s) {
    if (!s) return;
    CAMPOS_TXT.forEach(c => { if (s[c] !== undefined) $(c).value = s[c]; });
    CAMPOS_SEL.forEach(c => { if (s[c] !== undefined && [...$(c).options].some(o => o.value === s[c])) $(c).value = s[c]; });
    CAMPOS_CHK.forEach(c => { if (s[c] !== undefined) $(c).checked = !!s[c]; });
    document.querySelectorAll('#extras input').forEach(i => i.checked = (s.extras || []).includes(i.value));
  }
  function entradaCalculo(s) {
    return { vT: s.vTransacao, vA: s.vAvaliado, vF: s.vFinanciado, fracao: s.fracao, ato: s.ato, reducao: s.reducao,
      redEscritura: s.redEscritura, abertura: s.abertura, certidao: s.certidao, semEscritura: s.semEscritura, extras: s.extras };
  }

  /* ---------------- montagem a partir dos dados ---------------- */
  function montar() {
    // corretores
    const cs = D.corretores || [];
    $('corretor').innerHTML = cs.map((c, i) => `<option value="${i}">${esc(c.nome)}</option>`).join('') + '<option value="">Não identificar</option>';
    const ult = lsGet(ULT_CORRETOR, null);
    if (ult !== null && [...$('corretor').options].some(o => o.value === String(ult))) $('corretor').value = String(ult);

    // reduções
    $('reducao').innerHTML = '<option value="">Sem redução</option>' +
      (D.reducoes || []).map(r => `<option value="${esc(r.id)}">${esc(r.nome)} · ${pct(r.pct)}</option>`).join('');

    // custos adicionais
    const ex = D.extras || [];
    $('extras').innerHTML = ex.length ? '<p class="sub-extras">Outros custos de referência</p>' + ex.map(x =>
      `<label class="opcao"><input type="checkbox" value="${esc(x.id)}" ${x.padrao ? 'checked' : ''}><span>${esc(x.nome)} · ${brl(x.valor)}${x.descricao ? `<small>${esc(x.descricao)}</small>` : ''}</span></label>`
    ).join('') : '';

    // tabelas
    const linhaReg = (tab) => tab.map((f, i) => `<tr data-i="${i}"><td>${rotuloFaixa(tab, i)}</td><td>${brl(f[1])}</td><td>${brl(totalRegistro(D, Number(f[1]), 0))}</td></tr>`).join('');
    $('tbC').innerHTML = linhaReg(D.registro.tabC);
    $('tbB').innerHTML = linhaReg(D.registro.tabB);
    $('tbE').innerHTML = D.escritura.tab.map((f, i) => `<tr data-i="${i}"><td>${rotuloFaixa(D.escritura.tab, i)}</td><td>${brl(f[1])}</td></tr>`).join('');
    $('rotC').textContent = 'Vigência ' + D.registro.vigencia;
    $('rotE').textContent = D.escritura.rotulo;

    const acr = (D.registro.acrescimos || []).map(a => `${esc(a.nome)} ${pct(a.pct)}`).join(' · ');
    $('parametros').innerHTML = `<dl class="param">
      <dt>Alíquota do ITBI · ${esc(D.itbi.municipio)}</dt><dd>${pct(D.itbi.aliquota)}</dd>
      <dt>Base do ITBI</dt><dd>${nomeBase(D.itbi.base)}</dd>
      <dt>Base da escritura</dt><dd>${nomeBase(D.escritura.base)}</dd>
      <dt>Base do registro</dt><dd>${nomeBase(D.registro.base)}</dd>
      <dt>Acréscimos sobre emolumentos</dt><dd>${acr || 'nenhum'}</dd>
      <dt>Selo por ato</dt><dd>${brl(D.registro.selo)}</dd>
      <dt>Abertura de matrícula</dt><dd>${brl(D.registro.abertura)}</dd>
      <dt>Certidão de inteiro teor</dt><dd>${brl(D.registro.certidao)}</dd>
      <dt>Validade do relatório</dt><dd>${D.textos.validadeDias} dias</dd>
    </dl>`;

    $('rodFontes').textContent = 'Bases: ' + D.registro.fonte + ' · Escritura: ' + D.escritura.rotulo + ' · ITBI de ' + D.itbi.municipio + ' a ' + pct(D.itbi.aliquota) + '.';
    if (D.empresa && D.empresa.slogan) $('rodSlogan').textContent = D.empresa.slogan;
  }

  function marcar(tb, i) {
    document.querySelectorAll('#' + tb + ' tr').forEach(tr => tr.classList.toggle('ativa', i !== null && tr.dataset.i === String(i)));
  }

  /* ---------------- cálculo e painel ---------------- */
  function linha(nome, det, valor, cls) {
    return `<div class="linha ${cls || ''}"><span class="n">${nome}<em>${det}</em></span><span class="v">${brl(valor)}</span></div>`;
  }

  function calcular() {
    const s = lerEstado();
    // certidão dispensada por enquadramento
    const red = (D.reducoes || []).find(r => r.id === s.reducao);
    const disp = red && red.dispensaCertidao;
    $('certidao').disabled = !!disp;
    $('certidao').closest('.opcao').classList.toggle('desativada', !!disp);
    $('certNota').textContent = disp ? 'Já incluída no registro da primeira aquisição pelo SFH.' : 'Matrícula atualizada, já com o registro da aquisição.';
    $('dicaFin').hidden = !(num(s.vFinanciado) > 0 && !s.semEscritura);

    R = MR.calcular(D, entradaCalculo(s));
    const botoes = ['btPdf', 'btWhats', 'btCopiar', 'btLink'];
    if (R.vazio) {
      $('total').textContent = 'R$ 0,00'; $('pctTotal').textContent = ''; $('ctx').textContent = 'Informe os valores para calcular.';
      $('linhas').innerHTML = ''; $('desembolso').hidden = true;
      botoes.forEach(b => $(b).disabled = true);
      marcar('tbC', null); marcar('tbB', null); marcar('tbE', null);
      return;
    }
    botoes.forEach(b => $(b).disabled = false);

    const pFr = R.fr < 1 ? ' · fração de ' + dec(R.fr * 100, 0, 4) + '%' : '';
    $('ctx').innerHTML = 'Base do ITBI: <strong>' + brl(R.baseITBI) + '</strong> · Escritura: <strong>' + brl(R.baseEsc) + '</strong> · Registro: <strong>' + brl(R.baseReg) + '</strong>' + pFr;

    let h = R.itens.map(i => linha(esc(i.nome), esc(i.detalhe), i.valor, i.off ? 'off' : '')).join('');
    if (R.economia > 0.01) h += linha('Economia com a redução legal', 'Comparado ao custo integral de ' + brl(R.integral), -R.economia, 'desconto');
    $('linhas').innerHTML = h;
    $('total').textContent = brl(R.total);
    $('pctTotal').textContent = R.valorImovel > 0 ? 'Equivale a ' + dec(R.pctImovel, 2, 2) + '% do valor da transação.' : '';

    if (R.valorImovel > 0) {
      $('desembolso').hidden = false;
      $('desembolso').innerHTML = '<h3>Recursos próprios estimados</h3>' +
        linha('Valor da transação', R.fr < 1 ? 'Proporcional à fração adquirida' : 'Preço do imóvel', R.valorImovel) +
        (R.vF > 0 ? linha('Crédito financiado', 'Valor liberado pelo banco', -R.vF) : '') +
        linha('Custos de aquisição', 'ITBI, escritura e registro', R.total) +
        linha('Total a providenciar', R.vF > 0 ? 'Entrada somada aos custos' : 'Preço somado aos custos', R.recursosProprios, 'forte');
    } else $('desembolso').hidden = true;

    const reg = R.itens.find(i => i.id === 'registro'), escr = R.itens.find(i => i.id === 'escritura'), fid = R.itens.find(i => i.id === 'fiduciaria');
    marcar('tbC', !R.usaB ? reg.faixa.i : (fid ? fid.faixa.i : null));
    marcar('tbB', R.usaB ? reg.faixa.i : null);
    marcar('tbE', escr.off ? null : escr.faixa.i);
  }

  /* ---------------- resumo em texto ---------------- */
  function resumoTexto() {
    const s = lerEstado();
    const c = (D.corretores || [])[s.corretor];
    let t = '*Mude Imóveis · Estimativa de custos de aquisição*\n';
    if (s.cliente) t += 'Cliente: ' + s.cliente + '\n';
    if (s.imovel) t += 'Imóvel: ' + s.imovel + '\n';
    t += 'Valor da transação: ' + brl(R.valorImovel) + '\n';
    if (R.vF > 0) t += 'Crédito financiado: ' + brl(R.vF) + '\n';
    t += '\n';
    R.itens.forEach(i => { if (!i.off) t += '• ' + i.nome + ': ' + brl(i.valor) + '\n'; });
    if (R.economia > 0.01) t += '• Economia com redução legal: ' + brl(R.economia) + '\n';
    t += '\n*Total estimado: ' + brl(R.total) + '* (' + dec(R.pctImovel) + '% do valor)\n';
    t += 'Recursos próprios estimados: ' + brl(R.recursosProprios) + '\n\n';
    t += '_Simulação consultiva emitida em ' + dataBR(Date.now()) + '. Não constitui orçamento de cartório nem compromisso formal da Mude Imóveis._';
    if (c) t += '\n\n' + c.nome + (c.creci ? ' · ' + c.creci : '') + (c.telefone ? '\n' + c.telefone : '');
    return t;
  }

  async function copiar(txt, msg) {
    try { await navigator.clipboard.writeText(txt); toast(msg); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(msg); } catch (e2) { toast('Não foi possível copiar.', true); }
      ta.remove();
    }
  }

  /* ---------------- link compartilhável ---------------- */
  const codificar = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decodificar = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  function linkSimulacao() {
    const s = lerEstado(); delete s.obs;
    return location.origin + location.pathname + '#s=' + codificar(s);
  }

  /* ---------------- histórico local ---------------- */
  function salvarHistorico(id) {
    const s = lerEstado();
    let h = lsGet(HIST, []);
    h = h.filter(x => x.id !== id);
    h.unshift({ id, quando: Date.now(), cliente: s.cliente, imovel: s.imovel, valor: R.valorImovel, total: R.total, estado: s });
    lsSet(HIST, h.slice(0, 20));
    mostrarHistorico();
  }
  function mostrarHistorico() {
    const h = lsGet(HIST, []);
    $('historicoBloco').hidden = !h.length;
    $('historico').innerHTML = h.map((x, i) => `<button class="hist-item" data-i="${i}">
      <b>${esc(x.cliente || 'Cliente não identificado')}</b>
      <span>${esc(x.imovel || 'Imóvel não informado')} · ${brl(x.valor)}</span>
      <span>${dataHoraBR(x.quando)} · ${esc(x.id)}</span>
      <strong>${brl(x.total)}</strong></button>`).join('');
    document.querySelectorAll('.hist-item').forEach(b => b.onclick = () => {
      aplicarEstado(h[+b.dataset.i].estado); calcular(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Simulação carregada.');
    });
  }

  const novoId = () => {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return 'MR-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  };

  /* ---------------- eventos ---------------- */
  function ligar() {
    document.querySelectorAll('.entrada input, .entrada select, .entrada textarea').forEach(el => {
      el.addEventListener('input', calcular); el.addEventListener('change', calcular);
    });
    $('extras').addEventListener('change', calcular);
    document.querySelectorAll('.moeda').forEach(el => el.addEventListener('blur', () => formatarMoeda(el)));
    $('corretor').addEventListener('change', e => lsSet(ULT_CORRETOR, e.target.value));

    $('btPdf').onclick = async () => {
      if (!R || R.vazio) return;
      if (!window.jspdf) { toast('Carregando o gerador de PDF, tente novamente.', true); return; }
      const id = novoId();
      const s = lerEstado();
      try {
        $('btPdf').disabled = true; $('btPdf').textContent = 'Gerando relatório…';
        await MRRelatorio.gerar(D, R, s, id);
        salvarHistorico(id);
        toast('Relatório gerado.');
      } catch (e) { console.error(e); toast('Erro ao gerar o PDF.', true); }
      finally { $('btPdf').disabled = false; $('btPdf').textContent = 'Gerar relatório em PDF'; }
    };
    $('btWhats').onclick = () => { salvarHistorico(novoId()); window.open('https://wa.me/?text=' + encodeURIComponent(resumoTexto()), '_blank', 'noopener'); };
    $('btCopiar').onclick = () => copiar(resumoTexto(), 'Resumo copiado.');
    $('btLink').onclick = () => copiar(linkSimulacao(), 'Link da simulação copiado.');
    $('btNovo').onclick = () => {
      const corr = $('corretor').value;
      CAMPOS_TXT.forEach(c => $(c).value = ''); $('fracao').value = '100';
      $('ato').value = 'C'; $('reducao').value = ''; $('tipoImovel').selectedIndex = 0;
      CAMPOS_CHK.forEach(c => $(c).checked = false); $('certidao').checked = true;
      document.querySelectorAll('#extras input').forEach(i => i.checked = (D.extras.find(x => x.id === i.value) || {}).padrao || false);
      $('corretor').value = corr; history.replaceState(null, '', location.pathname);
      calcular(); $('vTransacao').focus();
    };
    $('btLimparHist').onclick = () => { lsSet(HIST, []); mostrarHistorico(); toast('Histórico limpo.'); };
  }

  /* ---------------- inicialização ---------------- */
  async function iniciar() {
    $('logoTopo').src = MR.LOGO;
    let { dados, origem } = await MR.carregarDados();
    if (/[?&]previa=1/.test(location.search)) {
      const p = lsGet('mudeRegistro_previa', null);
      if (p) { dados = p; origem = 'previa'; }
    }
    D = dados;
    const st = $('status');
    if (origem === 'previa') { st.classList.add('alerta'); $('statusTxt').textContent = 'Pré-visualização do administrador · não publicada'; }
    else if (origem === 'online') { st.classList.add('ok'); $('statusTxt').textContent = 'Tabelas atualizadas em ' + dataBR(D.atualizadoEm); }
    else { st.classList.add('alerta'); $('statusTxt').textContent = 'Modo offline · tabelas de ' + dataBR(D.atualizadoEm); }
    montar();
    ligar();
    const m = location.hash.match(/#s=([\w-]+)/);
    if (m) { try { aplicarEstado(decodificar(m[1])); toast('Simulação compartilhada carregada.'); } catch (e) {} }
    calcular();
    mostrarHistorico();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', iniciar) : iniciar();
})();

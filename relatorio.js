/* Mude Registro · relatório em PDF para o cliente (jsPDF + AutoTable) */
(function (global) {
  'use strict';
  const { brl, dec, pct, dataBR, dataHoraBR, nomeBase } = MR;

  const COR = {
    preto: [11, 11, 12], grafite: [38, 38, 42], texto: [45, 45, 50], cinza: [118, 118, 124], claro: [236, 234, 229],
    linha: [214, 208, 196], dourado: [184, 145, 63], douradoClaro: [227, 200, 137], fundo: [248, 246, 241], branco: [255, 255, 255]
  };
  const M = 16;              // margem lateral (mm)
  const W = 210, H = 297;    // A4
  const RODAPE = 16;         // altura reservada ao rodapé

  function gerar(D, R, S, id) {
    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const emp = D.empresa || {};
    const agora = new Date();
    const validade = new Date(agora.getTime() + (Number(D.textos.validadeDias) || 30) * 86400000);
    const corretor = (D.corretores || [])[S.corretor];
    let y = 0;

    const cor = (c, tipo = 'text') => tipo === 'fill' ? doc.setFillColor(...c) : tipo === 'draw' ? doc.setDrawColor(...c) : doc.setTextColor(...c);
    const fonte = (tam, estilo = 'normal', c = COR.texto) => { doc.setFont('helvetica', estilo); doc.setFontSize(tam); cor(c); };
    const espaco = (need) => { if (y + need > H - RODAPE - 6) { doc.addPage(); y = 20; } };

    /* ---------- cabeçalho (primeira página) ---------- */
    cor(COR.preto, 'fill'); doc.rect(0, 0, W, 42, 'F');
    cor(COR.dourado, 'fill'); doc.rect(0, 42, W, 0.9, 'F');
    try { doc.addImage(MR.LOGO, 'PNG', M, 7, 28, 28); } catch (e) {}
    fonte(8, 'bold', COR.dourado); doc.text('MUDE REGISTRO', M + 34, 14.5, { charSpace: 0.9 });
    fonte(17, 'bold', COR.branco); doc.text('Estimativa de Custos de Aquisição', M + 34, 22.5);
    fonte(9, 'normal', [200, 200, 204]); doc.text('ITBI, escritura pública e registro de imóveis · ' + (D.itbi.municipio || 'Dourados/MS'), M + 34, 28.5);
    fonte(7.5, 'normal', [160, 160, 166]);
    doc.text('Simulação nº', W - M, 13, { align: 'right' });
    fonte(9.5, 'bold', COR.douradoClaro); doc.text(id, W - M, 18, { align: 'right' });
    fonte(7.5, 'normal', [160, 160, 166]);
    doc.text('Emitida em ' + dataHoraBR(agora), W - M, 24.5, { align: 'right' });
    doc.text('Válida até ' + dataBR(validade), W - M, 29, { align: 'right' });
    doc.text('Tabelas atualizadas em ' + dataBR(D.atualizadoEm), W - M, 33.5, { align: 'right' });
    y = 52;

    /* ---------- utilitários de seção ---------- */
    let nSec = 0;
    function secao(titulo, need = 24) {
      espaco(need);
      nSec++;
      fonte(8, 'bold', COR.dourado); doc.text(String(nSec).padStart(2, '0'), M, y);
      fonte(11.5, 'bold', COR.preto); doc.text(titulo, M + 8, y);
      cor(COR.linha, 'draw'); doc.setLineWidth(0.25); doc.line(M, y + 2.6, W - M, y + 2.6);
      y += 7.5;
    }
    function tabelaChaveValor(linhas) {
      doc.autoTable({
        startY: y, margin: { left: M, right: M, bottom: RODAPE + 4 }, theme: 'plain',
        body: linhas.filter(l => l && l[1] !== undefined && l[1] !== ''),
        styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.6, bottom: 1.6, left: 0, right: 2 }, textColor: COR.texto, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 58, textColor: COR.cinza }, 1: { fontStyle: 'bold', textColor: COR.preto } },
        didParseCell: h => { if (h.row.index % 2 === 1) h.cell.styles.fillColor = null; }
      });
      y = doc.lastAutoTable.finalY + 7;
    }
    function paragrafo(txt, tam = 9, c = COR.texto, estilo = 'normal', largura = W - 2 * M, x = M) {
      fonte(tam, estilo, c);
      const linhas = doc.splitTextToSize(txt, largura);
      const alt = linhas.length * tam * 0.42;
      espaco(alt + 2);
      doc.text(linhas, x, y, { lineHeightFactor: 1.35 });
      y += alt + 1.5;
    }

    /* ---------- 01 identificação ---------- */
    secao('Identificação');
    tabelaChaveValor([
      ['Cliente', S.cliente || 'Não informado'],
      ['Imóvel', S.imovel || 'Não informado'],
      ['Tipo de imóvel', S.tipoImovel],
      ['Matrícula e cartório', S.matricula || ''],
      ['Consultor responsável', corretor ? corretor.nome + (corretor.creci ? ' · ' + corretor.creci : '') : '']
    ]);

    /* ---------- 02 operação ---------- */
    secao('Dados da operação');
    tabelaChaveValor([
      ['Ato a registrar', R.usaB ? 'Partilha, adjudicação em inventário ou divisão' : 'Compra e venda, permuta, dação em pagamento ou doação'],
      ['Valor da transação', brl(R.vT)],
      ['Avaliação da Prefeitura', R.vA > 0 ? brl(R.vA) : 'Não informada (considerado o valor da transação)'],
      R.fr < 1 ? ['Fração adquirida', dec(R.fr * 100, 0, 4) + '%'] : null,
      ['Crédito financiado', R.vF > 0 ? brl(R.vF) : 'Aquisição sem financiamento'],
      ['Enquadramento legal', R.red ? R.red.nome + ' · redução de ' + pct(R.red.pct) + ' nos emolumentos' : 'Sem redução'],
      ['Base de cálculo do ITBI', brl(R.baseITBI) + ' (' + nomeBase(D.itbi.base) + ')'],
      ['Base da escritura', brl(R.baseEsc) + ' (' + nomeBase(D.escritura.base) + ')'],
      ['Base do registro', brl(R.baseReg) + ' (' + nomeBase(D.registro.base) + ')']
    ]);

    /* ---------- 03 demonstrativo ---------- */
    secao('Demonstrativo de custos', 50);
    const corpo = R.itens.map(i => [
      { content: i.nome, styles: { fontStyle: 'bold', textColor: i.off ? COR.cinza : COR.preto } },
      i.grupo, i.detalhe, i.off ? 'Dispensada' : brl(i.valor)
    ]);
    const pe = [];
    if (R.economia > 0.01) pe.push([{ content: 'Economia obtida com a redução legal', colSpan: 3 }, '- ' + brl(R.economia)]);
    pe.push([{ content: 'TOTAL ESTIMADO', colSpan: 3 }, brl(R.total)]);
    doc.autoTable({
      startY: y, margin: { left: M, right: M, bottom: RODAPE + 4 }, theme: 'plain',
      head: [['Item', 'Órgão', 'Critério de cálculo', 'Valor']],
      body: corpo, foot: pe, showFoot: 'lastPage',
      styles: { font: 'helvetica', fontSize: 8.6, cellPadding: { top: 2.4, bottom: 2.4, left: 2, right: 2 }, textColor: COR.texto, valign: 'middle', lineColor: COR.linha, overflow: 'linebreak' },
      headStyles: { fillColor: COR.preto, textColor: COR.douradoClaro, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: COR.fundo, textColor: COR.preto, fontStyle: 'bold', fontSize: 9.5 },
      columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 34, textColor: COR.cinza, fontSize: 8 }, 2: { textColor: COR.cinza, fontSize: 8 }, 3: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: COR.preto } },
      didParseCell: h => {
        if (h.section === 'head' && h.column.index === 3) h.cell.styles.halign = 'right';
        if (h.section === 'foot') {
          if (h.column.index === 3 || h.cell.colSpan) h.cell.styles.halign = h.column.index === 0 ? 'left' : 'right';
          const ultimo = h.row.index === pe.length - 1;
          if (!ultimo) { h.cell.styles.textColor = COR.dourado; h.cell.styles.fillColor = COR.branco; h.cell.styles.fontSize = 8.6; }
          else { h.cell.styles.fillColor = COR.preto; h.cell.styles.textColor = h.column.index === 0 ? COR.branco : COR.douradoClaro; h.cell.styles.fontSize = 10.5; }
        }
        if (h.section === 'body') h.cell.styles.lineWidth = { bottom: 0.2 };
      }
    });
    y = doc.lastAutoTable.finalY + 5;

    // destaque
    espaco(22);
    cor(COR.fundo, 'fill'); cor(COR.dourado, 'draw'); doc.setLineWidth(0.4);
    doc.rect(M, y, W - 2 * M, 18, 'F'); doc.line(M, y, M, y + 18);
    fonte(8, 'normal', COR.cinza); doc.text('Custo total de aquisição estimado', M + 5, y + 6.5);
    fonte(16, 'bold', COR.preto); doc.text(brl(R.total), M + 5, y + 14);
    fonte(8, 'normal', COR.cinza);
    doc.text('Equivale a', W - M - 5, y + 6.5, { align: 'right' });
    fonte(13, 'bold', COR.dourado); doc.text(dec(R.pctImovel) + '% do valor da transação', W - M - 5, y + 13.5, { align: 'right' });
    y += 26;

    function secRecursos() {
    /* ---------- 04 recursos próprios ---------- */
    secao('Recursos próprios estimados', altRec);
    const rp = [['Valor da transação' + (R.fr < 1 ? ' (fração adquirida)' : ''), brl(R.valorImovel)]];
    if (R.vF > 0) rp.push(['(-) Crédito financiado', '- ' + brl(R.vF)]);
    rp.push([R.vF > 0 ? '(=) Entrada com recursos próprios' : '(=) Pagamento com recursos próprios', brl(R.proprio)]);
    rp.push(['(+) Custos de aquisição estimados', brl(R.total)]);
    doc.autoTable({
      startY: y, margin: { left: M, right: M, bottom: RODAPE + 4 }, theme: 'plain',
      body: rp, foot: [['Total de recursos próprios a providenciar', brl(R.recursosProprios)]],
      styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }, textColor: COR.texto },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold', textColor: COR.preto, cellWidth: 45 } },
      footStyles: { fillColor: COR.preto, textColor: COR.douradoClaro, fontStyle: 'bold', fontSize: 9.5 },
      didParseCell: h => { if (h.section === 'foot' && h.column.index === 1) h.cell.styles.halign = 'right'; if (h.section === 'body') { h.cell.styles.lineColor = COR.linha; h.cell.styles.lineWidth = { bottom: 0.2 }; } }
    });
    y = doc.lastAutoTable.finalY + 3;
    paragrafo('Valores de referência para planejamento financeiro. Não incluem tarifas bancárias, avaliação do banco, seguros, taxas condominiais, IPTU proporcional ou honorários, quando houver.', 7.8, COR.cinza);
    y += 5;

    }
    function secEtapas() {
    /* ---------- 05 etapas ---------- */
    secao('Etapas até a matrícula em seu nome', 22);
    const etapas = [
      ['ITBI', 'Emissão da guia na Prefeitura de ' + (D.itbi.municipio || 'Dourados/MS').split('/')[0] + ', com base na avaliação fiscal do imóvel, e pagamento antes da escritura.'],
      [R.itens.find(i => i.id === 'escritura').off ? 'Contrato com força de escritura' : 'Escritura pública', R.itens.find(i => i.id === 'escritura').off ? 'Assinatura do instrumento que dispensa a escritura pública (por exemplo, contrato de financiamento do SFH ou SFI).' : 'Lavratura no tabelionato de notas, com apresentação dos documentos das partes, do imóvel e da guia do ITBI quitada.'],
      ['Registro', 'Protocolo do título no Registro de Imóveis. A propriedade só se transfere com o registro na matrícula (art. 1.245 do Código Civil).' + (R.vF > 0 ? ' A alienação fiduciária em favor do banco é registrada na mesma matrícula.' : '')],
      ['Matrícula atualizada', 'Emissão da certidão de inteiro teor, que comprova a titularidade do imóvel em nome do comprador.']
    ];
    etapas.forEach((e, k) => {
      const txt = doc.splitTextToSize(e[1], W - 2 * M - 12);
      const alt = 5 + txt.length * 3.9;
      espaco(alt + 2);
      cor(COR.preto, 'fill'); doc.circle(M + 3.2, y - 1.1, 3.2, 'F');
      fonte(8, 'bold', COR.douradoClaro); doc.text(String(k + 1), M + 3.2, y + 0.1, { align: 'center' });
      fonte(9.2, 'bold', COR.preto); doc.text(e[0], M + 10, y);
      fonte(8.6, 'normal', COR.texto); doc.text(txt, M + 10, y + 4.6, { lineHeightFactor: 1.3 });
      y += alt + 1;
    });
    y += 3;
    }
    const altRec = 7.5 + (R.vF > 0 ? 4 : 3) * 6.6 + 8 + 10;
    const resta = H - RODAPE - 6 - y;
    if (resta < altRec && resta > 24) { secEtapas(); secRecursos(); } else { secRecursos(); secEtapas(); }

    /* ---------- 06 observações ---------- */
    const obs = [S.obs, D.textos.observacaoPadrao].filter(Boolean).join('\n\n');
    if (obs.trim()) { secao('Observações do consultor'); paragrafo(obs, 9); y += 4; }

    /* ---------- 07 bases ---------- */
    secao('Bases e parâmetros utilizados', 40);
    tabelaChaveValor([
      ['Registro de Imóveis', D.registro.fonte + ' · vigência ' + D.registro.vigencia],
      ['Acréscimos legais', (D.registro.acrescimos || []).map(a => a.nome + ' ' + pct(a.pct)).join(', ') + ' sobre os emolumentos, mais selo de ' + brl(D.registro.selo) + ' por ato'],
      ['Escritura pública', D.escritura.rotulo],
      ['ITBI', 'Alíquota de ' + pct(D.itbi.aliquota) + ' · ' + D.itbi.municipio],
      ['Atualização das tabelas', dataBR(D.atualizadoEm)]
    ]);

    /* ---------- aviso ---------- */
    const aviso = D.textos.aviso + ' Esta simulação é válida até ' + dataBR(validade) + '.';
    fonte(8.2, 'normal', COR.texto);
    const al = doc.splitTextToSize(aviso, W - 2 * M - 10);
    const altA = 11 + al.length * 3.6;
    espaco(altA + 34);
    cor(COR.dourado, 'draw'); doc.setLineWidth(0.35); cor(COR.branco, 'fill');
    doc.rect(M, y, W - 2 * M, altA, 'FD');
    fonte(8, 'bold', COR.dourado); doc.text('AVISO IMPORTANTE · SIMULAÇÃO SEM CARÁTER DE COMPROMISSO', M + 5, y + 6, { charSpace: 0.3 });
    fonte(8.2, 'normal', COR.texto); doc.text(al, M + 5, y + 11, { lineHeightFactor: 1.3 });
    y += altA + 9;

    /* ---------- assinatura ---------- */
    cor(COR.linha, 'draw'); doc.setLineWidth(0.25); doc.line(M, y, M + 80, y);
    fonte(9.5, 'bold', COR.preto); doc.text(corretor ? corretor.nome : (emp.nome || 'Mude Imóveis'), M, y + 5);
    fonte(8.2, 'normal', COR.cinza);
    doc.text([corretor && corretor.creci ? corretor.creci + ' · Mude Imóveis · ' + (emp.creci || '') : 'Mude Imóveis · ' + (emp.creci || ''),
      corretor && corretor.telefone ? corretor.telefone : (emp.telefone || '')], M, y + 9.5, { lineHeightFactor: 1.35 });
    fonte(11, 'bolditalic', COR.dourado); doc.text(emp.slogan || 'Mude que a Gente te Acompanha.', W - M, y + 7, { align: 'right' });

    /* ---------- rodapé em todas as páginas ---------- */
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      cor(COR.dourado, 'draw'); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
      fonte(7, 'bold', COR.preto); doc.text([(emp.nome || 'Mude Imóveis'), emp.creci, emp.site].filter(Boolean).join(' · '), M, H - 9.5);
      fonte(6.6, 'normal', COR.cinza);
      doc.text([emp.endereco, emp.telefone, emp.email].filter(Boolean).join(' · '), M, H - 6, { maxWidth: W - 2 * M - 26 });
      fonte(7.5, 'normal', COR.cinza); doc.text('Página ' + p + ' de ' + n, W - M, H - 9.5, { align: 'right' });
      if (p > 1) { fonte(7, 'normal', COR.cinza); doc.text('Estimativa de Custos de Aquisição · ' + id, M, 11); cor(COR.linha, 'draw'); doc.line(M, 13, W - M, 13); }
    }

    doc.setProperties({ title: 'Estimativa de Custos de Aquisição · ' + id, subject: 'Simulação de ITBI, escritura e registro', author: 'Mude Imóveis', creator: 'Mude Registro' });
    const nome = 'Mude-Registro_' + (S.cliente ? S.cliente.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '_' : '') + id + '.pdf';
    doc.save(nome);
    return nome;
  }

  global.MRRelatorio = { gerar };
})(window);

(() => {
const { Auth, ApiError, Vehicles, VehicleExpenses, People, Sales, Bills, Investments, InvestmentInstallments, InvestmentEntries } = window.Garagem;

const S = { veiculos: [], clientes: [], fornecedores: [], vendas: [], investimentos: [] };
let tab = 'painel', filtroVeic = 'todos', filtroOrigem = '', busca = '', buscaCli = '', buscaForn = '', filtroForn = '', filtroVenda = 'abertas', filtroInv = 'ativos';
let loaded = false, loading = true;
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const CATS = ['manutencao', 'funilaria', 'pneus', 'eletrica', 'documentacao', 'ipva', 'multas', 'vistoria', 'limpeza', 'comissao', 'anuncio', 'outro'];
const CAT_LABELS = { manutencao: 'Mecânica', funilaria: 'Funilaria e pintura', pneus: 'Pneus', eletrica: 'Elétrica', documentacao: 'Documentação / transferência', ipva: 'IPVA / licenciamento', multas: 'Multas', vistoria: 'Vistoria / laudo', limpeza: 'Limpeza / estética', comissao: 'Comissão', anuncio: 'Anúncio', outro: 'Outros' };
const ORIGENS = ['Particular', 'Leilão', 'Loja / revenda', 'Troca (veio em uma venda)', 'Consignação', 'Financeira / banco (retomado)', 'Locadora / frotista', 'Outra'];
const tipoOrig = v => v.origin_type || 'Não informada';
const FORMAS = ['À vista (dinheiro / Pix)', 'Financiamento bancário', 'Cartão de crédito', 'Parcelado direto (carnê / promissória)', 'Troca + diferença', 'Consórcio', 'Outra'];
const TIPOS_FORN = ['Vendedor de veículos', 'Prestador de serviço', 'Vendedor e prestador'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fdate = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
const iso = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
const today = () => iso(new Date());
const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1 + n, 1); const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(); dt.setDate(Math.min(d, last)); return iso(dt); };
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const daysBetween = (a, b) => { const p = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); };
const round2 = n => Math.round(n * 100) / 100;

function companyId() { return Auth.company.id; }

const despTotal = v => Number(v.total_expenses || 0);
const custo = v => num(v.purchase_price) + despTotal(v);
const vendaDe = vid => S.vendas.find(s => s.vehicleId === vid && s.status !== 4);
const veic = id => S.veiculos.find(v => v.id === id);
const cli = id => S.clientes.find(c => c.id === id);
const forn = id => id ? S.fornecedores.find(f => f.id === id) : null;
const pessoaPorId = id => S.clientes.find(c => c.id === id) || S.fornecedores.find(f => f.id === id);
const vendeVeic = f => f.tipo_forn !== 'Prestador de serviço';
const prestaServ = f => f.tipo_forn !== 'Vendedor de veículos';
const nomeVeic = v => v ? [v.brand, v.model, v.fabrication_year].filter(Boolean).join(' ') : 'Veículo removido';
const plate = p => `<span class="plate"><i>BRASIL</i><b>${esc((p || '—').toUpperCase())}</b></span>`;
const parcStatus = p => p.pago ? 'paid' : (p.venc < today() ? 'late' : (daysBetween(today(), p.venc) <= 7 ? 'soon' : 'open'));
const parcLabel = { paid: 'Paga', late: 'Vencida', soon: 'Vence logo', open: 'A vencer' };

function parcelasDaVenda(sale) {
  return (sale._bills || []).map(b => ({
    n: b.installment_number, venc: b.date_due, valor: Number(b.amount), pago: Number(b.status) !== 0,
    dataPag: b.date_received, billId: b.id,
  })).sort((a, b) => a.n - b.n);
}
const recebido = s => { const ps = parcelasDaVenda(s); if (!ps.length) return num(s.valor); return ps.filter(p => p.pago).reduce((a, p) => a + p.valor, 0); };
const aReceber = s => parcelasDaVenda(s).filter(p => !p.pago).reduce((a, p) => a + p.valor, 0);

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}
async function w(fn, ok) {
  try { await fn(); if (ok) toast(ok); return true; }
  catch (e) {
    toast(e instanceof ApiError ? e.message : 'Não foi possível salvar. Verifique a conexão e tente de novo.');
    console.error(e); return false;
  }
}

/* ---------- carregamento de dados ---------- */
async function loadAll() {
  loading = true; render();
  try {
    const cid = companyId();
    const [vRes, clRes, foRes, saRes, biRes, inRes] = await Promise.all([
      Vehicles.list(cid),
      People.list(cid, { role: 2 }),
      People.list(cid, { role: 3 }),
      Sales.list(cid),
      Bills.listByCompany(cid),
      Investments.list(cid, { status: '' }),
    ]);
    S.veiculos = vRes.data;
    S.clientes = clRes.data;
    S.fornecedores = foRes.data;
    const billsBySale = {};
    (biRes.data || []).forEach(b => { (billsBySale[b.saleId] ||= []).push(b); });
    S.vendas = (saRes.data || []).filter(s => s.vehicleId).map(s => ({ ...s, _bills: billsBySale[s.id] || [] }));

    // Parcelas de investimentos (empréstimos/vendas a prazo) só vêm no
    // detalhe (GET /investment/:id) - buscamos uma a uma só pros ativos com
    // parcelamento configurado, pra alimentar o painel de cobranças.
    const investList = inRes.data || [];
    await Promise.all(
      investList
        .filter(x => x.status !== 'encerrado' && Number(x.installment_count) > 0)
        .map(async x => {
          try { const full = await Investments.get(x.id); x.installments = full.installments; } catch (e) {}
        })
    );
    S.investimentos = investList;

    loaded = true;
  } catch (e) {
    app.innerHTML = `<div class="notice"><b>Não foi possível carregar os dados.</b><p class="muted" style="margin:6px 0 0">${esc(e.message || '')}</p></div>`;
    loading = false;
    return;
  }
  loading = false;
  render();
}

/* ---------- render ---------- */
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  render();
}
function render() {
  setChrome(true);
  if (loading || !loaded) { app.innerHTML = `<div class="notice">Carregando seus dados…</div>`; return; }
  app.innerHTML = ({ painel: vPainel, veiculos: vVeiculos, vendas: vVendas, clientes: vClientes, fornecedores: vFornecedores, investimentos: vInvest }[tab])();
}

function allParcelas() {
  const out = [];
  S.vendas.forEach(s => parcelasDaVenda(s).forEach((p, i) => out.push({ ...p, idx: i, venda: s })));
  return out;
}

function vPainel() {
  const estoque = S.veiculos.filter(v => v.flip_status !== 'vendido');
  const vendidos = S.veiculos.filter(v => v.flip_status === 'vendido');
  const capEstoque = estoque.reduce((a, v) => a + custo(v), 0);
  const lucro = vendidos.reduce((a, v) => a + (num(v.sale_price) - custo(v)), 0);
  const faturamento = vendidos.reduce((a, v) => a + num(v.sale_price), 0);
  const ps = allParcelas();
  const abertas = ps.filter(p => !p.pago);
  const venc = abertas.filter(p => p.venc < today());
  const hoje = today(), lim = addDays(hoje, 30);
  const prox = abertas.filter(p => p.venc >= hoje && p.venc <= lim).sort((a, b) => a.venc.localeCompare(b.venc));
  const totalAReceber = abertas.reduce((a, p) => a + p.valor, 0);
  const totVenc = venc.reduce((a, p) => a + p.valor, 0);
  const margem = faturamento ? (lucro / faturamento * 100) : 0;

  const linhaParc = p => {
    const v = veic(p.venda.vehicleId), c = pessoaPorId(p.venda.peopleId), st = parcStatus(p);
    const atraso = st === 'late' ? `${daysBetween(p.venc, hoje)} dias` : (p.venc === hoje ? 'hoje' : `em ${daysBetween(hoje, p.venc)} dias`);
    return `<tr><td><div class="small" style="font-weight:600">${esc(c ? c.name : 'Cliente removido')}</div><div class="small muted">${esc(nomeVeic(v))} · parcela ${p.n}</div></td>
      <td class="small">${fdate(p.venc)}<div class="${st === 'late' ? 'neg' : 'muted'}">${atraso}</div></td>
      <td class="n">${brl(p.valor)}</td>
      <td style="text-align:right"><button class="btn sm" data-act="pagar" data-bill="${p.billId}">Recebida</button></td></tr>`;
  };
  const parado = estoque.map(v => ({ v, dias: v.purchase_date ? daysBetween(v.purchase_date, hoje) : 0 })).sort((a, b) => b.dias - a.dias).slice(0, 6);
  const ativosInv = S.investimentos.filter(x => x.status !== 'encerrado');
  const atualInv = ativosInv.reduce((a, x) => a + Number(x.current_amount ?? x.invested_amount ?? 0), 0);

  return `
  <div class="kpis">
    <div class="kpi"><span class="lb">Em estoque</span><span class="vl">${estoque.length}</span><span class="sub">${brl(capEstoque)} investidos</span></div>
    <div class="kpi"><span class="lb">Vendidos</span><span class="vl">${vendidos.length}</span><span class="sub">${brl(faturamento)} em vendas</span></div>
    <div class="kpi ${lucro >= 0 ? 'good' : 'bad'}"><span class="lb">Lucro nas vendas</span><span class="vl">${brl(lucro)}</span><span class="sub">margem de ${margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span></div>
    <div class="kpi"><span class="lb">A receber</span><span class="vl">${brl(totalAReceber)}</span><span class="sub">${abertas.length} parcela${abertas.length === 1 ? '' : 's'} em aberto</span></div>
    <div class="kpi ${venc.length ? 'bad' : ''}"><span class="lb">Em atraso</span><span class="vl">${brl(totVenc)}</span><span class="sub">${venc.length} parcela${venc.length === 1 ? '' : 's'} vencida${venc.length === 1 ? '' : 's'}</span></div>
    ${S.investimentos.length ? `<div class="kpi" data-act="go-inv" style="cursor:pointer"><span class="lb">Outros investimentos</span><span class="vl">${brl(atualInv)}</span><span class="sub">${ativosInv.length} ativo${ativosInv.length === 1 ? '' : 's'}</span></div>` : ''}
  </div>
  <h2 class="sec">Cobranças</h2>
  <div class="grid2">
    <div class="panel"><h3><span>Parcelas vencidas</span><span>${venc.length}</span></h3>
      ${venc.length ? `<div class="tbl"><table><tbody>${venc.sort((a, b) => a.venc.localeCompare(b.venc)).map(linhaParc).join('')}</tbody></table></div>` : `<div class="empty">Nenhuma parcela em atraso.</div>`}
    </div>
    <div class="panel"><h3><span>Vencem nos próximos 30 dias</span><span>${prox.length}</span></h3>
      ${prox.length ? `<div class="tbl"><table><tbody>${prox.map(linhaParc).join('')}</tbody></table></div>` : `<div class="empty">Nenhum vencimento nos próximos 30 dias.</div>`}
    </div>
  </div>
  <h2 class="sec">Resultado por origem</h2>
  <div class="panel">${porOrigem()}</div>
  <h2 class="sec">Estoque parado há mais tempo</h2>
  <div class="panel">
    ${parado.length ? `<div class="tbl"><table><thead><tr><th>Veículo</th><th class="n">Dias em estoque</th><th class="n">Custo total</th></tr></thead><tbody>
      ${parado.map(({ v, dias }) => `<tr class="click" data-act="ver-veiculo" data-id="${v.id}"><td><div class="veh">${plate(v.license_plate)}<span class="nm">${esc(nomeVeic(v))}</span></div></td><td class="n ${dias > 90 ? 'neg' : ''}">${dias}</td><td class="n">${brl(custo(v))}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">Nenhum veículo em estoque. Use "+ Veículo" para cadastrar uma compra.</div>`}
  </div>`;
}

function porOrigem() {
  const g = {};
  S.veiculos.forEach(v => {
    const k = tipoOrig(v); const r = g[k] || (g[k] = { comprados: 0, estoque: 0, vendidos: 0, investido: 0, lucro: 0, dias: 0 });
    r.comprados++; r.investido += custo(v);
    if (v.flip_status === 'vendido') { r.vendidos++; r.lucro += num(v.sale_price) - custo(v); if (v.purchase_date && v.sale_date) r.dias += daysBetween(v.purchase_date, v.sale_date); } else r.estoque++;
  });
  const rows = Object.entries(g).sort((a, b) => b[1].comprados - a[1].comprados);
  if (!rows.length) return `<div class="empty">Cadastre veículos com a origem preenchida para comparar de onde vêm os melhores negócios.</div>`;
  return `<div class="tbl"><table><thead><tr><th>Origem</th><th class="n">Comprados</th><th class="n">Em estoque</th><th class="n">Vendidos</th><th class="n">Custo total</th><th class="n">Lucro nas vendas</th><th class="n">Lucro médio</th><th class="n hide-sm">Dias p/ vender</th></tr></thead><tbody>
    ${rows.map(([k, r]) => `<tr class="click" data-act="ver-origem" data-o="${esc(k)}"><td style="font-weight:600">${esc(k)}</td><td class="n">${r.comprados}</td><td class="n">${r.estoque}</td><td class="n">${r.vendidos}</td><td class="n">${brl(r.investido)}</td><td class="n ${r.lucro >= 0 ? 'pos' : 'neg'}">${r.vendidos ? brl(r.lucro) : '—'}</td><td class="n">${r.vendidos ? brl(r.lucro / r.vendidos) : '—'}</td><td class="n hide-sm">${r.vendidos ? Math.round(r.dias / r.vendidos) : '—'}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function vVeiculos() {
  let list = S.veiculos.slice().sort((a, b) => (b.purchase_date || '').localeCompare(a.purchase_date || ''));
  if (filtroVeic === 'estoque') list = list.filter(v => v.flip_status !== 'vendido');
  if (filtroVeic === 'vendidos') list = list.filter(v => v.flip_status === 'vendido');
  const q = busca.trim().toLowerCase();
  if (filtroOrigem) list = list.filter(v => tipoOrig(v) === filtroOrigem);
  if (q) list = list.filter(v => [v.license_plate, v.brand, v.model, v.fabrication_year, v.color, v.origin_name, v.origin_city, v.origin_type].join(' ').toLowerCase().includes(q));
  const seg = (k, l) => `<button data-act="filtro-veic" data-f="${k}" aria-pressed="${filtroVeic === k}">${l}</button>`;
  return `
  <h2 class="sec">Veículos <button class="btn sm" data-act="novo-veiculo">+ Cadastrar compra</button></h2>
  <div class="toolbar">
    <input type="search" id="busca-veic" placeholder="Buscar por placa, modelo ou vendedor" value="${esc(busca)}">
    <select id="filtro-origem" style="width:auto" aria-label="Filtrar por origem"><option value="">Todas as origens</option>${[...ORIGENS, 'Não informada'].map(o => `<option ${filtroOrigem === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
    <div class="seg">${seg('todos', 'Todos')}${seg('estoque', 'Em estoque')}${seg('vendidos', 'Vendidos')}</div>
  </div>
  <div class="panel">
  ${list.length ? `<div class="tbl"><table><thead><tr><th>Veículo</th><th>Situação</th><th>Origem</th><th class="hide-sm">Compra</th><th class="n">Valor pago</th><th class="n">Despesas</th><th class="n">Custo total</th><th class="n">Venda</th><th class="n">Lucro</th></tr></thead><tbody>
  ${list.map(v => {
    const vendido = v.flip_status === 'vendido', l = vendido ? num(v.sale_price) - custo(v) : null;
    return `<tr class="click" data-act="ver-veiculo" data-id="${v.id}">
      <td><div class="veh">${plate(v.license_plate)}<div><div class="nm">${esc(nomeVeic(v))}</div><div class="small muted">${esc(v.color || '')}${v.mileage ? ' · ' + Number(v.mileage).toLocaleString('pt-BR') + ' km' : ''}</div></div></div></td>
      <td>${vendido ? '<span class="pill sold">Vendido</span>' : '<span class="pill stock">Em estoque</span>'}</td>
      <td class="small"><div>${esc(tipoOrig(v))}</div><div class="muted">${esc(v.origin_name || '')}</div></td>
      <td class="small hide-sm">${fdate(v.purchase_date)}</td>
      <td class="n">${brl(v.purchase_price)}</td>
      <td class="n">${brl(despTotal(v))}</td>
      <td class="n">${brl(custo(v))}</td>
      <td class="n">${vendido ? brl(v.sale_price) : '—'}</td>
      <td class="n ${l == null ? '' : (l >= 0 ? 'pos' : 'neg')}">${l == null ? '—' : brl(l)}</td></tr>`;
  }).join('')}</tbody></table></div>` : `<div class="empty">${S.veiculos.length ? 'Nenhum veículo encontrado com esse filtro.' : 'Nenhum veículo cadastrado ainda. Clique em "+ Cadastrar compra" para registrar o primeiro.'}</div>`}
  </div>`;
}

function saleCard(s) {
  const v = veic(s.vehicleId), c = pessoaPorId(s.peopleId), ps = parcelasDaVenda(s);
  const valor = s.vehicleSaleContract?.saleValue ?? s.amount;
  const rec = recebido({ ...s, valor }), pct = num(valor) ? Math.min(100, rec / num(valor) * 100) : 0;
  const l = num(valor) - (v ? custo(v) : 0);
  const atras = ps.filter(p => parcStatus(p) === 'late').length;
  return `<div class="sale">
    <div class="sale-h">
      <div class="veh">${plate(v && v.license_plate)}<div><div class="nm">${esc(nomeVeic(v))}</div><div class="small muted">${esc(c ? c.name : 'Cliente removido')} · ${fdate(s.date_sale)}${s._forma ? ' · ' + esc(s._forma) : ''}</div></div></div>
      <div class="actions">${atras ? `<span class="pill late">${atras} vencida${atras > 1 ? 's' : ''}</span>` : ''}
        <button class="btn sm danger" data-act="excluir-venda" data-id="${s.id}" data-veiculo="${s.vehicleId}" data-confirm="1">Cancelar venda</button></div>
    </div>
    <div class="sale-h" style="padding-top:0">
      <div class="sale-meta">
        <div><span>Valor de venda</span><b>${brl(valor)}</b></div>
        <div><span>Recebido</span><b class="pos">${brl(rec)}</b></div>
        <div><span>A receber</span><b>${brl(aReceber({ ...s, valor }))}</b></div>
        <div><span>Lucro</span><b class="${l >= 0 ? 'pos' : 'neg'}">${brl(l)}</b></div>
      </div>
    </div>
    ${ps.length ? `<div class="tbl" style="border-top:1px solid var(--line)"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th><th>Situação</th><th class="hide-sm">Pago em</th><th></th></tr></thead><tbody>
      ${ps.map(p => { const st = parcStatus(p); return `<tr><td>${p.n}/${ps.length}</td><td>${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td><td><span class="pill ${st}">${parcLabel[st]}</span></td><td class="small muted hide-sm">${p.pago ? fdate(p.dataPag) : ''}</td>
        <td style="text-align:right">${p.pago ? `<button class="btn sm ghost" data-act="estornar" data-bill="${p.billId}">Desfazer</button>` : `<button class="btn sm" data-act="pagar" data-bill="${p.billId}">Recebida</button>`}</td></tr>`; }).join('')}
    </tbody></table></div>` : ''}
    <div class="bar" title="${Math.round(pct)}% recebido"><i style="width:${pct}%"></i></div>
  </div>`;
}

function vVendas() {
  let list = S.vendas.slice().sort((a, b) => (b.date_sale || '').localeCompare(a.date_sale || ''));
  if (filtroVenda === 'abertas') list = list.filter(s => aReceber(s) > 0);
  if (filtroVenda === 'atraso') list = list.filter(s => parcelasDaVenda(s).some(p => parcStatus(p) === 'late'));
  const seg = (k, l) => `<button data-act="filtro-venda" data-f="${k}" aria-pressed="${filtroVenda === k}">${l}</button>`;
  return `
  <h2 class="sec">Vendas e parcelas <button class="btn sm pri" data-act="nova-venda">+ Registrar venda</button></h2>
  <div class="toolbar"><div class="seg">${seg('abertas', 'Com saldo a receber')}${seg('atraso', 'Em atraso')}${seg('todas', 'Todas')}</div></div>
  <div class="cards">${list.length ? list.map(saleCard).join('') : `<div class="panel"><div class="empty">${S.vendas.length ? 'Nenhuma venda neste filtro.' : 'Nenhuma venda registrada. Quando vender um veículo, use "+ Registrar venda".'}</div></div>`}</div>`;
}

function histForn(id) {
  const veics = S.veiculos.filter(v => v.purchase_people_id === id);
  return { veics, totV: veics.reduce((a, v) => a + num(v.purchase_price), 0) };
}
function vFornecedores() {
  const q = buscaForn.trim().toLowerCase();
  let list = S.fornecedores.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  if (q) list = list.filter(f => [f.name, f.document, f.phone, f.city].join(' ').toLowerCase().includes(q));
  return `
  <h2 class="sec">Fornecedores <button class="btn sm" data-act="novo-fornecedor">+ Novo fornecedor</button></h2>
  <div class="toolbar"><input type="search" id="busca-forn" placeholder="Buscar por nome, CPF/CNPJ ou telefone" value="${esc(buscaForn)}"></div>
  <div class="panel">${list.length ? `<div class="tbl"><table><thead><tr><th>Nome</th><th>Telefone</th><th class="n">Veículos comprados</th></tr></thead><tbody>
    ${list.map(f => { const h = histForn(f.id); return `<tr class="click" data-act="editar-fornecedor" data-id="${f.id}"><td><div style="font-weight:600">${esc(f.name)}</div><div class="small muted" style="font-family:var(--f-mono)">${esc(f.document || '')}</div></td>
      <td class="small">${esc(f.phone || '—')}</td>
      <td class="n">${h.veics.length ? `${h.veics.length} · ${brl(h.totV)}` : '—'}</td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="empty">${S.fornecedores.length ? 'Nenhum fornecedor encontrado.' : 'Cadastre quem vende carros para você (particulares, lojas, leiloeiros).'}</div>`}</div>`;
}
function formFornecedor(f) {
  f = f || {};
  const h = f.id ? histForn(f.id) : { veics: [] };
  openModal(f.id ? 'Fornecedor' : 'Novo fornecedor', `
    <div class="fg">
      <label class="f full">Nome / razão social<input id="ff-nome" value="${esc(f.name)}"></label>
      <label class="f">CPF / CNPJ<input id="ff-cpf" value="${esc(f.document)}" inputmode="numeric"></label>
      <label class="f">Telefone / WhatsApp<input id="ff-tel" value="${esc(f.phone)}" inputmode="tel"></label>
      <label class="f">E-mail<input id="ff-email" type="email" value="${esc(f.email)}"></label>
    </div>
    ${h.veics.length ? `<fieldset><legend>Veículos comprados deste fornecedor</legend><div class="tbl"><table><tbody>${h.veics.map(v => `<tr><td><div class="veh">${plate(v.license_plate)}<span class="small">${esc(nomeVeic(v))}</span></div></td><td class="small">${fdate(v.purchase_date)}</td><td class="n">${brl(v.purchase_price)}</td><td>${v.flip_status === 'vendido' ? '<span class="pill sold">Vendido</span>' : '<span class="pill stock">Em estoque</span>'}</td></tr>`).join('')}</tbody></table></div></fieldset>` : ''}`,
    `${f.id ? `<button class="btn danger" data-act="excluir-fornecedor" data-id="${f.id}" data-confirm="1" style="margin-right:auto">Excluir fornecedor</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-fornecedor" data-id="${f.id || ''}">Salvar</button>`);
}
async function salvarFornecedor(id) {
  const data = { company_id: companyId(), name: val('ff-nome'), document: val('ff-cpf') || undefined, phone: val('ff-tel') || undefined, email: val('ff-email') || undefined, roles: [3] };
  if (!data.name) { toast('Informe o nome do fornecedor.'); return; }
  const ok = id ? await w(() => People.update(id, data), 'Fornecedor atualizado')
    : await w(() => People.create(data), 'Fornecedor cadastrado');
  if (ok) { closeModal(); loadAll(); }
}

/* ---------- outros investimentos ---------- */
const ehImovel = t => t === 'imovel' || t === 'terreno';
const INV_TIPOS = { imovel: 'Imóvel', terreno: 'Terreno', emprestimo: 'Empréstimo a terceiros', aplicacao_financeira: 'Aplicação financeira', acoes_fundos: 'Ações / fundos', participacao_empresa: 'Participação em empresa', maquinas_equipamentos: 'Máquinas / equipamentos', consorcio: 'Consórcio', criptoativos: 'Criptoativos', outro: 'Outro' };
const endImovel = x => [x.address, x.neighborhood, x.city, x.zip_code ? 'CEP ' + x.zip_code : ''].filter(Boolean).join(', ');
function invCalc(x) {
  const ls = x._entries || [];
  const aportes = num(x.invested_amount) + ls.filter(l => l.type === 'aporte').reduce((a, l) => a + num(l.amount), 0);
  const custos = ls.filter(l => l.type === 'custo').reduce((a, l) => a + num(l.amount), 0);
  const ps = x.installments || [];
  const pagas = ps.filter(p => p.paid).reduce((a, p) => a + num(p.amount), 0);
  const abertas = ps.filter(p => !p.paid).reduce((a, p) => a + num(p.amount), 0);
  const receb = ls.filter(l => l.type === 'retorno').reduce((a, l) => a + num(l.amount), 0) + pagas;
  const enc = x.status === 'encerrado';
  const atual = enc ? 0 : (x.current_amount != null ? num(x.current_amount) : (ps.length ? abertas : aportes));
  const saida = enc ? num(x.redemption_amount) : 0;
  const totalIn = aportes + custos;
  const resultado = receb + saida + atual - totalIn;
  return { aportes, custos, receb, atual, saida, totalIn, resultado, pct: totalIn ? resultado / totalIn * 100 : 0 };
}
function invParcelas() { const out = []; S.investimentos.filter(x => x.status !== 'encerrado').forEach(x => (x.installments || []).forEach((p, i) => { if (!p.paid) out.push({ ...p, idx: i, inv: x }); })); return out; }
function vInvest() {
  const all = S.investimentos;
  let list = all.slice().sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  if (filtroInv === 'ativos') list = list.filter(x => x.status !== 'encerrado');
  if (filtroInv === 'encerrados') list = list.filter(x => x.status === 'encerrado');
  const ativos = all.filter(x => x.status !== 'encerrado');
  const atual = ativos.reduce((a, x) => a + Number(x.current_amount ?? x.invested_amount ?? 0), 0);
  const seg = (k, l) => `<button data-act="filtro-inv" data-f="${k}" aria-pressed="${filtroInv === k}">${l}</button>`;
  return `
  <h2 class="sec">Outros investimentos <button class="btn sm pri" data-act="novo-inv">+ Novo investimento</button></h2>
  <div class="kpis" style="margin-top:0">
    <div class="kpi"><span class="lb">Valor atual (ativos)</span><span class="vl">${brl(atual)}</span><span class="sub">${ativos.length} investimento${ativos.length === 1 ? '' : 's'} ativo${ativos.length === 1 ? '' : 's'}</span></div>
  </div>
  <div class="toolbar" style="margin-top:14px"><div class="seg">${seg('ativos', 'Ativos')}${seg('encerrados', 'Encerrados')}${seg('todos', 'Todos')}</div></div>
  <div class="panel">${list.length ? `<div class="tbl"><table><thead><tr><th>Investimento</th><th>Tipo</th><th class="hide-sm">Início</th><th class="n">Aplicado</th><th class="n">Valor atual</th></tr></thead><tbody>
    ${list.map(x => `<tr class="click" data-act="ver-inv" data-id="${x.id}">
      <td><div style="font-weight:600">${esc(x.name)}</div><div class="small muted">${esc(ehImovel(x.type) ? endImovel(x) : (x.counterparty || ''))}</div></td>
      <td class="small">${esc(INV_TIPOS[x.type] || x.type)}${x.status === 'encerrado' ? '<div><span class="pill open">Encerrado</span></div>' : ''}</td>
      <td class="small hide-sm">${fdate(x.start_date)}</td>
      <td class="n">${brl(x.invested_amount)}</td>
      <td class="n">${x.status === 'encerrado' ? brl(x.redemption_amount) : brl(x.current_amount ?? x.invested_amount)}</td></tr>`).join('')}
  </tbody></table></div>` : `<div class="empty">${all.length ? 'Nenhum investimento neste filtro.' : 'Registre imóveis, empréstimos, aplicações e outros negócios.'}</div>`}</div>`;
}
function formInvest(x) {
  x = x || {};
  openModal(x.id ? 'Editar investimento' : 'Novo investimento', `
    <div class="fg">
      <label class="f full">Nome / descrição<input id="fi-nome" value="${esc(x.name)}" placeholder="Apartamento Águas Claras, empréstimo ao João…"></label>
      <label class="f">Tipo<select id="fi-tipo">${Object.entries(INV_TIPOS).map(([k, l]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Situação<select id="fi-status"><option value="ativo" ${(!x.status || x.status === 'ativo') ? 'selected' : ''}>Ativo</option><option value="encerrado" ${x.status === 'encerrado' ? 'selected' : ''}>Encerrado</option></select></label>
      <label class="f">Data do investimento<input id="fi-data" type="date" value="${esc(x.start_date || today())}"></label>
      <label class="f">Valor investido (R$)<input id="fi-valor" type="number" step="0.01" min="0" value="${esc(x.invested_amount)}"></label>
      <label class="f">Valor atual estimado (R$)<input id="fi-atual" type="number" step="0.01" min="0" value="${esc(x.current_amount)}" placeholder="igual ao investido"></label>
      <label class="f">Contraparte<input id="fi-contra" value="${esc(x.counterparty)}"></label>
      <label class="f">Rendimento esperado<input id="fi-rend" value="${esc(x.expected_return)}"></label>
    </div>
    <fieldset id="fi-imovel"><legend>Dados do imóvel</legend><div class="fg">
      <label class="f">Matrícula<input id="fi-mat" value="${esc(x.registration_number)}"></label>
      <label class="f full">Endereço<input id="fi-end" value="${esc(x.address)}"></label>
      <label class="f">Bairro<input id="fi-bairro" value="${esc(x.neighborhood)}"></label>
      <label class="f">Cidade / UF<input id="fi-cid" value="${esc(x.city)}"></label>
      <label class="f">CEP<input id="fi-cep" value="${esc(x.zip_code)}"></label>
    </div></fieldset>
    <fieldset><legend>Parcelas e taxa de juros</legend><div class="fg">
      <label class="f">Nº de parcelas<input id="fi-np" type="number" min="0" value="${esc(x.installment_count || 0)}"></label>
      <label class="f">Taxa de juros (%)<input id="fi-juros" type="number" min="0" step="0.01" value="${esc(x.interest_rate ?? '')}"></label>
      <label class="f">Período<select id="fi-per"><option value="mes" ${x.interest_period !== 'ano' ? 'selected' : ''}>ao mês</option><option value="ano" ${x.interest_period === 'ano' ? 'selected' : ''}>ao ano</option></select></label>
      <label class="f">1º vencimento<input id="fi-pv1" type="date" value="${esc(x.first_due_date || addMonths(x.start_date || today(), 1))}"></label>
    </div></fieldset>
    <div class="fg" id="fi-enc">
      <label class="f">Data de encerramento<input id="fi-dataenc" type="date" value="${esc(x.end_date)}"></label>
      <label class="f">Valor de venda / resgate (R$)<input id="fi-resg" type="number" step="0.01" min="0" value="${esc(x.redemption_amount)}"></label>
    </div>
    <label class="f">Observações<textarea id="fi-obs" rows="2">${esc(x.notes)}</textarea></label>`,
    `${x.id ? `<button class="btn danger" data-act="excluir-inv" data-id="${x.id}" data-confirm="1" style="margin-right:auto">Excluir</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-inv" data-id="${x.id || ''}">Salvar</button>`,
    root => {
      const st = document.getElementById('fi-status'); const sync = () => { document.getElementById('fi-enc').hidden = st.value !== 'encerrado'; }; st.addEventListener('change', sync); sync();
      const tp = document.getElementById('fi-tipo'); const syncT = () => { document.getElementById('fi-imovel').hidden = !ehImovel(tp.value); }; tp.addEventListener('change', syncT); syncT();
    });
}
async function salvarInvest(id) {
  const data = {
    company_id: companyId(), name: val('fi-nome'), type: val('fi-tipo'), status: val('fi-status'), start_date: val('fi-data'),
    invested_amount: num(val('fi-valor')), current_amount: val('fi-atual') ? num(val('fi-atual')) : undefined,
    counterparty: val('fi-contra') || undefined, expected_return: val('fi-rend') || undefined,
    installment_count: Number(val('fi-np')) || 0, interest_rate: val('fi-juros') ? num(val('fi-juros')) : undefined,
    interest_period: val('fi-per'), interest_system: 'price', first_due_date: val('fi-pv1') || undefined,
    notes: val('fi-obs') || undefined,
  };
  if (ehImovel(data.type)) Object.assign(data, { registration_number: val('fi-mat') || undefined, address: val('fi-end') || undefined, neighborhood: val('fi-bairro') || undefined, city: val('fi-cid') || undefined, zip_code: val('fi-cep') || undefined });
  if (!data.name) { toast('Informe o nome do investimento.'); return; }
  if (!data.invested_amount) { toast('Informe o valor investido.'); return; }
  if (data.status === 'encerrado') Object.assign(data, { end_date: val('fi-dataenc') || undefined, redemption_amount: val('fi-resg') ? num(val('fi-resg')) : undefined });
  const ok = id ? await w(() => Investments.update(id, data), 'Investimento atualizado')
    : await w(() => Investments.create(data), 'Investimento cadastrado');
  if (ok) { closeModal(); await loadAll(); if (id) verInvest(id); }
}
const TIPO_L = { retorno: 'Retorno recebido', aporte: 'Aporte adicional', custo: 'Custo / despesa' };
let openInvId = null;
function verInvest(id) {
  const x = S.investimentos.find(i => i.id === id); if (!x) return closeModal();
  const c = invCalc(x), ls = (x._entries || []).slice().sort((a, b) => (a.entry_date || '').localeCompare(b.entry_date || ''));
  const enc = x.status === 'encerrado';
  openModal(x.name, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="pill open">${esc(INV_TIPOS[x.type] || x.type)}</span>${enc ? '<span class="pill open">Encerrado</span>' : '<span class="pill sold">Ativo</span>'}<span class="small muted">${esc(x.counterparty || '')}</span></div>
    <div class="panel" style="padding:14px 16px"><dl class="ledger">
      <dt>Investido em ${fdate(x.start_date)}</dt><dd>${brl(x.invested_amount)}</dd>
      <dt class="tot">Total aplicado</dt><dd class="tot">${brl(c.totalIn)}</dd>
      <dt>Retornos recebidos</dt><dd class="pos">${brl(c.receb)}</dd>
      ${enc ? `<dt>Venda / resgate em ${fdate(x.end_date)}</dt><dd>${brl(c.saida)}</dd>` : `<dt>Valor atual estimado</dt><dd>${brl(c.atual)}</dd>`}
      <dt class="tot">Resultado</dt><dd class="tot ${c.resultado >= 0 ? 'pos' : 'neg'}">${brl(c.resultado)} (${c.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</dd>
    </dl></div>
    ${(x.installments || []).length ? `<fieldset><legend>Parcelas · ${x.installments.filter(p => p.paid).length} de ${x.installments.length} recebidas</legend>
      <div class="tbl preview" style="max-height:320px"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
      ${x.installments.map(p => `<tr><td>${p.number}/${x.installments.length}</td><td>${fdate(p.due_date)}</td><td class="n">${brl(p.amount)}</td><td><span class="pill ${p.paid ? 'paid' : 'open'}">${p.paid ? 'Paga' : 'A vencer'}</span></td>
        <td style="text-align:right">${p.paid ? `<button class="btn sm ghost" data-act="inv-estornar" data-id="${p.id}" data-inv="${x.id}">Desfazer</button>` : `<button class="btn sm" data-act="inv-pagar" data-id="${p.id}" data-inv="${x.id}">Recebida</button>`}</td></tr>`).join('')}
      </tbody></table></div></fieldset>` : ''}
    <fieldset><legend>Movimentações</legend>
      ${ls.length ? `<div class="tbl"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th class="n">Valor</th><th></th></tr></thead><tbody>
        ${ls.map(l => `<tr><td class="small">${fdate(l.entry_date)}</td><td class="small">${TIPO_L[l.type] || l.type}</td><td class="small">${esc(l.description)}</td><td class="n ${l.type === 'retorno' ? 'pos' : ''}">${brl(l.amount)}</td><td style="text-align:right"><button class="btn sm ghost danger" data-act="excluir-lanc" data-inv="${x.id}" data-lid="${l.id}" data-confirm="1">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="hint">Lance aqui o que entra (aluguéis, juros, dividendos) e o que sai (novos aportes, IPTU, taxas).</div>`}
      <div class="fg">
        <label class="f">Data<input id="fl-data" type="date" value="${today()}"></label>
        <label class="f">Tipo<select id="fl-tipo">${Object.entries(TIPO_L).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <label class="f">Descrição<input id="fl-desc"></label>
        <label class="f">Valor (R$)<input id="fl-valor" type="number" step="0.01" min="0"></label>
      </div>
      <div><button class="btn sm pri" data-act="add-lanc" data-inv="${x.id}">Lançar</button></div>
    </fieldset>`,
    `<button class="btn" data-act="editar-inv" data-id="${x.id}">Editar dados</button><button class="btn pri" data-act="fechar">Fechar</button>`);
  openInvId = id;
}
async function marcarInvParcela(invId, instId, paid) {
  if (await w(() => InvestmentInstallments.markPaid(instId, paid), paid ? 'Parcela marcada como recebida' : 'Recebimento desfeito')) { await loadAll(); if (openInvId === invId) verInvest(invId); }
}
async function addLanc(invId) {
  const valor = num(val('fl-valor'));
  if (!valor) { toast('Informe o valor.'); return; }
  if (await w(() => InvestmentEntries.create({ company_id: companyId(), investment_id: invId, entry_date: val('fl-data') || today(), type: val('fl-tipo'), description: val('fl-desc') || undefined, amount: valor }), 'Movimentação lançada')) { await loadAll(); verInvest(invId); }
}
async function excluirLanc(invId, lid) {
  if (await w(() => InvestmentEntries.remove(lid), 'Movimentação excluída')) { await loadAll(); verInvest(invId); }
}

function vClientes() {
  const q = buscaCli.trim().toLowerCase();
  let list = S.clientes.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  if (q) list = list.filter(c => [c.name, c.document, c.phone, c.city].join(' ').toLowerCase().includes(q));
  return `
  <h2 class="sec">Clientes <button class="btn sm" data-act="novo-cliente">+ Novo cliente</button></h2>
  <div class="toolbar"><input type="search" id="busca-cli" placeholder="Buscar por nome, CPF, telefone ou cidade" value="${esc(buscaCli)}"></div>
  <div class="panel">${list.length ? `<div class="tbl"><table><thead><tr><th>Nome</th><th>CPF / CNPJ</th><th>Telefone</th><th>Compras</th><th class="n">Saldo devedor</th></tr></thead><tbody>
    ${list.map(c => { const vs = S.vendas.filter(s => s.peopleId === c.id); const saldo = vs.reduce((a, s) => a + aReceber(s), 0); const late = vs.some(s => parcelasDaVenda(s).some(p => parcStatus(p) === 'late'));
      return `<tr class="click" data-act="editar-cliente" data-id="${c.id}"><td style="font-weight:600">${esc(c.name)}</td><td class="small" style="font-family:var(--f-mono)">${esc(c.document || '—')}</td><td class="small">${esc(c.phone || '—')}</td>
      <td class="small">${vs.length ? vs.map(s => esc(nomeVeic(veic(s.vehicleId)))).join(', ') : '<span class="muted">—</span>'}</td><td class="n ${late ? 'neg' : ''}">${saldo ? brl(saldo) : '—'}</td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="empty">${S.clientes.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</div>`}</div>`;
}

/* ---------- modais ---------- */
function openModal(title, body, footer, onMount) {
  modalRoot.innerHTML = `<div class="overlay" data-overlay="1"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h2>${esc(title)}</h2><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
    <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div></div>`;
  document.body.style.overflow = 'hidden';
  const f = modalRoot.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
  if (onMount) onMount(modalRoot);
}
function closeModal() { modalRoot.innerHTML = ''; document.body.style.overflow = ''; }
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

function formVeiculo(v) {
  v = v || {};
  openModal(v.id ? 'Editar veículo' : 'Cadastrar compra de veículo', `
    <fieldset><legend>Veículo</legend><div class="fg">
      <label class="f">Placa<input id="fv-placa" value="${esc(v.license_plate)}" placeholder="ABC1D23" maxlength="8" style="text-transform:uppercase"></label>
      <label class="f">Marca<input id="fv-marca" value="${esc(v.brand)}"></label>
      <label class="f">Modelo / versão<input id="fv-modelo" value="${esc(v.model)}"></label>
      <label class="f">Ano fab./mod.<input id="fv-ano" value="${esc(v.fabrication_year && v.model_year && v.fabrication_year !== v.model_year ? v.fabrication_year + '/' + v.model_year : v.fabrication_year)}" placeholder="2019/2020"></label>
      <label class="f">Cor<input id="fv-cor" value="${esc(v.color)}"></label>
      <label class="f">Quilometragem<input id="fv-km" type="number" min="0" value="${esc(v.mileage)}"></label>
      <label class="f">Renavam<input id="fv-renavam" value="${esc(v.reindeer)}" inputmode="numeric"></label>
      <label class="f">Chassi<input id="fv-chassi" value="${esc(v.vin_number)}" style="text-transform:uppercase"></label>
    </div></fieldset>
    <fieldset><legend>Compra</legend><div class="fg">
      <label class="f">Data da compra<input id="fv-data" type="date" value="${esc(v.purchase_date ? v.purchase_date.slice(0, 10) : today())}"></label>
      <label class="f">Valor pago (R$)<input id="fv-valor" type="number" step="0.01" min="0" value="${esc(v.purchase_price)}"></label>
    </div></fieldset>
    <fieldset><legend>Origem do veículo</legend><div class="fg">
      <label class="f full">Fornecedor cadastrado<select id="fv-forn"><option value="">— Não vincular (preencher à mão) —</option>${S.fornecedores.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map(f => `<option value="${f.id}" ${f.id === v.purchase_people_id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
      <label class="f">Tipo de origem<select id="fv-tipoorig"><option value="">Selecione…</option>${ORIGENS.map(o => `<option ${v.origin_type === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="f">Comprado de (nome do vendedor, leiloeiro ou loja)<input id="fv-origem" value="${esc(v.origin_name)}"></label>
      <label class="f">Contato / documento do vendedor<input id="fv-origcont" value="${esc(v.origin_contact)}"></label>
      <label class="f">Cidade / UF de origem<input id="fv-origcid" value="${esc(v.origin_city)}"></label>
      <label class="f full">Detalhes da origem<input id="fv-origdet" value="${esc(v.origin_details)}" placeholder="Nº do lote, leilão, nota fiscal…"></label>
    </div></fieldset>
    <fieldset><legend>Anotações</legend><div class="fg">
      <label class="f full">Observações<textarea id="fv-obs" rows="2">${esc(v.note)}</textarea></label>
    </div></fieldset>`,
    `${v.id ? `<button class="btn danger" data-act="excluir-veiculo" data-id="${v.id}" data-confirm="1" style="margin-right:auto">Excluir veículo</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-veiculo" data-id="${v.id || ''}">Salvar</button>`,
    () => {
      const sel = document.getElementById('fv-forn');
      sel.addEventListener('change', () => {
        const f = forn(sel.value); if (!f) return;
        document.getElementById('fv-origem').value = f.name || '';
        document.getElementById('fv-origcont').value = [f.phone, f.document].filter(Boolean).join(' · ');
      });
    });
}
async function salvarVeiculo(id) {
  const anoRaw = val('fv-ano');
  const [anoFab, anoMod] = anoRaw.includes('/') ? anoRaw.split('/') : [anoRaw, anoRaw];
  const data = {
    company_id: companyId(), role: 1,
    license_plate: val('fv-placa').toUpperCase(), brand: val('fv-marca') || undefined, model: val('fv-modelo') || undefined,
    fabrication_year: anoFab || undefined, model_year: anoMod || undefined, color: val('fv-cor') || undefined,
    mileage: val('fv-km') ? Number(val('fv-km')) : undefined, reindeer: val('fv-renavam') || undefined, vin_number: val('fv-chassi').toUpperCase() || undefined,
    purchase_date: val('fv-data'), purchase_price: num(val('fv-valor')), purchase_people_id: val('fv-forn') || undefined,
    origin_type: val('fv-tipoorig') || undefined, origin_name: val('fv-origem') || undefined, origin_contact: val('fv-origcont') || undefined,
    origin_city: val('fv-origcid') || undefined, origin_details: val('fv-origdet') || undefined, note: val('fv-obs') || undefined,
  };
  if (!data.model && !data.license_plate) { toast('Informe pelo menos a placa ou o modelo.'); return; }
  if (!data.purchase_price) { toast('Informe o valor pago.'); return; }
  const ok = id ? await w(() => Vehicles.update(id, data), 'Veículo atualizado')
    : await w(() => Vehicles.create(data), 'Veículo cadastrado');
  if (ok) { closeModal(); await loadAll(); }
}

let openVeicId = null;
function verVeiculo(id) {
  const v = veic(id); if (!v) return closeModal();
  const s = vendaDe(id), c = s && pessoaPorId(s.peopleId), l = s ? num(s.vehicleSaleContract?.saleValue ?? s.amount) - custo(v) : null;
  const desp = (v._expenses || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const dias = v.purchase_date ? daysBetween(v.purchase_date, s ? s.date_sale : today()) : null;
  openModal(nomeVeic(v), `
    <div class="veh" style="justify-content:space-between;flex-wrap:wrap">
      <div class="veh">${plate(v.license_plate)}<div class="small muted">${[v.color, v.mileage ? Number(v.mileage).toLocaleString('pt-BR') + ' km' : '', v.reindeer ? 'Renavam ' + esc(v.reindeer) : ''].filter(Boolean).join(' · ')}</div></div>
      ${v.flip_status === 'vendido' ? '<span class="pill sold">Vendido</span>' : '<span class="pill stock">Em estoque</span>'}
    </div>
    <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="panel" style="padding:14px 16px"><dl class="ledger">
        <dt>Compra em ${fdate(v.purchase_date)}</dt><dd>${brl(v.purchase_price)}</dd>
        <dt>Despesas (${desp.length})</dt><dd>${brl(despTotal(v))}</dd>
        <dt class="tot">Custo total</dt><dd class="tot">${brl(custo(v))}</dd>
        ${s ? `<dt>Venda em ${fdate(s.date_sale)}</dt><dd>${brl(s.vehicleSaleContract?.saleValue ?? s.amount)}</dd><dt class="tot">Lucro</dt><dd class="tot ${l >= 0 ? 'pos' : 'neg'}">${brl(l)}</dd>` : ''}
        ${dias != null ? `<dt>${s ? 'Dias até vender' : 'Dias em estoque'}</dt><dd>${dias}</dd>` : ''}
      </dl></div>
      <div class="panel" style="padding:14px 16px;font-size:14px">
        ${s ? `<div class="hint" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600">Comprador</div><div style="font-weight:600;margin-top:4px">${esc(c ? c.name : 'Cliente removido')}</div>`
          : `${v.note ? `<div class="hint" style="margin-top:8px">Observações</div><div>${esc(v.note)}</div>` : ''}<div style="margin-top:12px"><button class="btn sm pri" data-act="nova-venda" data-veiculo="${v.id}">Registrar venda</button></div>`}
      </div>
    </div>
    <div class="panel" style="padding:14px 16px;font-size:14px"><div class="hint" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600">Origem</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"><span class="pill open">${esc(tipoOrig(v))}</span><b>${esc(v.origin_name || '')}</b></div>
      <div class="small muted" style="margin-top:4px">${[v.origin_contact, v.origin_city].filter(Boolean).map(esc).join(' · ')}</div>
      ${v.origin_details ? `<div class="small" style="margin-top:4px">${esc(v.origin_details)}</div>` : ''}</div>
    <fieldset><legend>Despesas com o veículo</legend>
      ${desp.length ? `<div class="tbl preview" style="max-height:none"><table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="n">Valor</th><th></th></tr></thead><tbody>
        ${desp.map(d => `<tr><td class="small">${fdate(d.date)}</td><td class="small">${esc(CAT_LABELS[d.category] || d.category)}</td><td class="small">${esc(d.description)}</td><td class="n">${brl(d.amount)}</td><td style="text-align:right"><button class="btn sm ghost danger" data-act="excluir-despesa" data-veiculo="${v.id}" data-did="${d.id}" data-confirm="1">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="hint">Nenhuma despesa lançada.</div>`}
      <div class="fg">
        <label class="f">Data<input id="fd-data" type="date" value="${today()}"></label>
        <label class="f">Categoria<select id="fd-cat">${CATS.map(c => `<option value="${c}">${CAT_LABELS[c]}</option>`).join('')}</select></label>
        <label class="f">Descrição<input id="fd-desc" placeholder="Troca de embreagem"></label>
        <label class="f">Valor (R$)<input id="fd-valor" type="number" step="0.01" min="0"></label>
      </div>
      <div><button class="btn sm pri" data-act="add-despesa" data-veiculo="${v.id}">Lançar despesa</button></div>
    </fieldset>`,
    `<button class="btn" data-act="editar-veiculo" data-id="${v.id}">Editar dados</button><button class="btn pri" data-act="fechar">Fechar</button>`);
  openVeicId = id;
  VehicleExpenses.list(companyId(), id).then(res => { v._expenses = res.data; if (openVeicId === id) verVeiculo(id); }).catch(() => {});
}
async function addDespesa(vid) {
  const valor = num(val('fd-valor'));
  if (!valor) { toast('Informe o valor da despesa.'); return; }
  if (await w(() => VehicleExpenses.create({ company_id: companyId(), vehicle_id: vid, category: val('fd-cat'), description: val('fd-desc') || 'Despesa', date: val('fd-data') || today(), amount: valor }), 'Despesa lançada')) { await loadAll(); verVeiculo(vid); }
}
async function excluirDespesa(vid, did) {
  if (await w(() => VehicleExpenses.remove(did), 'Despesa excluída')) { await loadAll(); verVeiculo(vid); }
}

function formCliente(c) {
  c = c || {};
  openModal(c.id ? 'Cliente' : 'Novo cliente', `
    <div class="fg">
      <label class="f full">Nome completo<input id="fc-nome" value="${esc(c.name)}"></label>
      <label class="f">CPF / CNPJ<input id="fc-cpf" value="${esc(c.document)}" inputmode="numeric"></label>
      <label class="f">Telefone / WhatsApp<input id="fc-tel" value="${esc(c.phone)}" inputmode="tel"></label>
      <label class="f">E-mail<input id="fc-email" type="email" value="${esc(c.email)}"></label>
    </div>`,
    `${c.id ? `<button class="btn danger" data-act="excluir-cliente" data-id="${c.id}" data-confirm="1" style="margin-right:auto">Excluir cliente</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-cliente" data-id="${c.id || ''}">Salvar</button>`);
}
async function salvarCliente(id) {
  const data = { company_id: companyId(), name: val('fc-nome'), document: val('fc-cpf') || undefined, phone: val('fc-tel') || undefined, email: val('fc-email') || undefined, roles: [2] };
  if (!data.name) { toast('Informe o nome do cliente.'); return; }
  const ok = id ? await w(() => People.update(id, data), 'Cliente atualizado')
    : await w(() => People.create(data), 'Cliente cadastrado');
  if (ok) { closeModal(); await loadAll(); }
}

function formVenda(opts) {
  const disponiveis = S.veiculos.filter(v => v.flip_status !== 'vendido');
  if (!disponiveis.length) { toast('Não há veículo em estoque para vender. Cadastre uma compra primeiro.'); return; }
  const vSel = opts.veiculoId || disponiveis[0].id;
  openModal('Registrar venda', `
    <fieldset><legend>Veículo e valor</legend><div class="fg">
      <label class="f full">Veículo<select id="fs-veic">${disponiveis.map(v => `<option value="${v.id}" ${v.id === vSel ? 'selected' : ''}>${esc((v.license_plate ? v.license_plate + ' · ' : '') + nomeVeic(v))} (custo ${brl(custo(v))})</option>`).join('')}</select></label>
      <label class="f">Data da venda<input id="fs-data" type="date" value="${today()}"></label>
      <label class="f">Valor de venda (R$)<input id="fs-valor" type="number" step="0.01" min="0"></label>
      <label class="f full">Forma de venda<select id="fs-forma">${FORMAS.map(f => `<option>${f}</option>`).join('')}</select></label>
      <div class="full hint" id="fs-lucro"></div>
    </div></fieldset>
    <fieldset><legend>Comprador</legend><div class="fg">
      <label class="f full">Cliente<select id="fs-cli"><option value="__novo">+ Cadastrar novo cliente</option>${S.clientes.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map(c => `<option value="${c.id}">${esc(c.name)}${c.document ? ' · ' + esc(c.document) : ''}</option>`).join('')}</select></label>
    </div>
    <div class="fg" id="fs-novo">
      <label class="f full">Nome completo<input id="fn-nome"></label>
      <label class="f">CPF / CNPJ<input id="fn-cpf" inputmode="numeric"></label>
      <label class="f">Telefone / WhatsApp<input id="fn-tel" inputmode="tel"></label>
      <label class="f">E-mail<input id="fn-email" type="email"></label>
    </div></fieldset>
    <fieldset><legend>Parcelamento</legend>
      <div class="fg">
        <label class="f">Entrada (R$)<input id="fs-entrada" type="number" step="0.01" min="0" value="0"></label>
        <label class="f">Nº de parcelas<input id="fs-np" type="number" min="0" max="120" step="1" value="0"></label>
        <label class="f">1º vencimento<input id="fs-venc" type="date" value="${addMonths(today(), 1)}"></label>
        <label class="f">Valor da parcela (R$)<input id="fs-vp" type="number" step="0.01" min="0" placeholder="calculado"></label>
      </div>
      <div class="hint">Deixe 0 parcelas para venda recebida integralmente.</div>
      <div id="fs-prev"></div>
    </fieldset>
    <label class="f">Observações<textarea id="fs-obs" rows="2"></textarea></label>`,
    `<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-venda">Salvar venda</button>`,
    root => {
      const cliSel = document.getElementById('fs-cli');
      if (S.clientes.length) cliSel.value = '__novo';
      const syncCli = () => { document.getElementById('fs-novo').hidden = cliSel.value !== '__novo'; };
      cliSel.addEventListener('change', syncCli); syncCli();
      const upd = () => {
        const v = veic(document.getElementById('fs-veic').value), valor = num(val('fs-valor'));
        const lb = document.getElementById('fs-lucro');
        if (v && valor) { const l = valor - custo(v); lb.innerHTML = `Lucro previsto: <b class="${l >= 0 ? 'pos' : 'neg'}">${brl(l)}</b> sobre custo de ${brl(custo(v))}`; } else lb.textContent = v ? `Custo total do veículo: ${brl(custo(v))}` : '';
        const pv = document.getElementById('fs-prev');
        const ps = gerarParcelas();
        if (!ps.length) { pv.innerHTML = ''; return; }
        const tot = num(val('fs-entrada')) + ps.reduce((a, p) => a + p.valor, 0);
        pv.innerHTML = `<div class="preview"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>${ps.map(p => `<tr><td>${p.n}/${ps.length}</td><td>${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td></tr>`).join('')}</tbody></table></div>
          <div class="hint" style="margin-top:6px">Entrada + parcelas = ${brl(tot)}${Math.abs(tot - valor) > 0.05 ? ` (diferença de ${brl(tot - valor)} em relação ao valor de venda)` : ''}</div>`;
      };
      root.querySelectorAll('input,select').forEach(el => el.addEventListener('input', upd));
      upd();
    });
}
function gerarParcelas() {
  const n = Math.max(0, Math.min(120, parseInt(val('fs-np')) || 0));
  if (!n) return [];
  const valor = num(val('fs-valor')), entrada = num(val('fs-entrada')), venc = val('fs-venc') || addMonths(today(), 1);
  const saldo = Math.max(0, valor - entrada);
  let vp = num(val('fs-vp')), last = null;
  if (!vp) { vp = Math.floor(saldo / n * 100) / 100; last = round2(saldo - vp * (n - 1)); }
  return Array.from({ length: n }, (_, i) => ({ n: i + 1, venc: addMonths(venc, i), valor: (i === n - 1 && last != null) ? last : vp }));
}
async function salvarVenda() {
  const veiculoId = val('fs-veic');
  const valor = num(val('fs-valor'));
  if (!valor) { toast('Informe o valor de venda.'); return; }
  let clienteId = val('fs-cli');
  if (clienteId === '__novo') {
    const nome = val('fn-nome'); if (!nome) { toast('Informe o nome do comprador ou escolha um cliente.'); return; }
    try {
      const novo = await People.create({ company_id: companyId(), name: nome, document: val('fn-cpf') || undefined, phone: val('fn-tel') || undefined, email: val('fn-email') || undefined, roles: [2] });
      clienteId = novo.id;
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Não foi possível cadastrar o cliente.'); return; }
  }

  const entrada = num(val('fs-entrada'));
  const parcelas = gerarParcelas();
  const dataVenda = val('fs-data') || today();
  const plots = [];
  if (entrada > 0) plots.push({ portion: 1, form_payment: 9, date_due: dataVenda, amount: entrada, status: 1 });
  parcelas.forEach((p, i) => plots.push({ portion: plots.length + 1, form_payment: 9, date_due: p.venc, amount: p.valor, status: 0 }));
  if (!plots.length) plots.push({ portion: 1, form_payment: 9, date_due: dataVenda, amount: valor, status: 1 });

  const config = Auth.company.config || {};
  // sales.user_id aponta pra tabela de pessoas (não pra users): precisa ser o
  // cadastro de pessoa do usuário logado nesta empresa.
  let minhaPessoa;
  try { minhaPessoa = await People.me(companyId()); }
  catch (e) { toast('Não foi possível identificar seu cadastro de pessoa nesta empresa.'); return; }

  const payload = {
    companyId: companyId(), peopleId: clienteId, userId: minhaPessoa.id, role: 1, status: 3,
    vehicleId: veiculoId, categoryId: config.sale_category_default_id, bankAccountId: config.sale_bank_account_default_id,
    date_sale: dataVenda, note: val('fs-obs') || undefined,
    vehicleSaleContract: { vehicleId: veiculoId, buyerPeopleId: clienteId, saleValue: valor, downPayment: entrada, installmentCount: parcelas.length, firstDueDate: parcelas[0]?.venc },
    plots,
  };

  const ok = await w(async () => {
    await Sales.create(payload);
    await Vehicles.update(veiculoId, { flip_status: 'vendido', sale_price: valor, sale_date: dataVenda, sale_people_id: clienteId });
  }, 'Venda registrada');
  if (ok) { closeModal(); await loadAll(); setTab('vendas'); }
}
async function excluirVenda(id, veiculoId) {
  const ok = await w(async () => {
    await Sales.remove(id);
    await Vehicles.update(veiculoId, { flip_status: 'em_estoque', sale_price: null, sale_date: null, sale_people_id: null });
  }, 'Venda cancelada. O veículo voltou ao estoque.');
  if (ok) await loadAll();
}
async function marcarParcela(billId, pago) {
  const bill = await Bills.get(billId);
  await w(() => Bills.update(billId, { category_id: bill.categoryId, role: bill.role, name: bill.name, date_competence: bill.date_competence, date_due: bill.date_due, amount: bill.amount, repeat: false, form_payment: bill.form_payment, status: pago ? 1 : 0, date_received: pago ? today() : null }), pago ? 'Parcela marcada como recebida' : 'Recebimento desfeito');
  await loadAll();
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-act],[data-overlay]');
  if (!t) return;
  if (t.dataset.overlay && e.target === t) return closeModal();
  if (t.dataset.tab) return setTab(t.dataset.tab);
  const a = t.dataset.act; if (!a) return;
  if (t.dataset.confirm && !t.classList.contains('arm')) {
    const txt = t.textContent; t.classList.add('arm'); t.textContent = 'Confirmar?';
    setTimeout(() => { if (t.isConnected) { t.classList.remove('arm'); t.textContent = txt; } }, 3500); return;
  }
  switch (a) {
    case 'fechar': closeModal(); openVeicId = null; break;
    case 'sair': Auth.clear(); window.location.reload(); break;
    case 'novo-veiculo': formVeiculo(); break;
    case 'editar-veiculo': formVeiculo(veic(t.dataset.id)); break;
    case 'salvar-veiculo': salvarVeiculo(t.dataset.id); break;
    case 'excluir-veiculo': {
      if (vendaDe(t.dataset.id)) { toast('Este veículo tem uma venda registrada. Cancele a venda antes.'); break; }
      if (await w(() => Vehicles.remove(t.dataset.id), 'Veículo excluído')) { closeModal(); await loadAll(); } break; }
    case 'ver-veiculo': verVeiculo(t.dataset.id); break;
    case 'add-despesa': addDespesa(t.dataset.veiculo); break;
    case 'excluir-despesa': excluirDespesa(t.dataset.veiculo, t.dataset.did); break;
    case 'nova-venda': formVenda({ veiculoId: t.dataset.veiculo }); break;
    case 'salvar-venda': salvarVenda(); break;
    case 'excluir-venda': excluirVenda(t.dataset.id, t.dataset.veiculo); break;
    case 'pagar': marcarParcela(t.dataset.bill, true); break;
    case 'estornar': marcarParcela(t.dataset.bill, false); break;
    case 'novo-cliente': formCliente(); break;
    case 'novo-fornecedor': formFornecedor(); break;
    case 'novo-inv': formInvest(); break;
    case 'ver-inv': verInvest(t.dataset.id); break;
    case 'editar-inv': formInvest(S.investimentos.find(i => i.id === t.dataset.id)); break;
    case 'salvar-inv': salvarInvest(t.dataset.id); break;
    case 'excluir-inv': if (await w(() => Investments.remove(t.dataset.id), 'Investimento excluído')) { closeModal(); await loadAll(); } break;
    case 'inv-pagar': marcarInvParcela(t.dataset.inv, t.dataset.id, true); break;
    case 'inv-estornar': marcarInvParcela(t.dataset.inv, t.dataset.id, false); break;
    case 'add-lanc': addLanc(t.dataset.inv); break;
    case 'excluir-lanc': excluirLanc(t.dataset.inv, t.dataset.lid); break;
    case 'filtro-inv': filtroInv = t.dataset.f; render(); break;
    case 'go-inv': setTab('investimentos'); break;
    case 'editar-fornecedor': formFornecedor(forn(t.dataset.id)); break;
    case 'salvar-fornecedor': salvarFornecedor(t.dataset.id); break;
    case 'excluir-fornecedor': if (await w(() => People.remove(t.dataset.id), 'Fornecedor excluído')) { closeModal(); await loadAll(); } break;
    case 'editar-cliente': formCliente(cli(t.dataset.id)); break;
    case 'salvar-cliente': salvarCliente(t.dataset.id); break;
    case 'excluir-cliente': if (await w(() => People.remove(t.dataset.id), 'Cliente excluído')) { closeModal(); await loadAll(); } break;
    case 'ver-origem': filtroOrigem = t.dataset.o; filtroVeic = 'todos'; setTab('veiculos'); break;
    case 'filtro-veic': filtroVeic = t.dataset.f; render(); break;
    case 'filtro-venda': filtroVenda = t.dataset.f; render(); break;
    case 'filtro-forn': filtroForn = t.dataset.f; render(); break;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'busca-veic') { busca = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById('busca-veic'); el.focus(); el.setSelectionRange(pos, pos); }
  if (e.target.id === 'busca-forn') { buscaForn = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById('busca-forn'); el.focus(); el.setSelectionRange(pos, pos); }
  if (e.target.id === 'busca-cli') { buscaCli = e.target.value; const pos = e.target.selectionStart; render(); const el = document.getElementById('busca-cli'); el.focus(); el.setSelectionRange(pos, pos); }
});
document.addEventListener('change', e => { if (e.target.id === 'filtro-origem') { filtroOrigem = e.target.value; render(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalRoot.innerHTML) { closeModal(); openVeicId = null; } });

/* ---------- login / chrome ---------- */
function setChrome(on) {
  document.getElementById('top-actions').hidden = !on;
  document.getElementById('tabs').hidden = !on;
  document.getElementById('lock').hidden = on;
  app.hidden = !on;
  if (on) document.getElementById('who').textContent = (Auth.user?.name || Auth.user?.email || '').split(' ')[0];
}
let lockErr = '';
function renderLock() {
  setChrome(false);
  const el = document.getElementById('lock');
  const logo = document.querySelector('header .logo');
  const logoTag = logo ? `<img class="logo" alt="${esc(logo.alt)}" src="${logo.src}">` : '';
  el.innerHTML = `<form class="lock-card" id="lk-form" novalidate>${logoTag}
    <h2>Entrar no sistema</h2>
    <label class="f">E-mail<input id="lk-email" type="email" autocomplete="username" required></label>
    <label class="f">Senha<input id="lk-senha" type="password" autocomplete="current-password" required></label>
    <div class="err" id="lk-err">${esc(lockErr)}</div>
    <button class="btn pri" type="submit" style="justify-content:center">Entrar</button>`;
  setTimeout(() => document.getElementById('lk-email')?.focus(), 30);
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'lk-form') return;
  e.preventDefault();
  const email = val('lk-email'), senha = document.getElementById('lk-senha').value;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await Auth.signin(email, senha);
    lockErr = ''; boot();
  } catch (err) {
    lockErr = err instanceof ApiError ? err.message : 'Não foi possível entrar.';
    document.getElementById('lk-err').textContent = lockErr;
  } finally { btn.disabled = false; }
});

function boot() {
  if (!Auth.load() && !Auth.token) { renderLock(); return; }
  loadAll();
}
boot();
})();

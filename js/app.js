(() => {
const { Auth, ApiError, Vehicles, VehicleExpenses, People, Sales, Bills, Categories, Configs, Investments, InvestmentInstallments, InvestmentEntries } = window.Garagem;

const S = { veiculos: [], clientes: [], fornecedores: [], vendas: [], investimentos: [], contas: [], categorias: [], config: null };
let tab = 'painel', filtroVeic = 'todos', filtroOrigem = '', busca = '', buscaCli = '', buscaForn = '', filtroForn = '', filtroVenda = 'abertas', filtroInv = 'ativos', filtroPagar = 'abertas';
let loaded = false, loading = true;
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const CATS = ['manutencao', 'funilaria', 'pneus', 'eletrica', 'documentacao', 'ipva', 'multas', 'vistoria', 'limpeza', 'comissao', 'anuncio', 'outro'];
const CAT_LABELS = { manutencao: 'Mecânica', funilaria: 'Funilaria e pintura', pneus: 'Pneus', eletrica: 'Elétrica', documentacao: 'Documentação / transferência', ipva: 'IPVA / licenciamento', multas: 'Multas', vistoria: 'Vistoria / laudo', limpeza: 'Limpeza / estética', comissao: 'Comissão', anuncio: 'Anúncio', outro: 'Outros' };
const ORIGENS = ['Particular', 'Leilão', 'Loja / revenda', 'Troca (veio em uma venda)', 'Consignação', 'Financeira / banco (retomado)', 'Locadora / frotista', 'Outra'];
const tipoOrig = v => v.origin_type || 'Não informada';
const FORMAS = ['À vista (dinheiro / Pix)', 'Financiamento bancário', 'Cartão de crédito', 'Parcelado direto (carnê / promissória)', 'Troca + diferença', 'Consórcio', 'Outra'];
const TIPOS_FORN = ['Vendedor de veículos', 'Prestador de serviço', 'Vendedor e prestador'];
// Meio de pagamento da compra -> form_payment das contas (mesma tabela do ERP: 0 boleto, 1 cartão de crédito, 5 cheque, 9 dinheiro, 10 PIX, 12 transferência)
const MEIOS_COMPRA = { 'Dinheiro': 9, 'PIX': 10, 'Transferência / TED': 12, 'Cartão de crédito': 1, 'Boleto': 0, 'Cheque': 5, 'Nota promissória': 0, 'Financiamento': 12, 'Outro': 0 };
const COND = { a_vista: 'À vista', parcelado: 'Parcelado' };
const CATS_CONTA = ['Despesa de veículo', 'Documentação / impostos', 'Aluguel', 'Água / luz / internet / telefone', 'Salários / comissões', 'Fornecedor', 'Empréstimo / financiamento', 'Outros'];
const CAT_COMPRA = 'Compra de veículos';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const d10 = d => d ? String(d).slice(0, 10) : '';
const fdate = d => d ? d10(d).split('-').reverse().join('/') : '—';
const iso = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
const today = () => iso(new Date());
const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1 + n, 1); const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(); dt.setDate(Math.min(d, last)); return iso(dt); };
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const daysBetween = (a, b) => { const p = s => { const [y, m, d] = d10(s).split('-').map(Number); return new Date(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 86400000); };
const round2 = n => Math.round(n * 100) / 100;
const pl = (n, a, b) => n + ' ' + (n === 1 ? a : b);

function companyId() { return Auth.company.id; }

const despesasDe = v => v._expenses || [];
const despTotal = v => v._expenses ? v._expenses.reduce((a, d) => a + num(d.amount), 0) : Number(v.total_expenses || 0);
const custo = v => num(v.purchase_price) + despTotal(v);
const vendaDe = vid => S.vendas.find(s => s.vehicleId === vid && s.status !== 4);
const veic = id => S.veiculos.find(v => v.id === id);
const cli = id => S.clientes.find(c => c.id === id);
const forn = id => id ? S.fornecedores.find(f => f.id === id) : null;
const pessoaPorId = id => S.clientes.find(c => c.id === id) || S.fornecedores.find(f => f.id === id);
const tipoForn = f => f.supplier_type || 'Vendedor de veículos';
const vendeVeic = f => tipoForn(f) !== 'Prestador de serviço';
const prestaServ = f => tipoForn(f) !== 'Vendedor de veículos';
const cidadePessoa = p => (p && p.address && p.address.city) || '';
const endPessoa = p => (p && p.address && p.address.address) || '';
const fornOpts = (sel, pred) => S.fornecedores.filter(pred).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.name)}${cidadePessoa(f) ? ' · ' + esc(cidadePessoa(f)) : ''}</option>`).join('');
const nomeVeic = v => v ? [v.brand, v.model, v.fabrication_year].filter(Boolean).join(' ') : 'Veículo removido';
const plate = p => `<span class="plate"><i>BRASIL</i><b>${esc((p || '—').toUpperCase())}</b></span>`;
const parcStatus = p => p.pago ? 'paid' : (p.venc < today() ? 'late' : (daysBetween(today(), p.venc) <= 7 ? 'soon' : 'open'));
const parcLabel = { paid: 'Paga', late: 'Vencida', soon: 'Vence logo', open: 'A vencer' };

const recebido = s => s.parcelas.length ? (s.entradaBill ? s.entradaBill.valor : 0) + s.parcelas.filter(p => p.pago).reduce((a, p) => a + p.valor, 0) : s.valor;
const aReceber = s => s.parcelas.filter(p => !p.pago).reduce((a, p) => a + p.valor, 0);

/* ---------- compra do veículo (forma de pagamento e parcelas em Contas a pagar) ---------- */
const condCompra = v => COND[v.purchase_condition] || '';
const meioCompra = v => v.purchase_payment_method || '';
const contasVeic = v => v ? S.contas.filter(c => c.compra && c.vehicleId === v.id).sort((a, b) => a.venc.localeCompare(b.venc)) : [];
const nParcCompra = v => contasVeic(v).length;
const compraSaldo = v => contasVeic(v).filter(p => !p.pago).reduce((a, p) => a + p.valor, 0);
const compraPagas = v => contasVeic(v).filter(p => p.pago).length;
const parcCompraTxt = v => { const ps = contasVeic(v); if (!ps.length) return 'parcelas não informadas'; return `${num(v.purchase_down_payment) ? 'entrada de ' + brl(v.purchase_down_payment) + ' + ' : ''}${ps.length}x de ${brl(ps[0].valor)}`; };
const formaCompraTxt = v => { const c = condCompra(v), m = meioCompra(v); if (!c) return ''; return c === 'À vista' ? 'À vista' + (m ? ' · ' + m : '') : 'Parcelado: ' + parcCompraTxt(v) + (m ? ' · ' + m : ''); };

/* ---------- sócios ---------- */
const SA = () => (S.config && S.config.partner_a_name) || 'Sócio 1', SB = () => (S.config && S.config.partner_b_name) || 'Sócio 2';
// Sem informação de quem pagou, divide meio a meio.
const partes = (o, total, ka, kb) => { const t = num(total); if (!o || (o[ka] == null && o[kb] == null)) return { a: t / 2, b: t / 2 }; return { a: num(o[ka]), b: num(o[kb]) }; };
const PV = ['partner_a_paid', 'partner_b_paid'], PR = ['recA', 'recB'];
function socCalc(v) {
  const c = partes(v, v.purchase_price, ...PV); let dA = 0, dB = 0;
  despesasDe(v).forEach(d => { const p = partes(d, d.amount, ...PV); dA += p.a; dB += p.b; });
  const invA = c.a + dA, invB = c.b + dB, total = invA + invB, s = vendaDe(v.id);
  const r = { compraA: c.a, compraB: c.b, despA: dA, despB: dB, invA, invB, total, vendido: !!s, venda: 0, lucro: 0, metade: 0, devA: 0, devB: 0, recA: 0, recB: 0, saldoA: 0 };
  if (s) { const rc = partes(s, s.valor, ...PR); Object.assign(r, { venda: s.valor, recA: rc.a, recB: rc.b }); r.lucro = r.venda - total; r.metade = r.lucro / 2; r.devA = invA + r.metade; r.devB = invB + r.metade; r.saldoA = r.recA - r.devA; }
  return r;
}
const acertoTxt = x => Math.abs(x) < 0.005 ? 'Contas zeradas: ninguém precisa repassar nada.' : (x > 0 ? `${SA()} repassa ${brl(x)} para ${SB()}.` : `${SB()} repassa ${brl(-x)} para ${SA()}.`);
const quem = (o, total, ka = PV[0], kb = PV[1]) => { const p = partes(o, total, ka, kb); if (p.a > 0.004 && p.b > 0.004) return `<span class="quem"><i class="dot A"></i>${brl(p.a)} · <i class="dot B"></i>${brl(p.b)}</span>`; return p.b > 0.004 ? `<span class="quem"><i class="dot B"></i>${esc(SB())}</span>` : `<span class="quem"><i class="dot A"></i>${esc(SA())}</span>`; };
function payerHtml(key, titulo, totalId, o, ka = PV[0], kb = PV[1]) {
  const has = o && (o[ka] != null || o[kb] != null); const a = has ? num(o[ka]) : 0, b = has ? num(o[kb]) : 0;
  // Sem informação de quem pagou vale meio a meio, então o padrão é "Os dois" com a metade.
  const mode = has ? (a && b ? 'AB' : (b ? 'B' : 'A')) : 'AB';
  const opt = (m, l) => `<label><input type="radio" name="${key}m" value="${m}" ${mode === m ? 'checked' : ''}>${l}</label>`;
  return `<div class="payer" data-key="${key}" data-total="${totalId}"><span class="plab">${titulo}</span>
    <div class="segp">${opt('A', `<i class="dot A"></i>${esc(SA())}`)}${opt('B', `<i class="dot B"></i>${esc(SB())}`)}${opt('AB', 'Os dois')}</div>
    <div class="fg" data-both ${mode === 'AB' ? '' : 'hidden'}><label class="f">Quanto ${esc(SA())} entrou (R$)<input id="${key}A" type="number" step="0.01" min="0" inputmode="decimal" value="${has && mode === 'AB' ? a : ''}" placeholder="metade"></label><div class="hint" data-rest style="align-self:end;padding-bottom:10px"></div></div></div>`;
}
function wirePayer(root) {
  (root || document).querySelectorAll('.payer').forEach(p => {
    const key = p.dataset.key, tot = document.getElementById(p.dataset.total), inA = p.querySelector('#' + key + 'A');
    const upd = () => { const m = p.querySelector(`input[name="${key}m"]:checked`).value; p.querySelector('[data-both]').hidden = m !== 'AB';
      const t = num(tot && tot.value), a = inA.value === '' ? t / 2 : num(inA.value); p.querySelector('[data-rest]').textContent = m === 'AB' && t ? `${SB()} entrou ${brl(t - a)}` : ''; };
    p.addEventListener('change', e => { if (e.target.type === 'radio' && e.target.value === 'AB' && !inA.value && tot && num(tot.value)) inA.value = round2(num(tot.value) / 2); upd(); });
    p.addEventListener('input', upd); if (tot) tot.addEventListener('input', upd); upd();
  });
}
function readPayer(key, total) {
  const r = document.querySelector(`input[name="${key}m"]:checked`); const m = r ? r.value : 'A';
  if (m === 'A') return { a: round2(total), b: 0 }; if (m === 'B') return { a: 0, b: round2(total) };
  const a = val(key + 'A') === '' ? total / 2 : num(val(key + 'A')); if (a < 0 || a > total) return { err: `A parte de ${SA()} precisa ficar entre zero e ${brl(total)}.` };
  return { a: round2(a), b: round2(total - a) };
}

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
// A API serializa colunas em snake_case (vehicle_id, people_id, sale_id) e o
// contrato de venda em camelCase; normaliza tudo aqui na entrada.
const normBill = b => ({ id: b.id, billId: b.id, n: b.installment_number, tot: b.installments, nome: b.name, venc: d10(b.date_due), valor: Number(b.amount), pago: Number(b.status) !== 0, dataPag: d10(b.date_received),
  vehicleId: b.vehicle_id ?? null, compra: !!b.vehicle_purchase, peopleId: b.people_id ?? b.peopleId ?? null, categoryId: b.category_id ?? b.categoryId ?? null, note: b.note || '' });

function normVenda(s, bills) {
  const c = s.vehicleSaleContract || s.vehicle_sale_contract || null;
  const ps = bills.map(normBill).sort((a, b) => (a.n || 0) - (b.n || 0) || a.venc.localeCompare(b.venc));
  const entrada = num(c && c.downPayment);
  let entradaBill = null, parcelas = [];
  if (c ? Number(c.installmentCount || 0) > 0 : ps.length > 1) {
    parcelas = ps.slice();
    if (entrada > 0) { const i = parcelas.findIndex(p => p.pago && Math.abs(p.valor - entrada) < 0.01); if (i >= 0) entradaBill = parcelas.splice(i, 1)[0]; }
  }
  return { ...s, contrato: c, valor: num(c ? c.saleValue : (s.amount ?? s.net_total)), data: d10(s.date_sale), forma: (c && c.paymentForm) || '',
    entrada: entradaBill ? entradaBill.valor : 0, taxaJuros: num(c && c.interestRate), recA: c ? c.partnerAReceived ?? null : null, recB: c ? c.partnerBReceived ?? null : null,
    _bills: ps, parcelas, entradaBill };
}

async function loadAll() {
  loading = true; render();
  try {
    const cid = companyId();
    const [vRes, exRes, clRes, foRes, saRes, biRes, paRes, inRes, caRes, cfg] = await Promise.all([
      Vehicles.list(cid),
      VehicleExpenses.list(cid),
      People.list(cid, { role: 2 }),
      People.list(cid, { role: 3 }),
      Sales.list(cid),
      Bills.listByCompany(cid),
      Bills.listPayables(cid),
      Investments.list(cid, { status: '' }),
      Categories.list(cid, 0),
      Configs.get(cid).catch(() => null),
    ]);
    const despPorVeic = {};
    (exRes.data || []).forEach(d => (despPorVeic[d.vehicle_id] ||= []).push({ ...d, date: d10(d.date) }));
    S.veiculos = (vRes.data || []).map(v => ({ ...v, purchase_date: d10(v.purchase_date), sale_date: d10(v.sale_date), _expenses: despPorVeic[v.id] || [] }));
    S.clientes = clRes.data || [];
    S.fornecedores = foRes.data || [];
    S.contas = (paRes.data || []).map(normBill);
    S.categorias = caRes.data || [];
    S.config = cfg;
    const billsBySale = {};
    (biRes.data || []).forEach(b => { const sid = b.sale_id ?? b.saleId; if (sid) (billsBySale[sid] ||= []).push(b); });
    S.vendas = (saRes.data || [])
      .map(s => ({ ...s, vehicleId: s.vehicleId ?? s.vehicle_id, peopleId: s.peopleId ?? s.people_id }))
      .filter(s => s.vehicleId)
      .map(s => normVenda(s, billsBySale[s.id] || []));

    // Parcelas e movimentações dos investimentos só vêm no detalhe (GET /investment/:id).
    const investList = inRes.data || [];
    await Promise.all(investList.map(async x => {
      try { const full = await Investments.get(x.id); x.installments = full.installments || []; x.entries = full.entries || []; } catch (e) { x.installments = []; x.entries = []; }
    }));
    S.investimentos = investList.map(x => ({ ...x, start_date: d10(x.start_date), end_date: d10(x.end_date), due_date: d10(x.due_date), first_due_date: d10(x.first_due_date),
      parcelas: (x.installments || []).slice().sort((a, b) => a.number - b.number).map(p => ({ id: p.id, n: p.number, venc: d10(p.due_date), valor: num(p.amount), pago: !!p.paid, dataPag: d10(p.paid_at) })),
      lancamentos: (x.entries || []).map(l => ({ ...l, entry_date: d10(l.entry_date) })) }));

    loaded = true;
  } catch (e) {
    app.innerHTML = `<div class="notice"><b>Não foi possível carregar os dados.</b><p class="muted" style="margin:6px 0 0">${esc(e.message || '')}</p></div>`;
    loading = false;
    return;
  }
  loading = false;
  render();
  if (openVeicId && modalRoot.innerHTML) verVeiculo(openVeicId);
}

async function categoriaPagar(nome) {
  const c = S.categorias.find(x => (x.name || '').toLowerCase() === nome.toLowerCase());
  if (c) return c.id;
  const novo = await Categories.create({ company_id: companyId(), role: 0, name: nome });
  S.categorias.push(novo); return novo.id;
}
const nomeCategoria = id => (S.categorias.find(c => c.id === id) || {}).name || '';

/* ---------- render ---------- */
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  render();
}
function render() {
  setChrome(true);
  if (loading || !loaded) { app.innerHTML = `<div class="notice">Carregando seus dados…</div>`; return; }
  app.innerHTML = ({ painel: vPainel, veiculos: vVeiculos, vendas: vVendas, pagar: vPagar, clientes: vClientes, fornecedores: vFornecedores, investimentos: vInvest, socios: vSocios }[tab])();
}

function allParcelas() {
  const out = [];
  S.vendas.forEach(s => s.parcelas.forEach((p, i) => out.push({ ...p, idx: i, venda: s })));
  return out;
}

function vPainel() {
  const estoque = S.veiculos.filter(v => !vendaDe(v.id));
  const vendidos = S.vendas.filter(s => s.status !== 4);
  const capEstoque = estoque.reduce((a, v) => a + custo(v), 0);
  const lucro = vendidos.reduce((a, s) => { const v = veic(s.vehicleId); return a + s.valor - (v ? custo(v) : 0); }, 0);
  const faturamento = vendidos.reduce((a, s) => a + s.valor, 0);
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
    return `<tr><td><div class="small" style="font-weight:600">${esc(c ? c.name : 'Cliente removido')}</div><div class="small muted">${esc(nomeVeic(v))} · parcela ${p.idx + 1}/${p.venda.parcelas.length}</div></td>
      <td class="small">${fdate(p.venc)}<div class="${st === 'late' ? 'neg' : 'muted'}">${atraso}</div></td>
      <td class="n">${brl(p.valor)}</td>
      <td style="text-align:right"><button class="btn sm" data-act="pagar" data-bill="${p.billId}">Recebida</button></td></tr>`;
  };
  const parado = estoque.map(v => ({ v, dias: v.purchase_date ? daysBetween(v.purchase_date, hoje) : 0 })).sort((a, b) => b.dias - a.dias).slice(0, 6);
  const contasAb = S.contas.filter(x => !x.pago), contasVc = contasAb.filter(x => x.venc < hoje);

  return `
  <div class="kpis">
    <div class="kpi"><span class="lb">Em estoque</span><span class="vl">${estoque.length}</span><span class="sub">${brl(capEstoque)} investidos</span></div>
    <div class="kpi"><span class="lb">Vendidos</span><span class="vl">${vendidos.length}</span><span class="sub">${brl(faturamento)} em vendas</span></div>
    <div class="kpi ${lucro >= 0 ? 'good' : 'bad'}"><span class="lb">Lucro nas vendas</span><span class="vl">${brl(lucro)}</span><span class="sub">margem de ${margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span></div>
    <div class="kpi"><span class="lb">A receber</span><span class="vl">${brl(totalAReceber)}</span><span class="sub">${pl(abertas.length, 'parcela', 'parcelas')} em aberto</span></div>
    <div class="kpi ${venc.length ? 'bad' : ''}"><span class="lb">Em atraso</span><span class="vl">${brl(totVenc)}</span><span class="sub">${venc.length} parcela${venc.length === 1 ? '' : 's'} vencida${venc.length === 1 ? '' : 's'}</span></div>
    ${contasAb.length ? `<div class="kpi ${contasVc.length ? 'bad' : ''}" data-tab="pagar" style="cursor:pointer"><span class="lb">A pagar</span><span class="vl">${brl(contasAb.reduce((t, x) => t + x.valor, 0))}</span><span class="sub">${pl(contasAb.length, 'conta', 'contas')}${contasVc.length ? ` · <span class="neg">${contasVc.length} vencida${contasVc.length > 1 ? 's' : ''}</span>` : ''}</span></div>` : ''}
    ${S.investimentos.length ? (() => { const at = S.investimentos.filter(x => x.status !== 'encerrado'); const r = S.investimentos.reduce((a, x) => a + invCalc(x).resultado, 0); const vi = invParcelas().filter(p => p.venc < hoje).length;
      return `<div class="kpi" data-act="go-inv" style="cursor:pointer"><span class="lb">Outros investimentos</span><span class="vl">${brl(at.reduce((a, x) => a + invCalc(x).atual, 0))}</span><span class="sub">${at.length} ativo${at.length === 1 ? '' : 's'} · resultado <span class="${r >= 0 ? 'pos' : 'neg'}">${brl(r)}</span>${vi ? ` · <span class="neg">${vi} vencida${vi > 1 ? 's' : ''}</span>` : ''}</span></div>`; })() : ''}
  </div>
  ${blocoSocios()}
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

function totaisSocios() {
  const t = { compraA: 0, compraB: 0, despA: 0, despB: 0, invA: 0, invB: 0, lucro: 0, saldoA: 0, vend: 0, venda: 0, devA: 0, devB: 0, recA: 0, recB: 0, vinvA: 0, vinvB: 0 };
  S.veiculos.forEach(v => { const c = socCalc(v); ['compraA', 'compraB', 'despA', 'despB', 'invA', 'invB'].forEach(k => t[k] += c[k]);
    if (c.vendido) { t.vend++; t.lucro += c.lucro; t.saldoA += c.saldoA; t.venda += c.venda; t.devA += c.devA; t.devB += c.devB; t.recA += c.recA; t.recB += c.recB; t.vinvA += c.invA; t.vinvB += c.invB; } });
  return t;
}
function blocoSocios() {
  const t = totaisSocios(), tot = t.invA + t.invB;
  return `<h2 class="sec">Sócios <span class="actions"><button class="btn sm" data-act="pdf-geral">Relatório geral em PDF</button><button class="btn sm" data-tab="socios">Ver divisão por veículo</button></span></h2>
  <div class="panel"><div class="socios">
    <div class="socio A"><span class="nm"><i class="dot A"></i>${esc(SA())}</span><span class="small muted">Pagou em compras e despesas</span><span class="vl">${brl(t.invA)}</span><span class="small muted">Metade do lucro: ${brl(t.lucro / 2)}</span></div>
    <div class="socio B"><span class="nm"><i class="dot B"></i>${esc(SB())}</span><span class="small muted">Pagou em compras e despesas</span><span class="vl">${brl(t.invB)}</span><span class="small muted">Metade do lucro: ${brl(t.lucro / 2)}</span></div>
  </div>
  <div class="sbar" role="img" aria-label="Divisão do que cada sócio pagou"><i class="A" style="width:${tot ? t.invA / tot * 100 : 50}%"></i><i class="B" style="width:${tot ? t.invB / tot * 100 : 50}%"></i></div>
  ${t.vend ? `<div class="acerto">Acerto dos ${t.vend} vendido${t.vend > 1 ? 's' : ''}: ${esc(acertoTxt(t.saldoA))}</div>` : `<div class="hint" style="padding:0 16px 14px">O acerto entre os sócios aparece quando houver venda registrada.</div>`}</div>`;
}
function vSocios() {
  const t = totaisSocios();
  const list = S.veiculos.slice().sort((a, b) => (b.purchase_date || '').localeCompare(a.purchase_date || ''));
  return `
  <h2 class="sec">Nomes dos sócios</h2>
  <div class="panel" style="padding:14px 16px"><div class="fg">
    <label class="f"><span><i class="dot A"></i>Sócio 1</span><input id="cfg-a" value="${esc(SA())}"></label>
    <label class="f"><span><i class="dot B"></i>Sócio 2</span><input id="cfg-b" value="${esc(SB())}"></label>
    <div style="align-self:end"><button class="btn pri" data-act="salvar-socios">Salvar nomes</button></div></div>
    <p class="hint" style="margin:10px 0 0">O lucro de cada venda é dividido por dois. Antes da divisão, cada sócio recebe de volta o que pagou na compra e nas despesas daquele veículo. Lançamentos sem a informação de quem pagou contam meio a meio.</p></div>
  ${blocoSocios()}
  <h2 class="sec">Quem pagou o quê</h2>
  <div class="panel"><div class="tbl"><table><thead><tr><th></th><th class="n">${esc(SA())}</th><th class="n">${esc(SB())}</th></tr></thead><tbody>
    <tr><td>Aquisições</td><td class="n">${brl(t.compraA)}</td><td class="n">${brl(t.compraB)}</td></tr>
    <tr><td>Despesas, serviços e taxas</td><td class="n">${brl(t.despA)}</td><td class="n">${brl(t.despB)}</td></tr>
    <tr><td style="font-weight:600">Total pago</td><td class="n" style="font-weight:600">${brl(t.invA)}</td><td class="n" style="font-weight:600">${brl(t.invB)}</td></tr>
    ${t.vend ? `<tr><td>Metade do lucro (vendidos)</td><td class="n">${brl(t.lucro / 2)}</td><td class="n">${brl(t.lucro / 2)}</td></tr>
    <tr><td>Tem direito a receber (vendidos)</td><td class="n">${brl(t.devA)}</td><td class="n">${brl(t.devB)}</td></tr>
    <tr><td>Recebeu das vendas</td><td class="n">${brl(t.recA)}</td><td class="n">${brl(t.recB)}</td></tr>` : ''}
  </tbody></table></div></div>
  <h2 class="sec">Divisão por veículo</h2>
  <div class="panel">${list.length ? `<div class="tbl"><table><thead><tr><th>Veículo</th><th>Situação</th><th class="n">${esc(SA())} pagou</th><th class="n">${esc(SB())} pagou</th><th class="n">Lucro</th><th class="n">Cada um</th><th>Acerto</th><th></th></tr></thead><tbody>
    ${list.map(v => { const c = socCalc(v); return `<tr class="click" data-act="ver-veiculo" data-id="${v.id}"><td><div class="veh">${plate(v.license_plate)}<span class="nm">${esc(nomeVeic(v))}</span></div></td>
      <td>${c.vendido ? '<span class="pill sold">Vendido</span>' : '<span class="pill stock">Em estoque</span>'}</td>
      <td class="n">${brl(c.invA)}</td><td class="n">${brl(c.invB)}</td>
      <td class="n ${c.vendido ? (c.lucro >= 0 ? 'pos' : 'neg') : ''}">${c.vendido ? brl(c.lucro) : '—'}</td><td class="n">${c.vendido ? brl(c.metade) : '—'}</td>
      <td class="small">${c.vendido ? esc(acertoTxt(c.saldoA)) : '<span class="muted">após a venda</span>'}</td>
      <td style="text-align:right"><button class="btn sm" data-act="pdf-veiculo" data-id="${v.id}">PDF</button></td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="empty">Nenhum veículo cadastrado ainda.</div>`}</div>`;
}
async function salvarSocios() {
  const a = val('cfg-a'), b = val('cfg-b'); if (!a || !b) { toast('Preencha o nome dos dois sócios.'); return; }
  if (!S.config) { toast('Não encontrei a configuração desta empresa.'); return; }
  if (await w(async () => { S.config = { ...S.config, ...(await Configs.update(S.config.id, { companyId: companyId(), partner_a_name: a, partner_b_name: b })) }; }, 'Nomes dos sócios salvos')) render();
}

function porOrigem() {
  const g = {};
  S.veiculos.forEach(v => {
    const k = tipoOrig(v); const r = g[k] || (g[k] = { comprados: 0, estoque: 0, vendidos: 0, investido: 0, lucro: 0, dias: 0 });
    const s = vendaDe(v.id); r.comprados++; r.investido += custo(v);
    if (s) { r.vendidos++; r.lucro += s.valor - custo(v); if (v.purchase_date && s.data) r.dias += daysBetween(v.purchase_date, s.data); } else r.estoque++;
  });
  const rows = Object.entries(g).sort((a, b) => b[1].comprados - a[1].comprados);
  if (!rows.length) return `<div class="empty">Cadastre veículos com a origem preenchida para comparar de onde vêm os melhores negócios.</div>`;
  return `<div class="tbl"><table><thead><tr><th>Origem</th><th class="n">Comprados</th><th class="n">Em estoque</th><th class="n">Vendidos</th><th class="n">Custo total</th><th class="n">Lucro nas vendas</th><th class="n">Lucro médio</th><th class="n hide-sm">Dias p/ vender</th></tr></thead><tbody>
    ${rows.map(([k, r]) => `<tr class="click" data-act="ver-origem" data-o="${esc(k)}"><td style="font-weight:600">${esc(k)}</td><td class="n">${r.comprados}</td><td class="n">${r.estoque}</td><td class="n">${r.vendidos}</td><td class="n">${brl(r.investido)}</td><td class="n ${r.lucro >= 0 ? 'pos' : 'neg'}">${r.vendidos ? brl(r.lucro) : '—'}</td><td class="n">${r.vendidos ? brl(r.lucro / r.vendidos) : '—'}</td><td class="n hide-sm">${r.vendidos ? Math.round(r.dias / r.vendidos) : '—'}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function vVeiculos() {
  let list = S.veiculos.slice().sort((a, b) => (b.purchase_date || '').localeCompare(a.purchase_date || ''));
  if (filtroVeic === 'estoque') list = list.filter(v => !vendaDe(v.id));
  if (filtroVeic === 'vendidos') list = list.filter(v => vendaDe(v.id));
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
    const s = vendaDe(v.id), l = s ? s.valor - custo(v) : null;
    return `<tr class="click" data-act="ver-veiculo" data-id="${v.id}">
      <td><div class="veh">${plate(v.license_plate)}<div><div class="nm">${esc(nomeVeic(v))}</div><div class="small muted">${esc(v.color || '')}${v.mileage ? ' · ' + Number(v.mileage).toLocaleString('pt-BR') + ' km' : ''}</div></div></div></td>
      <td>${s ? '<span class="pill sold">Vendido</span>' : '<span class="pill stock">Em estoque</span>'}</td>
      <td class="small"><div>${esc(tipoOrig(v))}</div><div class="muted">${esc(v.origin_name || '')}</div></td>
      <td class="small hide-sm">${fdate(v.purchase_date)}${condCompra(v) ? `<div class="muted">${esc(formaCompraTxt(v))}</div>` : ''}</td>
      <td class="n">${brl(v.purchase_price)}</td>
      <td class="n">${brl(despTotal(v))}</td>
      <td class="n">${brl(custo(v))}</td>
      <td class="n">${s ? brl(s.valor) : '—'}</td>
      <td class="n ${l == null ? '' : (l >= 0 ? 'pos' : 'neg')}">${l == null ? '—' : brl(l)}</td></tr>`;
  }).join('')}</tbody></table></div>` : `<div class="empty">${S.veiculos.length ? 'Nenhum veículo encontrado com esse filtro.' : 'Nenhum veículo cadastrado ainda. Clique em "+ Cadastrar compra" para registrar o primeiro.'}</div>`}
  </div>`;
}

function saleCard(s) {
  const v = veic(s.vehicleId), c = pessoaPorId(s.peopleId), ps = s.parcelas;
  const rec = recebido(s), pct = s.valor ? Math.min(100, rec / s.valor * 100) : 0;
  const l = s.valor - (v ? custo(v) : 0);
  const atras = ps.filter(p => parcStatus(p) === 'late').length;
  return `<div class="sale">
    <div class="sale-h">
      <div class="veh">${plate(v && v.license_plate)}<div><div class="nm">${esc(nomeVeic(v))}</div><div class="small muted">${esc(c ? c.name : 'Cliente removido')} · ${fdate(s.data)}${s.forma ? ' · ' + esc(s.forma) : ''}</div></div></div>
      <div class="actions">${atras ? `<span class="pill late">${atras} vencida${atras > 1 ? 's' : ''}</span>` : ''}
        <button class="btn sm" data-act="editar-venda" data-id="${s.id}">Editar</button>
        <button class="btn sm danger" data-act="excluir-venda" data-id="${s.id}" data-veiculo="${s.vehicleId}" data-confirm="1">Cancelar venda</button></div>
    </div>
    <div class="sale-h" style="padding-top:0">
      <div class="sale-meta">
        <div><span>Valor de venda</span><b>${brl(s.valor)}</b></div>
        ${ps.length ? `<div><span>Entrada</span><b>${brl(s.entrada)}</b></div>` : ''}
        <div><span>Recebido</span><b class="pos">${brl(rec)}</b></div>
        <div><span>A receber</span><b>${brl(aReceber(s))}</b></div>
        <div><span>Lucro</span><b class="${l >= 0 ? 'pos' : 'neg'}">${brl(l)}</b></div>
      </div>
    </div>
    ${ps.length ? `<div class="tbl" style="border-top:1px solid var(--line)"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th><th>Situação</th><th class="hide-sm">Pago em</th><th></th></tr></thead><tbody>
      ${ps.map((p, i) => { const st = parcStatus(p); return `<tr><td>${i + 1}/${ps.length}</td><td>${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td><td><span class="pill ${st}">${parcLabel[st]}</span></td><td class="small muted hide-sm">${p.pago ? fdate(p.dataPag) : ''}</td>
        <td style="text-align:right">${p.pago ? `<button class="btn sm ghost" data-act="estornar" data-bill="${p.billId}">Desfazer</button>` : `<button class="btn sm" data-act="pagar" data-bill="${p.billId}">Recebida</button>`}</td></tr>`; }).join('')}
    </tbody></table></div>` : ''}
    <div class="bar" title="${Math.round(pct)}% recebido"><i style="width:${pct}%"></i></div>
  </div>`;
}

function vVendas() {
  let list = S.vendas.slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  if (filtroVenda === 'abertas') list = list.filter(s => aReceber(s) > 0);
  if (filtroVenda === 'atraso') list = list.filter(s => s.parcelas.some(p => parcStatus(p) === 'late'));
  const seg = (k, l) => `<button data-act="filtro-venda" data-f="${k}" aria-pressed="${filtroVenda === k}">${l}</button>`;
  return `
  <h2 class="sec">Vendas e parcelas <button class="btn sm pri" data-act="nova-venda">+ Registrar venda</button></h2>
  <div class="toolbar"><div class="seg">${seg('abertas', 'Com saldo a receber')}${seg('atraso', 'Em atraso')}${seg('todas', 'Todas')}</div></div>
  <div class="cards">${list.length ? list.map(saleCard).join('') : `<div class="panel"><div class="empty">${S.vendas.length ? 'Nenhuma venda neste filtro.' : 'Nenhuma venda registrada. Quando vender um veículo, use "+ Registrar venda".'}</div></div>`}</div>`;
}

/* ---------- contas a pagar ---------- */
function contasTodas() {
  return S.contas.map(c => {
    const v = c.vehicleId ? veic(c.vehicleId) : null;
    const credor = c.compra && v ? (v.purchase_creditor || (forn(v.purchase_people_id) || {}).name || v.origin_name || '') : ((pessoaPorId(c.peopleId) || {}).name || '');
    return { ...c, v, credor };
  });
}
function situacaoCompra(v) {
  const c = condCompra(v);
  if (!c) return '<span class="pill open">Não informada</span>';
  if (c === 'À vista') return '<span class="pill paid">Quitada</span>';
  const ps = contasVeic(v);
  if (!ps.length) return '<span class="pill open">Sem datas</span>';
  if (ps.every(p => p.pago)) return '<span class="pill paid">Quitada</span>';
  if (ps.some(p => !p.pago && p.venc < today())) return '<span class="pill late">Parcela vencida</span>';
  return '<span class="pill soon">Pagando</span>';
}
const btnConta = x => x.pago ? `<button class="btn sm ghost" data-act="conta-estornar" data-bill="${x.id}">Desfazer</button>` : `<button class="btn sm" data-act="conta-pagar" data-bill="${x.id}">Paguei</button>`;
function vPagar() {
  const hoje = today(), lim = addDays(hoje, 30), mes = hoje.slice(0, 7);
  const all = contasTodas(), ab = all.filter(x => !x.pago), venc = ab.filter(x => x.venc < hoje), prox = ab.filter(x => x.venc >= hoje && x.venc <= lim);
  const pagMes = all.filter(x => x.pago && (x.dataPag || '').slice(0, 7) === mes);
  const soma = a => a.reduce((t, x) => t + x.valor, 0);
  const lista = ({ abertas: ab, vencidas: venc, pagas: all.filter(x => x.pago), todas: all }[filtroPagar] || ab).slice()
    .sort((a, b) => filtroPagar === 'pagas' ? (b.dataPag || b.venc).localeCompare(a.dataPag || a.venc) : a.venc.localeCompare(b.venc));
  const compras = S.veiculos.slice().sort((a, b) => (b.purchase_date || '').localeCompare(a.purchase_date || ''));
  const nVista = compras.filter(v => condCompra(v) === 'À vista').length, nParc = compras.filter(v => condCompra(v) === 'Parcelado').length;
  const saldoCompras = compras.reduce((t, v) => t + compraSaldo(v), 0);
  const seg = (f, l) => `<button data-act="filtro-pagar" data-f="${f}" aria-pressed="${filtroPagar === f}">${l}</button>`;
  const linha = x => {
    const st = parcStatus(x);
    const quando = x.pago ? (x.dataPag ? 'paga em ' + fdate(x.dataPag) : 'paga') : st === 'late' ? (d => `${d} dia${d === 1 ? '' : 's'} de atraso`)(daysBetween(x.venc, hoje)) : x.venc === hoje ? 'vence hoje' : `em ${daysBetween(hoje, x.venc)} dias`;
    const desc = x.compra && x.v
      ? `<div class="veh">${plate(x.v.license_plate)}<div><div class="small" style="font-weight:600">Compra · ${esc(nomeVeic(x.v))}</div><div class="small muted">Parcela ${contasVeic(x.v).findIndex(p => p.id === x.id) + 1}/${nParcCompra(x.v)}</div></div></div>`
      : `<div class="small" style="font-weight:600">${esc(x.nome || 'Conta')}</div><div class="small muted">${esc([nomeCategoria(x.categoryId), x.v ? nomeVeic(x.v) : ''].filter(Boolean).join(' · '))}</div>`;
    const acoes = x.compra ? btnConta(x) : `${btnConta(x)} <button class="btn sm ghost" data-act="editar-conta" data-id="${x.id}">Editar</button>`;
    return `<tr ${x.compra && x.v ? `class="click" data-act="ver-veiculo" data-id="${x.v.id}"` : ''}>
      <td class="small" style="white-space:nowrap">${fdate(x.venc)}<div class="${st === 'late' ? 'neg' : 'muted'}">${quando}</div></td>
      <td>${desc}</td><td class="small hide-sm">${esc(x.credor || '—')}</td><td class="n">${brl(x.valor)}</td>
      <td><span class="pill ${st}">${parcLabel[st]}</span></td><td style="text-align:right;white-space:nowrap">${acoes}</td></tr>`;
  };
  const vazio = { abertas: 'Nenhuma conta em aberto.', vencidas: 'Nenhuma conta vencida.', pagas: 'Nenhum pagamento registrado ainda.', todas: 'Nenhuma conta lançada.' }[filtroPagar];
  return `
  <div class="kpis">
    <div class="kpi"><span class="lb">Em aberto</span><span class="vl">${brl(soma(ab))}</span><span class="sub">${pl(ab.length, 'conta', 'contas')}</span></div>
    <div class="kpi ${venc.length ? 'bad' : ''}"><span class="lb">Vencidas</span><span class="vl">${brl(soma(venc))}</span><span class="sub">${pl(venc.length, 'conta', 'contas')} em atraso</span></div>
    <div class="kpi"><span class="lb">Próximos 30 dias</span><span class="vl">${brl(soma(prox))}</span><span class="sub">${pl(prox.length, 'vencimento', 'vencimentos')}</span></div>
    <div class="kpi good"><span class="lb">Pago neste mês</span><span class="vl">${brl(soma(pagMes))}</span><span class="sub">${pl(pagMes.length, 'pagamento', 'pagamentos')}</span></div>
    <div class="kpi"><span class="lb">Compras de veículos</span><span class="vl">${brl(saldoCompras)}</span><span class="sub">saldo devedor · ${nVista} à vista · ${nParc} parcelada${nParc === 1 ? '' : 's'}</span></div>
  </div>
  <h2 class="sec">Vencimentos <span class="actions"><button class="btn sm" data-act="pdf-pagar">Relatório em PDF</button><button class="btn sm pri" data-act="nova-conta">+ Conta a pagar</button></span></h2>
  <div class="toolbar"><div class="seg">${seg('abertas', 'Em aberto')}${seg('vencidas', 'Vencidas')}${seg('pagas', 'Pagas')}${seg('todas', 'Todas')}</div></div>
  <div class="panel">${lista.length ? `<div class="tbl"><table><thead><tr><th>Vencimento</th><th>Conta</th><th class="hide-sm">Pagar a</th><th class="n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${lista.map(linha).join('')}</tbody></table></div>` : `<div class="empty">${vazio} As parcelas de compras parceladas entram aqui sozinhas; outras contas você lança em "+ Conta a pagar".</div>`}</div>
  <h2 class="sec">Onde está cada compra de veículo</h2>
  <div class="panel">${compras.length ? `<div class="tbl"><table><thead><tr><th>Veículo</th><th class="hide-sm">Comprado de</th><th class="n">Valor</th><th>Forma de pagamento</th><th class="n">Pagas</th><th class="n">Saldo devedor</th><th>Situação</th></tr></thead><tbody>
    ${compras.map(v => { const n = nParcCompra(v), pg = compraPagas(v), c = condCompra(v); return `<tr class="click" data-act="ver-veiculo" data-id="${v.id}">
      <td><div class="veh">${plate(v.license_plate)}<div><div class="nm small">${esc(nomeVeic(v))}</div><div class="small muted">${fdate(v.purchase_date)} · ${quem(v, v.purchase_price)}</div></div></div></td>
      <td class="small hide-sm">${esc((forn(v.purchase_people_id) || {}).name || v.origin_name || '—')}${c === 'Parcelado' && v.purchase_creditor ? `<div class="muted">pagar a ${esc(v.purchase_creditor)}</div>` : ''}</td>
      <td class="n">${brl(v.purchase_price)}</td>
      <td class="small">${c ? `<b>${c}</b>${c === 'Parcelado' ? `<div>${esc(parcCompraTxt(v))}</div>` : ''}${meioCompra(v) ? `<div class="muted">${esc(meioCompra(v))}</div>` : ''}` : '<span class="muted">Não informada</span>'}</td>
      <td class="n">${c === 'Parcelado' && n ? `${pg}/${n}<div style="height:4px;background:var(--sunk);border-radius:2px;margin-top:4px;min-width:50px"><i style="display:block;height:100%;border-radius:2px;background:var(--good);width:${Math.round(pg / n * 100)}%"></i></div>` : '—'}</td>
      <td class="n ${compraSaldo(v) ? '' : 'muted'}">${brl(compraSaldo(v))}</td>
      <td>${situacaoCompra(v)}</td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="empty">Nenhum veículo cadastrado. Use "+ Veículo" para lançar uma compra à vista ou parcelada.</div>`}</div>`;
}
function formConta(c) {
  c = c || {}; openVeicId = null;
  const catAtual = nomeCategoria(c.categoryId);
  const cats = catAtual && !CATS_CONTA.includes(catAtual) ? [catAtual, ...CATS_CONTA] : CATS_CONTA;
  openModal(c.id ? 'Editar conta a pagar' : 'Nova conta a pagar', `<div class="fg">
    <label class="f full">Descrição<input id="fk-desc" value="${esc(c.nome)}" placeholder="Aluguel do pátio, IPVA, conserto…"></label>
    <label class="f">Categoria<select id="fk-cat">${cats.map(x => `<option ${catAtual === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    <label class="f">Pagar a (fornecedor)<select id="fk-forn"><option value="">— Nenhum —</option>${fornOpts(c.peopleId, () => true)}</select></label>
    <label class="f">Vencimento<input id="fk-venc" type="date" value="${esc(c.venc || today())}"></label>
    <label class="f">Valor (R$)<input id="fk-valor" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(c.valor)}"></label>
    <label class="f">Veículo relacionado<select id="fk-veic"><option value="">— Nenhum —</option>${S.veiculos.map(v => `<option value="${v.id}" ${c.vehicleId === v.id ? 'selected' : ''}>${esc((v.license_plate ? v.license_plate + ' · ' : '') + nomeVeic(v))}</option>`).join('')}</select></label>
    ${c.id ? '' : `<label class="f">Repetir todo mês<select id="fk-rep">${[1, 2, 3, 4, 5, 6, 9, 12, 18, 24].map(n => `<option value="${n}">${n === 1 ? 'Não repetir' : 'Por ' + n + ' meses'}</option>`).join('')}</select></label>`}
    <label class="f full">Observações<textarea id="fk-obs" rows="2">${esc(c.note)}</textarea></label>
  </div><div class="hint">Gastos que entram no custo de um carro (mecânica, documentação…) continuam sendo lançados como despesa dentro do veículo, para o lucro e a divisão entre os sócios ficarem certos. Aqui você controla o vencimento.</div>`,
  `${c.id ? `<button class="btn danger" data-act="excluir-conta" data-id="${c.id}" data-confirm="1" style="margin-right:auto">Excluir</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-conta" data-id="${c.id || ''}">Salvar</button>`);
}
function billPagar({ nome, venc, valor, categoryId, peopleId, vehicleId, compra, formPayment, note, n, tot, status = 0, dataPag }) {
  return { company_id: companyId(), category_id: categoryId, bank_account_id: (S.config && S.config.sale_bank_account_default_id) || undefined, role: 0, name: nome,
    date_competence: venc, date_due: venc, amount: round2(valor), repeat: false, form_payment: formPayment ?? 9, status, date_received: dataPag || undefined,
    people_id: peopleId || undefined, vehicle_id: vehicleId || null, vehicle_purchase: !!compra, note: note || undefined, installments: tot, installment_number: n };
}
async function salvarConta(id) {
  const desc = val('fk-desc'), valor = num(val('fk-valor')), venc = val('fk-venc') || today();
  if (!desc) { toast('Informe a descrição da conta.'); return; }
  if (!valor) { toast('Informe o valor da conta.'); return; }
  const base = { valor, peopleId: val('fk-forn'), vehicleId: val('fk-veic'), note: val('fk-obs') };
  const ok = await w(async () => {
    const categoryId = await categoriaPagar(val('fk-cat'));
    if (id) {
      const c = S.contas.find(x => x.id === id);
      await Bills.update(id, billPagar({ ...base, nome: desc, venc, categoryId, n: c.n, tot: c.tot, status: c.pago ? 1 : 0, dataPag: c.dataPag }));
      return;
    }
    const rp = parseInt(val('fk-rep')) || 1;
    for (let i = 0; i < rp; i++) await Bills.create(billPagar({ ...base, nome: rp > 1 ? `${desc} (${i + 1}/${rp})` : desc, venc: addMonths(venc, i), categoryId, n: i + 1, tot: rp }));
  }, id ? 'Conta atualizada' : 'Conta lançada');
  if (ok) { closeModal(); await loadAll(); }
}

function histForn(id) {
  const veics = S.veiculos.filter(v => v.purchase_people_id === id);
  const servs = [];
  S.veiculos.forEach(v => despesasDe(v).forEach(d => { if (d.supplier_people_id === id) servs.push({ ...d, v }); }));
  return { veics, servs, totV: veics.reduce((a, v) => a + num(v.purchase_price), 0), totS: servs.reduce((a, d) => a + num(d.amount), 0) };
}
function vFornecedores() {
  const q = buscaForn.trim().toLowerCase();
  let list = S.fornecedores.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  if (filtroForn === 'v') list = list.filter(vendeVeic);
  if (filtroForn === 's') list = list.filter(prestaServ);
  if (q) list = list.filter(f => [f.name, f.document, f.phone, cidadePessoa(f), CAT_LABELS[f.supplier_service], f.contact_name].join(' ').toLowerCase().includes(q));
  const seg = (k, l) => `<button data-act="filtro-forn" data-f="${k}" aria-pressed="${filtroForn === k}">${l}</button>`;
  return `
  <h2 class="sec">Fornecedores <button class="btn sm" data-act="novo-fornecedor">+ Novo fornecedor</button></h2>
  <div class="toolbar"><input type="search" id="busca-forn" placeholder="Buscar por nome, CPF/CNPJ, telefone ou cidade" value="${esc(buscaForn)}">
    <div class="seg">${seg('', 'Todos')}${seg('v', 'Vendem veículos')}${seg('s', 'Prestam serviço')}</div></div>
  <div class="panel">${list.length ? `<div class="tbl"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Telefone</th><th class="hide-sm">Cidade</th><th class="n">Veículos comprados</th><th class="n">Serviços pagos</th></tr></thead><tbody>
    ${list.map(f => { const h = histForn(f.id); return `<tr class="click" data-act="editar-fornecedor" data-id="${f.id}"><td><div style="font-weight:600">${esc(f.name)}</div><div class="small muted" style="font-family:var(--f-mono)">${esc(f.document || '')}</div></td>
      <td class="small">${esc(tipoForn(f))}${prestaServ(f) && f.supplier_service ? `<div class="muted">${esc(CAT_LABELS[f.supplier_service] || f.supplier_service)}</div>` : ''}${vendeVeic(f) && f.supplier_default_origin ? `<div class="muted">${esc(f.supplier_default_origin)}</div>` : ''}</td>
      <td class="small">${esc(f.phone || '—')}</td><td class="small hide-sm">${esc(cidadePessoa(f) || '—')}</td>
      <td class="n">${h.veics.length ? `${h.veics.length} · ${brl(h.totV)}` : '—'}</td><td class="n">${h.servs.length ? `${h.servs.length} · ${brl(h.totS)}` : '—'}</td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="empty">${S.fornecedores.length ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor cadastrado. Cadastre quem vende carros para você (particulares, lojas, leiloeiros) e quem presta serviço (oficinas, funilarias, despachantes).'}</div>`}</div>`;
}
function formFornecedor(f) {
  f = f || {}; openVeicId = null;
  const h = f.id ? histForn(f.id) : { veics: [], servs: [] };
  openModal(f.id ? 'Fornecedor' : 'Novo fornecedor', `
    <div class="fg">
      <label class="f full">Nome / razão social<input id="ff-nome" value="${esc(f.name)}"></label>
      <label class="f">Tipo<select id="ff-tipo">${TIPOS_FORN.map(t => `<option ${tipoForn(f) === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="f" id="ff-orig-w">Origem padrão dos veículos<select id="ff-orig"><option value="">—</option>${ORIGENS.map(o => `<option ${f.supplier_default_origin === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="f" id="ff-serv-w">Serviço principal<select id="ff-serv"><option value="">—</option>${CATS.map(c => `<option value="${c}" ${f.supplier_service === c ? 'selected' : ''}>${CAT_LABELS[c]}</option>`).join('')}</select></label>
      <label class="f">CPF / CNPJ<input id="ff-cpf" value="${esc(f.document)}" inputmode="numeric"></label>
      <label class="f">Telefone / WhatsApp<input id="ff-tel" value="${esc(f.phone)}" inputmode="tel"></label>
      <label class="f">E-mail<input id="ff-email" type="email" value="${esc(f.email)}"></label>
      <label class="f">Pessoa de contato<input id="ff-contato" value="${esc(f.contact_name)}"></label>
      <label class="f full">Endereço<input id="ff-end" value="${esc(endPessoa(f))}"></label>
      <label class="f">Cidade / UF<input id="ff-cid" value="${esc(cidadePessoa(f))}"></label>
      <label class="f">Chave Pix<input id="ff-pix" value="${esc(f.pix_key)}"></label>
      <label class="f full">Observações<textarea id="ff-obs" rows="2">${esc(f.observation)}</textarea></label>
    </div>
    ${h.veics.length ? `<fieldset><legend>Veículos comprados deste fornecedor</legend><div class="tbl"><table><tbody>${h.veics.map(v => `<tr><td><div class="veh">${plate(v.license_plate)}<span class="small">${esc(nomeVeic(v))}</span></div></td><td class="small">${fdate(v.purchase_date)}</td><td class="n">${brl(v.purchase_price)}</td><td>${vendaDe(v.id) ? '<span class="pill sold">Vendido</span>' : '<span class="pill stock">Em estoque</span>'}</td></tr>`).join('')}</tbody></table></div></fieldset>` : ''}
    ${h.servs.length ? `<fieldset><legend>Serviços prestados</legend><div class="tbl"><table><tbody>${h.servs.map(d => `<tr><td class="small">${fdate(d.date)}</td><td class="small">${esc(CAT_LABELS[d.category] || d.category)}${d.description ? ' · ' + esc(d.description) : ''}</td><td class="small">${esc(d.v.license_plate || nomeVeic(d.v))}</td><td class="n">${brl(d.amount)}</td></tr>`).join('')}</tbody></table></div></fieldset>` : ''}`,
    `${f.id ? `<button class="btn danger" data-act="excluir-fornecedor" data-id="${f.id}" data-confirm="1" style="margin-right:auto">Excluir fornecedor</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-fornecedor" data-id="${f.id || ''}">Salvar</button>`,
    () => {
      const tp = document.getElementById('ff-tipo');
      const sync = () => { document.getElementById('ff-orig-w').hidden = tp.value === 'Prestador de serviço'; document.getElementById('ff-serv-w').hidden = tp.value === 'Vendedor de veículos'; };
      tp.addEventListener('change', sync); sync();
    });
}
const rolesCom = (p, r) => [...new Set([...((p && p.roles) || []).map(Number), r])];
const enderecoPayload = (end, cid, atual) => (end || cid || (atual && atual.address)) ? { address: end || null, city: cid || null } : undefined;
async function salvarFornecedor(id) {
  const f = id ? forn(id) : null;
  const data = { company_id: companyId(), name: val('ff-nome'), document: val('ff-cpf') || undefined, phone: val('ff-tel') || undefined, email: val('ff-email') || undefined, roles: rolesCom(f, 3),
    supplier_type: val('ff-tipo'), supplier_default_origin: val('ff-orig') || null, supplier_service: val('ff-serv') || null, contact_name: val('ff-contato') || null, pix_key: val('ff-pix') || null,
    observation: val('ff-obs') || undefined, address: enderecoPayload(val('ff-end'), val('ff-cid'), f) };
  if (!data.name) { toast('Informe o nome do fornecedor.'); return; }
  const ok = id ? await w(() => People.update(id, data), 'Fornecedor atualizado')
    : await w(() => People.create(data), 'Fornecedor cadastrado');
  if (ok) { closeModal(); loadAll(); }
}

/* ---------- outros investimentos ---------- */
const ehImovel = t => t === 'imovel' || t === 'terreno';
const INV_TIPOS = { imovel: 'Imóvel', terreno: 'Terreno', emprestimo: 'Empréstimo a terceiros', aplicacao_financeira: 'Aplicação financeira', acoes_fundos: 'Ações / fundos', participacao_empresa: 'Participação em empresa', maquinas_equipamentos: 'Máquinas / equipamentos', consorcio: 'Consórcio', criptoativos: 'Criptoativos', outro: 'Outro' };
const TIPOS_IMOVEL = ['Casa', 'Apartamento', 'Sala / loja comercial', 'Galpão', 'Lote / terreno urbano', 'Chácara / rural', 'Outro'];
const endImovel = x => [x.address, x.neighborhood, x.city, x.zip_code ? 'CEP ' + x.zip_code : ''].filter(Boolean).join(', ');
function invCalc(x) {
  const ls = x.lancamentos || [];
  const aportes = num(x.invested_amount) + ls.filter(l => l.type === 'aporte').reduce((a, l) => a + num(l.amount), 0);
  const custos = ls.filter(l => l.type === 'custo').reduce((a, l) => a + num(l.amount), 0);
  const ps = x.parcelas || [];
  const pagas = ps.filter(p => p.pago).reduce((a, p) => a + p.valor, 0);
  const abertas = ps.filter(p => !p.pago).reduce((a, p) => a + p.valor, 0);
  const receb = ls.filter(l => l.type === 'retorno').reduce((a, l) => a + num(l.amount), 0) + pagas;
  const enc = x.status === 'encerrado';
  const atual = enc ? 0 : (x.current_amount != null ? num(x.current_amount) : (ps.length ? abertas : aportes));
  const saida = enc ? num(x.redemption_amount) : 0;
  const totalIn = aportes + custos;
  const resultado = receb + saida + atual - totalIn;
  return { aportes, custos, receb, atual, saida, totalIn, resultado, pagas, abertas, jurosPrev: ps.length ? ps.reduce((a, p) => a + p.valor, 0) - num(x.invested_amount) : 0, pct: totalIn ? resultado / totalIn * 100 : 0 };
}
const taxaMensal = (r, per) => per === 'ano' ? Math.pow(1 + r, 1 / 12) - 1 : r;
function calcParcela(P, i, n, sis) {
  if (!n) return 0;
  if (sis === 'simples') return round2(P * (1 + i * n) / n);
  if (!i) return round2(P / n);
  return round2(P * i / (1 - Math.pow(1 + i, -n)));
}
const pctFmt = n => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const pctTxt = p => (p >= 0 ? '+' : '') + p.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
function invParcelas() { const out = []; S.investimentos.filter(x => x.status !== 'encerrado').forEach(x => x.parcelas.forEach((p, i) => { if (!p.pago) out.push({ ...p, idx: i, inv: x }); })); return out; }
function vInvest() {
  const all = S.investimentos;
  let list = all.slice().sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  if (filtroInv === 'ativos') list = list.filter(x => x.status !== 'encerrado');
  if (filtroInv === 'encerrados') list = list.filter(x => x.status === 'encerrado');
  const ativos = all.filter(x => x.status !== 'encerrado');
  const tot = all.reduce((a, x) => { const c = invCalc(x); a.in += c.totalIn; a.rec += c.receb; a.res += c.resultado; return a; }, { in: 0, rec: 0, res: 0 });
  const atual = ativos.reduce((a, x) => a + invCalc(x).atual, 0);
  const porTipo = {};
  ativos.forEach(x => { const k = INV_TIPOS[x.type] || 'Outro'; porTipo[k] = (porTipo[k] || 0) + invCalc(x).atual; });
  const seg = (k, l) => `<button data-act="filtro-inv" data-f="${k}" aria-pressed="${filtroInv === k}">${l}</button>`;
  const h = today(), lim = addDays(h, 30), proxInv = invParcelas().filter(p => p.venc <= lim).sort((a, b) => a.venc.localeCompare(b.venc));
  return `
  <h2 class="sec">Outros investimentos <button class="btn sm pri" data-act="novo-inv">+ Novo investimento</button></h2>
  <div class="kpis" style="margin-top:0">
    <div class="kpi"><span class="lb">Valor atual (ativos)</span><span class="vl">${brl(atual)}</span><span class="sub">${ativos.length} investimento${ativos.length === 1 ? '' : 's'} ativo${ativos.length === 1 ? '' : 's'}</span></div>
    <div class="kpi"><span class="lb">Total aplicado</span><span class="vl">${brl(tot.in)}</span><span class="sub">aportes e custos</span></div>
    <div class="kpi"><span class="lb">Retornos recebidos</span><span class="vl">${brl(tot.rec)}</span><span class="sub">aluguéis, juros, dividendos</span></div>
    <div class="kpi ${tot.res >= 0 ? 'good' : 'bad'}"><span class="lb">Resultado</span><span class="vl">${brl(tot.res)}</span><span class="sub">${tot.in ? pctTxt(tot.res / tot.in * 100) + ' sobre o aplicado' : '—'}</span></div>
  </div>
  ${Object.keys(porTipo).length ? `<div class="toolbar" style="margin-top:14px">${Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill open">${esc(k)} · ${brl(v)}</span>`).join('')}</div>` : ''}
  ${proxInv.length ? `<h2 class="sec">Parcelas vencidas e dos próximos 30 dias</h2><div class="panel"><div class="tbl"><table><tbody>${proxInv.map(p => { const st = parcStatus(p); const quando = st === 'late' ? `${daysBetween(p.venc, h)} dias de atraso` : (p.venc === h ? 'hoje' : `em ${daysBetween(h, p.venc)} dias`);
      return `<tr><td><div class="small" style="font-weight:600">${esc(p.inv.name)}</div><div class="small muted">${esc(p.inv.counterparty || '')} · parcela ${p.n}/${p.inv.parcelas.length}</div></td><td class="small">${fdate(p.venc)}<div class="${st === 'late' ? 'neg' : 'muted'}">${quando}</div></td><td class="n">${brl(p.valor)}</td><td style="text-align:right"><button class="btn sm" data-act="inv-pagar" data-inv="${p.inv.id}" data-id="${p.id}">Recebida</button></td></tr>`; }).join('')}</tbody></table></div></div>` : ''}
  <div class="toolbar" style="margin-top:14px"><div class="seg">${seg('ativos', 'Ativos')}${seg('encerrados', 'Encerrados')}${seg('todos', 'Todos')}</div></div>
  <div class="panel">${list.length ? `<div class="tbl"><table><thead><tr><th>Investimento</th><th>Tipo</th><th class="hide-sm">Início</th><th class="n">Aplicado</th><th class="n">Retornos</th><th class="n">Valor atual</th><th class="n">Resultado</th></tr></thead><tbody>
    ${list.map(x => { const c = invCalc(x); return `<tr class="click" data-act="ver-inv" data-id="${x.id}">
      <td><div style="font-weight:600">${esc(x.name)}</div><div class="small muted">${esc(ehImovel(x.type) ? [endImovel(x), x.registration_number ? 'mat. ' + x.registration_number : ''].filter(Boolean).join(' · ') : (x.counterparty || ''))}</div></td>
      <td class="small">${esc(INV_TIPOS[x.type] || x.type)}${x.parcelas.length ? `<div class="muted">${x.parcelas.filter(p => p.pago).length}/${x.parcelas.length} parcelas · ${pctFmt(x.interest_rate)}% ${x.interest_period === 'ano' ? 'a.a.' : 'a.m.'}</div>` : ''}${x.parcelas.some(p => parcStatus(p) === 'late') ? '<div><span class="pill late">Parcela vencida</span></div>' : ''}${x.status === 'encerrado' ? '<div><span class="pill open">Encerrado</span></div>' : ''}</td>
      <td class="small hide-sm">${fdate(x.start_date)}</td>
      <td class="n">${brl(c.totalIn)}</td><td class="n">${brl(c.receb)}</td>
      <td class="n">${x.status === 'encerrado' ? `<span class="small muted">resgate</span> ${brl(c.saida)}` : brl(c.atual)}</td>
      <td class="n ${c.resultado >= 0 ? 'pos' : 'neg'}">${brl(c.resultado)}<div class="small">${c.totalIn ? pctTxt(c.pct) : ''}</div></td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="empty">${all.length ? 'Nenhum investimento neste filtro.' : 'Nenhum investimento cadastrado. Registre imóveis, empréstimos, aplicações, participações e outros negócios para acompanhar tudo junto com os veículos.'}</div>`}</div>`;
}
function formInvest(x) {
  x = x || {};
  const temPago = (x.parcelas || []).some(p => p.pago);
  openModal(x.id ? 'Editar investimento' : 'Novo investimento', `
    <div class="fg">
      <label class="f full">Nome / descrição<input id="fi-nome" value="${esc(x.name)}" placeholder="Apartamento Águas Claras, empréstimo ao João…"></label>
      <label class="f">Tipo<select id="fi-tipo">${Object.entries(INV_TIPOS).map(([k, l]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Situação<select id="fi-status"><option value="ativo" ${(!x.status || x.status === 'ativo') ? 'selected' : ''}>Ativo</option><option value="encerrado" ${x.status === 'encerrado' ? 'selected' : ''}>Encerrado</option></select></label>
      <label class="f">Data do investimento<input id="fi-data" type="date" value="${esc(x.start_date || today())}"></label>
      <label class="f">Valor investido (R$)<input id="fi-valor" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(x.invested_amount)}"></label>
      <label class="f">Valor atual estimado (R$)<input id="fi-atual" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(x.current_amount)}" placeholder="igual ao investido"></label>
      <label class="f">Contraparte / onde está aplicado<input id="fi-contra" value="${esc(x.counterparty)}" placeholder="Banco, sócio, devedor, inquilino…"></label>
      <label class="f">Rendimento esperado<input id="fi-rend" value="${esc(x.expected_return)}" placeholder="2% a.m., aluguel R$ 2.500/mês…"></label>
      <label class="f">Vencimento / prazo<input id="fi-venc" type="date" value="${esc(x.due_date)}"></label>
    </div>
    <fieldset id="fi-imovel"><legend>Dados do imóvel</legend><div class="fg">
      <label class="f">Matrícula<input id="fi-mat" value="${esc(x.registration_number)}" placeholder="Nº da matrícula"></label>
      <label class="f">Cartório de Registro de Imóveis<input id="fi-cart" value="${esc(x.notary_office)}" placeholder="1º Ofício de Brasília…"></label>
      <label class="f">Inscrição do IPTU<input id="fi-iptu" value="${esc(x.iptu_registration)}"></label>
      <label class="f">Tipo de imóvel<select id="fi-timov"><option value="">—</option>${TIPOS_IMOVEL.map(t => `<option ${x.property_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="f full">Endereço (rua, número, complemento)<input id="fi-end" value="${esc(x.address)}"></label>
      <label class="f">Bairro / setor<input id="fi-bairro" value="${esc(x.neighborhood)}"></label>
      <label class="f">Cidade / UF<input id="fi-cid" value="${esc(x.city)}"></label>
      <label class="f">CEP<input id="fi-cep" value="${esc(x.zip_code)}" inputmode="numeric"></label>
      <label class="f">Área (m²)<input id="fi-area" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(x.area)}"></label>
    </div></fieldset>
    <fieldset><legend>Parcelas e taxa de juros</legend>
      ${temPago ? `<div class="hint">Este investimento já tem parcelas recebidas (${x.parcelas.length} parcelas a ${pctFmt(x.interest_rate)}% ${x.interest_period === 'ano' ? 'ao ano' : 'ao mês'}), então o parcelamento não pode ser refeito aqui.</div>` : `
      <div class="fg">
        <label class="f">Nº de parcelas<input id="fi-np" type="number" min="0" max="480" step="1" value="${esc(x.installment_count || 0)}"></label>
        <label class="f">Taxa de juros (%)<input id="fi-juros" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(x.interest_rate ?? '')}" placeholder="0"></label>
        <label class="f">Período da taxa<select id="fi-per"><option value="mes" ${x.interest_period !== 'ano' ? 'selected' : ''}>ao mês</option><option value="ano" ${x.interest_period === 'ano' ? 'selected' : ''}>ao ano</option></select></label>
        <label class="f">Cálculo<select id="fi-sis"><option value="price" ${x.interest_system !== 'simples' ? 'selected' : ''}>Juros compostos (Price)</option><option value="simples" ${x.interest_system === 'simples' ? 'selected' : ''}>Juros simples</option></select></label>
        <label class="f">1º vencimento<input id="fi-pv1" type="date" value="${esc(x.first_due_date || addMonths(x.start_date || today(), 1))}"></label>
      </div>
      <div class="hint">Use para empréstimos, vendas a prazo ou qualquer investimento que volte em parcelas. Deixe 0 parcelas se não houver. O valor da parcela é calculado pela taxa.</div>
      <div id="fi-prev"></div>`}
    </fieldset>
    <div class="fg" id="fi-enc">
      <label class="f">Data de encerramento<input id="fi-dataenc" type="date" value="${esc(x.end_date)}"></label>
      <label class="f">Valor de venda / resgate (R$)<input id="fi-resg" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(x.redemption_amount)}"></label>
    </div>
    <label class="f">Observações<textarea id="fi-obs" rows="2">${esc(x.notes)}</textarea></label>`,
    `${x.id ? `<button class="btn danger" data-act="excluir-inv" data-id="${x.id}" data-confirm="1" style="margin-right:auto">Excluir</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-inv" data-id="${x.id || ''}">Salvar</button>`,
    root => {
      const st = document.getElementById('fi-status'); const sync = () => { document.getElementById('fi-enc').hidden = st.value !== 'encerrado'; }; st.addEventListener('change', sync); sync();
      const tp = document.getElementById('fi-tipo'); const syncT = () => { document.getElementById('fi-imovel').hidden = !ehImovel(tp.value); }; tp.addEventListener('change', syncT); syncT();
      const pv = document.getElementById('fi-prev'); if (!pv) return;
      const upd = () => {
        const n = Math.max(0, Math.min(480, parseInt(val('fi-np')) || 0)); if (!n) { pv.innerHTML = ''; return; }
        const P = num(val('fi-valor')), vp = calcParcela(P, taxaMensal(num(val('fi-juros')) / 100, val('fi-per')), n, val('fi-sis')), v1 = val('fi-pv1') || addMonths(today(), 1);
        const tot = vp * n;
        pv.innerHTML = `<div class="ledger" style="margin:4px 0 8px"><dt>${n} parcelas de</dt><dd>${brl(vp)}</dd><dt>Total a receber</dt><dd>${brl(tot)}</dd><dt>Juros no período</dt><dd class="pos">${brl(tot - P)}</dd></div>
          <div class="preview"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>${Array.from({ length: n }, (_, k) => `<tr><td>${k + 1}/${n}</td><td>${fdate(addMonths(v1, k))}</td><td class="n">${brl(vp)}</td></tr>`).join('')}</tbody></table></div>`;
      };
      root.querySelectorAll('input,select').forEach(el => el.addEventListener('input', upd)); upd();
    });
}
async function salvarInvest(id) {
  const data = {
    company_id: companyId(), name: val('fi-nome'), type: val('fi-tipo'), status: val('fi-status'), start_date: val('fi-data'),
    invested_amount: num(val('fi-valor')), current_amount: val('fi-atual') ? num(val('fi-atual')) : undefined,
    counterparty: val('fi-contra') || undefined, expected_return: val('fi-rend') || undefined, due_date: val('fi-venc') || undefined,
    notes: val('fi-obs') || undefined,
  };
  if (document.getElementById('fi-np')) Object.assign(data, { installment_count: Number(val('fi-np')) || 0, interest_rate: val('fi-juros') ? num(val('fi-juros')) : undefined,
    interest_period: val('fi-per'), interest_system: val('fi-sis'), first_due_date: val('fi-pv1') || undefined });
  if (ehImovel(data.type)) Object.assign(data, { registration_number: val('fi-mat') || undefined, notary_office: val('fi-cart') || undefined, iptu_registration: val('fi-iptu') || undefined,
    property_type: val('fi-timov') || undefined, address: val('fi-end') || undefined, neighborhood: val('fi-bairro') || undefined, city: val('fi-cid') || undefined,
    zip_code: val('fi-cep') || undefined, area: val('fi-area') ? num(val('fi-area')) : undefined });
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
  const c = invCalc(x), ls = x.lancamentos.slice().sort((a, b) => (a.entry_date || '').localeCompare(b.entry_date || ''));
  const enc = x.status === 'encerrado';
  openModal(x.name, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="pill open">${esc(INV_TIPOS[x.type] || x.type)}</span>${enc ? '<span class="pill open">Encerrado</span>' : '<span class="pill sold">Ativo</span>'}<span class="small muted">${[x.counterparty, x.expected_return, x.due_date ? 'vence ' + fdate(x.due_date) : ''].filter(Boolean).map(esc).join(' · ')}</span></div>
    ${ehImovel(x.type) ? `<div class="panel" style="padding:14px 16px;font-size:14px;display:flex;flex-direction:column;gap:4px">
      <div class="hint" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600">Imóvel${x.property_type ? ' · ' + esc(x.property_type) : ''}</div>
      <div style="font-weight:600">${esc(endImovel(x) || 'Endereço não informado')}</div>
      <div class="small">Matrícula <b style="font-family:var(--f-mono)">${esc(x.registration_number || '—')}</b>${x.notary_office ? ' · ' + esc(x.notary_office) : ''}</div>
      <div class="small muted">${[x.iptu_registration ? 'IPTU ' + esc(x.iptu_registration) : '', x.area ? Number(x.area).toLocaleString('pt-BR') + ' m²' : ''].filter(Boolean).join(' · ')}</div>
    </div>` : ''}
    <div class="panel" style="padding:14px 16px"><dl class="ledger">
      <dt>Investido em ${fdate(x.start_date)}</dt><dd>${brl(x.invested_amount)}</dd>
      <dt>Aportes adicionais</dt><dd>${brl(c.aportes - num(x.invested_amount))}</dd>
      <dt>Custos</dt><dd>${brl(c.custos)}</dd>
      <dt class="tot">Total aplicado</dt><dd class="tot">${brl(c.totalIn)}</dd>
      <dt>Retornos recebidos</dt><dd class="pos">${brl(c.receb)}</dd>
      ${enc ? `<dt>Venda / resgate em ${fdate(x.end_date)}</dt><dd>${brl(c.saida)}</dd>` : `<dt>Valor atual estimado</dt><dd>${brl(c.atual)}</dd>`}
      <dt class="tot">Resultado</dt><dd class="tot ${c.resultado >= 0 ? 'pos' : 'neg'}">${brl(c.resultado)} (${c.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</dd>
    </dl></div>
    ${x.notes ? `<div class="small">${esc(x.notes)}</div>` : ''}
    ${x.parcelas.length ? `<fieldset><legend>Parcelas · ${x.parcelas.filter(p => p.pago).length} de ${x.parcelas.length} recebidas</legend>
      <div class="small muted">${x.parcelas.length}x de ${brl(x.parcelas[0].valor)} · juros de ${pctFmt(x.interest_rate)}% ${x.interest_period === 'ano' ? 'ao ano' : 'ao mês'} (${x.interest_system === 'simples' ? 'simples' : 'compostos'}) · juros previstos ${brl(c.jurosPrev)} · a receber ${brl(c.abertas)}</div>
      <div class="tbl preview" style="max-height:320px"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th><th>Situação</th><th class="hide-sm">Pago em</th><th></th></tr></thead><tbody>
      ${x.parcelas.map(p => { const st = parcStatus(p); return `<tr><td>${p.n}/${x.parcelas.length}</td><td>${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td><td><span class="pill ${st}">${parcLabel[st]}</span></td><td class="small muted hide-sm">${p.pago ? fdate(p.dataPag) : ''}</td>
        <td style="text-align:right">${p.pago ? `<button class="btn sm ghost" data-act="inv-estornar" data-id="${p.id}" data-inv="${x.id}">Desfazer</button>` : `<button class="btn sm" data-act="inv-pagar" data-id="${p.id}" data-inv="${x.id}">Recebida</button>`}</td></tr>`; }).join('')}
      </tbody></table></div></fieldset>` : ''}
    <fieldset><legend>Movimentações</legend>
      ${ls.length ? `<div class="tbl"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th class="n">Valor</th><th></th></tr></thead><tbody>
        ${ls.map(l => `<tr><td class="small">${fdate(l.entry_date)}</td><td class="small">${TIPO_L[l.type] || l.type}</td><td class="small">${esc(l.description)}</td><td class="n ${l.type === 'retorno' ? 'pos' : ''}">${brl(l.amount)}</td><td style="text-align:right"><button class="btn sm ghost danger" data-act="excluir-lanc" data-inv="${x.id}" data-lid="${l.id}" data-confirm="1">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="hint">Lance aqui o que entra (aluguéis, juros, dividendos) e o que sai (novos aportes, IPTU, condomínio, taxas).</div>`}
      <div class="fg">
        <label class="f">Data<input id="fl-data" type="date" value="${today()}"></label>
        <label class="f">Tipo<select id="fl-tipo">${Object.entries(TIPO_L).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <label class="f">Descrição<input id="fl-desc" placeholder="Aluguel de outubro"></label>
        <label class="f">Valor (R$)<input id="fl-valor" type="number" step="0.01" min="0" inputmode="decimal"></label>
      </div>
      <div><button class="btn sm pri" data-act="add-lanc" data-inv="${x.id}">Lançar</button></div>
    </fieldset>`,
    `<button class="btn" data-act="editar-inv" data-id="${x.id}">Editar dados</button><button class="btn pri" data-act="fechar">Fechar</button>`, null, { autofocus: false });
  openInvId = id;
}
async function marcarInvParcela(invId, instId, paid) {
  if (await w(() => InvestmentInstallments.markPaid(instId, paid), paid ? 'Parcela marcada como recebida' : 'Recebimento desfeito')) { await loadAll(); if (openInvId === invId && modalRoot.innerHTML) verInvest(invId); }
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
  if (q) list = list.filter(c => [c.name, c.document, c.phone, cidadePessoa(c)].join(' ').toLowerCase().includes(q));
  return `
  <h2 class="sec">Clientes <button class="btn sm" data-act="novo-cliente">+ Novo cliente</button></h2>
  <div class="toolbar"><input type="search" id="busca-cli" placeholder="Buscar por nome, CPF, telefone ou cidade" value="${esc(buscaCli)}"></div>
  <div class="panel">${list.length ? `<div class="tbl"><table><thead><tr><th>Nome</th><th>CPF / CNPJ</th><th>Telefone</th><th class="hide-sm">Cidade</th><th>Compras</th><th class="n">Saldo devedor</th></tr></thead><tbody>
    ${list.map(c => { const vs = S.vendas.filter(s => s.peopleId === c.id); const saldo = vs.reduce((a, s) => a + aReceber(s), 0); const late = vs.some(s => s.parcelas.some(p => parcStatus(p) === 'late'));
      return `<tr class="click" data-act="editar-cliente" data-id="${c.id}"><td style="font-weight:600">${esc(c.name)}</td><td class="small" style="font-family:var(--f-mono)">${esc(c.document || '—')}</td><td class="small">${esc(c.phone || '—')}</td><td class="small hide-sm">${esc(cidadePessoa(c) || '—')}</td>
      <td class="small">${vs.length ? vs.map(s => esc(nomeVeic(veic(s.vehicleId)))).join(', ') : '<span class="muted">—</span>'}</td><td class="n ${late ? 'neg' : ''}">${saldo ? brl(saldo) : '—'}</td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="empty">${S.clientes.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado. Você pode cadastrar aqui ou direto ao registrar uma venda.'}</div>`}</div>`;
}

/* ---------- modais ---------- */
function openModal(title, body, footer, onMount, opts = {}) {
  modalRoot.innerHTML = `<div class="overlay" data-overlay="1"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h2>${esc(title)}</h2><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
    <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div></div>`;
  document.body.style.overflow = 'hidden';
  const f = opts.autofocus === false ? null : modalRoot.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
  if (onMount) onMount(modalRoot);
}
function closeModal() { modalRoot.innerHTML = ''; document.body.style.overflow = ''; openVeicId = null; openInvId = null; }
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

function formVeiculo(v) {
  v = v || {}; openVeicId = null;
  const pcs = contasVeic(v), pagoC = pcs.some(p => p.pago), dis = pagoC ? 'disabled' : '';
  openModal(v.id ? 'Editar veículo' : 'Cadastrar compra de veículo', `
    <fieldset><legend>Veículo</legend><div class="fg">
      <label class="f">Placa<input id="fv-placa" value="${esc(v.license_plate)}" placeholder="ABC1D23" maxlength="8" style="text-transform:uppercase"></label>
      <label class="f">Marca<input id="fv-marca" value="${esc(v.brand)}" placeholder="Volkswagen"></label>
      <label class="f">Modelo / versão<input id="fv-modelo" value="${esc(v.model)}" placeholder="Gol 1.0 MPI"></label>
      <label class="f">Ano fab./mod.<input id="fv-ano" value="${esc(v.fabrication_year && v.model_year && v.fabrication_year !== v.model_year ? v.fabrication_year + '/' + v.model_year : v.fabrication_year)}" placeholder="2019/2020"></label>
      <label class="f">Cor<input id="fv-cor" value="${esc(v.color)}"></label>
      <label class="f">Quilometragem<input id="fv-km" type="number" inputmode="numeric" min="0" value="${esc(v.mileage)}"></label>
      <label class="f">Renavam<input id="fv-renavam" value="${esc(v.reindeer)}" inputmode="numeric"></label>
      <label class="f">Chassi<input id="fv-chassi" value="${esc(v.vin_number)}" style="text-transform:uppercase"></label>
    </div></fieldset>
    <fieldset><legend>Compra</legend><div class="fg">
      <label class="f">Data da compra<input id="fv-data" type="date" value="${esc(v.purchase_date || today())}"></label>
      <label class="f">Valor da compra (R$)<input id="fv-valor" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(v.purchase_price)}"></label>
      <label class="f">Condição de pagamento<select id="fv-cond"><option value="">Selecione…</option>${Object.entries(COND).map(([k, l]) => `<option value="${k}" ${v.purchase_condition === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Meio de pagamento<select id="fv-meio"><option value="">Selecione…</option>${Object.keys(MEIOS_COMPRA).map(o => `<option ${meioCompra(v) === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
    </div>
    <div id="fv-parc-w" ${v.purchase_condition === 'parcelado' ? '' : 'hidden'} style="display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:8px;padding:12px">
      <span style="font-size:12.5px;font-weight:600;color:var(--muted)">Parcelamento da compra (entra em Contas a pagar)</span>
      ${pagoC ? `<div class="hint">Esta compra já tem parcelas pagas, então o parcelamento não pode ser refeito aqui. Marque ou desfaça pagamentos na aba Contas a pagar.</div>` : ''}
      <div class="fg">
        <label class="f">Entrada (R$)<input id="fv-ent" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(v.purchase_down_payment || '')}" placeholder="0" ${dis}></label>
        <label class="f">Nº de parcelas<input id="fv-np" type="number" min="1" max="120" step="1" inputmode="numeric" value="${pcs.length || ''}" ${dis}></label>
        <label class="f">1º vencimento<input id="fv-venc" type="date" value="${esc(pcs.length ? pcs[0].venc : addMonths(v.purchase_date || today(), 1))}" ${dis}></label>
        <label class="f">Valor da parcela (R$)<input id="fv-vp" type="number" step="0.01" min="0" inputmode="decimal" value="${pcs.length ? esc(pcs[0].valor) : ''}" placeholder="calculado" ${dis}></label>
        <label class="f full">Pagar a (credor)<input id="fv-credor" value="${esc(v.purchase_creditor)}" placeholder="Vendedor, banco, financeira, administradora do cartão…"></label>
      </div>
      <div id="fv-prev"></div>
    </div>${payerHtml('pc', 'Quem pagou a aquisição', 'fv-valor', v.id ? v : null)}</fieldset>
    <fieldset><legend>Origem do veículo</legend><div class="fg">
      <label class="f full">Fornecedor cadastrado<select id="fv-forn"><option value="">— Não vincular (preencher à mão) —</option>${fornOpts(v.purchase_people_id, vendeVeic)}</select><span class="hint" style="font-weight:400">Ao escolher, nome, contato, cidade e tipo de origem são preenchidos. Cadastre novos na aba Fornecedores.</span></label>
      <label class="f">Tipo de origem<select id="fv-tipoorig"><option value="">Selecione…</option>${ORIGENS.map(o => `<option ${v.origin_type === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="f">Comprado de (nome do vendedor, leiloeiro ou loja)<input id="fv-origem" value="${esc(v.origin_name)}"></label>
      <label class="f">Contato / documento do vendedor<input id="fv-origcont" value="${esc(v.origin_contact)}" placeholder="Telefone, CPF ou CNPJ"></label>
      <label class="f">Cidade / UF de origem<input id="fv-origcid" value="${esc(v.origin_city)}"></label>
      <label class="f full">Detalhes da origem<input id="fv-origdet" value="${esc(v.origin_details)}" placeholder="Nº do lote, leilão, nota fiscal, venda em que entrou na troca…"></label>
    </div></fieldset>
    <fieldset><legend>Anotações</legend><div class="fg">
      <label class="f full">Observações<textarea id="fv-obs" rows="2">${esc(v.note)}</textarea></label>
    </div></fieldset>`,
    `${v.id ? `<button class="btn danger" data-act="excluir-veiculo" data-id="${v.id}" data-confirm="1" style="margin-right:auto">Excluir veículo</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-veiculo" data-id="${v.id || ''}">Salvar</button>`,
    root => {
      wirePayer(root);
      const cond = document.getElementById('fv-cond'), pw = document.getElementById('fv-parc-w'), vpEl = document.getElementById('fv-vp');
      let vpMan = !!pcs.length; vpEl.addEventListener('input', () => { vpMan = vpEl.value !== ''; });
      const prev = () => {
        pw.hidden = cond.value !== 'parcelado'; const box = document.getElementById('fv-prev');
        const ps = pagoC ? pcs : gerarContasCompra(vpMan);
        if (!ps.length) { box.innerHTML = ''; return; }
        const tot = num(val('fv-ent')) + ps.reduce((a, p) => a + num(p.valor), 0), valor = num(val('fv-valor'));
        box.innerHTML = `<div class="preview"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>${ps.map((p, i) => `<tr><td>${i + 1}/${ps.length}</td><td>${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td></tr>`).join('')}</tbody></table></div>
          <div class="hint" style="margin-top:6px">Entrada + parcelas = ${brl(tot)}${valor && Math.abs(tot - valor) > 0.05 ? ` (diferença de ${brl(tot - valor)} em relação ao valor da compra, que pode ser juros)` : ''}</div>`;
      };
      root.querySelectorAll('#fv-valor,#fv-ent,#fv-np,#fv-venc,#fv-vp').forEach(el => el.addEventListener('input', prev));
      cond.addEventListener('change', prev); prev();
      const sel = document.getElementById('fv-forn');
      sel.addEventListener('change', () => {
        const f = forn(sel.value); if (!f) return;
        document.getElementById('fv-origem').value = f.name || '';
        document.getElementById('fv-origcont').value = [f.phone, f.document].filter(Boolean).join(' · ');
        document.getElementById('fv-origcid').value = cidadePessoa(f);
        if (f.supplier_default_origin) document.getElementById('fv-tipoorig').value = f.supplier_default_origin;
      });
    });
}
function gerarContasCompra(vpManual) {
  const n = Math.max(0, Math.min(120, parseInt(val('fv-np')) || 0)); if (!n) return [];
  const saldo = Math.max(0, num(val('fv-valor')) - num(val('fv-ent'))), venc = val('fv-venc') || addMonths(today(), 1);
  let vp = vpManual ? num(val('fv-vp')) : 0, last = null;
  if (!vp) { vp = Math.floor(saldo / n * 100) / 100; last = round2(saldo - vp * (n - 1)); }
  return Array.from({ length: n }, (_, i) => ({ n: i + 1, venc: addMonths(venc, i), valor: (i === n - 1 && last != null) ? last : vp }));
}
// Recria as parcelas da compra em Contas a pagar quando o plano mudou (só se nenhuma foi paga).
async function sincronizarContasCompra(v, plano, extra) {
  const atuais = S.contas.filter(c => c.compra && c.vehicleId === v.id);
  if (atuais.some(c => c.pago)) return;
  const assin = ps => ps.map(p => `${p.venc}|${round2(p.valor)}`).join(',');
  const mesmoPlano = assin(atuais.slice().sort((a, b) => a.venc.localeCompare(b.venc))) === assin(plano);
  if (mesmoPlano && extra.mesmoMeio) return;
  for (const c of atuais) await Bills.remove(c.id);
  if (!plano.length) return;
  const categoryId = await categoriaPagar(CAT_COMPRA);
  const rot = [v.license_plate, nomeVeic(v)].filter(Boolean).join(' · ');
  for (const p of plano) await Bills.create(billPagar({ nome: `Compra ${rot} (${p.n}/${plano.length})`, venc: p.venc, valor: p.valor, categoryId, peopleId: v.purchase_people_id, vehicleId: v.id, compra: true, formPayment: MEIOS_COMPRA[v.purchase_payment_method] ?? 0, n: p.n, tot: plano.length }));
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
    purchase_condition: val('fv-cond') || null, purchase_payment_method: val('fv-meio') || null,
  };
  if (!data.model && !data.license_plate) { toast('Informe pelo menos a placa ou o modelo.'); return; }
  if (!data.purchase_price) { toast('Informe o valor pago.'); return; }
  const old = id ? veic(id) : null, pagoC = !!old && contasVeic(old).some(p => p.pago);
  let plano = [];
  if (data.purchase_condition === 'parcelado') {
    data.purchase_creditor = val('fv-credor') || null;
    if (!pagoC) {
      plano = gerarContasCompra(val('fv-vp') !== '');
      if (!plano.length) { toast('Informe em quantas parcelas a compra foi feita.'); return; }
      if (num(val('fv-ent')) > data.purchase_price) { toast('A entrada não pode ser maior que o valor da compra.'); return; }
      data.purchase_down_payment = num(val('fv-ent'));
    }
  } else if (pagoC) { toast('Esta compra já tem parcelas pagas. Para mudar a condição, desfaça os pagamentos em Contas a pagar.'); return; }
  else { data.purchase_down_payment = null; data.purchase_creditor = null; }
  const pc = readPayer('pc', data.purchase_price); if (pc.err) { toast(pc.err); return; }
  data.partner_a_paid = pc.a; data.partner_b_paid = pc.b;
  const ok = await w(async () => {
    const salvo = id ? await Vehicles.update(id, data) : await Vehicles.create(data);
    await sincronizarContasCompra({ ...(old || {}), ...data, id: id || salvo.id }, plano, { mesmoMeio: !old || old.purchase_payment_method === data.purchase_payment_method });
  }, id ? 'Veículo atualizado' : 'Veículo cadastrado');
  if (ok) { closeModal(); await loadAll(); }
}

let openVeicId = null;
function verVeiculo(id) {
  const v = veic(id); if (!v) return closeModal();
  const s = vendaDe(id), c = s && pessoaPorId(s.peopleId), l = s ? s.valor - custo(v) : null;
  const desp = despesasDe(v).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const dias = v.purchase_date ? daysBetween(v.purchase_date, s ? s.data : today()) : null;
  const sc = socCalc(v);
  openModal(nomeVeic(v), `
    <div class="veh" style="justify-content:space-between;flex-wrap:wrap">
      <div class="veh">${plate(v.license_plate)}<div class="small muted">${[v.color, v.mileage ? Number(v.mileage).toLocaleString('pt-BR') + ' km' : '', v.reindeer ? 'Renavam ' + esc(v.reindeer) : ''].filter(Boolean).join(' · ')}</div></div>
      ${s ? '<span class="pill sold">Vendido</span>' : '<span class="pill stock">Em estoque</span>'}
    </div>
    <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="panel" style="padding:14px 16px"><dl class="ledger">
        <dt>Compra em ${fdate(v.purchase_date)}</dt><dd>${brl(v.purchase_price)}</dd><dt>Pago por</dt><dd>${quem(v, v.purchase_price)}</dd>${condCompra(v) ? `<dt>Forma de pagamento</dt><dd>${esc(formaCompraTxt(v))}</dd>` : ''}
        <dt>Despesas (${desp.length})</dt><dd>${brl(despTotal(v))}</dd>
        <dt class="tot">Custo total</dt><dd class="tot">${brl(custo(v))}</dd>
        ${s ? `<dt>Venda em ${fdate(s.data)}</dt><dd>${brl(s.valor)}</dd><dt class="tot">Lucro</dt><dd class="tot ${l >= 0 ? 'pos' : 'neg'}">${brl(l)}</dd>` : ''}
        ${dias != null ? `<dt>${s ? 'Dias até vender' : 'Dias em estoque'}</dt><dd>${dias}</dd>` : ''}
      </dl></div>
      <div class="panel" style="padding:14px 16px;font-size:14px">
        ${s ? `<div class="hint" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600">Comprador</div><div style="font-weight:600;margin-top:4px">${esc(c ? c.name : 'Cliente removido')}</div><div class="small muted">${esc(c ? [c.document, c.phone].filter(Boolean).join(' · ') : '')}</div><div class="small" style="margin-top:8px">${esc(s.forma)}${s.parcelas.length ? ` · ${s.parcelas.length} parcelas · a receber ${brl(aReceber(s))}` : ''}</div>`
          : `${v.note ? `<div class="hint" style="margin-top:8px">Observações</div><div>${esc(v.note)}</div>` : ''}<div style="margin-top:12px"><button class="btn sm pri" data-act="nova-venda" data-veiculo="${v.id}">Registrar venda</button></div>`}
      </div>
    </div>
    <div class="panel" style="padding:14px 16px;font-size:14px"><div class="hint" style="text-transform:uppercase;letter-spacing:.06em;font-weight:600">Origem</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"><span class="pill open">${esc(tipoOrig(v))}</span><b>${esc(v.origin_name || '')}</b></div>
      <div class="small muted" style="margin-top:4px">${[v.origin_contact, v.origin_city].filter(Boolean).map(esc).join(' · ')}</div>
      ${v.origin_details ? `<div class="small" style="margin-top:4px">${esc(v.origin_details)}</div>` : ''}</div>
    ${condCompra(v) === 'Parcelado' ? `<div class="panel"><h3><span>Pagamento da compra · ${esc(parcCompraTxt(v))}</span><span>${compraPagas(v)}/${nParcCompra(v)} pagas</span></h3>
      ${contasVeic(v).length ? `<div class="tbl"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${contasVeic(v).map((p, i, ps) => { const st = parcStatus(p); return `<tr><td>${i + 1}/${ps.length}</td><td class="small">${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td><td><span class="pill ${st}">${parcLabel[st]}${p.pago && p.dataPag ? ' em ' + fdate(p.dataPag) : ''}</span></td><td style="text-align:right">${btnConta(p)}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty">As parcelas desta compra ainda não têm vencimento. Use "Editar dados" para gerar as datas.</div>`}
      <div class="hint" style="padding:8px 16px 12px">${v.purchase_creditor ? 'Pagar a ' + esc(v.purchase_creditor) + ' · ' : ''}saldo devedor ${brl(compraSaldo(v))}</div></div>` : ''}
    <div class="panel"><h3><span>Divisão entre os sócios</span><button class="btn sm" data-act="pdf-veiculo" data-id="${v.id}">Gerar PDF</button></h3>
      <div class="socios">
        <div class="socio A"><span class="nm"><i class="dot A"></i>${esc(SA())}</span><span class="small muted">Aquisição ${brl(sc.compraA)} · despesas ${brl(sc.despA)}</span><span class="vl">${brl(sc.invA)}</span>${sc.vendido ? `<span class="small muted">Tem direito a ${brl(sc.devA)} (devolução + metade do lucro)</span>` : ''}</div>
        <div class="socio B"><span class="nm"><i class="dot B"></i>${esc(SB())}</span><span class="small muted">Aquisição ${brl(sc.compraB)} · despesas ${brl(sc.despB)}</span><span class="vl">${brl(sc.invB)}</span>${sc.vendido ? `<span class="small muted">Tem direito a ${brl(sc.devB)} (devolução + metade do lucro)</span>` : ''}</div>
      </div>
      ${sc.vendido ? `<div class="hint" style="padding:0 16px 8px">Lucro ${brl(sc.lucro)} ÷ 2 = ${brl(sc.metade)} para cada um · Recebeu da venda: ${esc(SA())} ${brl(sc.recA)}, ${esc(SB())} ${brl(sc.recB)}</div><div class="acerto">${esc(acertoTxt(sc.saldoA))}</div>` : `<div class="hint" style="padding:0 16px 14px">O lucro e o acerto aparecem depois que a venda for registrada.</div>`}</div>
    <fieldset><legend>Despesas com o veículo</legend>
      ${desp.length ? `<div class="tbl preview" style="max-height:none"><table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th class="hide-sm">Fornecedor</th><th class="n">Valor</th><th>Quem pagou</th><th></th></tr></thead><tbody>
        ${desp.map(d => `<tr><td class="small">${fdate(d.date)}</td><td class="small">${esc(CAT_LABELS[d.category] || d.category)}</td><td class="small">${esc(d.description)}</td><td class="small hide-sm">${esc((forn(d.supplier_people_id) || d.supplier || {}).name || '—')}</td><td class="n">${brl(d.amount)}</td><td>${quem(d, d.amount)}</td><td style="text-align:right"><button class="btn sm ghost danger" data-act="excluir-despesa" data-veiculo="${v.id}" data-did="${d.id}" data-confirm="1" aria-label="Excluir despesa">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="hint">Nenhuma despesa lançada. Registre aqui reparos, documentação, pneus e tudo o que entra no custo do carro.</div>`}
      <div class="fg">
        <label class="f">Data<input id="fd-data" type="date" value="${today()}"></label>
        <label class="f">Categoria<select id="fd-cat">${CATS.map(c => `<option value="${c}">${CAT_LABELS[c]}</option>`).join('')}</select></label>
        <label class="f">Descrição<input id="fd-desc" placeholder="Troca de embreagem"></label>
        <label class="f">Fornecedor / prestador<select id="fd-forn"><option value="">— Nenhum —</option>${fornOpts('', prestaServ)}</select></label>
        <label class="f">Valor (R$)<input id="fd-valor" type="number" step="0.01" min="0" inputmode="decimal"></label>
      </div>
      ${payerHtml('pd', 'Quem pagou esta despesa', 'fd-valor', null)}
      <div><button class="btn sm pri" data-act="add-despesa" data-veiculo="${v.id}">Lançar despesa</button></div>
    </fieldset>`,
    `<button class="btn" data-act="pdf-veiculo" data-id="${v.id}">Gerar PDF</button><button class="btn" data-act="editar-veiculo" data-id="${v.id}">Editar dados</button><button class="btn pri" data-act="fechar">Fechar</button>`, root => wirePayer(root), { autofocus: false });
  openVeicId = id;
}
async function addDespesa(vid) {
  const valor = num(val('fd-valor'));
  if (!valor) { toast('Informe o valor da despesa.'); return; }
  const pd = readPayer('pd', valor); if (pd.err) { toast(pd.err); return; }
  if (await w(() => VehicleExpenses.create({ company_id: companyId(), vehicle_id: vid, category: val('fd-cat'), description: val('fd-desc') || 'Despesa', date: val('fd-data') || today(), amount: valor,
    supplier_people_id: val('fd-forn') || undefined, partner_a_paid: pd.a, partner_b_paid: pd.b }), 'Despesa lançada')) { await loadAll(); verVeiculo(vid); }
}
async function excluirDespesa(vid, did) {
  if (await w(() => VehicleExpenses.remove(did), 'Despesa excluída')) { await loadAll(); verVeiculo(vid); }
}

function formCliente(c) {
  c = c || {}; openVeicId = null;
  const vs = c.id ? S.vendas.filter(s => s.peopleId === c.id) : [];
  openModal(c.id ? 'Cliente' : 'Novo cliente', `
    <div class="fg">${camposCliente('fc-', c)}
      <label class="f full">Observações<textarea id="fc-obs" rows="2">${esc(c.observation)}</textarea></label>
    </div>
    ${vs.length ? `<fieldset><legend>Compras</legend>${vs.map(s => `<div class="small">${esc(nomeVeic(veic(s.vehicleId)))} · ${fdate(s.data)} · ${brl(s.valor)} · a receber ${brl(aReceber(s))}</div>`).join('')}</fieldset>` : ''}`,
    `${c.id && !vs.length ? `<button class="btn danger" data-act="excluir-cliente" data-id="${c.id}" data-confirm="1" style="margin-right:auto">Excluir cliente</button>` : ''}<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-cliente" data-id="${c.id || ''}">Salvar</button>`);
}
const camposCliente = (p, c = {}) => `
      <label class="f full">Nome completo<input id="${p}nome" value="${esc(c.name)}"></label>
      <label class="f">CPF / CNPJ<input id="${p}cpf" value="${esc(c.document)}" inputmode="numeric"></label>
      <label class="f">RG<input id="${p}rg" value="${esc(c.general_record)}"></label>
      <label class="f">Telefone / WhatsApp<input id="${p}tel" value="${esc(c.phone)}" inputmode="tel"></label>
      <label class="f">E-mail<input id="${p}email" type="email" value="${esc(c.email)}"></label>
      <label class="f full">Endereço<input id="${p}end" value="${esc(endPessoa(c))}"></label>
      <label class="f">Cidade / UF<input id="${p}cid" value="${esc(cidadePessoa(c))}"></label>`;
const lerCliente = (p, atual) => ({ company_id: companyId(), name: val(p + 'nome'), document: val(p + 'cpf') || undefined, general_record: val(p + 'rg') || undefined, phone: val(p + 'tel') || undefined,
  email: val(p + 'email') || undefined, observation: val(p + 'obs') || undefined, roles: rolesCom(atual, 2), address: enderecoPayload(val(p + 'end'), val(p + 'cid'), atual) });
async function salvarCliente(id) {
  const data = lerCliente('fc-', id ? cli(id) : null);
  if (!data.name) { toast('Informe o nome do cliente.'); return; }
  const ok = id ? await w(() => People.update(id, data), 'Cliente atualizado')
    : await w(() => People.create(data), 'Cliente cadastrado');
  if (ok) { closeModal(); await loadAll(); }
}

function formVenda(opts) {
  openVeicId = null;
  const s = opts.vendaId ? S.vendas.find(x => x.id === opts.vendaId) : null;
  const disponiveis = S.veiculos.filter(v => !vendaDe(v.id) || (s && v.id === s.vehicleId));
  if (!disponiveis.length) { toast('Não há veículo em estoque para vender. Cadastre uma compra primeiro.'); return; }
  const vSel = s ? s.vehicleId : (opts.veiculoId || disponiveis[0].id);
  const nP = s ? s.parcelas.length : 0;
  // Editando: só refaz o parcelamento de venda parcelada sem nenhuma parcela recebida.
  const travado = s && (!nP || s.parcelas.some(p => p.pago));
  openModal(s ? 'Editar venda' : 'Registrar venda', `
    <fieldset><legend>Veículo e valor</legend><div class="fg">
      <label class="f full">Veículo<select id="fs-veic" ${s ? 'disabled' : ''}>${disponiveis.map(v => `<option value="${v.id}" ${v.id === vSel ? 'selected' : ''}>${esc((v.license_plate ? v.license_plate + ' · ' : '') + nomeVeic(v))} (custo ${brl(custo(v))})</option>`).join('')}</select></label>
      <label class="f">Data da venda<input id="fs-data" type="date" value="${esc(s ? s.data : today())}"></label>
      <label class="f">Valor de venda (R$)<input id="fs-valor" type="number" step="0.01" min="0" inputmode="decimal" value="${s ? esc(s.valor) : ''}"></label>
      <label class="f full">Forma de venda<select id="fs-forma">${FORMAS.map(f => `<option ${s && s.forma === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
      <div class="full hint" id="fs-lucro"></div>
    </div>${payerHtml('pv', 'Quem recebe o dinheiro desta venda', 'fs-valor', s, ...PR)}<div class="hint">Usado para calcular quanto um sócio repassa ao outro no acerto.</div></fieldset>
    <fieldset><legend>Comprador</legend><div class="fg">
      <label class="f full">Cliente<select id="fs-cli"><option value="__novo">+ Cadastrar novo cliente</option>${S.clientes.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map(c => `<option value="${c.id}" ${s && s.peopleId === c.id ? 'selected' : ''}>${esc(c.name)}${c.document ? ' · ' + esc(c.document) : ''}</option>`).join('')}</select></label>
    </div>
    <div class="fg" id="fs-novo">${camposCliente('fn-')}</div></fieldset>
    <fieldset><legend>Parcelamento</legend>
      ${travado ? `<div class="hint">${nP ? 'Esta venda já tem parcelas recebidas' : 'Esta venda foi registrada sem parcelas'}, então o parcelamento não pode ser refeito aqui. Para mudar, cancele a venda e registre de novo.</div>` : `
      <div class="fg">
        <label class="f">Entrada (R$)<input id="fs-entrada" type="number" step="0.01" min="0" inputmode="decimal" value="${s ? esc(s.entrada || '') : ''}" ${s ? 'disabled' : ''}></label>
        <label class="f">Nº de parcelas<input id="fs-np" type="number" min="${s ? 1 : 0}" max="120" step="1" value="${nP}"></label>
        <label class="f">Juros (% ao mês)<input id="fs-juros" type="number" min="0" step="0.01" inputmode="decimal" value="${s ? esc(s.taxaJuros || '') : ''}" placeholder="0"></label>
        <label class="f">1º vencimento<input id="fs-venc" type="date" value="${esc(s && nP ? s.parcelas[0].venc : addMonths(today(), 1))}"></label>
        <label class="f">Valor da parcela (R$)<input id="fs-vp" type="number" step="0.01" min="0" inputmode="decimal" value="${s && nP ? esc(s.parcelas[0].valor) : ''}" placeholder="calculado"></label>
      </div>
      <div class="hint">${s ? 'A entrada já lançada não muda na edição.' : 'Deixe 0 parcelas para venda recebida integralmente.'} Com juros, a parcela é calculada pela tabela Price sobre o saldo após a entrada; você também pode digitar o valor combinado.</div>
      <div id="fs-prev"></div>`}
    </fieldset>
    <label class="f">Observações<textarea id="fs-obs" rows="2">${esc(s ? s.note : '')}</textarea></label>`,
    `<button class="btn" data-act="fechar">Cancelar</button><button class="btn pri" data-act="salvar-venda" data-id="${s ? s.id : ''}">Salvar venda</button>`,
    root => {
      wirePayer(root);
      const cliSel = document.getElementById('fs-cli');
      if (!s && S.clientes.length) cliSel.value = '__novo';
      const syncCli = () => { document.getElementById('fs-novo').hidden = cliSel.value !== '__novo'; };
      cliSel.addEventListener('change', syncCli); syncCli();
      let vpManual = !!(s && nP);
      const vpEl = document.getElementById('fs-vp'); if (vpEl) vpEl.addEventListener('input', () => { vpManual = vpEl.value !== ''; });
      const upd = () => {
        const v = veic(document.getElementById('fs-veic').value), valor = num(val('fs-valor'));
        const lb = document.getElementById('fs-lucro');
        if (v && valor) { const l = valor - custo(v); lb.innerHTML = `Lucro previsto: <b class="${l >= 0 ? 'pos' : 'neg'}">${brl(l)}</b> sobre custo de ${brl(custo(v))}`; } else lb.textContent = v ? `Custo total do veículo: ${brl(custo(v))}` : '';
        const pv = document.getElementById('fs-prev'); if (!pv) return;
        const ps = gerarParcelas(vpManual);
        if (!ps.length) { pv.innerHTML = ''; return; }
        const tot = num(val('fs-entrada')) + ps.reduce((a, p) => a + p.valor, 0);
        pv.innerHTML = `<div class="preview"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>${ps.map(p => `<tr><td>${p.n}/${ps.length}</td><td>${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td></tr>`).join('')}</tbody></table></div>
          <div class="hint" style="margin-top:6px">Entrada + parcelas = ${brl(tot)}${Math.abs(tot - valor) > 0.05 ? ` (diferença de ${brl(tot - valor)} em relação ao valor de venda)` : ''}</div>`;
      };
      root.querySelectorAll('input,select').forEach(el => el.addEventListener('input', upd));
      upd();
    });
}
function gerarParcelas(vpManual) {
  const npEl = document.getElementById('fs-np'); if (!npEl) return null;
  const n = Math.max(0, Math.min(120, parseInt(npEl.value) || 0));
  if (!n) return [];
  const valor = num(val('fs-valor')), entrada = num(val('fs-entrada')), venc = val('fs-venc') || addMonths(today(), 1);
  const saldo = Math.max(0, valor - entrada);
  let vp = vpManual ? num(val('fs-vp')) : 0, last = null;
  const jm = num(val('fs-juros')) / 100;
  if (!vp && jm > 0) vp = calcParcela(saldo, jm, n, 'price');
  if (!vp) { vp = Math.floor(saldo / n * 100) / 100; last = round2(saldo - vp * (n - 1)); }
  return Array.from({ length: n }, (_, i) => ({ n: i + 1, venc: addMonths(venc, i), valor: (i === n - 1 && last != null) ? last : vp }));
}
async function salvarVenda(id) {
  const s = id ? S.vendas.find(x => x.id === id) : null;
  const veiculoId = s ? s.vehicleId : val('fs-veic');
  const valor = num(val('fs-valor'));
  if (!valor) { toast('Informe o valor de venda.'); return; }
  const pv = readPayer('pv', valor); if (pv.err) { toast(pv.err); return; }
  let clienteId = val('fs-cli');
  if (clienteId === '__novo') {
    const novoCli = lerCliente('fn-', null); if (!novoCli.name) { toast('Informe o nome do comprador ou escolha um cliente.'); return; }
    try { clienteId = (await People.create(novoCli)).id; }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Não foi possível cadastrar o cliente.'); return; }
  }

  const dataVenda = val('fs-data') || today();
  const geradas = gerarParcelas(document.getElementById('fs-vp') && val('fs-vp') !== '');
  const entrada = s ? s.entrada : num(val('fs-entrada'));
  // Na edição o backend só recria as contas pendentes (status 0) e mantém as recebidas.
  const parcelas = geradas === null ? s.parcelas.map((p, i) => ({ ...p, n: i + 1 })).filter(p => !p.pago) : geradas;
  const nTotal = geradas === null ? s.parcelas.length : parcelas.length;
  const plots = [], base = entrada > 0 ? 1 : 0;
  if (!s && entrada > 0) plots.push({ portion: 1, form_payment: 9, date_due: dataVenda, amount: entrada, status: 1 });
  parcelas.forEach(p => plots.push({ portion: base + p.n, form_payment: 9, date_due: p.venc, amount: p.valor, status: 0 }));
  if (!s && !plots.length) plots.push({ portion: 1, form_payment: 9, date_due: dataVenda, amount: valor, status: 1 });

  const config = S.config || Auth.company.config || {};
  // sales.user_id aponta pra tabela de pessoas (não pra users): precisa ser o
  // cadastro de pessoa do usuário logado nesta empresa.
  let minhaPessoa;
  try { minhaPessoa = await People.me(companyId()); }
  catch (e) { toast('Não foi possível identificar seu cadastro de pessoa nesta empresa.'); return; }

  const payload = {
    companyId: companyId(), peopleId: clienteId, userId: minhaPessoa.id, role: 1, status: 3,
    vehicleId: veiculoId, categoryId: s ? (s.categoryId ?? s.category_id) : config.sale_category_default_id, bankAccountId: s ? (s.bankAccountId ?? s.bank_account_id) : config.sale_bank_account_default_id,
    date_sale: dataVenda, note: val('fs-obs') || undefined,
    vehicleSaleContract: { vehicleId: veiculoId, buyerPeopleId: clienteId, saleValue: valor, downPayment: entrada, installmentCount: nTotal, firstDueDate: (s && s.parcelas[0] ? s.parcelas[0].venc : parcelas[0]?.venc),
      paymentForm: val('fs-forma'), interestRate: geradas && geradas.length ? num(val('fs-juros')) : (s ? s.taxaJuros : 0), partnerAReceived: pv.a, partnerBReceived: pv.b },
    plots,
  };

  const ok = await w(async () => {
    if (s) await Sales.update(s.id, payload); else await Sales.create(payload);
    await Vehicles.update(veiculoId, { flip_status: 'vendido', sale_price: valor, sale_date: dataVenda, sale_people_id: clienteId });
  }, s ? 'Venda atualizada' : 'Venda registrada');
  if (ok) { closeModal(); await loadAll(); if (!s) setTab('vendas'); }
}
async function excluirVenda(id, veiculoId) {
  const ok = await w(async () => {
    await Sales.remove(id);
    await Vehicles.update(veiculoId, { flip_status: 'em_estoque', sale_price: null, sale_date: null, sale_people_id: null });
  }, 'Venda cancelada. O veículo voltou ao estoque.');
  if (ok) await loadAll();
}
async function marcarBill(billId, pago, msgs) {
  const ok = await w(async () => {
    const bill = await Bills.get(billId);
    await Bills.update(billId, { category_id: bill.category_id ?? bill.categoryId, role: bill.role, name: bill.name, date_competence: bill.date_competence, date_due: bill.date_due, amount: bill.amount, repeat: false, form_payment: bill.form_payment, status: pago ? 1 : 0, date_received: pago ? today() : null });
  }, pago ? msgs[0] : 'Pagamento desfeito');
  if (ok) await loadAll();
}

/* ---------- PDF ---------- */
const LOGO = () => document.querySelector('header .logo');
function pdfDoc(titulo) {
  const { jsPDF } = window.jspdf; const d = new jsPDF({ unit: 'mm', format: 'a4' });
  try { d.addImage(LOGO(), 'JPEG', 148, 7, 48, 21.7); } catch (e) {}
  d.setFont('helvetica', 'bold'); d.setFontSize(15); d.text('Grupo A.M.S Facilita', 14, 15);
  d.setFont('helvetica', 'normal'); d.setFontSize(11); d.text(titulo, 14, 22);
  d.setFontSize(8.5); d.setTextColor(110); d.text(`Emitido em ${new Date().toLocaleString('pt-BR')}  ·  Sócios: ${SA()} e ${SB()}`, 14, 27.5); d.setTextColor(0);
  d.setDrawColor(201, 160, 75); d.setLineWidth(.7); d.line(14, 31, 196, 31); return d;
}
const TBL = { theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: [20, 20, 20], textColor: [243, 227, 184] }, footStyles: { fillColor: [236, 236, 234], textColor: 20, fontStyle: 'bold' }, margin: { left: 14, right: 14 } };
const RIGHT = cols => Object.fromEntries(cols.map(c => [c, { halign: 'right' }]));
function pdfRodape(d) { const n = d.getNumberOfPages(); for (let i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(8); d.setTextColor(120); d.text(`Página ${i} de ${n}`, 196, 290, { align: 'right' }); d.setTextColor(0); } }
const nomeArq = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-');
const pdfTexto = (d, txt, y) => { d.setFont('helvetica', 'bold'); d.setFontSize(10.5); d.splitTextToSize(txt, 182).forEach((l, i) => d.text(l, 14, y + i * 5.5)); d.setFont('helvetica', 'normal'); };
const pdfPronto = () => { if (window.jspdf) return true; toast('O gerador de PDF ainda não carregou. Tente de novo em instantes.'); return false; };
function entregarPdf(d, nome) { pdfRodape(d); d.save(nome); toast('PDF gerado'); }
function pdfVeiculo(id) {
  if (!pdfPronto()) return;
  const v = veic(id); if (!v) return; const c = socCalc(v), s = vendaDe(id), cl = s && pessoaPorId(s.peopleId), f = forn(v.purchase_people_id);
  const d = pdfDoc('Relatório do veículo');
  d.autoTable({ ...TBL, startY: 35, theme: 'plain', styles: { fontSize: 9.5, cellPadding: 1.1 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }, body: [
    ['Veículo', nomeVeic(v)], ['Placa', v.license_plate || '—'], ['Renavam / chassi', [v.reindeer || '—', v.vin_number || '—'].join(' / ')], ['Cor / KM', [v.color || '—', v.mileage ? Number(v.mileage).toLocaleString('pt-BR') + ' km' : '—'].join(' / ')],
    ['Fornecedor / origem', [f ? f.name : v.origin_name, tipoOrig(v)].filter(Boolean).join(' · ') || '—'], ['Data da compra', fdate(v.purchase_date)], ['Forma de pagamento da compra', formaCompraTxt(v) || '—'],
    ['Situação', s ? `Vendido em ${fdate(s.data)}${cl ? ' para ' + cl.name : ''}${s.forma ? ' (' + s.forma + ')' : ''}` : 'Em estoque']] });
  const pa = partes(v, v.purchase_price, ...PV);
  const linhas = [[fdate(v.purchase_date), 'Aquisição do veículo', f ? f.name : (v.origin_name || ''), brl(v.purchase_price), pa.a ? brl(pa.a) : '—', pa.b ? brl(pa.b) : '—'],
    ...despesasDe(v).slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(x => { const p = partes(x, x.amount, ...PV); return [fdate(x.date), [CAT_LABELS[x.category] || x.category, x.description].filter(Boolean).join(' — '), (forn(x.supplier_people_id) || x.supplier || {}).name || '', brl(x.amount), p.a ? brl(p.a) : '—', p.b ? brl(p.b) : '—']; })];
  d.autoTable({ ...TBL, startY: d.lastAutoTable.finalY + 5, head: [['Data', 'Lançamento', 'Fornecedor / prestador', 'Valor', `Pago por ${SA()}`, `Pago por ${SB()}`]], body: linhas,
    foot: [['', 'Total investido', '', brl(c.total), brl(c.invA), brl(c.invB)]], columnStyles: RIGHT([3, 4, 5]) });
  const res = [['Valor de compra', brl(v.purchase_price)], ['Total de despesas', brl(despTotal(v))], ['Custo total', brl(c.total)]];
  if (c.vendido) res.push(['Valor de venda', brl(c.venda)], ['Lucro', brl(c.lucro)], ['Lucro dividido por 2', brl(c.metade)]);
  d.autoTable({ ...TBL, startY: d.lastAutoTable.finalY + 5, head: [['Resultado', '']], body: res, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }, tableWidth: 100 });
  if (c.vendido) {
    d.autoTable({ ...TBL, startY: d.lastAutoTable.finalY + 5, head: [['Divisão entre os sócios', SA(), SB()]], columnStyles: RIGHT([1, 2]), body: [
      ['Pagou (compra + despesas)', brl(c.invA), brl(c.invB)], ['Metade do lucro', brl(c.metade), brl(c.metade)], ['Tem direito a receber', brl(c.devA), brl(c.devB)], ['Recebeu da venda', brl(c.recA), brl(c.recB)]] });
    pdfTexto(d, 'Acerto: ' + acertoTxt(c.saldoA), d.lastAutoTable.finalY + 8);
  }
  entregarPdf(d, `relatorio-${nomeArq(v.license_plate || nomeVeic(v))}.pdf`);
}
function pdfGeral() {
  if (!pdfPronto()) return;
  if (!S.veiculos.length) { toast('Cadastre ao menos um veículo para gerar o relatório.'); return; }
  const vs = S.veiculos.slice().sort((a, b) => (a.purchase_date || '').localeCompare(b.purchase_date || '')), t = totaisSocios(), d = pdfDoc('Relatório geral de veículos e sócios');
  const rows = vs.map(v => { const c = socCalc(v), s = vendaDe(v.id); return [nomeVeic(v), v.license_plate || '—', brl(v.purchase_price), brl(despTotal(v)), brl(c.total), c.vendido ? brl(c.venda) : '—', c.vendido ? brl(c.lucro) : '—', s ? 'Vendido ' + fdate(s.data) : 'Em estoque']; });
  d.autoTable({ ...TBL, startY: 35, head: [['Veículo', 'Placa', 'Compra', 'Despesas', 'Custo total', 'Venda', 'Lucro', 'Situação']], body: rows,
    foot: [['Totais', '', brl(t.compraA + t.compraB), brl(t.despA + t.despB), brl(t.invA + t.invB), brl(t.venda), brl(t.lucro), '']], columnStyles: RIGHT([2, 3, 4, 5, 6]) });
  d.autoTable({ ...TBL, startY: d.lastAutoTable.finalY + 5, head: [['Quem pagou o quê', SA(), SB()]], columnStyles: RIGHT([1, 2]), body: [
    ['Aquisições', brl(t.compraA), brl(t.compraB)], ['Despesas, serviços e taxas', brl(t.despA), brl(t.despB)], ['Total pago', brl(t.invA), brl(t.invB)]] });
  d.autoTable({ ...TBL, startY: d.lastAutoTable.finalY + 5, head: [['Divisão por veículo', `${SA()} pagou`, `${SB()} pagou`, 'Lucro', 'Cada um']], columnStyles: RIGHT([1, 2, 3, 4]),
    body: vs.map(v => { const c = socCalc(v); return [`${nomeVeic(v)}${v.license_plate ? ' (' + v.license_plate + ')' : ''}`, brl(c.invA), brl(c.invB), c.vendido ? brl(c.lucro) : '—', c.vendido ? brl(c.metade) : '—']; }) });
  if (t.vend) {
    d.autoTable({ ...TBL, startY: d.lastAutoTable.finalY + 5, head: [['Veículos vendidos', SA(), SB()]], columnStyles: RIGHT([1, 2]), body: [
      ['Pagou nos vendidos', brl(t.vinvA), brl(t.vinvB)], ['Metade do lucro', brl(t.lucro / 2), brl(t.lucro / 2)], ['Tem direito a receber', brl(t.devA), brl(t.devB)], ['Recebeu das vendas', brl(t.recA), brl(t.recB)]] });
    const y = d.lastAutoTable.finalY + 8;
    pdfTexto(d, `Lucro total: ${brl(t.lucro)}  ·  Para cada sócio: ${brl(t.lucro / 2)}`, y);
    pdfTexto(d, 'Acerto: ' + acertoTxt(t.saldoA), y + 6);
  }
  entregarPdf(d, `relatorio-geral-${today()}.pdf`);
}
function pdfPagar() {
  if (!pdfPronto()) return;
  const d = pdfDoc('Contas a pagar'), ab = contasTodas().filter(x => !x.pago).sort((a, b) => a.venc.localeCompare(b.venc));
  const descTxt = x => x.compra && x.v ? `Compra ${x.v.license_plate ? x.v.license_plate + ' · ' : ''}${nomeVeic(x.v)}` : (x.nome || 'Conta');
  d.autoTable({ ...TBL, startY: 35, head: [['Vencimento', 'Conta em aberto', 'Pagar a', 'Situação', 'Valor']], body: ab.length ? ab.map(x => [fdate(x.venc), descTxt(x), x.credor || '—', parcLabel[parcStatus(x)], brl(x.valor)]) : [['—', 'Nenhuma conta em aberto', '', '', '']],
    foot: [['', 'Total em aberto', '', '', brl(ab.reduce((t, x) => t + x.valor, 0))]], columnStyles: RIGHT([4]) });
  const vs = S.veiculos.slice().sort((a, b) => (a.purchase_date || '').localeCompare(b.purchase_date || ''));
  if (vs.length) d.autoTable({ ...TBL, startY: d.lastAutoTable.finalY + 6, head: [['Compra do veículo', 'Data', 'Valor', 'Forma de pagamento', 'Pagas', 'Saldo devedor']],
    body: vs.map(v => [(v.license_plate ? v.license_plate + ' · ' : '') + nomeVeic(v), fdate(v.purchase_date), brl(v.purchase_price), formaCompraTxt(v) || 'Não informada', nParcCompra(v) ? `${compraPagas(v)}/${nParcCompra(v)}` : '—', brl(compraSaldo(v))]),
    foot: [['Totais', '', brl(vs.reduce((t, v) => t + num(v.purchase_price), 0)), '', '', brl(vs.reduce((t, v) => t + compraSaldo(v), 0))]], columnStyles: RIGHT([2, 5]) });
  entregarPdf(d, `contas-a-pagar-${today()}.pdf`);
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-act],[data-overlay]');
  if (!t) return;
  if (t.dataset.overlay && e.target === t) return closeModal();
  if (t.dataset.tab) { closeModal(); return setTab(t.dataset.tab); }
  const a = t.dataset.act; if (!a) return;
  if (t.dataset.confirm && !t.classList.contains('arm')) {
    const txt = t.textContent; t.classList.add('arm'); t.textContent = 'Confirmar?';
    setTimeout(() => { if (t.isConnected) { t.classList.remove('arm'); t.textContent = txt; } }, 3500); return;
  }
  switch (a) {
    case 'fechar': closeModal(); break;
    case 'sair': Auth.clear(); window.location.reload(); break;
    case 'novo-veiculo': formVeiculo(); break;
    case 'editar-veiculo': formVeiculo(veic(t.dataset.id)); break;
    case 'salvar-veiculo': salvarVeiculo(t.dataset.id); break;
    case 'excluir-veiculo': {
      if (vendaDe(t.dataset.id)) { toast('Este veículo tem uma venda registrada. Cancele a venda antes.'); break; }
      if (await w(async () => { for (const c of S.contas.filter(c => c.compra && c.vehicleId === t.dataset.id && !c.pago)) await Bills.remove(c.id); await Vehicles.remove(t.dataset.id); }, 'Veículo excluído')) { closeModal(); await loadAll(); } break; }
    case 'ver-veiculo': verVeiculo(t.dataset.id); break;
    case 'add-despesa': addDespesa(t.dataset.veiculo); break;
    case 'excluir-despesa': excluirDespesa(t.dataset.veiculo, t.dataset.did); break;
    case 'nova-venda': formVenda({ veiculoId: t.dataset.veiculo }); break;
    case 'editar-venda': formVenda({ vendaId: t.dataset.id }); break;
    case 'salvar-venda': salvarVenda(t.dataset.id); break;
    case 'excluir-venda': excluirVenda(t.dataset.id, t.dataset.veiculo); break;
    case 'pagar': marcarBill(t.dataset.bill, true, ['Parcela marcada como recebida']); break;
    case 'estornar': marcarBill(t.dataset.bill, false); break;
    case 'conta-pagar': marcarBill(t.dataset.bill, true, ['Conta marcada como paga']); break;
    case 'conta-estornar': marcarBill(t.dataset.bill, false); break;
    case 'nova-conta': formConta(); break;
    case 'editar-conta': formConta(S.contas.find(c => c.id === t.dataset.id)); break;
    case 'salvar-conta': salvarConta(t.dataset.id); break;
    case 'excluir-conta': if (await w(() => Bills.remove(t.dataset.id), 'Conta excluída')) { closeModal(); await loadAll(); } break;
    case 'filtro-pagar': filtroPagar = t.dataset.f; render(); break;
    case 'pdf-pagar': pdfPagar(); break;
    case 'pdf-veiculo': pdfVeiculo(t.dataset.id); break;
    case 'pdf-geral': pdfGeral(); break;
    case 'salvar-socios': salvarSocios(); break;
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalRoot.innerHTML) closeModal(); });

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

// Cliente da API real do Controle Dois (api.grupoamsfacilita.com.br).
// Substitui inteiramente o "db" de Artifact (Firestore-like) do protótipo
// original por chamadas REST contra o backend AdonisJS já em produção.
const API_BASE = 'https://api.grupoamsfacilita.com.br';
// Esse app é dedicado a um único nicho - só deixa entrar se alguma das
// empresas do usuário estiver marcada com esse system_type (19 = "Garagem
// do Investidor", ver app/Constants/systemTypes.ts no backend).
const GARAGEM_SYSTEM_TYPE = 19;

const Auth = {
  token: null,
  user: null,
  company: null,

  load() {
    try {
      const raw = localStorage.getItem('gi-auth');
      if (!raw) return false;
      const saved = JSON.parse(raw);
      this.token = saved.token;
      this.user = saved.user;
      this.company = saved.company;
      return Boolean(this.token);
    } catch (e) {
      return false;
    }
  },

  save() {
    localStorage.setItem(
      'gi-auth',
      JSON.stringify({ token: this.token, user: this.user, company: this.company })
    );
  },

  clear() {
    this.token = null;
    this.user = null;
    this.company = null;
    localStorage.removeItem('gi-auth');
  },

  async signin(email, password) {
    const res = await fetch(`${API_BASE}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.message || data.mensagem || 'Usuário ou senha incorretos.', res.status, data);
    }

    // O login é o mesmo do Controle Dois inteiro (multi-nicho) - aqui
    // restringimos pra só aceitar se o usuário tiver acesso a alguma
    // empresa com o nicho certo, usando ESSA empresa como ativa (ignora
    // "company" da resposta, que é só a primeira da lista do usuário).
    const empresaGaragem = (data.user?.companies || []).find(
      (c) => Number(c.system_type) === GARAGEM_SYSTEM_TYPE
    );
    if (!empresaGaragem) {
      throw new ApiError(
        'Este usuário não tem acesso ao nicho Garagem do Investidor. Fale com o administrador do sistema.',
        403,
        data
      );
    }

    this.token = data.token?.token;
    this.user = data.user;
    this.company = empresaGaragem;
    this.save();
    return data;
  },
};

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, { query, body } = {}) {
  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Auth.token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) {
      Auth.clear();
      window.location.reload();
    }
    throw new ApiError(data?.message || data?.mensagem || 'Erro ao comunicar com o servidor.', res.status, data);
  }
  return data;
}

const get = (path, query) => request('GET', path, { query });
const post = (path, body) => request('POST', path, { body });
const put = (path, body) => request('PUT', path, { body });
const del = (path) => request('DELETE', path);

// ---------- Veículos ----------
const Vehicles = {
  list: (companyId, opts = {}) =>
    get('/vehicle', { companyId, limit: opts.limit || 200, search: opts.search, page: opts.page || 1 }),
  get: (id) => get(`/vehicle/${id}`),
  create: (data) => post('/vehicle', data),
  update: (id, data) => put(`/vehicle/${id}`, data),
  remove: (id) => del(`/vehicle/${id}`),
};

// ---------- Despesas de veículo ----------
const VehicleExpenses = {
  list: (companyId, vehicleId) => get('/vehicle-expense', { companyId, vehicleId, limit: 200 }),
  create: (data) => post('/vehicle-expense', data),
  remove: (id) => del(`/vehicle-expense/${id}`),
};

// ---------- Pessoas (clientes/fornecedores) ----------
const People = {
  list: (companyId, opts = {}) =>
    get('/people', { companyId, role: opts.role, search: opts.search, limit: opts.limit || 200, page: opts.page || 1 }),
  me: (companyId) => get('/people/me', { companyId }),
  get: (id) => get(`/people/${id}`),
  create: (data) => post('/people', data),
  update: (id, data) => put(`/people/${id}`, data),
  remove: (id) => del(`/people/${id}`),
};

// ---------- Vendas (Sale + VehicleSaleContract + Bills/parcelas) ----------
const Sales = {
  list: (companyId, opts = {}) => get('/sale', { companyId, role: 1, limit: opts.limit || 200, page: opts.page || 1 }),
  get: (id) => get(`/sale/${id}`),
  create: (data) => post('/sale', data),
  update: (id, data) => put(`/sale/${id}`, data),
  remove: (id) => del(`/sale/${id}`),
};

const Bills = {
  listBySale: (companyId, saleId) => get('/bill', { companyId, saleId, statusType: '', limit: 500 }),
  listByCompany: (companyId) => get('/bill', { companyId, role: 1, statusType: '', limit: 1000, orderBy: 'date_due', sortedBy: 'asc' }),
  get: (id) => get(`/bill/${id}`),
  update: (id, data) => put(`/bill/${id}`, data),
};

// ---------- Investimentos ----------
const Investments = {
  list: (companyId, opts = {}) =>
    get('/investment', { companyId, status: opts.status, search: opts.search, limit: opts.limit || 100, page: opts.page || 1 }),
  get: (id) => get(`/investment/${id}`),
  create: (data) => post('/investment', data),
  update: (id, data) => put(`/investment/${id}`, data),
  remove: (id) => del(`/investment/${id}`),
};

const InvestmentInstallments = {
  markPaid: (id, paid) => put(`/investment-installment/${id}`, { paid }),
};

const InvestmentEntries = {
  create: (data) => post('/investment-entry', data),
  remove: (id) => del(`/investment-entry/${id}`),
};

window.Garagem = {
  Auth,
  ApiError,
  Vehicles,
  VehicleExpenses,
  People,
  Sales,
  Bills,
  Investments,
  InvestmentInstallments,
  InvestmentEntries,
};

import { useState, useEffect, useMemo } from 'react';
import { ExternalLink, CheckCircle, Clock, Search, ArrowUpRight, Wallet, Activity, CreditCard, ChevronDown, Bell, Settings, UserPlus, Users, Key, Terminal, ArrowDownLeft, ShieldCheck, Box, Play, Target, Check, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

function AgentDemoModal({ isOpen, onClose }) {
  const [steps, setSteps] = useState([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSteps([]);
      setIsInjecting(true);
      setIsFinished(false);
      startSimulation();
    }
  }, [isOpen]);

  const startSimulation = async () => {
    // Start backend agent exec asynchronously
    fetch('http://localhost:8000/api/demo/run-agent', { method: 'POST' }).catch(console.error);

    const simulationSteps = [
      { msg: '[LLM] Agent initialized on port 8080.', delay: 500, icon: <Terminal className="w-4 h-4 text-gray-400" /> },
      { msg: '[LLM] Attempting to fetch Premium AI API (`GET /api/premium-data`)...', delay: 2000, icon: <Search className="w-4 h-4 text-blue-400" /> },
      { msg: '[LLM] Analyzing response... HTTP 402 Payment Required.', delay: 4500, icon: <ShieldCheck className="w-4 h-4 text-red-400" /> },
      { msg: '[LLM] Browsing WWW-Authenticate header. Extracting UCP manifest URL.', delay: 7000, icon: <Search className="w-4 h-4 text-blue-400" /> },
      { msg: 'Fetching Universal Commerce Protocol Manifest...', delay: 9000, icon: <CheckCircle className="w-4 h-4 text-emerald-400" /> },
      { msg: '[LLM] Business profile parsed. Intent matched: dev.ucp.shopping.checkout on TRON.', delay: 12500, icon: <CheckCircle className="w-4 h-4 text-emerald-400" /> },
      { msg: '[LLM] POST /ucp/v1/checkout-sessions for 15.00 USDT...', delay: 15500, icon: <Wallet className="w-4 h-4 text-amber-400" /> },
      { msg: '🔒 Checkout suspended by Merchant API. Check your phone!', delay: 16500, icon: <ShieldCheck className="w-4 h-4 text-red-500" /> },
      { msg: 'Awaiting human cryptographic approval via Telegram...', delay: 18000, icon: <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" /> },
      { msg: '🔓 2FA Hit Received! Checkout session updated with transfer instructions.', delay: 30000, icon: <CheckCircle className="w-4 h-4 text-emerald-400" /> },
      { msg: '[LLM] Analyzing payload parameters... Target: TXYZopYRdj...', delay: 33000, icon: <Search className="w-4 h-4 text-blue-400" /> },
      { msg: '[LLM] Formatting TRC20 15 USDT smart contract payload...', delay: 36000, icon: <Activity className="w-4 h-4 text-purple-400" /> },
      { msg: 'Cryptographically signing & broadcasting to Nile Testnet...', delay: 38500, icon: <Terminal className="w-4 h-4 text-blue-400" /> },
      { msg: 'Submitting blockchain receipt to POST /ucp/v1/checkout-sessions/:id/complete...', delay: 43000, icon: <Target className="w-4 h-4 text-blue-400" /> },
      { msg: 'Receipt validated. Premium payload decrypted successfully.', delay: 45000, icon: <CheckCircle className="w-4 h-4 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" /> }
    ];

    let currentSteps = [];
    for (const step of simulationSteps) {
      setTimeout(() => {
        currentSteps = [...currentSteps, step];
        setSteps(currentSteps);
      }, step.delay);
    }
    
    setTimeout(() => {
      setIsInjecting(false);
      setIsFinished(true);
    }, 46000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#09090b] border border-[#27272a] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="border-b border-[#27272a] p-4 flex justify-between items-center bg-[#18181b]/50">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {isInjecting ? <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span> : null}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isInjecting ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
            </span>
            <h2 className="text-sm font-semibold text-white tracking-wide">Live Autonomous Agent VM</h2>
          </div>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white transition-colors">
            ✕
          </button>
        </div>
        <div className="p-6 h-[400px] overflow-y-auto font-mono text-sm flex flex-col gap-3">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mt-0.5">{step.icon}</div>
              <div className="text-[#e4e4e7]">{step.msg}</div>
            </div>
          ))}
          {isInjecting && (
            <div className="flex gap-3 items-center text-[#71717a] mt-2">
              <span className="w-4 h-4 flex items-center justify-center font-bold animate-pulse">_</span>
              <span>Processing...</span>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-[#27272a] bg-[#18181b]/30 flex justify-end">
          {isFinished ? (
            <button onClick={onClose} className="px-5 py-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/30 rounded font-medium hover:bg-emerald-600/20 transition-all font-sans text-sm tracking-wide">
              Return to Dashboard
            </button>
          ) : (
             <div className="px-4 py-2 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Do not close terminal...
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ metrics }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">High-level view of performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white text-black font-medium text-sm rounded-md hover:bg-gray-100 transition-colors shadow-sm">
            Download report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="col-span-1 md:col-span-2 bg-[#09090b] border border-[#27272a] rounded-xl p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="text-sm font-medium text-[#a1a1aa] mb-1">Total revenue (30d)</div>
            <div className="text-5xl font-bold text-white tracking-tight">{metrics.grossVolume}</div>
            <div className="mt-3 flex items-center gap-2 text-emerald-500 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4" /> +12.5% <span className="text-[#71717a] font-normal">vs last month</span>
            </div>
          </div>
          <div className="w-full flex items-end gap-1 h-12 mt-6 opacity-30">
            {[4,6,3,8,5,7,9,6,4,8,10,7,5,8,4].map((h, i) => (
              <div key={i} className="flex-1 bg-white rounded-t-sm" style={{ height: `${h * 10}%` }}></div>
            ))}
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-4">
          <div className="bg-gradient-to-br from-indigo-600/10 to-transparent border border-indigo-500/20 rounded-xl p-5 shadow-sm text-indigo-400 w-full flex-1 relative overflow-hidden group">
            <h3 className="flex items-center gap-2 text-sm font-medium mb-2">
              <Box className="w-4 h-4" /> UCP Universal Standard
            </h3>
            <p className="text-xs text-indigo-300/80 leading-relaxed mb-4">
              Your gateway is fully mapped to the UCP specification. Agents can autonomously interpret intent and dispatch TRON tokens.
            </p>
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 shadow-sm w-full flex-1">
            <div className="text-sm font-medium text-[#a1a1aa] mb-2">UCP Conversion Rate</div>
            <div className="text-3xl font-semibold text-white">{metrics.successRate}</div>
            <p className="text-xs text-[#71717a] mt-1">Checkouts that resulted in paid on-chain challenges.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalancesTab({ metrics }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Balances</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">Manage and track your settled funds across the blockchain.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-indigo-600/10 text-indigo-400 font-medium text-sm rounded-md border border-indigo-500/20 hover:bg-indigo-600/20 transition-all shadow-[0_0_10px_rgba(79,70,229,0.1)]">
            Payout to cold wallet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-[#a1a1aa] mb-2">
            <Wallet className="w-4 h-4" /> Available to payout
          </div>
          <div className="text-4xl font-bold text-white mb-4">{metrics.grossVolume}</div>
          <div className="border-t border-[#27272a] pt-4 mt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#71717a]">Network</span>
              <span className="text-[#fafafa] font-medium">TRON Nile Testnet</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-[#71717a]">Asset</span>
              <span className="text-[#fafafa] font-medium">TRC20_USDT</span>
            </div>
          </div>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-[#a1a1aa] mb-2">
            <Clock className="w-4 h-4" /> Pending settlement
          </div>
          <div className="text-4xl font-bold text-[#fafafa] mb-4">$0.00 <span className="text-[#a1a1aa] text-xl font-normal">USDT</span></div>
          <p className="text-sm text-[#71717a] leading-relaxed">
            Standard TRON transactions settle usually within 5-15 seconds. Currently all observed unconfirmed UCP challenges are awaiting agent payload broadcast.
          </p>
        </div>
      </div>
    </div>
  );
}

function DevelopersTab() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Developers</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">API keys, webhooks, and endpoint configuration.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#27272a]">
              <h3 className="text-sm font-medium text-white flex items-center gap-2"><Key className="w-4 h-4 text-[#a1a1aa]" /> API Keys</h3>
            </div>
            <div className="p-5 bg-[#18181b]/30">
              <div className="flex justify-between items-center py-3 border-b border-[#27272a]">
                <div>
                  <div className="text-sm font-medium text-white">Publishable key</div>
                  <div className="text-xs text-[#71717a] mt-0.5">Used by checkout forms and SDKs</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs bg-[#27272a] text-[#e4e4e7] px-2 py-1 rounded">pk_test_ucpx8923485</span>
                  <button className="text-xs text-blue-500 hover:text-blue-400 font-medium">Reveal</button>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-[#27272a]">
                <div>
                  <div className="text-sm font-medium text-white">Secret key</div>
                  <div className="text-xs text-[#71717a] mt-0.5">Keep this secure. Used to verify requests.</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs bg-[#27272a] text-[#e4e4e7] px-2 py-1 rounded">sk_test_••••••••••</span>
                  <button className="px-3 py-1.5 border border-[#27272a] rounded shadow-sm text-xs font-medium hover:bg-[#27272a] transition-all">Reveal key</button>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#27272a] flex justify-between items-center">
              <h3 className="text-sm font-medium text-white flex items-center gap-2"><Terminal className="w-4 h-4 text-[#a1a1aa]" /> Webhooks</h3>
              <button className="text-xs font-medium text-blue-500 border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 rounded hover:bg-blue-500/20 transition-all">Add endpoint</button>
            </div>
            <div className="p-5">
              <div className="text-sm font-medium text-[#fafafa] mb-1">No webhooks configured</div>
              <p className="text-xs text-[#71717a] max-w-md">Listen to events on your UCP merchant backend directly dynamically without polling.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 border border-[#27272a] bg-[#18181b] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-4">Recent API Requests</h3>
          <div className="space-y-4">
            {[ 
              { code: 200, url: 'POST /ucp/v1/checkout-sessions/chk_x/complete', time: '5m' },
              { code: 201, url: 'POST /ucp/v1/checkout-sessions', time: '5m' },
              { code: 200, url: 'GET /.well-known/ucp', time: '6m' },
              { code: 400, url: 'POST /ucp/v1/checkout-sessions/chk_x/complete', time: '22m' },
            ].map((log, i) => (
              <div key={i} className="flex justify-between items-start text-xs font-mono border-b border-[#27272a] pb-3 last:border-0 last:pb-0">
                <div>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${log.code === 200 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{log.code}</span>
                  <div className="text-[#a1a1aa] mt-1.5 truncate max-w-[150px]" title={log.url}>{log.url}</div>
                </div>
                <div className="text-[#52525b]">{log.time} ago</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/orders');
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const grossVolume = paidOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const successRate = orders.length === 0 ? 0 : Math.round((paidOrders.length / orders.length) * 100);

    return {
      grossVolume: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grossVolume),
      totalTransactions: orders.length,
      successRate: `${successRate}%`,
      activeCheckouts: orders.filter(o => o.status === 'PENDING').length
    };
  }, [orders]);

  const customers = useMemo(() => {
    const custMap = {};
    orders.forEach(order => {
      const agentId = `${order.id.split('-').pop()}@agent.ucp`;
      if (!custMap[agentId]) {
        custMap[agentId] = { id: agentId, totalSpend: 0, ordersCount: 0, lastActive: order.createdAt, currency: order.currency };
      }
      custMap[agentId].ordersCount += 1;
      if (order.status === 'PAID') custMap[agentId].totalSpend += parseFloat(order.total_amount || 0);
      if (new Date(order.createdAt) > new Date(custMap[agentId].lastActive)) custMap[agentId].lastActive = order.createdAt;
    });
    return Object.values(custMap).sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] font-sans flex flex-col">
      <AgentDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />

      <nav className="border-b border-[#27272a] bg-[#09090b] px-6 py-3 flex items-center justify-between sticky top-0 z-10 w-full">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center border border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
              <span className="text-white font-bold text-lg leading-none mt-[-2px]">♦</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">TRON UCP Demo</span>
          </div>
          
          <div className="hidden md:flex gap-1 bg-[#18181b] p-1 rounded-md border border-[#27272a]">
            {['Overview', 'Payments', 'Balances', 'Customers', 'Developers'].map((item) => (
              <button 
                key={item} 
                onClick={() => setActiveTab(item)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === item ? 'bg-[#27272a] text-white shadow-sm' : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDemoModalOpen(true)}
            className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium text-sm rounded-full border border-emerald-400/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2"
          >
            <Play className="fill-white w-3 h-3" /> Run Live Demo Agent
          </button>
          
          <button 
            onClick={fetchOrders}
            className="p-1.5 bg-[#18181b] rounded-md border border-[#27272a] hover:bg-[#27272a] transition-all text-[#a1a1aa] hover:text-white group"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
          
          <div className="w-px h-6 bg-[#27272a] mx-2"></div>

          <div className="relative group hidden sm:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] group-focus-within:text-red-500 transition-colors" />
            <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 bg-[#18181b] border border-[#27272a] rounded-md text-sm outline-none w-64 text-white hover:border-[#3f3f46] focus:border-red-500/50 transition-all placeholder:text-[#52525b]" />
          </div>
          <button className="p-2 text-[#a1a1aa] hover:text-white transition-colors"><Bell className="w-5 h-5" /></button>
          <button className="p-2 text-[#a1a1aa] hover:text-white transition-colors"><Settings className="w-5 h-5" /></button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#27272a] to-[#3f3f46] border border-[#52525b] ml-2 flex items-center justify-center font-bold text-xs text-white">AS</div>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {activeTab === 'Overview' && <OverviewTab metrics={metrics} />}
        {activeTab === 'Balances' && <BalancesTab metrics={metrics} />}
        {activeTab === 'Developers' && <DevelopersTab />}

        {activeTab === 'Payments' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Payments Overview</h1>
                <p className="text-[#a1a1aa] text-sm mt-1">Live agent transaction data across the Nile Testnet.</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 bg-white text-black font-medium text-sm rounded-md hover:bg-gray-100 transition-colors shadow-sm flex items-center gap-2">
                  <ChevronDown className="w-4 h-4" /> Export
                </button>
              </div>
            </div>

            <div className="bg-[#09090b] rounded-xl border border-[#27272a] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
                <h2 className="text-sm font-medium text-[#e4e4e7]">All payments {orders.length > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-[#a1a1aa] text-xs">{orders.length}</span>}</h2>
              </div>
              
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[#27272a] bg-[#09090b]">
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa]">AMOUNT</th>
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa]">STATUS</th>
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa]">DESCRIPTION</th>
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa]">CUSTOMER / AGENT</th>
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa]">DATE</th>
                      <th className="px-5 py-3.5 font-medium text-right text-[#a1a1aa]">BLOCK EXPLORER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-5 py-16 text-center text-[#71717a]">
                          <div className="flex flex-col items-center justify-center">
                            <CreditCard className="w-8 h-8 mb-3 opacity-50" />
                            <p>No payments found.</p>
                          </div>
                        </td>
                      </tr>
                    ) : orders.map(order => (
                      <tr key={order.id} className="hover:bg-[#18181b]/80 transition-colors group">
                        <td className="px-5 py-4 font-medium text-[#fafafa]">
                          ${parseFloat(order.total_amount).toFixed(2)} <span className="text-[#71717a] ml-1 font-normal text-xs">{order.currency}</span>
                        </td>
                        <td className="px-5 py-4">
                          {order.status === 'PAID' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-[#052e16] text-[#34d399] border border-[#064e3b]"><CheckCircle className="w-3.5 h-3.5" /> Succeeded</div>
                          ) : order.status === 'VERIFYING' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-[#1e3a8a]/50 text-[#60a5fa] border border-[#1e3a8a] animate-pulse"><RefreshCw className="w-3 h-3 animate-spin" /> Verifying...</div>
                          ) : order.status === 'FAILED' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-[#7f1d1d]/50 text-[#f87171] border border-[#7f1d1d]"><ShieldCheck className="w-3.5 h-3.5" /> Failed</div>
                          ) : order.status === 'REJECTED' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-[#3f3f46]/50 text-[#a1a1aa] border border-[#3f3f46]"><ShieldCheck className="w-3.5 h-3.5" /> Rejected</div>
                          ) : order.status === 'AWAITING_2FA' ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-[#4c1d95]/50 text-[#c084fc] border border-[#4c1d95] animate-pulse"><ShieldCheck className="w-3.5 h-3.5" /> Awaiting 2FA</div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-[#422006] text-[#fbbf24] border border-[#78350f]"><Clock className="w-3.5 h-3.5" /> Pending</div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-[#e4e4e7]">
                          {order.items && order.items.length > 0 ? order.items[0].id : 'Invoice Payment'}
                        </td>
                        <td className="px-5 py-4 text-[#a1a1aa] font-mono text-xs">{order.id.split('-').pop()}@agent.ucp</td>
                        <td className="px-5 py-4 text-[#a1a1aa]">{format(new Date(order.createdAt), "MMM d, h:mm a")}</td>
                        <td className="px-5 py-4 text-right">
                          {order.txHash ? (
                            <a href={`https://nile.tronscan.org/#/transaction/${order.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#3b82f6] hover:text-[#60a5fa] hover:underline transition-colors font-medium text-xs">
                              {order.txHash.slice(0, 6)}...{order.txHash.slice(-4)} <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : <span className="text-[#52525b] text-xs">Waiting for hash...</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Customers' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
                <p className="text-[#a1a1aa] text-sm mt-1">Autonomous agents transacting with your merchant gateway.</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 bg-[#18181b] text-white font-medium text-sm rounded-md border border-[#27272a] hover:bg-[#27272a] transition-all shadow-sm flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Add customer
                </button>
              </div>
            </div>

            <div className="bg-[#09090b] rounded-xl border border-[#27272a] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
                <h2 className="text-sm font-medium text-[#e4e4e7]">Identified Agents {customers.length > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-[#a1a1aa] text-xs">{customers.length}</span>}</h2>
              </div>
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[#27272a] bg-[#09090b]">
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa]">CUSTOMER</th>
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa] text-center">STATUS</th>
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa]">TOTAL SPEND (VERIFIED)</th>
                      <th className="px-5 py-3.5 font-medium text-[#a1a1aa] text-center">ORDER COUNT</th>
                      <th className="px-5 py-3.5 font-medium text-right text-[#a1a1aa]">LAST ACTIVE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-5 py-16 text-center text-[#71717a]">
                          <p>No customers found yet.</p>
                        </td>
                      </tr>
                    ) : customers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-[#18181b]/80 transition-colors group">
                        <td className="px-5 py-4 font-medium text-[#fafafa] flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 border border-[#3f3f46] flex items-center justify-center text-xs font-bold font-mono text-gray-300">
                            {cust.id.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-mono text-[13px]">{cust.id}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#1e293b]/50 text-[#94a3b8] border border-[#334155]">Session active</div>
                        </td>
                        <td className="px-5 py-4 font-medium text-[#fafafa]">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cust.totalSpend)} <span className="text-[#71717a] ml-1 font-normal text-[11px]">{cust.currency}</span></td>
                        <td className="px-5 py-4 text-[#a1a1aa] text-center">{cust.ordersCount} session{cust.ordersCount !== 1 && 's'}</td>
                        <td className="px-5 py-4 text-right text-[#a1a1aa]">{formatDistanceToNow(new Date(cust.lastActive), { addSuffix: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

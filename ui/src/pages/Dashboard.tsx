import { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Cpu, 
  Database, 
  Activity, 
  RefreshCw, 
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Key,
  Server,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { api } from '../services/api';
import type { ProxyStats, CircuitBreakerStats } from '../types/api';
import { clsx } from 'clsx';

export default function Dashboard() {
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getStats().catch(() => null)
      ]);
      setHealth(h);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Cpu className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Connecting to transport firewall...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="max-w-md bg-red-900/20 border-red-800">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Connection Failed</h2>
            <p className="text-gray-400">{error}</p>
            <button 
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getCircuitStateIcon = (state: CircuitBreakerStats['state']) => {
    switch (state) {
      case 'CLOSED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'HALF_OPEN':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'OPEN':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getCircuitStateColor = (state: CircuitBreakerStats['state']) => {
    switch (state) {
      case 'CLOSED':
        return 'text-green-500 bg-green-500/10';
      case 'HALF_OPEN':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'OPEN':
        return 'text-red-500 bg-red-500/10';
    }
  };

  const blockedRequests = stats?.blockedRequests;
  const recentBlockedRequests = blockedRequests?.recent ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold">MCP Transport Firewall</h1>
              <p className="text-sm text-gray-400">Fail-Closed Stdio Boundary Enforcement</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {health && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Healthy</span>
              </div>
            )}
            <button 
              onClick={loadData}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <span className="text-yellow-400 text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">HTTP Review Routes</CardTitle>
              <Server className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.routes ?? 0}</div>
              <p className="text-xs text-gray-500 mt-1">Registered downstream HTTP routes</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">L1 Cache Hit Rate</CardTitle>
              <Activity className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {stats?.cache ? `${(stats.cache.hitRatio * 100).toFixed(1)}%` : 'N/A'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                L1: {stats?.cache?.hits.l1 ?? 0} | L2: {stats?.cache?.hits.l2 ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Cache Misses</CardTitle>
              <Database className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.cache?.misses ?? 0}</div>
              <p className="text-xs text-gray-500 mt-1">Total cache misses</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Circuit Breakers</CardTitle>
              <Shield className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {stats?.circuitBreakers?.length ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Active breakers</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                Circuit Breakers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.circuitBreakers?.length ? (
                <p className="text-gray-500 text-sm">No circuit breakers configured</p>
              ) : (
                <div className="space-y-3">
                  {stats.circuitBreakers.map((cb) => (
                    <div 
                      key={cb.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        {getCircuitStateIcon(cb.state)}
                        <div>
                          <p className="font-medium">{cb.name}</p>
                          <p className="text-xs text-gray-500">
                            {cb.failures} failures / {cb.successes} successes
                          </p>
                        </div>
                      </div>
                      <span className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-medium',
                        getCircuitStateColor(cb.state)
                      )}>
                        {cb.state}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-500" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-gray-400" />
                    <span>NHI Authentication</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <span>Color Boundary</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                    Enforcing
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-gray-400" />
                    <span>Epistemic Egress Filter</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-gray-400" />
                    <span>Preflight Validation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Pending: {stats?.preflight.pending ?? 0}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                      Ready
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-gray-400" />
                    <span>Prometheus Exporter</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                    /metrics Ready
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Blocked Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {blockedRequests ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-gray-800/50">
                    <p className="text-2xl font-bold text-red-400">{blockedRequests.total}</p>
                    <p className="text-xs text-gray-500">Total blocked requests</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-gray-800/50">
                    <p className="text-sm font-medium text-white break-words">
                      {blockedRequests.lastBlockedAt ? new Date(blockedRequests.lastBlockedAt).toLocaleString() : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">Last blocked at</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-gray-800/50">
                    <p className="text-2xl font-bold text-amber-400">{blockedRequests.byCode.length}</p>
                    <p className="text-xs text-gray-500">Distinct blocked codes</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-300">Blocked codes</p>
                  {blockedRequests.byCode.length ? (
                    <div className="flex flex-wrap gap-2">
                      {blockedRequests.byCode.slice(0, 8).map((item) => (
                        <span
                          key={item.code}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/20"
                        >
                          {item.code} {item.count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No blocked request codes recorded</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-300">Recent blocked requests</p>
                  {recentBlockedRequests.length ? (
                    <div className="space-y-2">
                      {recentBlockedRequests.slice(0, 5).map((entry) => (
                        <div
                          key={`${entry.timestamp}-${entry.code}-${entry.event}`}
                          className="flex flex-col gap-1 rounded-lg bg-gray-800/50 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-white">{entry.code}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{entry.reason ?? entry.event}</p>
                          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                            {entry.ip && <span>ip: {entry.ip}</span>}
                            {entry.path && <span>path: {entry.path}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No blocked requests recorded</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Blocked request metrics not initialized</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-green-500" />
              Cache Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.cache ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-gray-800/50">
                  <p className="text-2xl font-bold text-blue-400">{stats.cache.l1.size}</p>
                  <p className="text-xs text-gray-500">L1 Entries</p>
                  <p className="text-xs text-gray-600">max: {stats.cache.l1.maxSize}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gray-800/50">
                  <p className="text-2xl font-bold text-green-400">{stats.cache.l2.entries}</p>
                  <p className="text-xs text-gray-500">L2 Entries</p>
                  <p className="text-xs text-gray-600">{stats.cache.l2.expiredEntries} expired</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gray-800/50">
                  <p className="text-2xl font-bold text-purple-400">{stats.cache.hits.total}</p>
                  <p className="text-xs text-gray-500">Total Hits</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-gray-800/50">
                  <p className="text-2xl font-bold text-red-400">{stats.cache.misses}</p>
                  <p className="text-xs text-gray-500">Total Misses</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Cache not initialized</p>
            )}
          </CardContent>
        </Card>

        <footer className="text-center text-gray-600 text-sm pt-4 border-t border-gray-800">
          <p>MCP Transport Firewall v2.2.2</p>
          <p className="text-xs mt-1">Fail-closed stdio firewall with an HTTP compatibility harness</p>
        </footer>
      </div>
    </div>
  );
}

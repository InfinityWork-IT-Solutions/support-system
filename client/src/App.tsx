import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Ticket, AppSettings } from './lib/api'
import { 
  Mail, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Send, 
  Search,
  ChevronRight,
  Zap,
  Inbox,
  MessageSquare,
  Settings,
  Save,
  TestTube2
} from 'lucide-react'

function App() {
  const queryClient = useQueryClient()
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    urgency: '',
    search: '',
  })
  const [editedDraft, setEditedDraft] = useState('')
  const [settingsForm, setSettingsForm] = useState<Partial<AppSettings>>({})
  const [testResult, setTestResult] = useState<{type: string; success: boolean; message: string} | null>(null)

  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => api.getTickets(filters),
    enabled: !showSettings,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    enabled: !showSettings,
  })

  const { data: selectedTicket, isLoading: ticketLoading } = useQuery({
    queryKey: ['ticket', selectedTicketId],
    queryFn: () => selectedTicketId ? api.getTicket(selectedTicketId) : null,
    enabled: !!selectedTicketId && !showSettings,
  })

  const { data: currentSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    enabled: showSettings,
  })

  const fetchEmailsMutation = useMutation({
    mutationFn: api.fetchEmails,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const processAllMutation = useMutation({
    mutationFn: api.processAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const processTicketMutation = useMutation({
    mutationFn: (id: number) => api.processTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.approveTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.rejectTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const sendMutation = useMutation({
    mutationFn: (id: number) => api.sendResponse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: string }) => api.updateDraft(id, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] })
    },
  })

  const saveSettingsMutation = useMutation({
    mutationFn: (settings: Partial<AppSettings>) => api.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSettingsForm({})
    },
  })

  const testImapMutation = useMutation({
    mutationFn: api.testImap,
    onSuccess: (data) => setTestResult({ type: 'IMAP', ...data }),
  })

  const testSmtpMutation = useMutation({
    mutationFn: api.testSmtp,
    onSuccess: (data) => setTestResult({ type: 'SMTP', ...data }),
  })

  const getUrgencyColor = (urgency: string | null) => {
    switch (urgency) {
      case 'High': return 'text-red-600 bg-red-50'
      case 'Medium': return 'text-yellow-600 bg-yellow-50'
      case 'Low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'text-green-600 bg-green-50'
      case 'REJECTED': return 'text-red-600 bg-red-50'
      case 'PENDING': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id)
    setEditedDraft(ticket.draft_response || '')
  }

  const handleSettingsChange = (key: keyof AppSettings, value: string) => {
    setSettingsForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settingsForm)
  }

  if (showSettings) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary-600 p-2 rounded-lg">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                  <p className="text-sm text-gray-500">Configure email and AI settings</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {testResult && (
            <div className={`mb-6 p-4 rounded-lg ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <strong>{testResult.type} Test:</strong> {testResult.message}
              <button onClick={() => setTestResult(null)} className="ml-4 underline">Dismiss</button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">IMAP Settings (Incoming Email)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Host</label>
                <input
                  type="text"
                  placeholder={currentSettings?.imap_host || "imap.gmail.com"}
                  value={settingsForm.imap_host ?? ''}
                  onChange={(e) => handleSettingsChange('imap_host', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Port</label>
                <input
                  type="text"
                  placeholder={currentSettings?.imap_port || "993"}
                  value={settingsForm.imap_port ?? ''}
                  onChange={(e) => handleSettingsChange('imap_port', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Username</label>
                <input
                  type="text"
                  placeholder={currentSettings?.imap_username || "your-email@gmail.com"}
                  value={settingsForm.imap_username ?? ''}
                  onChange={(e) => handleSettingsChange('imap_username', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IMAP Password</label>
                <input
                  type="password"
                  placeholder="App password"
                  value={settingsForm.imap_password ?? ''}
                  onChange={(e) => handleSettingsChange('imap_password', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              onClick={() => testImapMutation.mutate()}
              disabled={testImapMutation.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <TestTube2 className="w-4 h-4" />
              {testImapMutation.isPending ? 'Testing...' : 'Test IMAP Connection'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">SMTP Settings (Outgoing Email)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  placeholder={currentSettings?.smtp_host || "smtp.gmail.com"}
                  value={settingsForm.smtp_host ?? ''}
                  onChange={(e) => handleSettingsChange('smtp_host', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                <input
                  type="text"
                  placeholder={currentSettings?.smtp_port || "587"}
                  value={settingsForm.smtp_port ?? ''}
                  onChange={(e) => handleSettingsChange('smtp_port', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                <input
                  type="text"
                  placeholder={currentSettings?.smtp_username || "your-email@gmail.com"}
                  value={settingsForm.smtp_username ?? ''}
                  onChange={(e) => handleSettingsChange('smtp_username', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                <input
                  type="password"
                  placeholder="App password"
                  value={settingsForm.smtp_password ?? ''}
                  onChange={(e) => handleSettingsChange('smtp_password', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                <input
                  type="text"
                  placeholder={currentSettings?.smtp_from_email || "support@infinityworkitsolutions.com"}
                  value={settingsForm.smtp_from_email ?? ''}
                  onChange={(e) => handleSettingsChange('smtp_from_email', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              onClick={() => testSmtpMutation.mutate()}
              disabled={testSmtpMutation.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <TestTube2 className="w-4 h-4" />
              {testSmtpMutation.isPending ? 'Testing...' : 'Test SMTP Connection'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">OpenAI Settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                value={settingsForm.openai_api_key ?? ''}
                onChange={(e) => handleSettingsChange('openai_api_key', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saveSettingsMutation.isPending || Object.keys(settingsForm).length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary-600 p-2 rounded-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Support Desk</h1>
                <p className="text-sm text-gray-500">InfinityWork IT Solutions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchEmailsMutation.mutate()}
                disabled={fetchEmailsMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Inbox className="w-4 h-4" />
                {fetchEmailsMutation.isPending ? 'Fetching...' : 'Fetch Emails'}
              </button>
              <button
                onClick={() => processAllMutation.mutate()}
                disabled={processAllMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {processAllMutation.isPending ? 'Processing...' : 'Process All'}
              </button>
              <button
                onClick={() => refetchTickets()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stats?.total || 0}</div>
            <div className="text-sm text-gray-500">Total Tickets</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
            <div className="text-sm text-gray-500">Pending Review</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats?.approved || 0}</div>
            <div className="text-sm text-gray-500">Approved</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600">{stats?.rejected || 0}</div>
            <div className="text-sm text-gray-500">Rejected</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm mb-6 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or subject..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              <option value="Technical">Technical</option>
              <option value="Billing">Billing</option>
              <option value="Login / Access">Login / Access</option>
              <option value="Feature Request">Feature Request</option>
              <option value="General Inquiry">General Inquiry</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={filters.urgency}
              onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Urgency</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">Tickets ({tickets.length})</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {ticketsLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : tickets.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No tickets found</div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                      selectedTicketId === ticket.id ? 'bg-primary-50 border-l-4 border-l-primary-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">
                        {ticket.sender_email}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="text-sm text-gray-700 truncate mb-2">{ticket.subject}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(ticket.approval_status)}`}>
                        {ticket.approval_status}
                      </span>
                      {ticket.urgency && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getUrgencyColor(ticket.urgency)}`}>
                          {ticket.urgency}
                        </span>
                      )}
                      {ticket.category && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                          {ticket.category}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(ticket.received_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
            {!selectedTicketId ? (
              <div className="flex items-center justify-center h-[600px] text-gray-500">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a ticket to view details</p>
                </div>
              </div>
            ) : ticketLoading ? (
              <div className="flex items-center justify-center h-[600px] text-gray-500">Loading...</div>
            ) : selectedTicket ? (
              <div className="h-[600px] overflow-y-auto">
                <div className="p-6 border-b bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedTicket.subject}</h2>
                      <p className="text-sm text-gray-500">From: {selectedTicket.sender_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(selectedTicket.approval_status)}`}>
                        {selectedTicket.approval_status}
                      </span>
                    </div>
                  </div>

                  {selectedTicket.ai_processed && (
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Category</div>
                        <div className="font-medium">{selectedTicket.category || 'N/A'}</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Urgency</div>
                        <div className={`font-medium ${getUrgencyColor(selectedTicket.urgency).split(' ')[0]}`}>
                          {selectedTicket.urgency || 'N/A'}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Received</div>
                        <div className="font-medium text-sm">{new Date(selectedTicket.received_at).toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  {!selectedTicket.ai_processed && (
                    <button
                      onClick={() => processTicketMutation.mutate(selectedTicket.id)}
                      disabled={processTicketMutation.isPending}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      {processTicketMutation.isPending ? 'Processing...' : 'Process with AI'}
                    </button>
                  )}
                </div>

                {selectedTicket.summary && (
                  <div className="p-6 border-b">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">AI Summary</h3>
                    <p className="text-gray-700">{selectedTicket.summary}</p>
                  </div>
                )}

                <div className="p-6 border-b">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Conversation</h3>
                  <div className="space-y-4">
                    {selectedTicket.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-lg ${
                          msg.is_incoming ? 'bg-gray-50' : 'bg-green-50 ml-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {msg.is_incoming ? msg.sender_email : 'InfinityWork Support'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTicket.fix_steps && (
                  <div className="p-6 border-b">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Troubleshooting Steps</h3>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedTicket.fix_steps}
                    </pre>
                  </div>
                )}

                {selectedTicket.ai_processed && (
                  <div className="p-6 border-b">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Draft Response</h3>
                    <textarea
                      value={editedDraft || selectedTicket.draft_response || ''}
                      onChange={(e) => setEditedDraft(e.target.value)}
                      className="w-full h-40 p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {editedDraft !== selectedTicket.draft_response && (
                      <button
                        onClick={() => updateDraftMutation.mutate({ id: selectedTicket.id, draft: editedDraft })}
                        disabled={updateDraftMutation.isPending}
                        className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
                      >
                        Save Changes
                      </button>
                    )}
                  </div>
                )}

                <div className="p-6 bg-gray-50">
                  <div className="flex items-center gap-3">
                    {selectedTicket.approval_status === 'PENDING' && selectedTicket.ai_processed && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(selectedTicket.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(selectedTicket.id)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}
                    {selectedTicket.approval_status === 'APPROVED' && !selectedTicket.sent_at && (
                      <button
                        onClick={() => sendMutation.mutate(selectedTicket.id)}
                        disabled={sendMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        Send Response
                      </button>
                    )}
                    {selectedTicket.sent_at && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span>Response sent on {new Date(selectedTicket.sent_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

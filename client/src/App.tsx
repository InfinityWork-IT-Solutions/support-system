import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Ticket, TicketDetail } from './lib/api'
import { 
  Mail, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Send, 
  Clock, 
  AlertTriangle,
  Search,
  Filter,
  ChevronRight,
  Zap,
  Inbox,
  MessageSquare
} from 'lucide-react'

function App() {
  const queryClient = useQueryClient()
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    urgency: '',
    search: '',
  })
  const [editedDraft, setEditedDraft] = useState('')

  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => api.getTickets(filters),
  })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
  })

  const { data: selectedTicket, isLoading: ticketLoading } = useQuery({
    queryKey: ['ticket', selectedTicketId],
    queryFn: () => selectedTicketId ? api.getTicket(selectedTicketId) : null,
    enabled: !!selectedTicketId,
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

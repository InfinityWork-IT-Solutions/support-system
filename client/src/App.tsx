import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Ticket, AppSettings, Analytics, PerformanceMetrics, VolumeTrends, Template, SchedulerStatus, SlackSettings, KnowledgeArticle } from './lib/api'
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
  TestTube2,
  Square,
  CheckSquare,
  BarChart3,
  FileText,
  Trash2,
  Edit2,
  Clock,
  Play,
  Pause,
  Hash,
  BookOpen,
  Lightbulb,
  Download
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from 'recharts'

function App() {
  const queryClient = useQueryClient()
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    urgency: '',
    search: '',
  })
  const [editedDraft, setEditedDraft] = useState('')
  const [settingsForm, setSettingsForm] = useState<Partial<AppSettings>>({})
  const [testResult, setTestResult] = useState<{type: string; success: boolean; message: string} | null>(null)
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set())
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateForm, setTemplateForm] = useState<{ name: string; category: string; content: string }>({ name: '', category: '', content: '' })
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [slackForm, setSlackForm] = useState<{
    webhook_url: string;
    notify_on_new: boolean;
    notify_on_urgent: boolean;
    notify_on_process: boolean;
  }>({
    webhook_url: '',
    notify_on_new: true,
    notify_on_urgent: true,
    notify_on_process: false
  })
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [knowledgeForm, setKnowledgeForm] = useState<{ title: string; category: string; keywords: string; content: string }>({ title: '', category: '', keywords: '', content: '' })
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null)
  const [knowledgeSearch, setKnowledgeSearch] = useState('')

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

  const { data: analytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: api.getAnalytics,
    enabled: showAnalytics,
  })

  const { data: performance } = useQuery({
    queryKey: ['performance'],
    queryFn: api.getPerformanceMetrics,
    enabled: showAnalytics,
  })

  const { data: volumeTrends } = useQuery({
    queryKey: ['volumeTrends'],
    queryFn: () => api.getVolumeTrends(30),
    enabled: showAnalytics,
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.getTemplates(),
  })

  const { data: schedulerStatus } = useQuery({
    queryKey: ['scheduler'],
    queryFn: api.getScheduler,
    enabled: showSettings,
  })

  const { data: slackSettings } = useQuery({
    queryKey: ['slackSettings'],
    queryFn: api.getSlackSettings,
    enabled: showSettings,
  })

  const { data: knowledgeArticles = [] } = useQuery({
    queryKey: ['knowledge', knowledgeSearch],
    queryFn: () => api.getKnowledgeArticles({ search: knowledgeSearch }),
    enabled: showKnowledge,
  })

  const { data: knowledgeSuggestions = [] } = useQuery({
    queryKey: ['knowledgeSuggestions', selectedTicket?.category, selectedTicket?.summary],
    queryFn: () => api.getKnowledgeSuggestions(
      selectedTicket?.category || undefined,
      selectedTicket?.summary?.split(' ').slice(0, 5).join(',')
    ),
    enabled: !!selectedTicket && selectedTicket.ai_processed,
  })

  useEffect(() => {
    if (slackSettings) {
      setSlackForm({
        webhook_url: '',
        notify_on_new: slackSettings.notify_on_new,
        notify_on_urgent: slackSettings.notify_on_urgent,
        notify_on_process: slackSettings.notify_on_process
      })
    }
  }, [slackSettings])

  const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899']

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

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: number[]) => api.bulkApprove(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setSelectedTicketIds(new Set())
    },
  })

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: number[]) => api.bulkReject(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setSelectedTicketIds(new Set())
    },
  })

  const bulkSendMutation = useMutation({
    mutationFn: (ids: number[]) => api.bulkSend(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setSelectedTicketIds(new Set())
    },
  })

  const createTemplateMutation = useMutation({
    mutationFn: api.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setTemplateForm({ name: '', category: '', content: '' })
    },
  })

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; category?: string; content?: string } }) => 
      api.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setEditingTemplateId(null)
      setTemplateForm({ name: '', category: '', content: '' })
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: api.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  const updateSchedulerMutation = useMutation({
    mutationFn: ({ enabled, interval }: { enabled: boolean; interval: number }) => 
      api.updateScheduler(enabled, interval),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler'] })
    },
  })

  const updateSlackMutation = useMutation({
    mutationFn: api.updateSlackSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slackSettings'] })
      setSlackForm({ webhook_url: '', notify_on_new: true, notify_on_urgent: true, notify_on_process: false })
    },
  })

  const testSlackMutation = useMutation({
    mutationFn: api.testSlack,
    onSuccess: (data) => setTestResult({ type: 'Slack', ...data }),
  })

  const createArticleMutation = useMutation({
    mutationFn: api.createKnowledgeArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      setKnowledgeForm({ title: '', category: '', keywords: '', content: '' })
    },
  })

  const updateArticleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; category?: string; keywords?: string; content?: string } }) => 
      api.updateKnowledgeArticle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      setEditingArticleId(null)
      setKnowledgeForm({ title: '', category: '', keywords: '', content: '' })
    },
  })

  const deleteArticleMutation = useMutation({
    mutationFn: api.deleteKnowledgeArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
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

  const handleSettingsChange = (key: keyof AppSettings, value: string) => {
    setSettingsForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settingsForm)
  }

  const toggleTicketSelection = (ticketId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedTicketIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId)
      } else {
        newSet.add(ticketId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedTicketIds.size === tickets.length) {
      setSelectedTicketIds(new Set())
    } else {
      setSelectedTicketIds(new Set(tickets.map(t => t.id)))
    }
  }

  const getSelectedPendingIds = () => 
    tickets.filter(t => selectedTicketIds.has(t.id) && t.approval_status === 'PENDING' && t.ai_processed).map(t => t.id)
  
  const getSelectedApprovedIds = () => 
    tickets.filter(t => selectedTicketIds.has(t.id) && t.approval_status === 'APPROVED' && !t.sent_at).map(t => t.id)

  const handleEditTemplate = (template: Template) => {
    setEditingTemplateId(template.id)
    setTemplateForm({ name: template.name, category: template.category || '', content: template.content })
  }

  const handleSaveTemplate = () => {
    if (editingTemplateId) {
      updateTemplateMutation.mutate({ id: editingTemplateId, data: templateForm })
    } else {
      createTemplateMutation.mutate(templateForm)
    }
  }

  const handleCancelEdit = () => {
    setEditingTemplateId(null)
    setTemplateForm({ name: '', category: '', content: '' })
  }

  const applyTemplate = (template: Template) => {
    setEditedDraft(template.content)
  }

  const handleEditArticle = (article: KnowledgeArticle) => {
    setEditingArticleId(article.id)
    setKnowledgeForm({ title: article.title, category: article.category || '', keywords: article.keywords || '', content: article.content })
  }

  const handleSaveArticle = () => {
    if (editingArticleId) {
      updateArticleMutation.mutate({ id: editingArticleId, data: knowledgeForm })
    } else {
      createArticleMutation.mutate(knowledgeForm)
    }
  }

  const handleCancelArticleEdit = () => {
    setEditingArticleId(null)
    setKnowledgeForm({ title: '', category: '', keywords: '', content: '' })
  }

  const applyArticleToResponse = (article: KnowledgeArticle) => {
    setEditedDraft(article.content)
  }

  if (showKnowledge) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary-600 p-2 rounded-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Knowledge Base</h1>
                  <p className="text-sm text-gray-500">Solution articles and help guides</p>
                </div>
              </div>
              <button
                onClick={() => setShowKnowledge(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search knowledge base..."
                value={knowledgeSearch}
                onChange={(e) => setKnowledgeSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingArticleId ? 'Edit Article' : 'Create New Article'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={knowledgeForm.title}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                    placeholder="e.g., How to Reset Password"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={knowledgeForm.category}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No Category</option>
                    <option value="Technical">Technical</option>
                    <option value="Billing">Billing</option>
                    <option value="Login / Access">Login / Access</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
                  <input
                    type="text"
                    value={knowledgeForm.keywords}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, keywords: e.target.value })}
                    placeholder="e.g., password, reset, login, forgot"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    value={knowledgeForm.content}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                    placeholder="Enter the article content..."
                    className="w-full h-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveArticle}
                    disabled={!knowledgeForm.title || !knowledgeForm.content || createArticleMutation.isPending || updateArticleMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {editingArticleId ? 'Update Article' : 'Save Article'}
                  </button>
                  {editingArticleId && (
                    <button
                      onClick={handleCancelArticleEdit}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Articles ({knowledgeArticles.length})</h2>
              {knowledgeArticles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No articles yet. Create your first one!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {knowledgeArticles.map((article) => (
                    <div key={article.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{article.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {article.category && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                {article.category}
                              </span>
                            )}
                            {article.keywords && (
                              <span className="text-xs text-gray-400">
                                {article.keywords.split(',').slice(0, 3).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditArticle(article)}
                            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                            title="Edit article"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteArticleMutation.mutate(article.id)}
                            disabled={deleteArticleMutation.isPending}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Delete article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{article.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showTemplates) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary-600 p-2 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Response Templates</h1>
                  <p className="text-sm text-gray-500">Manage reusable response templates</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingTemplateId ? 'Edit Template' : 'Create New Template'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="e.g., Password Reset Response"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No Category</option>
                    <option value="Technical">Technical</option>
                    <option value="Billing">Billing</option>
                    <option value="Login / Access">Login / Access</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Content</label>
                  <textarea
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    placeholder="Enter your template text here..."
                    className="w-full h-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!templateForm.name || !templateForm.content || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {editingTemplateId ? 'Update Template' : 'Save Template'}
                  </button>
                  {editingTemplateId && (
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Existing Templates ({templates.length})</h2>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No templates yet. Create your first one!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {templates.map((template) => (
                    <div key={template.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">{template.name}</h3>
                          {template.category && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              {template.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                            title="Edit template"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            disabled={deleteTemplateMutation.isPending}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{template.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showAnalytics) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary-600 p-2 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
                  <p className="text-sm text-gray-500">Ticket insights and statistics</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalytics(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{analytics?.total_tickets || 0}</div>
              <div className="text-sm text-gray-500">Total Tickets</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-green-600">{analytics?.approval_rate || 0}%</div>
              <div className="text-sm text-gray-500">Approval Rate</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{analytics?.sent_count || 0}</div>
              <div className="text-sm text-gray-500">Responses Sent</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-purple-600">{analytics?.ai_processed_count || 0}</div>
              <div className="text-sm text-gray-500">AI Processed</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Tickets by Category</h2>
              {analytics?.by_category && analytics.by_category.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.by_category}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {analytics.by_category.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No category data available
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Tickets by Urgency</h2>
              {analytics?.by_urgency && analytics.by_urgency.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.by_urgency}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6">
                      {analytics.by_urgency.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.name === 'High' ? '#ef4444' : entry.name === 'Medium' ? '#eab308' : '#22c55e'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No urgency data available
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Ticket Volume Trends (Last 30 Days)</h2>
              {volumeTrends && (
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Total: <strong className="text-gray-900">{volumeTrends.total}</strong></span>
                  <span>Daily Avg: <strong className="text-gray-900">{volumeTrends.average}</strong></span>
                </div>
              )}
            </div>
            {volumeTrends?.trends && volumeTrends.trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={volumeTrends.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value: string) => {
                      const [year, month, day] = value.split('-').map(Number);
                      return `${month}/${day}`;
                    }}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip 
                    labelFormatter={(value: string) => {
                      const [year, month, day] = value.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    }}
                    formatter={(value: number) => [value, 'Tickets']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No trend data available
              </div>
            )}
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Status Breakdown</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{analytics?.approved_count || 0}</div>
                <div className="text-sm text-gray-600">Approved</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{analytics?.rejected_count || 0}</div>
                <div className="text-sm text-gray-600">Rejected</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{analytics?.send_rate || 0}%</div>
                <div className="text-sm text-gray-600">Send Rate</div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Response Time Metrics</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{performance?.avg_processing_time_hours || 0}h</div>
                <div className="text-sm text-gray-600">Avg. Processing Time</div>
                <div className="text-xs text-gray-400 mt-1">Time to AI process ticket</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">{performance?.avg_approval_time_hours || 0}h</div>
                <div className="text-sm text-gray-600">Avg. Approval Time</div>
                <div className="text-xs text-gray-400 mt-1">Time to approve response</div>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-lg">
                <div className="text-3xl font-bold text-teal-600">{performance?.avg_resolution_time_hours || 0}h</div>
                <div className="text-sm text-gray-600">Avg. Resolution Time</div>
                <div className="text-xs text-gray-400 mt-1">Time to send response</div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Today's Activity</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-700">{performance?.today_tickets || 0}</div>
                <div className="text-sm text-gray-600">Tickets Received</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-700">{performance?.today_processed || 0}</div>
                <div className="text-sm text-gray-600">Tickets Processed</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-700">{performance?.today_sent || 0}</div>
                <div className="text-sm text-gray-600">Responses Sent</div>
              </div>
            </div>
          </div>

          {performance?.by_approver && performance.by_approver.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Agent Performance</h2>
              <div className="space-y-3">
                {performance.by_approver.map((approver, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">{approver.name}</span>
                    <span className="text-lg font-bold text-primary-600">{approver.count} approved</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
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

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">Auto-Fetch Scheduler</h2>
              </div>
              {schedulerStatus?.running && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Running
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Automatically fetch new emails at regular intervals. When enabled, the system will check for new emails periodically.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSchedulerMutation.mutate({ 
                      enabled: !schedulerStatus?.enabled, 
                      interval: schedulerStatus?.interval_minutes || 5 
                    })}
                    disabled={updateSchedulerMutation.isPending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                      schedulerStatus?.enabled 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {schedulerStatus?.enabled ? (
                      <>
                        <Pause className="w-4 h-4" />
                        {updateSchedulerMutation.isPending ? 'Stopping...' : 'Stop Scheduler'}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        {updateSchedulerMutation.isPending ? 'Starting...' : 'Start Scheduler'}
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interval (minutes)</label>
                <div className="flex items-center gap-2">
                  <select
                    value={schedulerStatus?.interval_minutes || 5}
                    onChange={(e) => {
                      const newInterval = parseInt(e.target.value)
                      updateSchedulerMutation.mutate({ 
                        enabled: schedulerStatus?.enabled || false, 
                        interval: newInterval 
                      })
                    }}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={1}>1 minute</option>
                    <option value={2}>2 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Current status: {schedulerStatus?.enabled ? 'Enabled' : 'Disabled'} | 
              Interval: Every {schedulerStatus?.interval_minutes || 5} minutes
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold">Slack Notifications</h2>
              </div>
              {slackSettings?.configured && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Connected
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Receive instant notifications in Slack when new tickets arrive, urgent issues are detected, or tickets are processed by AI.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <input
                  type="password"
                  placeholder={slackSettings?.configured ? '********' : 'https://hooks.slack.com/services/...'}
                  value={slackForm.webhook_url}
                  onChange={(e) => setSlackForm({ ...slackForm, webhook_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create a webhook in your Slack workspace and paste the URL here.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Notification Triggers</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slackForm.notify_on_new}
                      onChange={(e) => setSlackForm({ ...slackForm, notify_on_new: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Notify on new tickets</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slackForm.notify_on_urgent}
                      onChange={(e) => setSlackForm({ ...slackForm, notify_on_urgent: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Notify on urgent tickets</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slackForm.notify_on_process}
                      onChange={(e) => setSlackForm({ ...slackForm, notify_on_process: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Notify when AI processes tickets</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => updateSlackMutation.mutate({
                  webhook_url: slackForm.webhook_url,
                  notify_on_new: slackForm.notify_on_new,
                  notify_on_urgent: slackForm.notify_on_urgent,
                  notify_on_process: slackForm.notify_on_process
                })}
                disabled={updateSlackMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateSlackMutation.isPending ? 'Saving...' : 'Save Slack Settings'}
              </button>
              <button
                onClick={() => testSlackMutation.mutate()}
                disabled={testSlackMutation.isPending || !slackSettings?.configured}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <TestTube2 className="w-4 h-4" />
                {testSlackMutation.isPending ? 'Testing...' : 'Test Slack'}
              </button>
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
                onClick={() => setShowAnalytics(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Analytics"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowTemplates(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Templates"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowKnowledge(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Knowledge Base"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <a
                href={api.exportTickets(filters)}
                download
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Export to CSV"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Settings"
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-gray-200 rounded"
                    title={selectedTicketIds.size === tickets.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedTicketIds.size === tickets.length && tickets.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-primary-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <h2 className="font-semibold text-gray-900">Tickets ({tickets.length})</h2>
                </div>
                {selectedTicketIds.size > 0 && (
                  <span className="text-xs text-primary-600 font-medium">{selectedTicketIds.size} selected</span>
                )}
              </div>
              {selectedTicketIds.size > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {getSelectedPendingIds().length > 0 && (
                    <>
                      <button
                        onClick={() => bulkApproveMutation.mutate(getSelectedPendingIds())}
                        disabled={bulkApproveMutation.isPending}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve ({getSelectedPendingIds().length})
                      </button>
                      <button
                        onClick={() => bulkRejectMutation.mutate(getSelectedPendingIds())}
                        disabled={bulkRejectMutation.isPending}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject ({getSelectedPendingIds().length})
                      </button>
                    </>
                  )}
                  {getSelectedApprovedIds().length > 0 && (
                    <button
                      onClick={() => bulkSendMutation.mutate(getSelectedApprovedIds())}
                      disabled={bulkSendMutation.isPending}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      Send ({getSelectedApprovedIds().length})
                    </button>
                  )}
                </div>
              )}
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => toggleTicketSelection(ticket.id, e)}
                          className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
                        >
                          {selectedTicketIds.has(ticket.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {ticket.sender_email}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
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

                {knowledgeSuggestions.length > 0 && (
                  <div className="p-6 border-b bg-yellow-50">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-yellow-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Suggested Knowledge Articles</h3>
                    </div>
                    <div className="space-y-2">
                      {knowledgeSuggestions.map((article) => (
                        <div key={article.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">{article.title}</div>
                            {article.category && (
                              <span className="text-xs text-gray-500">{article.category}</span>
                            )}
                          </div>
                          <button
                            onClick={() => applyArticleToResponse(article)}
                            className="ml-2 px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">Draft Response</h3>
                      {templates.length > 0 && (
                        <select
                          onChange={(e) => {
                            const template = templates.find(t => t.id === parseInt(e.target.value))
                            if (template) applyTemplate(template)
                            e.target.value = ''
                          }}
                          className="text-sm px-2 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          defaultValue=""
                        >
                          <option value="" disabled>Use Template...</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
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

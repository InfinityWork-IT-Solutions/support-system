import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Ticket, AppSettings, Analytics, PerformanceMetrics, VolumeTrends, Template, SchedulerStatus, SlackSettings, KnowledgeArticle, Survey, SurveyStats, AutoResponderSettings, TeamMember, SlaSummary, SlaSettings, SavedView, QuickFilter } from './lib/api'
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
  Download,
  Star,
  User,
  Users,
  UserPlus,
  AlertTriangle,
  Timer,
  Target,
  Bookmark,
  Plus,
  X,
  Filter,
  Bell,
  LogOut
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from 'recharts'
import Login from './components/Login'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('auth_user')
  })
  const [currentUser, setCurrentUser] = useState<string>(() => {
    const user = localStorage.getItem('auth_user')
    return user ? JSON.parse(user).name : ''
  })

  const handleLogin = (username: string) => {
    setIsAuthenticated(true)
    setCurrentUser(username)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_user')
    setIsAuthenticated(false)
    setCurrentUser('')
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return <Dashboard currentUser={currentUser} onLogout={handleLogout} />
}

function Dashboard({ currentUser, onLogout }: { currentUser: string; onLogout: () => void }) {
  const queryClient = useQueryClient()
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    urgency: '',
    search: '',
    sla_breached: undefined as boolean | undefined,
    assigned_to: '',
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
  const [autoResponderForm, setAutoResponderForm] = useState<{
    enabled: boolean;
    template: string;
  }>({
    enabled: false,
    template: ''
  })
  const [teamMemberForm, setTeamMemberForm] = useState<{
    name: string;
    email: string;
    role: string;
  }>({
    name: '',
    email: '',
    role: 'agent'
  })
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null)
  const [showPriorityQueue, setShowPriorityQueue] = useState(false)
  const [slaSettingsForm, setSlaSettingsForm] = useState<{
    high_hours: number;
    medium_hours: number;
    low_hours: number;
  }>({
    high_hours: 4,
    medium_hours: 8,
    low_hours: 24
  })
  const [emailNotificationForm, setEmailNotificationForm] = useState<{
    enabled: boolean;
    urgent_only: boolean;
    recipients: string;
  }>({
    enabled: false,
    urgent_only: true,
    recipients: 'all'
  })
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('all')
  const [activeSavedView, setActiveSavedView] = useState<number | null>(null)
  const [showSaveViewModal, setShowSaveViewModal] = useState(false)
  const [savedViewForm, setSavedViewForm] = useState<{
    name: string;
    is_default: boolean;
  }>({ name: '', is_default: false })

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

  const { data: surveyStats } = useQuery({
    queryKey: ['surveyStats'],
    queryFn: api.getSurveyStats,
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

  const { data: autoResponderSettings } = useQuery({
    queryKey: ['autoResponder'],
    queryFn: api.getAutoResponderSettings,
    enabled: showSettings,
  })

  const { data: emailNotificationSettings } = useQuery({
    queryKey: ['emailNotifications'],
    queryFn: api.getEmailNotificationSettings,
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

  const { data: customerHistory = [] } = useQuery({
    queryKey: ['customerHistory', selectedTicket?.sender_email, selectedTicket?.id],
    queryFn: () => api.getCustomerHistory(
      selectedTicket?.sender_email || '',
      selectedTicket?.id
    ),
    enabled: !!selectedTicket?.sender_email,
  })

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.getTeamMembers(false),
  })

  const { data: activeTeamMembers = [] } = useQuery({
    queryKey: ['activeTeamMembers'],
    queryFn: () => api.getTeamMembers(true),
  })

  const { data: slaSummary } = useQuery({
    queryKey: ['slaSummary'],
    queryFn: api.getSlaSummary,
    enabled: !showSettings,
  })

  const { data: priorityQueue = [] } = useQuery({
    queryKey: ['priorityQueue'],
    queryFn: () => api.getPriorityQueue(20),
    enabled: showPriorityQueue,
  })

  const { data: slaSettings } = useQuery({
    queryKey: ['slaSettings'],
    queryFn: api.getSlaSettings,
    enabled: showSettings,
  })

  const { data: savedViews = [] } = useQuery({
    queryKey: ['savedViews'],
    queryFn: api.getSavedViews,
  })

  const { data: quickFilters = [] } = useQuery({
    queryKey: ['quickFilters'],
    queryFn: api.getQuickFilters,
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

  useEffect(() => {
    if (autoResponderSettings) {
      setAutoResponderForm({
        enabled: autoResponderSettings.enabled,
        template: autoResponderSettings.template
      })
    }
  }, [autoResponderSettings])

  useEffect(() => {
    if (emailNotificationSettings) {
      setEmailNotificationForm({
        enabled: emailNotificationSettings.enabled,
        urgent_only: emailNotificationSettings.urgent_only,
        recipients: emailNotificationSettings.recipients
      })
    }
  }, [emailNotificationSettings])

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

  const updateAutoResponderMutation = useMutation({
    mutationFn: api.updateAutoResponderSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoResponder'] })
    },
  })

  const updateEmailNotificationMutation = useMutation({
    mutationFn: api.updateEmailNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailNotifications'] })
    },
  })

  const testEmailNotificationMutation = useMutation({
    mutationFn: api.testEmailNotification,
    onSuccess: (data) => setTestResult({ type: 'Email Notification', ...data }),
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

  const createTeamMemberMutation = useMutation({
    mutationFn: api.createTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] })
      queryClient.invalidateQueries({ queryKey: ['activeTeamMembers'] })
      setTeamMemberForm({ name: '', email: '', role: 'agent' })
    },
  })

  const updateTeamMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; email?: string; role?: string; is_active?: boolean } }) =>
      api.updateTeamMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] })
      queryClient.invalidateQueries({ queryKey: ['activeTeamMembers'] })
      setEditingMemberId(null)
      setTeamMemberForm({ name: '', email: '', role: 'agent' })
    },
  })

  const deleteTeamMemberMutation = useMutation({
    mutationFn: api.deleteTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] })
      queryClient.invalidateQueries({ queryKey: ['activeTeamMembers'] })
    },
  })

  const assignTicketMutation = useMutation({
    mutationFn: ({ ticketId, memberId }: { ticketId: number; memberId: number | null }) =>
      api.assignTicket(ticketId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const updateSlaMutation = useMutation({
    mutationFn: (settings: SlaSettings) => api.updateSlaSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slaSettings'] })
    },
  })

  const refreshSlaMutation = useMutation({
    mutationFn: () => api.refreshSlaStatus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slaSummary'] })
      queryClient.invalidateQueries({ queryKey: ['priorityQueue'] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const createSavedViewMutation = useMutation({
    mutationFn: api.createSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedViews'] })
      setShowSaveViewModal(false)
      setSavedViewForm({ name: '', is_default: false })
    },
  })

  const deleteSavedViewMutation = useMutation({
    mutationFn: api.deleteSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedViews'] })
      setActiveSavedView(null)
    },
  })

  const applyQuickFilter = (filter: QuickFilter) => {
    setActiveQuickFilter(filter.id)
    setActiveSavedView(null)
    setFilters({
      status: filter.filters.status || '',
      category: filter.filters.category || '',
      urgency: filter.filters.urgency || '',
      search: '',
      sla_breached: filter.filters.sla_breached,
      assigned_to: filter.filters.assigned_to === null ? 'unassigned' : '',
    })
  }

  const applySavedView = (view: SavedView) => {
    setActiveSavedView(view.id)
    setActiveQuickFilter('')
    setFilters({
      status: view.status || '',
      category: view.category || '',
      urgency: view.urgency || '',
      search: view.search || '',
      sla_breached: view.sla_breached ?? undefined,
      assigned_to: view.assigned_to === null ? 'unassigned' : view.assigned_to?.toString() || '',
    })
  }

  const handleSaveView = () => {
    if (!savedViewForm.name.trim()) return
    createSavedViewMutation.mutate({
      name: savedViewForm.name,
      status: filters.status || null,
      category: filters.category || null,
      urgency: filters.urgency || null,
      search: filters.search || null,
      is_default: savedViewForm.is_default,
    })
  }

  useEffect(() => {
    if (slaSettings) {
      setSlaSettingsForm({
        high_hours: slaSettings.high_hours,
        medium_hours: slaSettings.medium_hours,
        low_hours: slaSettings.low_hours
      })
    }
  }, [slaSettings])

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

  const handleEditTeamMember = (member: TeamMember) => {
    setEditingMemberId(member.id)
    setTeamMemberForm({ name: member.name, email: member.email, role: member.role })
  }

  const handleSaveTeamMember = () => {
    if (editingMemberId) {
      updateTeamMemberMutation.mutate({ id: editingMemberId, data: teamMemberForm })
    } else {
      createTeamMemberMutation.mutate(teamMemberForm)
    }
  }

  const handleCancelMemberEdit = () => {
    setEditingMemberId(null)
    setTeamMemberForm({ name: '', email: '', role: 'agent' })
  }

  const handleAssignTicket = (memberId: string) => {
    if (selectedTicketId) {
      assignTicketMutation.mutate({
        ticketId: selectedTicketId,
        memberId: memberId ? parseInt(memberId) : null
      })
    }
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

          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold">Customer Satisfaction</h2>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">
                  {surveyStats?.average_rating ? surveyStats.average_rating.toFixed(1) : '0.0'}
                </div>
                <div className="text-sm text-gray-600">Avg. Rating</div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3 h-3 ${
                        star <= (surveyStats?.average_rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{surveyStats?.total_sent || 0}</div>
                <div className="text-sm text-gray-600">Surveys Sent</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{surveyStats?.total_completed || 0}</div>
                <div className="text-sm text-gray-600">Responses</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{surveyStats?.response_rate || 0}%</div>
                <div className="text-sm text-gray-600">Response Rate</div>
              </div>
            </div>
            {surveyStats?.rating_distribution && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Rating Distribution</h3>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = surveyStats.rating_distribution[String(rating)] || 0;
                    const total = surveyStats.total_completed || 1;
                    const percentage = Math.round((count / total) * 100);
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <div className="flex items-center gap-1 w-16">
                          <span className="text-sm font-medium">{rating}</span>
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        </div>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500 w-12 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold">Email Notifications</h2>
              </div>
              {emailNotificationSettings?.enabled && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Send email alerts to team members when urgent tickets are received or SLA deadlines are breached.
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotificationForm.enabled}
                  onChange={(e) => setEmailNotificationForm({ ...emailNotificationForm, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Enable email notifications</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotificationForm.urgent_only}
                  onChange={(e) => setEmailNotificationForm({ ...emailNotificationForm, urgent_only: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Only notify for urgent tickets</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipients</label>
                <select
                  value={emailNotificationForm.recipients}
                  onChange={(e) => setEmailNotificationForm({ ...emailNotificationForm, recipients: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All active team members</option>
                  <option value="none">No recipients (disabled)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Notifications will be sent to all active team members' email addresses.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => updateEmailNotificationMutation.mutate({
                  enabled: emailNotificationForm.enabled,
                  urgent_only: emailNotificationForm.urgent_only,
                  recipients: emailNotificationForm.recipients
                })}
                disabled={updateEmailNotificationMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateEmailNotificationMutation.isPending ? 'Saving...' : 'Save Email Settings'}
              </button>
              <button
                onClick={() => testEmailNotificationMutation.mutate()}
                disabled={testEmailNotificationMutation.isPending || !emailNotificationSettings?.enabled}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <TestTube2 className="w-4 h-4" />
                {testEmailNotificationMutation.isPending ? 'Testing...' : 'Test Email'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Auto-Responder
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoResponderForm.enabled}
                  onChange={(e) => setAutoResponderForm({ ...autoResponderForm, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Enable auto-responder for new tickets</span>
              </label>
              <p className="text-sm text-gray-500">
                When enabled, customers will receive an automatic acknowledgment email when their ticket is received.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Response Template
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Use {'{ticket_id}'} for ticket number and {'{subject}'} for the original subject line.
                </p>
                <textarea
                  value={autoResponderForm.template}
                  onChange={(e) => setAutoResponderForm({ ...autoResponderForm, template: e.target.value })}
                  className="w-full h-48 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                />
              </div>
              <button
                onClick={() => updateAutoResponderMutation.mutate({
                  enabled: autoResponderForm.enabled,
                  template: autoResponderForm.template
                })}
                disabled={updateAutoResponderMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateAutoResponderMutation.isPending ? 'Saving...' : 'Save Auto-Responder Settings'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Team Members
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">
                  {editingMemberId ? 'Edit Team Member' : 'Add Team Member'}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={teamMemberForm.name}
                    onChange={(e) => setTeamMemberForm({ ...teamMemberForm, name: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={teamMemberForm.email}
                    onChange={(e) => setTeamMemberForm({ ...teamMemberForm, email: e.target.value })}
                    placeholder="e.g., john@infinitywork.com"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={teamMemberForm.role}
                    onChange={(e) => setTeamMemberForm({ ...teamMemberForm, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="agent">Agent</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveTeamMember}
                    disabled={!teamMemberForm.name || !teamMemberForm.email || createTeamMemberMutation.isPending || updateTeamMemberMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    {editingMemberId ? 'Update' : 'Add'} Member
                  </button>
                  {editingMemberId && (
                    <button
                      onClick={handleCancelMemberEdit}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Current Team ({teamMembers.length})</h3>
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-500">No team members added yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {teamMembers.map((member) => (
                      <div key={member.id} className={`p-3 border rounded-lg flex items-center justify-between ${!member.is_active ? 'opacity-50 bg-gray-50' : ''}`}>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{member.role}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditTeamMember(member)}
                            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateTeamMemberMutation.mutate({ id: member.id, data: { is_active: !member.is_active } })}
                            className={`p-1.5 rounded ${member.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                            title={member.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {member.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => deleteTeamMemberMutation.mutate(member.id)}
                            disabled={deleteTeamMemberMutation.isPending}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Timer className="w-5 h-5 text-orange-600" />
              SLA Settings
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Configure response time deadlines for different ticket urgency levels. Tickets exceeding these times will be marked as SLA breached.
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  High Urgency (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={slaSettingsForm.high_hours}
                  onChange={(e) => setSlaSettingsForm({ ...slaSettingsForm, high_hours: parseInt(e.target.value) || 4 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 4 hours</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medium Urgency (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={slaSettingsForm.medium_hours}
                  onChange={(e) => setSlaSettingsForm({ ...slaSettingsForm, medium_hours: parseInt(e.target.value) || 8 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 8 hours</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Low Urgency (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={slaSettingsForm.low_hours}
                  onChange={(e) => setSlaSettingsForm({ ...slaSettingsForm, low_hours: parseInt(e.target.value) || 24 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 24 hours</p>
              </div>
            </div>
            <button
              onClick={() => updateSlaMutation.mutate(slaSettingsForm)}
              disabled={updateSlaMutation.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {updateSlaMutation.isPending ? 'Saving...' : 'Save SLA Settings'}
            </button>
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
    <div className="min-h-screen dashboard-bg">
      <header className="enterprise-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-400/30 blur-xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-cyan-400 to-blue-500 p-2.5 rounded-xl shadow-lg">
                  <Mail className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">AI Support Desk</h1>
                <p className="text-sm text-cyan-300/80">InfinityWork IT Solutions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchEmailsMutation.mutate()}
                disabled={fetchEmailsMutation.isPending}
                className="enterprise-btn enterprise-btn-primary"
              >
                <Inbox className="w-4 h-4" />
                {fetchEmailsMutation.isPending ? 'Fetching...' : 'Fetch Emails'}
              </button>
              <button
                onClick={() => processAllMutation.mutate()}
                disabled={processAllMutation.isPending}
                className="enterprise-btn enterprise-btn-success"
              >
                <Zap className="w-4 h-4" />
                {processAllMutation.isPending ? 'Processing...' : 'Process All'}
              </button>
              <div className="h-8 w-px bg-white/20 mx-2"></div>
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
                <button
                  onClick={() => refetchTickets()}
                  className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Analytics"
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowTemplates(true)}
                  className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Templates"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowKnowledge(true)}
                  className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Knowledge Base"
                >
                  <BookOpen className="w-5 h-5" />
                </button>
                <a
                  href={api.exportTickets(filters)}
                  download
                  className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Export to CSV"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
              <div className="h-8 w-px bg-white/20 mx-2"></div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-white">{currentUser}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-5 mb-6">
          <div className="stat-card stat-card-blue p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{stats?.total || 0}</div>
                <div className="text-sm font-medium text-gray-500 mt-1">Total Tickets</div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center">
                <Inbox className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="stat-card stat-card-amber p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-amber-600">{stats?.pending || 0}</div>
                <div className="text-sm font-medium text-gray-500 mt-1">Pending Review</div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="stat-card stat-card-green p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-600">{stats?.approved || 0}</div>
                <div className="text-sm font-medium text-gray-500 mt-1">Approved</div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="stat-card stat-card-red p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-red-600">{stats?.rejected || 0}</div>
                <div className="text-sm font-medium text-gray-500 mt-1">Rejected</div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-50 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {slaSummary && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-600">{slaSummary.on_track}</div>
                  <div className="text-sm text-gray-500">On Track</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-500">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-yellow-600" />
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{slaSummary.at_risk}</div>
                  <div className="text-sm text-gray-500">At Risk (&lt;2h)</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-500">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-2xl font-bold text-red-600">{slaSummary.breached}</div>
                  <div className="text-sm text-gray-500">SLA Breached</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Active Tickets</div>
                  <div className="text-lg font-semibold">{slaSummary.total_active}</div>
                </div>
                <button
                  onClick={() => {
                    setShowPriorityQueue(!showPriorityQueue)
                    setSelectedTicketId(null)
                  }}
                  className={`px-3 py-1 text-sm rounded-lg ${showPriorityQueue ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Priority Queue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm mb-4 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Quick Filters:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {quickFilters.map((qf) => (
                <button
                  key={qf.id}
                  onClick={() => applyQuickFilter(qf)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    activeQuickFilter === qf.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {qf.name}
                </button>
              ))}
            </div>
            <div className="border-l border-gray-300 h-6 mx-2" />
            <Bookmark className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Saved:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {savedViews.map((sv) => (
                <div key={sv.id} className="flex items-center gap-1">
                  <button
                    onClick={() => applySavedView(sv)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      activeSavedView === sv.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {sv.name}
                  </button>
                  <button
                    onClick={() => deleteSavedViewMutation.mutate(sv.id)}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                    title="Delete view"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowSaveViewModal(true)}
                className="px-2 py-1 text-sm rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center gap-1"
                title="Save current filters as view"
              >
                <Plus className="w-3 h-3" />
                Save View
              </button>
            </div>
          </div>
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

        {showSaveViewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Save Current Filters as View</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">View Name</label>
                  <input
                    type="text"
                    value={savedViewForm.name}
                    onChange={(e) => setSavedViewForm({ ...savedViewForm, name: e.target.value })}
                    placeholder="e.g., High Priority Technical"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  <p className="font-medium mb-1">Current Filters:</p>
                  <ul className="list-disc list-inside">
                    {filters.status && <li>Status: {filters.status}</li>}
                    {filters.category && <li>Category: {filters.category}</li>}
                    {filters.urgency && <li>Urgency: {filters.urgency}</li>}
                    {filters.search && <li>Search: {filters.search}</li>}
                    {!filters.status && !filters.category && !filters.urgency && !filters.search && <li>No filters applied</li>}
                  </ul>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={savedViewForm.is_default}
                    onChange={(e) => setSavedViewForm({ ...savedViewForm, is_default: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Set as default view</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowSaveViewModal(false)
                    setSavedViewForm({ name: '', is_default: false })
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveView}
                  disabled={!savedViewForm.name.trim() || createSavedViewMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {createSavedViewMutation.isPending ? 'Saving...' : 'Save View'}
                </button>
              </div>
            </div>
          </div>
        )}

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
              {showPriorityQueue && (
                <div className="bg-primary-50 p-3 border-b flex items-center justify-between">
                  <span className="font-medium text-primary-700">Priority Queue (sorted by urgency)</span>
                  <button
                    onClick={() => refreshSlaMutation.mutate()}
                    disabled={refreshSlaMutation.isPending}
                    className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                  >
                    {refreshSlaMutation.isPending ? 'Refreshing...' : 'Refresh SLA'}
                  </button>
                </div>
              )}
              {ticketsLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : (showPriorityQueue ? priorityQueue : tickets).length === 0 ? (
                <div className="p-4 text-center text-gray-500">No tickets found</div>
              ) : (
                (showPriorityQueue ? priorityQueue : tickets).map((ticket) => (
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
                      {ticket.sla_breached && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          SLA Breached
                        </span>
                      )}
                      {!ticket.sla_breached && ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date(Date.now() + 2 * 60 * 60 * 1000) && !ticket.sent_at && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          At Risk
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

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Assigned to:</span>
                    </div>
                    <select
                      value={selectedTicket.assigned_to?.toString() || ''}
                      onChange={(e) => handleAssignTicket(e.target.value)}
                      disabled={assignTicketMutation.isPending}
                      className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Unassigned</option>
                      {activeTeamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                    {selectedTicket.assignee && (
                      <span className="text-xs text-gray-400">
                        Since {selectedTicket.assigned_at ? new Date(selectedTicket.assigned_at).toLocaleDateString() : ''}
                      </span>
                    )}
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

                {customerHistory.length > 0 && (
                  <div className="p-6 border-b bg-blue-50">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Customer History ({customerHistory.length} previous tickets)</h3>
                    </div>
                    <div className="space-y-2">
                      {customerHistory.map((historyTicket) => (
                        <div 
                          key={historyTicket.id} 
                          className="flex items-center justify-between bg-white p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSelectTicket(historyTicket)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">{historyTicket.subject}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(historyTicket.approval_status)}`}>
                                {historyTicket.approval_status}
                              </span>
                              {historyTicket.category && (
                                <span className="text-xs text-gray-500">{historyTicket.category}</span>
                              )}
                              <span className="text-xs text-gray-400">
                                {new Date(historyTicket.received_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
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

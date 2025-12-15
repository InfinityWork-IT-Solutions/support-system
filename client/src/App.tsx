/**
 * App.tsx - Main Application Component
 * =====================================
 * 
 * PURPOSE:
 * This is the main React component file for the AI Support Desk application.
 * It contains the App component (authentication router) and the Dashboard component
 * (main application interface).
 * 
 * FILE STRUCTURE (3200+ lines):
 * -----------------------------
 * Lines 1-50:     Imports (React, React Query, API client, icons, charts)
 * Lines 50-75:    App Component - Authentication state management
 * Lines 75-750:   Dashboard Component - State declarations and React Query hooks
 * Lines 750-1100: Dashboard - Mutation functions (API actions)
 * Lines 1100-1500: Dashboard - Helper functions and event handlers
 * Lines 1500-3200: Dashboard - JSX rendering (UI layout)
 * 
 * MAIN COMPONENTS:
 * ----------------
 * 1. App - Root component that handles authentication
 *    - Checks localStorage for auth_user to persist login
 *    - Renders Login component if not authenticated
 *    - Renders Dashboard if authenticated
 * 
 * 2. Dashboard - Main application interface with these sections:
 *    - Header: Logo, user info, navigation buttons
 *    - Left Panel: Ticket list with filters and search
 *    - Right Panel: Selected ticket details, AI summary, approval actions
 *    - Settings View: Email configuration, scheduler, integrations
 *    - Analytics View: Charts and performance metrics
 *    - Knowledge Base: Help articles management
 *    - Templates: Response template management
 *    - Priority Queue: SLA-sorted urgent tickets
 * 
 * STATE MANAGEMENT:
 * -----------------
 * - React Query (TanStack Query) for server state
 * - Local state (useState) for UI state like selected ticket, form values
 * - localStorage for authentication persistence
 * 
 * KEY FEATURES:
 * -------------
 * - Ticket Management: View, filter, approve/reject, send responses
 * - AI Processing: Automatic categorization, urgency detection, draft generation
 * - Bulk Actions: Approve/reject/send multiple tickets at once
 * - Team Assignment: Assign tickets to team members
 * - SLA Tracking: Monitor response time deadlines
 * - Analytics: Category and urgency charts, performance metrics
 * - Knowledge Base: Searchable solution articles
 * - Templates: Reusable response templates
 * - Settings: Email server configuration, notifications, scheduler
 * 
 * DATA FLOW:
 * ----------
 * 1. User actions trigger mutations (useMutation hooks)
 * 2. Mutations call API functions from api.ts
 * 3. On success, queries are invalidated (queryClient.invalidateQueries)
 * 4. React Query refetches stale data automatically
 * 5. Components re-render with fresh data
 * 
 * APPROVAL WORKFLOW:
 * ------------------
 * Critical design decision: No automated sending!
 * 1. Ticket arrives -> AI processes (adds category, urgency, draft)
 * 2. Human reviews AI draft in the right panel
 * 3. Human clicks Approve or Reject button
 * 4. If approved, human must click Send to actually email customer
 * 
 * TROUBLESHOOTING:
 * ----------------
 * - Tickets not loading: Check if Backend API workflow is running
 * - AI not processing: Verify OPENAI_API_KEY is set
 * - Email not sending: Check SMTP settings in Settings view
 * - Filters not working: Check React Query cache invalidation
 * - Slow performance: Check network tab for slow API calls
 * - Charts not showing: Ensure recharts is installed
 * 
 * STYLING:
 * --------
 * - Tailwind CSS for utility-first styling
 * - Enterprise design system with consistent colors:
 *   - Primary: Blue (#3b82f6)
 *   - Success: Green (#22c55e)  
 *   - Warning: Yellow (#eab308)
 *   - Danger: Red (#ef4444)
 * - Glass-morphism effects on cards and modals
 * 
 * ICONS:
 * ------
 * All icons from lucide-react library for consistency
 */

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

/**
 * App Component - Root authentication router
 * 
 * Manages authentication state using localStorage for persistence.
 * If user is authenticated, renders Dashboard; otherwise renders Login.
 * 
 * Authentication flow:
 * 1. On mount, checks localStorage for 'auth_user' key
 * 2. If found, user is considered logged in
 * 3. Login component calls handleLogin() after Google OAuth success
 * 4. handleLogout() clears localStorage and resets state
 */
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

/**
 * Dashboard Component - Main application interface
 * 
 * This is the primary component containing all ticket management functionality.
 * Uses React Query for data fetching and caching, with local state for UI controls.
 * 
 * Props:
 * - currentUser: Display name of logged-in user
 * - onLogout: Callback to trigger logout
 * 
 * Main sections rendered:
 * - Header bar with navigation
 * - Left panel with ticket list
 * - Right panel with ticket details
 * - Settings modal
 * - Analytics modal
 * - Knowledge base modal
 * - Templates modal
 */
function Dashboard({ currentUser, onLogout }: { currentUser: string; onLogout: () => void }) {
  const queryClient = useQueryClient()
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  
  // Get user position and organization from localStorage
  const userPosition = (() => {
    try {
      const user = localStorage.getItem('auth_user')
      return user ? JSON.parse(user).position : null
    } catch {
      return null
    }
  })()
  const userOrganization = (() => {
    try {
      const user = localStorage.getItem('auth_user')
      return user ? JSON.parse(user).organization : null
    } catch {
      return null
    }
  })()
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
  const [activeSettingsSection, setActiveSettingsSection] = useState<string>('imap')

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
      <div className="min-h-screen dashboard-bg">
        <header className="enterprise-header sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-400/30 blur-xl rounded-full"></div>
                  <div className="relative bg-gradient-to-br from-emerald-400 to-teal-500 p-2.5 rounded-xl shadow-lg">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Knowledge Base</h1>
                  <p className="text-sm text-emerald-300/80">Solution articles and help guides</p>
                </div>
              </div>
              <button
                onClick={() => setShowKnowledge(false)}
                className="enterprise-btn enterprise-btn-secondary"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="enterprise-card p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search knowledge base articles..."
                  value={knowledgeSearch}
                  onChange={(e) => setKnowledgeSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 enterprise-input"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>{knowledgeArticles.length} article{knowledgeArticles.length !== 1 ? 's' : ''} available</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="detail-section">
              <div className="detail-section-header">
                {editingArticleId ? <Edit2 className="w-5 h-5 text-emerald-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                <span>{editingArticleId ? 'Edit Article' : 'Create New Article'}</span>
              </div>
              <div className="detail-section-content">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Article Title</label>
                    <input
                      type="text"
                      value={knowledgeForm.title}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                      placeholder="e.g., How to Reset Password"
                      className="enterprise-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                    <select
                      value={knowledgeForm.category}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, category: e.target.value })}
                      className="enterprise-select"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Keywords</label>
                    <input
                      type="text"
                      value={knowledgeForm.keywords}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, keywords: e.target.value })}
                      placeholder="e.g., password, reset, login, forgot"
                      className="enterprise-input"
                    />
                    <p className="text-xs text-gray-500 mt-1">Separate keywords with commas for better search matching</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Content</label>
                    <textarea
                      value={knowledgeForm.content}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                      placeholder="Enter the article content with step-by-step instructions..."
                      className="enterprise-input h-48"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleSaveArticle}
                      disabled={!knowledgeForm.title || !knowledgeForm.content || createArticleMutation.isPending || updateArticleMutation.isPending}
                      className="enterprise-btn enterprise-btn-success"
                    >
                      <Save className="w-4 h-4" />
                      {editingArticleId ? 'Update Article' : 'Save Article'}
                    </button>
                    {editingArticleId && (
                      <button
                        onClick={handleCancelArticleEdit}
                        className="enterprise-btn enterprise-btn-secondary"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section-header">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <span>Articles Library</span>
                <span className="ml-auto text-xs text-gray-500 font-normal">{knowledgeArticles.length} article{knowledgeArticles.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="detail-section-content p-0">
                {knowledgeArticles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No articles yet</h3>
                    <p className="text-sm text-gray-500">Create your first knowledge base article to help resolve tickets faster.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto scrollbar-thin">
                    {knowledgeArticles.map((article) => (
                      <div key={article.id} className="p-4 hover:bg-gray-50 transition-colors group">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">{article.title}</h3>
                            <div className="flex items-center gap-2 mt-1.5">
                              {article.category && (
                                <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
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
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditArticle(article)}
                              className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Edit article"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteArticleMutation.mutate(article.id)}
                              disabled={deleteArticleMutation.isPending}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
      </div>
    )
  }

  if (showTemplates) {
    return (
      <div className="min-h-screen dashboard-bg">
        <header className="enterprise-header sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-violet-400/30 blur-xl rounded-full"></div>
                  <div className="relative bg-gradient-to-br from-violet-400 to-purple-500 p-2.5 rounded-xl shadow-lg">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Response Templates</h1>
                  <p className="text-sm text-violet-300/80">Manage reusable response templates</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="enterprise-btn enterprise-btn-secondary"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="enterprise-card p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4 text-violet-500" />
                <span>{templates.length} template{templates.length !== 1 ? 's' : ''} available</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="detail-section">
              <div className="detail-section-header">
                {editingTemplateId ? <Edit2 className="w-5 h-5 text-violet-600" /> : <Plus className="w-5 h-5 text-violet-600" />}
                {editingTemplateId ? 'Edit Template' : 'Create New Template'}
              </div>
              <div className="detail-section-content space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="e.g., Password Reset Response"
                    className="w-full enterprise-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full enterprise-input"
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
                    className="w-full h-48 enterprise-input resize-none"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!templateForm.name || !templateForm.content || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    className="enterprise-btn enterprise-btn-success disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {editingTemplateId ? 'Update Template' : 'Save Template'}
                  </button>
                  {editingTemplateId && (
                    <button
                      onClick={handleCancelEdit}
                      className="enterprise-btn enterprise-btn-secondary"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section-header">
                <FileText className="w-5 h-5 text-violet-600" />
                Existing Templates ({templates.length})
              </div>
              <div className="detail-section-content">
                {templates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="relative inline-block mb-4">
                      <div className="absolute inset-0 bg-violet-200/50 blur-xl rounded-full"></div>
                      <div className="relative bg-gradient-to-br from-violet-100 to-purple-50 p-4 rounded-2xl">
                        <FileText className="w-10 h-10 text-violet-400" />
                      </div>
                    </div>
                    <p className="text-gray-500 font-medium">No templates yet</p>
                    <p className="text-sm text-gray-400 mt-1">Create your first template to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {templates.map((template) => (
                      <div key={template.id} className="p-4 border border-gray-200 rounded-xl hover:border-violet-200 hover:bg-violet-50/30 transition-all group">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-gray-900">{template.name}</h3>
                            {template.category && (
                              <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full">
                                {template.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditTemplate(template)}
                              className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Edit template"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              disabled={deleteTemplateMutation.isPending}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
      </div>
    )
  }

  if (showAnalytics) {
    return (
      <div className="min-h-screen dashboard-bg">
        <header className="enterprise-header">
          <div className="max-w-6xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
                  <p className="text-sm text-slate-300">Ticket insights and performance metrics</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalytics(false)}
                className="enterprise-btn enterprise-btn-secondary"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-4 gap-5 mb-8">
            <div className="stat-card stat-card-cyan p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-100 to-blue-50 rounded-lg flex items-center justify-center">
                  <Inbox className="w-5 h-5 text-cyan-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Total Tickets</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{analytics?.total_tickets || 0}</div>
            </div>
            <div className="stat-card stat-card-green p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-green-50 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Approval Rate</span>
              </div>
              <div className="text-3xl font-bold text-emerald-600">{analytics?.approval_rate || 0}%</div>
            </div>
            <div className="stat-card stat-card-blue p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-50 rounded-lg flex items-center justify-center">
                  <Send className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Responses Sent</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">{analytics?.sent_count || 0}</div>
            </div>
            <div className="stat-card stat-card-purple p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-50 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-violet-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">AI Processed</span>
              </div>
              <div className="text-3xl font-bold text-violet-600">{analytics?.ai_processed_count || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="chart-container">
              <div className="chart-title">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-50 rounded-lg flex items-center justify-center">
                  <Hash className="w-4 h-4 text-blue-600" />
                </div>
                Tickets by Category
              </div>
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
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Hash className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No category data available</p>
                  </div>
                </div>
              )}
            </div>

            <div className="chart-container">
              <div className="chart-title">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-orange-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                Tickets by Urgency
              </div>
              {analytics?.by_urgency && analytics.by_urgency.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.by_urgency}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'white', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {analytics.by_urgency.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.name === 'High' ? '#ef4444' : entry.name === 'Medium' ? '#f59e0b' : '#10b981'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No urgency data available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 chart-container">
            <div className="flex items-center justify-between mb-6">
              <div className="chart-title mb-0">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-blue-50 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-cyan-600" />
                </div>
                Ticket Volume Trends (Last 30 Days)
              </div>
              {volumeTrends && (
                <div className="flex items-center gap-6">
                  <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm text-gray-500">Total: </span>
                    <span className="font-bold text-gray-900">{volumeTrends.total}</span>
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-gray-100">
                    <span className="text-sm text-gray-500">Daily Avg: </span>
                    <span className="font-bold text-gray-900">{volumeTrends.average}</span>
                  </div>
                </div>
              )}
            </div>
            {volumeTrends?.trends && volumeTrends.trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={volumeTrends.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value: string) => {
                      const [year, month, day] = value.split('-').map(Number);
                      return `${month}/${day}`;
                    }}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip 
                    labelFormatter={(value: string) => {
                      const [year, month, day] = value.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    }}
                    formatter={(value: number) => [value, 'Tickets']}
                    contentStyle={{ 
                      background: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="url(#colorGradient)" 
                    strokeWidth={3}
                    dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No trend data available</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 enterprise-card p-6">
            <div className="chart-title">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              Status Breakdown
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-green-100">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-emerald-600">{analytics?.approved_count || 0}</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Approved</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-100">
                <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-rose-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-red-600">{analytics?.rejected_count || 0}</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Rejected</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-blue-600">{analytics?.send_rate || 0}%</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Send Rate</div>
              </div>
            </div>
          </div>

          <div className="mt-6 enterprise-card p-6">
            <div className="chart-title">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-purple-50 rounded-lg flex items-center justify-center">
                <Timer className="w-4 h-4 text-violet-600" />
              </div>
              Response Time Metrics
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-violet-600">{performance?.avg_processing_time_hours || 0}h</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Avg. Processing Time</div>
                <div className="text-xs text-gray-400 mt-1">Time to AI process ticket</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-orange-600">{performance?.avg_approval_time_hours || 0}h</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Avg. Approval Time</div>
                <div className="text-xs text-gray-400 mt-1">Time to approve response</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border border-teal-100">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-teal-600">{performance?.avg_resolution_time_hours || 0}h</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Avg. Resolution Time</div>
                <div className="text-xs text-gray-400 mt-1">Time to send response</div>
              </div>
            </div>
          </div>

          <div className="mt-6 enterprise-card p-6">
            <div className="chart-title">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-blue-50 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-cyan-600" />
              </div>
              Today's Activity
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-5 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Inbox className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-700">{performance?.today_tickets || 0}</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Tickets Received</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-700">{performance?.today_processed || 0}</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Tickets Processed</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-700">{performance?.today_sent || 0}</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Responses Sent</div>
              </div>
            </div>
          </div>

          {performance?.by_approver && performance.by_approver.length > 0 && (
            <div className="mt-6 enterprise-card p-6">
              <div className="chart-title">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-violet-50 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                Agent Performance
              </div>
              <div className="space-y-3">
                {performance.by_approver.map((approver, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg flex items-center justify-center text-white font-bold">
                        {approver.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-800">{approver.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-indigo-600">{approver.count}</span>
                      <span className="text-sm text-gray-500">approved</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 enterprise-card p-6">
            <div className="chart-title">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-yellow-50 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              Customer Satisfaction
            </div>
            <div className="grid grid-cols-4 gap-5 mb-6">
              <div className="text-center p-5 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Star className="w-6 h-6 text-white fill-white" />
                </div>
                <div className="text-3xl font-bold text-amber-600">
                  {surveyStats?.average_rating ? surveyStats.average_rating.toFixed(1) : '0.0'}
                </div>
                <div className="text-sm font-medium text-gray-600 mt-1">Avg. Rating</div>
                <div className="flex items-center justify-center gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= (surveyStats?.average_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-blue-600">{surveyStats?.total_sent || 0}</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Surveys Sent</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-green-100">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-emerald-600">{surveyStats?.total_completed || 0}</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Responses</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-violet-600">{surveyStats?.response_rate || 0}%</div>
                <div className="text-sm font-medium text-gray-600 mt-1">Response Rate</div>
              </div>
            </div>
            {surveyStats?.rating_distribution && (
              <div className="p-5 bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Rating Distribution</h3>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = surveyStats.rating_distribution[String(rating)] || 0;
                    const total = surveyStats.total_completed || 1;
                    const percentage = Math.round((count / total) * 100);
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 w-16">
                          <span className="text-sm font-semibold text-gray-700">{rating}</span>
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </div>
                        <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-600 w-14 text-right">{count} ({percentage}%)</span>
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
    const settingsSections = [
      { id: 'imap', name: 'IMAP Settings', icon: Inbox, group: 'Email Infrastructure', description: 'Incoming email configuration' },
      { id: 'smtp', name: 'SMTP Settings', icon: Send, group: 'Email Infrastructure', description: 'Outgoing email configuration' },
      { id: 'scheduler', name: 'Auto-Fetch', icon: Clock, group: 'Automation', description: 'Scheduled email polling' },
      { id: 'autoresponder', name: 'Auto-Responder', icon: Mail, group: 'Automation', description: 'Automatic acknowledgments' },
      { id: 'email-notify', name: 'Email Alerts', icon: Bell, group: 'Notifications', description: 'Team email notifications' },
      { id: 'slack', name: 'Slack', icon: Hash, group: 'Notifications', description: 'Slack webhook integration' },
      { id: 'sla', name: 'SLA Settings', icon: Timer, group: 'Operations', description: 'Response time deadlines' },
      { id: 'team', name: 'Team Members', icon: Users, group: 'Operations', description: 'Manage support agents' },
    ]

    const groups = [
      { name: 'Email Infrastructure', icon: Mail },
      { name: 'Automation', icon: Zap },
      { name: 'Notifications', icon: Bell },
      { name: 'Operations', icon: Settings },
    ]

    return (
      <div className="min-h-screen dashboard-bg">
        <header className="enterprise-header sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/30 blur-xl rounded-full"></div>
                  <div className="relative bg-gradient-to-br from-cyan-400 to-blue-500 p-2.5 rounded-xl shadow-lg">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
                  <p className="text-sm text-cyan-300/80">Configure system preferences</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="enterprise-btn enterprise-btn-secondary"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {testResult && (
            <div className={`mb-6 p-4 rounded-xl flex items-center justify-between ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                  <strong>{testResult.type} Test:</strong> {testResult.message}
                </span>
              </div>
              <button onClick={() => setTestResult(null)} className="text-sm font-medium underline text-gray-600 hover:text-gray-800">Dismiss</button>
            </div>
          )}

          <div className="flex gap-6">
            <div className="w-72 flex-shrink-0">
              <div className="enterprise-card p-4 sticky top-28">
                <nav className="space-y-6">
                  {groups.map((group) => {
                    const GroupIcon = group.icon
                    const groupSections = settingsSections.filter(s => s.group === group.name)
                    return (
                      <div key={group.name}>
                        <div className="flex items-center gap-2 px-3 mb-2">
                          <GroupIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.name}</span>
                        </div>
                        <div className="space-y-1">
                          {groupSections.map((section) => {
                            const SectionIcon = section.icon
                            const isActive = activeSettingsSection === section.id
                            return (
                              <button
                                key={section.id}
                                onClick={() => setActiveSettingsSection(section.id)}
                                className={`w-full sidebar-item ${isActive ? 'active' : ''}`}
                              >
                                <SectionIcon className="w-5 h-5" />
                                <div className="text-left">
                                  <div className="text-sm font-medium">{section.name}</div>
                                  {!isActive && <div className="text-xs opacity-60">{section.description}</div>}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </nav>
              </div>
            </div>

            <div className="flex-1 space-y-6">
              {activeSettingsSection === 'imap' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Inbox className="w-5 h-5 text-cyan-600" />
                    <span>IMAP Settings</span>
                    <span className="text-xs text-gray-500 font-normal ml-auto">Incoming Email Configuration</span>
                  </div>
                  <div className="detail-section-content">
                    <p className="text-sm text-gray-600 mb-6">Configure the IMAP server connection to fetch incoming support emails. Use app-specific passwords for Gmail.</p>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">IMAP Host</label>
                        <input
                          type="text"
                          placeholder={currentSettings?.imap_host || "imap.gmail.com"}
                          value={settingsForm.imap_host ?? ''}
                          onChange={(e) => handleSettingsChange('imap_host', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">IMAP Port</label>
                        <input
                          type="text"
                          placeholder={currentSettings?.imap_port || "993"}
                          value={settingsForm.imap_port ?? ''}
                          onChange={(e) => handleSettingsChange('imap_port', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <input
                          type="text"
                          placeholder={currentSettings?.imap_username || "your-email@gmail.com"}
                          value={settingsForm.imap_username ?? ''}
                          onChange={(e) => handleSettingsChange('imap_username', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input
                          type="password"
                          placeholder="App password"
                          value={settingsForm.imap_password ?? ''}
                          onChange={(e) => handleSettingsChange('imap_password', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveSettings}
                        disabled={saveSettingsMutation.isPending || Object.keys(settingsForm).length === 0}
                        className="enterprise-btn enterprise-btn-primary"
                      >
                        <Save className="w-4 h-4" />
                        {saveSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => testImapMutation.mutate()}
                        disabled={testImapMutation.isPending}
                        className="enterprise-btn enterprise-btn-secondary"
                      >
                        <TestTube2 className="w-4 h-4" />
                        {testImapMutation.isPending ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'smtp' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Send className="w-5 h-5 text-blue-600" />
                    <span>SMTP Settings</span>
                    <span className="text-xs text-gray-500 font-normal ml-auto">Outgoing Email Configuration</span>
                  </div>
                  <div className="detail-section-content">
                    <p className="text-sm text-gray-600 mb-6">Configure the SMTP server to send email responses to customers. Make sure to use a valid sender email address.</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Host</label>
                        <input
                          type="text"
                          placeholder={currentSettings?.smtp_host || "smtp.gmail.com"}
                          value={settingsForm.smtp_host ?? ''}
                          onChange={(e) => handleSettingsChange('smtp_host', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Port</label>
                        <input
                          type="text"
                          placeholder={currentSettings?.smtp_port || "587"}
                          value={settingsForm.smtp_port ?? ''}
                          onChange={(e) => handleSettingsChange('smtp_port', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                        <input
                          type="text"
                          placeholder={currentSettings?.smtp_username || "your-email@gmail.com"}
                          value={settingsForm.smtp_username ?? ''}
                          onChange={(e) => handleSettingsChange('smtp_username', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input
                          type="password"
                          placeholder="App password"
                          value={settingsForm.smtp_password ?? ''}
                          onChange={(e) => handleSettingsChange('smtp_password', e.target.value)}
                          className="enterprise-input"
                        />
                      </div>
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">From Email Address</label>
                      <input
                        type="text"
                        placeholder={currentSettings?.smtp_from_email || "support@infinityworkitsolutions.com"}
                        value={settingsForm.smtp_from_email ?? ''}
                        onChange={(e) => handleSettingsChange('smtp_from_email', e.target.value)}
                        className="enterprise-input"
                      />
                      <p className="text-xs text-gray-500 mt-2">This email will appear as the sender for all outgoing responses.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveSettings}
                        disabled={saveSettingsMutation.isPending || Object.keys(settingsForm).length === 0}
                        className="enterprise-btn enterprise-btn-primary"
                      >
                        <Save className="w-4 h-4" />
                        {saveSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => testSmtpMutation.mutate()}
                        disabled={testSmtpMutation.isPending}
                        className="enterprise-btn enterprise-btn-secondary"
                      >
                        <TestTube2 className="w-4 h-4" />
                        {testSmtpMutation.isPending ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'scheduler' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Clock className="w-5 h-5 text-cyan-600" />
                    <span>Auto-Fetch Scheduler</span>
                    {schedulerStatus?.running && (
                      <span className="ml-auto flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Running
                      </span>
                    )}
                  </div>
                  <div className="detail-section-content">
                    <p className="text-sm text-gray-600 mb-6">
                      Automatically fetch new emails at regular intervals. When enabled, the system will check for new emails periodically without manual intervention.
                    </p>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="enterprise-card p-5">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Scheduler Status</label>
                        <button
                          onClick={() => updateSchedulerMutation.mutate({ 
                            enabled: !schedulerStatus?.enabled, 
                            interval: schedulerStatus?.interval_minutes || 5 
                          })}
                          disabled={updateSchedulerMutation.isPending}
                          className={`w-full enterprise-btn ${
                            schedulerStatus?.enabled 
                              ? 'enterprise-btn-danger' 
                              : 'enterprise-btn-success'
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
                      <div className="enterprise-card p-5">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Check Interval</label>
                        <select
                          value={schedulerStatus?.interval_minutes || 5}
                          onChange={(e) => {
                            const newInterval = parseInt(e.target.value)
                            updateSchedulerMutation.mutate({ 
                              enabled: schedulerStatus?.enabled || false, 
                              interval: newInterval 
                            })
                          }}
                          className="enterprise-select"
                        >
                          <option value={1}>Every 1 minute</option>
                          <option value={2}>Every 2 minutes</option>
                          <option value={5}>Every 5 minutes</option>
                          <option value={10}>Every 10 minutes</option>
                          <option value={15}>Every 15 minutes</option>
                          <option value={30}>Every 30 minutes</option>
                          <option value={60}>Every 60 minutes</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <RefreshCw className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Current Configuration</div>
                        <div className="text-xs text-gray-500">
                          Status: <span className={schedulerStatus?.enabled ? 'text-green-600 font-medium' : 'text-gray-600'}>{schedulerStatus?.enabled ? 'Enabled' : 'Disabled'}</span> | 
                          Interval: Every {schedulerStatus?.interval_minutes || 5} minutes
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'autoresponder' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <span>Auto-Responder</span>
                    {autoResponderSettings?.enabled && (
                      <span className="ml-auto flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Active
                      </span>
                    )}
                  </div>
                  <div className="detail-section-content">
                    <p className="text-sm text-gray-600 mb-6">
                      Automatically send acknowledgment emails when new tickets are received. This helps customers know their request has been logged.
                    </p>
                    <div className="mb-6">
                      <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={autoResponderForm.enabled}
                          onChange={(e) => setAutoResponderForm({ ...autoResponderForm, enabled: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Enable auto-responder for new tickets</span>
                          <p className="text-xs text-gray-500 mt-0.5">Customers will receive an automatic acknowledgment email</p>
                        </div>
                      </label>
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Response Template</label>
                      <p className="text-xs text-gray-500 mb-3">
                        Use <code className="bg-gray-100 px-1.5 py-0.5 rounded text-cyan-600">{'{ticket_id}'}</code> for ticket number and <code className="bg-gray-100 px-1.5 py-0.5 rounded text-cyan-600">{'{subject}'}</code> for the original subject line.
                      </p>
                      <textarea
                        value={autoResponderForm.template}
                        onChange={(e) => setAutoResponderForm({ ...autoResponderForm, template: e.target.value })}
                        className="enterprise-input h-48 font-mono text-sm"
                        placeholder="Dear Customer,&#10;&#10;Thank you for contacting InfinityWork IT Solutions...&#10;&#10;Your ticket #{ticket_id} has been received..."
                      />
                    </div>
                    <button
                      onClick={() => updateAutoResponderMutation.mutate({
                        enabled: autoResponderForm.enabled,
                        template: autoResponderForm.template
                      })}
                      disabled={updateAutoResponderMutation.isPending}
                      className="enterprise-btn enterprise-btn-primary"
                    >
                      <Save className="w-4 h-4" />
                      {updateAutoResponderMutation.isPending ? 'Saving...' : 'Save Auto-Responder Settings'}
                    </button>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'email-notify' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Bell className="w-5 h-5 text-orange-600" />
                    <span>Email Notifications</span>
                    {emailNotificationSettings?.enabled && (
                      <span className="ml-auto flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Active
                      </span>
                    )}
                  </div>
                  <div className="detail-section-content">
                    <p className="text-sm text-gray-600 mb-6">
                      Send email alerts to team members when urgent tickets are received or SLA deadlines are breached.
                    </p>
                    <div className="space-y-4 mb-6">
                      <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={emailNotificationForm.enabled}
                          onChange={(e) => setEmailNotificationForm({ ...emailNotificationForm, enabled: e.target.checked })}
                          className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Enable email notifications</span>
                          <p className="text-xs text-gray-500 mt-0.5">Team members will receive email alerts</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={emailNotificationForm.urgent_only}
                          onChange={(e) => setEmailNotificationForm({ ...emailNotificationForm, urgent_only: e.target.checked })}
                          className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Only notify for urgent tickets</span>
                          <p className="text-xs text-gray-500 mt-0.5">Reduce noise by only alerting on high-priority issues</p>
                        </div>
                      </label>
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Recipients</label>
                      <select
                        value={emailNotificationForm.recipients}
                        onChange={(e) => setEmailNotificationForm({ ...emailNotificationForm, recipients: e.target.value })}
                        className="enterprise-select"
                      >
                        <option value="all">All active team members</option>
                        <option value="none">No recipients (disabled)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        Notifications will be sent to all active team members' email addresses.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateEmailNotificationMutation.mutate({
                          enabled: emailNotificationForm.enabled,
                          urgent_only: emailNotificationForm.urgent_only,
                          recipients: emailNotificationForm.recipients
                        })}
                        disabled={updateEmailNotificationMutation.isPending}
                        className="enterprise-btn enterprise-btn-primary"
                      >
                        <Save className="w-4 h-4" />
                        {updateEmailNotificationMutation.isPending ? 'Saving...' : 'Save Email Settings'}
                      </button>
                      <button
                        onClick={() => testEmailNotificationMutation.mutate()}
                        disabled={testEmailNotificationMutation.isPending || !emailNotificationSettings?.enabled}
                        className="enterprise-btn enterprise-btn-secondary"
                      >
                        <TestTube2 className="w-4 h-4" />
                        {testEmailNotificationMutation.isPending ? 'Testing...' : 'Send Test Email'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'slack' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Hash className="w-5 h-5 text-purple-600" />
                    <span>Slack Notifications</span>
                    {slackSettings?.configured && (
                      <span className="ml-auto flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Connected
                      </span>
                    )}
                  </div>
                  <div className="detail-section-content">
                    <p className="text-sm text-gray-600 mb-6">
                      Receive instant notifications in Slack when new tickets arrive, urgent issues are detected, or tickets are processed by AI.
                    </p>
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Webhook URL</label>
                      <input
                        type="password"
                        placeholder={slackSettings?.configured ? '••••••••••••••••' : 'https://hooks.slack.com/services/...'}
                        value={slackForm.webhook_url}
                        onChange={(e) => setSlackForm({ ...slackForm, webhook_url: e.target.value })}
                        className="enterprise-input"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Create a webhook in your Slack workspace and paste the URL here.
                      </p>
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Notification Triggers</label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={slackForm.notify_on_new}
                            onChange={(e) => setSlackForm({ ...slackForm, notify_on_new: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">Notify on new tickets</span>
                            <p className="text-xs text-gray-500">Get notified when a new support ticket arrives</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={slackForm.notify_on_urgent}
                            onChange={(e) => setSlackForm({ ...slackForm, notify_on_urgent: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">Notify on urgent tickets</span>
                            <p className="text-xs text-gray-500">Get alerts for high-priority issues that need immediate attention</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={slackForm.notify_on_process}
                            onChange={(e) => setSlackForm({ ...slackForm, notify_on_process: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">Notify when AI processes tickets</span>
                            <p className="text-xs text-gray-500">Get updates when tickets are analyzed and categorized</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateSlackMutation.mutate({
                          webhook_url: slackForm.webhook_url,
                          notify_on_new: slackForm.notify_on_new,
                          notify_on_urgent: slackForm.notify_on_urgent,
                          notify_on_process: slackForm.notify_on_process
                        })}
                        disabled={updateSlackMutation.isPending}
                        className="enterprise-btn enterprise-btn-primary"
                      >
                        <Save className="w-4 h-4" />
                        {updateSlackMutation.isPending ? 'Saving...' : 'Save Slack Settings'}
                      </button>
                      <button
                        onClick={() => testSlackMutation.mutate()}
                        disabled={testSlackMutation.isPending || !slackSettings?.configured}
                        className="enterprise-btn enterprise-btn-secondary"
                      >
                        <TestTube2 className="w-4 h-4" />
                        {testSlackMutation.isPending ? 'Testing...' : 'Send Test Message'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'sla' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Timer className="w-5 h-5 text-orange-600" />
                    <span>SLA Settings</span>
                    <span className="text-xs text-gray-500 font-normal ml-auto">Service Level Agreement Configuration</span>
                  </div>
                  <div className="detail-section-content">
                    <p className="text-sm text-gray-600 mb-6">
                      Configure response time deadlines for different ticket urgency levels. Tickets exceeding these times will be marked as SLA breached and highlighted in the priority queue.
                    </p>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="enterprise-card p-5 border-l-4 border-red-500">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            High Urgency
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="72"
                            value={slaSettingsForm.high_hours}
                            onChange={(e) => setSlaSettingsForm({ ...slaSettingsForm, high_hours: parseInt(e.target.value) || 4 })}
                            className="enterprise-input"
                          />
                          <span className="text-sm text-gray-500">hours</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Default: 4 hours</p>
                      </div>
                      <div className="enterprise-card p-5 border-l-4 border-amber-500">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            Medium Urgency
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="72"
                            value={slaSettingsForm.medium_hours}
                            onChange={(e) => setSlaSettingsForm({ ...slaSettingsForm, medium_hours: parseInt(e.target.value) || 8 })}
                            className="enterprise-input"
                          />
                          <span className="text-sm text-gray-500">hours</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Default: 8 hours</p>
                      </div>
                      <div className="enterprise-card p-5 border-l-4 border-green-500">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <span className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-green-500" />
                            Low Urgency
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="72"
                            value={slaSettingsForm.low_hours}
                            onChange={(e) => setSlaSettingsForm({ ...slaSettingsForm, low_hours: parseInt(e.target.value) || 24 })}
                            className="enterprise-input"
                          />
                          <span className="text-sm text-gray-500">hours</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Default: 24 hours</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateSlaMutation.mutate(slaSettingsForm)}
                      disabled={updateSlaMutation.isPending}
                      className="enterprise-btn enterprise-btn-primary"
                    >
                      <Save className="w-4 h-4" />
                      {updateSlaMutation.isPending ? 'Saving...' : 'Save SLA Settings'}
                    </button>
                  </div>
                </div>
              )}

              {activeSettingsSection === 'team' && (
                <div className="detail-section animate-fade-in">
                  <div className="detail-section-header">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <span>Team Members</span>
                    <span className="text-xs text-gray-500 font-normal ml-auto">{teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="detail-section-content">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-6 border border-indigo-100">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <UserPlus className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-indigo-900">How to Add Users</h4>
                          <p className="text-xs text-indigo-700 mt-1">
                            Fill in the form below to add new team members. They will be able to receive ticket assignments and email notifications. 
                            Use the role field to designate permissions: <strong>Agent</strong> for standard support, <strong>Supervisor</strong> for team leads, or <strong>Admin</strong> for full access.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="enterprise-card p-5">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          {editingMemberId ? <Edit2 className="w-4 h-4 text-indigo-600" /> : <UserPlus className="w-4 h-4 text-indigo-600" />}
                          {editingMemberId ? 'Edit Team Member' : 'Add New Team Member'}
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                            <input
                              type="text"
                              value={teamMemberForm.name}
                              onChange={(e) => setTeamMemberForm({ ...teamMemberForm, name: e.target.value })}
                              placeholder="e.g., John Smith"
                              className="enterprise-input"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                            <input
                              type="email"
                              value={teamMemberForm.email}
                              onChange={(e) => setTeamMemberForm({ ...teamMemberForm, email: e.target.value })}
                              placeholder="e.g., john@infinitywork.com"
                              className="enterprise-input"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                            <select
                              value={teamMemberForm.role}
                              onChange={(e) => setTeamMemberForm({ ...teamMemberForm, role: e.target.value })}
                              className="enterprise-select"
                            >
                              <option value="agent">Agent - Handle support tickets</option>
                              <option value="supervisor">Supervisor - Team management</option>
                              <option value="admin">Admin - Full system access</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={handleSaveTeamMember}
                              disabled={!teamMemberForm.name || !teamMemberForm.email || createTeamMemberMutation.isPending || updateTeamMemberMutation.isPending}
                              className="enterprise-btn enterprise-btn-primary flex-1"
                            >
                              <UserPlus className="w-4 h-4" />
                              {editingMemberId ? 'Update Member' : 'Add Member'}
                            </button>
                            {editingMemberId && (
                              <button
                                onClick={handleCancelMemberEdit}
                                className="enterprise-btn enterprise-btn-secondary"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          Current Team ({teamMembers.length})
                        </h3>
                        {teamMembers.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">No team members added yet.</p>
                            <p className="text-xs text-gray-400 mt-1">Add your first team member using the form.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                            {teamMembers.map((member) => (
                              <div key={member.id} className={`enterprise-card p-4 flex items-center justify-between ${!member.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                                    member.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' :
                                    member.role === 'supervisor' ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
                                    'bg-gradient-to-br from-gray-400 to-gray-500'
                                  }`}>
                                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm text-gray-900">{member.name}</div>
                                    <div className="text-xs text-gray-500">{member.email}</div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                      member.role === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>{member.role}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditTeamMember(member)}
                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => updateTeamMemberMutation.mutate({ id: member.id, data: { is_active: !member.is_active } })}
                                    className={`p-2 rounded-lg transition-colors ${member.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                                    title={member.is_active ? 'Deactivate' : 'Activate'}
                                  >
                                    {member.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => deleteTeamMemberMutation.mutate(member.id)}
                                    disabled={deleteTeamMemberMutation.isPending}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                </div>
              )}
            </div>
          </div>
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
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">{currentUser}</span>
                    {(userPosition || userOrganization) && (
                      <span className="text-xs text-white/60">
                        {userPosition}{userPosition && userOrganization && ' - '}{userOrganization}
                      </span>
                    )}
                  </div>
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
            <div className="enterprise-card p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-50 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{slaSummary.on_track}</div>
                  <div className="text-sm font-medium text-gray-500">On Track</div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
            </div>
            <div className="enterprise-card p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-yellow-50 rounded-xl flex items-center justify-center">
                  <Timer className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{slaSummary.at_risk}</div>
                  <div className="text-sm font-medium text-gray-500">At Risk (&lt;2h)</div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500"></div>
            </div>
            <div className="enterprise-card p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-rose-50 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{slaSummary.breached}</div>
                  <div className="text-sm font-medium text-gray-500">SLA Breached</div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-rose-500"></div>
            </div>
            <div className="enterprise-card p-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-gray-50 rounded-xl flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{slaSummary.total_active}</div>
                    <div className="text-xs font-medium text-gray-500">Active Tickets</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPriorityQueue(!showPriorityQueue)
                    setSelectedTicketId(null)
                  }}
                  className={`enterprise-btn text-sm ${showPriorityQueue ? 'enterprise-btn-primary' : 'enterprise-btn-secondary'}`}
                >
                  Priority Queue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="enterprise-card mb-5 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-blue-50 rounded-lg flex items-center justify-center">
                <Filter className="w-4 h-4 text-cyan-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Quick Filters</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {quickFilters.map((qf) => (
                <button
                  key={qf.id}
                  onClick={() => applyQuickFilter(qf)}
                  className={`quick-filter-btn ${activeQuickFilter === qf.id ? 'active' : ''}`}
                >
                  {qf.name}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-gray-200 mx-3"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-purple-50 rounded-lg flex items-center justify-center">
                <Bookmark className="w-4 h-4 text-violet-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Saved Views</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {savedViews.map((sv) => (
                <div key={sv.id} className="flex items-center gap-1">
                  <button
                    onClick={() => applySavedView(sv)}
                    className={`quick-filter-btn ${activeSavedView === sv.id ? 'active' : ''}`}
                  >
                    {sv.name}
                  </button>
                  <button
                    onClick={() => deleteSavedViewMutation.mutate(sv.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Delete view"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowSaveViewModal(true)}
                className="quick-filter-btn flex items-center gap-1"
                title="Save current filters as view"
              >
                <Plus className="w-3 h-3" />
                Save View
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or subject..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="enterprise-input pl-11"
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="enterprise-select w-auto"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="enterprise-select w-auto"
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
              className="enterprise-select w-auto"
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
          <div className="col-span-1 enterprise-card overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1.5 hover:bg-white rounded-lg transition-colors"
                    title={selectedTicketIds.size === tickets.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedTicketIds.size === tickets.length && tickets.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-cyan-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div>
                    <h2 className="font-semibold text-gray-900">Tickets</h2>
                    <span className="text-xs text-gray-500">{tickets.length} total</span>
                  </div>
                </div>
                {selectedTicketIds.size > 0 && (
                  <span className="px-2 py-1 text-xs font-semibold text-cyan-700 bg-cyan-100 rounded-full">{selectedTicketIds.size} selected</span>
                )}
              </div>
              {selectedTicketIds.size > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                  {getSelectedPendingIds().length > 0 && (
                    <>
                      <button
                        onClick={() => bulkApproveMutation.mutate(getSelectedPendingIds())}
                        disabled={bulkApproveMutation.isPending}
                        className="enterprise-btn enterprise-btn-success text-xs py-1.5 px-3"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve ({getSelectedPendingIds().length})
                      </button>
                      <button
                        onClick={() => bulkRejectMutation.mutate(getSelectedPendingIds())}
                        disabled={bulkRejectMutation.isPending}
                        className="enterprise-btn enterprise-btn-danger text-xs py-1.5 px-3"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject ({getSelectedPendingIds().length})
                      </button>
                    </>
                  )}
                  {getSelectedApprovedIds().length > 0 && (
                    <button
                      onClick={() => bulkSendMutation.mutate(getSelectedApprovedIds())}
                      disabled={bulkSendMutation.isPending}
                      className="enterprise-btn enterprise-btn-primary text-xs py-1.5 px-3"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send ({getSelectedApprovedIds().length})
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
              {showPriorityQueue && (
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-600" />
                    <span className="font-medium text-cyan-800">Priority Queue</span>
                  </div>
                  <button
                    onClick={() => refreshSlaMutation.mutate()}
                    disabled={refreshSlaMutation.isPending}
                    className="enterprise-btn enterprise-btn-secondary text-xs py-1 px-3"
                  >
                    {refreshSlaMutation.isPending ? 'Refreshing...' : 'Refresh SLA'}
                  </button>
                </div>
              )}
              {ticketsLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-3 animate-spin" />
                  <p className="text-gray-500">Loading tickets...</p>
                </div>
              ) : (showPriorityQueue ? priorityQueue : tickets).length === 0 ? (
                <div className="p-8 text-center">
                  <Inbox className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No tickets found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                (showPriorityQueue ? priorityQueue : tickets).map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`ticket-item mx-3 my-2 ${selectedTicketId === ticket.id ? 'selected' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => toggleTicketSelection(ticket.id, e)}
                          className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0 transition-colors"
                        >
                          {selectedTicketIds.has(ticket.id) ? (
                            <CheckSquare className="w-4 h-4 text-cyan-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-slate-100 to-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {ticket.sender_email}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-colors ${selectedTicketId === ticket.id ? 'text-cyan-500' : 'text-gray-300'}`} />
                    </div>
                    <div className="text-sm text-gray-700 truncate mb-3 pl-7 font-medium">{ticket.subject}</div>
                    <div className="flex items-center gap-2 flex-wrap pl-7">
                      <span className={`status-badge status-${ticket.approval_status.toLowerCase()}`}>
                        {ticket.approval_status}
                      </span>
                      {ticket.urgency && (
                        <span className={`urgency-badge urgency-${ticket.urgency.toLowerCase()}`}>
                          {ticket.urgency}
                        </span>
                      )}
                      {ticket.sla_breached && (
                        <span className="sla-indicator sla-breach text-xs py-0.5 px-2">
                          <AlertTriangle className="w-3 h-3" />
                          Breached
                        </span>
                      )}
                      {!ticket.sla_breached && ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date(Date.now() + 2 * 60 * 60 * 1000) && !ticket.sent_at && (
                        <span className="sla-indicator sla-warning text-xs py-0.5 px-2">
                          <Timer className="w-3 h-3" />
                          At Risk
                        </span>
                      )}
                      {ticket.category && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">
                          {ticket.category}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-3 pl-7 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(ticket.received_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="col-span-2 enterprise-card overflow-hidden">
            {!selectedTicketId ? (
              <div className="flex items-center justify-center h-[600px]">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-gray-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <MessageSquare className="w-10 h-10 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">Select a ticket to view details</p>
                  <p className="text-gray-400 text-sm mt-1">Click on a ticket from the list</p>
                </div>
              </div>
            ) : ticketLoading ? (
              <div className="flex items-center justify-center h-[600px]">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
              </div>
            ) : selectedTicket ? (
              <div className="h-[600px] overflow-y-auto scrollbar-thin">
                <div className="p-6 border-b bg-gradient-to-r from-slate-50 to-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Mail className="w-6 h-6 text-cyan-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedTicket.subject}</h2>
                        <p className="text-sm text-gray-500 mt-1">From: <span className="font-medium text-gray-700">{selectedTicket.sender_email}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-badge status-${selectedTicket.approval_status.toLowerCase()}`}>
                        {selectedTicket.approval_status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-purple-50 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-violet-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-600">Assigned to:</span>
                    </div>
                    <select
                      value={selectedTicket.assigned_to?.toString() || ''}
                      onChange={(e) => handleAssignTicket(e.target.value)}
                      disabled={assignTicketMutation.isPending}
                      className="enterprise-select w-auto text-sm py-1.5"
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
                  <div className="m-6 detail-section">
                    <div className="detail-section-header">
                      <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-blue-50 rounded-lg flex items-center justify-center">
                        <Zap className="w-4 h-4 text-cyan-600" />
                      </div>
                      AI Summary
                    </div>
                    <div className="detail-section-content">
                      <p className="text-gray-700 leading-relaxed">{selectedTicket.summary}</p>
                    </div>
                  </div>
                )}

                {knowledgeSuggestions.length > 0 && (
                  <div className="mx-6 mb-6 detail-section" style={{ background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)' }}>
                    <div className="detail-section-header" style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)' }}>
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-200 to-yellow-100 rounded-lg flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-amber-600" />
                      </div>
                      Suggested Knowledge Articles
                    </div>
                    <div className="detail-section-content space-y-2">
                      {knowledgeSuggestions.map((article) => (
                        <div key={article.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-amber-100 hover:border-amber-200 transition-all">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-900 truncate">{article.title}</div>
                            {article.category && (
                              <span className="text-xs text-amber-600 font-medium">{article.category}</span>
                            )}
                          </div>
                          <button
                            onClick={() => applyArticleToResponse(article)}
                            className="ml-3 enterprise-btn enterprise-btn-primary text-xs py-2 px-3"
                          >
                            Use Article
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mx-6 mb-6 detail-section">
                  <div className="detail-section-header">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-violet-50 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                    </div>
                    Conversation
                  </div>
                  <div className="detail-section-content space-y-4">
                    {selectedTicket.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-xl border transition-all ${
                          msg.is_incoming 
                            ? 'bg-gradient-to-br from-slate-50 to-gray-50 border-gray-200' 
                            : 'bg-gradient-to-br from-emerald-50 to-green-50 border-green-200 ml-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              msg.is_incoming 
                                ? 'bg-gradient-to-br from-slate-200 to-gray-100' 
                                : 'bg-gradient-to-br from-emerald-200 to-green-100'
                            }`}>
                              <User className={`w-4 h-4 ${msg.is_incoming ? 'text-slate-600' : 'text-emerald-600'}`} />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {msg.is_incoming ? msg.sender_email : 'InfinityWork Support'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pl-10">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTicket.fix_steps && (
                  <div className="mx-6 mb-6 detail-section">
                    <div className="detail-section-header">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-amber-50 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-orange-600" />
                      </div>
                      Troubleshooting Steps
                    </div>
                    <div className="detail-section-content">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-br from-slate-50 to-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
                        {selectedTicket.fix_steps}
                      </pre>
                    </div>
                  </div>
                )}

                {customerHistory.length > 0 && (
                  <div className="mx-6 mb-6 detail-section" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
                    <div className="detail-section-header" style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' }}>
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-200 to-sky-100 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      Customer History
                      <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-semibold">
                        {customerHistory.length}
                      </span>
                    </div>
                    <div className="detail-section-content space-y-3">
                      {customerHistory.map((historyTicket) => (
                        <div 
                          key={historyTicket.id} 
                          className="flex items-center justify-between bg-white p-4 rounded-xl border border-blue-100 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
                          onClick={() => handleSelectTicket(historyTicket)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">{historyTicket.subject}</div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`status-badge status-${historyTicket.approval_status.toLowerCase()}`}>
                                {historyTicket.approval_status}
                              </span>
                              {historyTicket.category && (
                                <span className="text-xs text-blue-600 font-medium">{historyTicket.category}</span>
                              )}
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(historyTicket.received_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTicket.ai_processed && (
                  <div className="mx-6 mb-6 detail-section">
                    <div className="detail-section-header justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-purple-50 rounded-lg flex items-center justify-center">
                          <Edit2 className="w-4 h-4 text-violet-600" />
                        </div>
                        Draft Response
                      </div>
                      {templates.length > 0 && (
                        <select
                          onChange={(e) => {
                            const template = templates.find(t => t.id === parseInt(e.target.value))
                            if (template) applyTemplate(template)
                            e.target.value = ''
                          }}
                          className="enterprise-select w-auto text-sm py-2"
                          defaultValue=""
                        >
                          <option value="" disabled>Use Template...</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="detail-section-content">
                      <textarea
                        value={editedDraft || selectedTicket.draft_response || ''}
                        onChange={(e) => setEditedDraft(e.target.value)}
                        className="enterprise-input h-40 resize-none font-mono text-sm"
                        placeholder="Draft your response here..."
                      />
                      {editedDraft !== selectedTicket.draft_response && (
                        <button
                          onClick={() => updateDraftMutation.mutate({ id: selectedTicket.id, draft: editedDraft })}
                          disabled={updateDraftMutation.isPending}
                          className="mt-3 enterprise-btn enterprise-btn-secondary"
                        >
                          <Save className="w-4 h-4" />
                          Save Changes
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-6 bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    {selectedTicket.approval_status === 'PENDING' && selectedTicket.ai_processed && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(selectedTicket.id)}
                          disabled={approveMutation.isPending}
                          className="enterprise-btn enterprise-btn-success"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {approveMutation.isPending ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(selectedTicket.id)}
                          disabled={rejectMutation.isPending}
                          className="enterprise-btn enterprise-btn-danger"
                        >
                          <XCircle className="w-4 h-4" />
                          {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                        </button>
                      </>
                    )}
                    {selectedTicket.approval_status === 'APPROVED' && !selectedTicket.sent_at && (
                      <button
                        onClick={() => sendMutation.mutate(selectedTicket.id)}
                        disabled={sendMutation.isPending}
                        className="enterprise-btn enterprise-btn-primary"
                      >
                        <Send className="w-4 h-4" />
                        {sendMutation.isPending ? 'Sending...' : 'Send Response'}
                      </button>
                    )}
                    {selectedTicket.sent_at && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-green-200">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-green-700">Response Sent</div>
                          <div className="text-sm text-green-600">{new Date(selectedTicket.sent_at).toLocaleString()}</div>
                        </div>
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

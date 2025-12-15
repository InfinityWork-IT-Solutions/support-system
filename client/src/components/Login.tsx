import { useState, useEffect } from 'react'
import { LogIn, Lock, User, Loader2 } from 'lucide-react'
import companyLogo from '../assets/company-logo.png'
import aiBgImage from '@assets/image_1765797199880.png'

interface LoginProps {
  onLogin: (username: string) => void
}

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"></div>
      
      <div 
        className="absolute inset-0 animate-bg-zoom"
        style={{
          backgroundImage: `url(${aiBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.6,
        }}
      />
      
      <div 
        className="absolute inset-0 animate-bg-pan"
        style={{
          backgroundImage: `url(${aiBgImage})`,
          backgroundSize: '120%',
          backgroundPosition: 'center',
          opacity: 0.3,
          mixBlendMode: 'screen',
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/80"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-slate-950/60"></div>
      
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-cyan-400/30 animate-particle"
          style={{
            width: `${Math.random() * 6 + 3}px`,
            height: `${Math.random() * 6 + 3}px`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${Math.random() * 10 + 15}s`,
          }}
        />
      ))}
      
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, rgba(6, 182, 212, 0.1) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      
      <div className="absolute inset-0 animate-scanline opacity-10"></div>
    </div>
  )
}

export default function Login({ onLogin }: LoginProps) {
  const [showSplash, setShowSplash] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [logoLoaded, setLogoLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('auth_user', JSON.stringify(data.user))
        onLogin(data.user.name)
      } else {
        setError(data.detail || 'Invalid username or password')
      }
    } catch (err) {
      setError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (showSplash) {
    return (
      <div className="min-h-screen login-bg flex items-center justify-center relative overflow-hidden">
        <AnimatedBackground />
        
        <div className="text-center animate-fade-in relative z-10">
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-3xl bg-cyan-500/30 rounded-full animate-pulse-glow scale-150"></div>
            <div className="absolute -inset-8 border border-cyan-400/20 rounded-full animate-orbit opacity-50" style={{ animationDuration: '10s' }}></div>
            <div className="absolute -inset-16 border border-blue-400/10 rounded-full animate-orbit opacity-30" style={{ animationDuration: '15s', animationDirection: 'reverse' }}></div>
            <img 
              src={companyLogo} 
              alt="InfinityWork IT Solutions" 
              className={`w-80 h-80 object-contain relative z-10 transition-all duration-700 ${logoLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
              onLoad={() => setLogoLoaded(true)}
            />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 animate-slide-up text-glow tracking-tight">
            AI Support Desk
          </h1>
          <p className="text-cyan-400 text-xl animate-slide-up-delay font-light">
            InfinityWork IT Solutions (Pty) Ltd
          </p>
          <div className="mt-10 flex justify-center">
            <div className="flex space-x-3">
              <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-bounce shadow-lg shadow-cyan-400/50" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-bounce shadow-lg shadow-cyan-400/50" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-bounce shadow-lg shadow-cyan-400/50" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen login-bg flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 blur-2xl bg-cyan-500/20 rounded-full animate-pulse-glow"></div>
            <img 
              src={companyLogo} 
              alt="InfinityWork IT Solutions" 
              className="w-36 h-36 object-contain mx-auto mb-4 relative z-10 drop-shadow-2xl"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 text-glow tracking-tight">AI Support Desk</h1>
          <p className="text-cyan-400 text-sm font-light">InfinityWork IT Solutions (Pty) Ltd</p>
        </div>

        <div className="glass-card rounded-3xl p-8 glow-blue animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-2xl font-semibold text-white text-center mb-8">
            Welcome Back
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-cyan-400 group-focus-within:text-cyan-300 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 input-glow transition-all duration-300"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-cyan-400 group-focus-within:text-cyan-300 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 input-glow transition-all duration-300"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm text-center backdrop-blur-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-500 hover:from-cyan-400 hover:via-cyan-300 hover:to-blue-400 text-white font-semibold rounded-xl btn-glow transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-center text-gray-400 text-sm mb-4">Or sign in with your organization</div>
            <button
              type="button"
              onClick={() => window.location.href = '/api/auth/google/login'}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-center text-gray-500 text-xs">
              Admin access: <span className="text-cyan-400/70">admin</span> / <span className="text-cyan-400/70">admin123</span>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-gray-500 text-xs">
          &copy; {new Date().getFullYear()} InfinityWork IT Solutions (Pty) Ltd. All rights reserved.
        </p>
      </div>
    </div>
  )
}

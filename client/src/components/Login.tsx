import { useState, useEffect } from 'react'
import { LogIn, Lock, User, Loader2 } from 'lucide-react'
import companyLogo from '../assets/company-logo.png'

interface LoginProps {
  onLogin: (username: string) => void
}

function ParticleBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-cyan-400/20 animate-particle"
          style={{
            width: `${Math.random() * 10 + 5}px`,
            height: `${Math.random() * 10 + 5}px`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${Math.random() * 10 + 10}s`,
          }}
        />
      ))}
      
      {[...Array(6)].map((_, i) => (
        <div
          key={`orb-${i}`}
          className="absolute rounded-full animate-float-slow"
          style={{
            width: `${Math.random() * 300 + 200}px`,
            height: `${Math.random() * 300 + 200}px`,
            background: `radial-gradient(circle, ${i % 2 === 0 ? 'rgba(6, 182, 212, 0.1)' : 'rgba(59, 130, 246, 0.08)'} 0%, transparent 70%)`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${i * 2}s`,
            filter: 'blur(40px)',
          }}
        />
      ))}
      
      <div 
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animationDelay: '1.5s',
        }}
      />
      
      <div className="absolute inset-0">
        <svg className="w-full h-full opacity-10">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
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
        <ParticleBackground />
        
        <div className="text-center animate-fade-in relative z-10">
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-3xl bg-cyan-500/30 rounded-full animate-pulse-glow scale-150"></div>
            <div className="absolute -inset-8 border border-cyan-400/20 rounded-full animate-orbit opacity-50" style={{ animationDuration: '10s' }}></div>
            <div className="absolute -inset-16 border border-blue-400/10 rounded-full animate-orbit opacity-30" style={{ animationDuration: '15s', animationDirection: 'reverse' }}></div>
            <img 
              src={companyLogo} 
              alt="InfinityWork IT Solutions" 
              className={`w-64 h-64 object-contain relative z-10 transition-all duration-700 ${logoLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
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
      <ParticleBackground />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 blur-2xl bg-cyan-500/20 rounded-full animate-pulse-glow"></div>
            <img 
              src={companyLogo} 
              alt="InfinityWork IT Solutions" 
              className="w-28 h-28 object-contain mx-auto mb-4 relative z-10 drop-shadow-2xl"
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

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-gray-400 text-sm">
              Default credentials: <span className="text-cyan-400 font-medium">admin</span> / <span className="text-cyan-400 font-medium">admin123</span>
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

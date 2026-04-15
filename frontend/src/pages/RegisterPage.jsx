import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    first_name: '', last_name: '', role: 'USER',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { confirmPassword, ...payload } = form
      await register(payload)
      navigate('/')
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msg = Object.values(data).flat().join(' ')
        setError(msg || 'Registration failed.')
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="auth-card w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-0.5">Create an account</h2>
        <p className="text-slate-400 text-sm mb-4">Join GIS MineClaim Zimbabwe</p>

        {error && <div className="auth-error mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="auth-label">First Name</label>
              <input type="text" className="auth-input" placeholder="Tatenda"
                value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="auth-label">Last Name</label>
              <input type="text" className="auth-input" placeholder="Moyo"
                value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="auth-label">Username</label>
              <input type="text" className="auth-input" placeholder="tmoyo"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
          </div>

          <div>
            <label className="auth-label">Email</label>
            <input type="email" className="auth-input" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="auth-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input pr-9"
                  placeholder="Min. 8 chars"
                  value={form.password}
                  minLength={8}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="auth-label">Confirm</label>
              <input type="password" className="auth-input" placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
            </div>
          </div>

          <button type="submit" className="auth-btn !mt-4" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-3">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

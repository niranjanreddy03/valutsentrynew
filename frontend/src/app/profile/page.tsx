'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { Button, Card, Input } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  User,
  Mail,
  Building,
  Calendar,
  Save,
  Camera,
  Shield,
  Key,
} from 'lucide-react'

export default function ProfilePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const { user, supabaseUser } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    company: '',
    role: '',
  })

  useEffect(() => {
    // Use supabaseUser as fallback when user profile doesn't exist in DB
    const email = user?.email || supabaseUser?.email || ''
    const fullName = user?.full_name || supabaseUser?.user_metadata?.full_name || ''
    const role = user?.role || 'user'
    
    setProfile({
      fullName,
      email,
      company: '',
      role,
    })
  }, [user, supabaseUser])

  const handleSave = async () => {
    setSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    toast.success('Profile updated successfully')
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header alertCount={0} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Profile
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Manage your account information and preferences
              </p>
            </div>

            {/* Profile Card */}
            <Card className="mb-6">
              <div className="p-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6 mb-8 pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="relative">
                    <div 
                      className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
                      style={{ background: 'var(--accent-primary)', color: 'white' }}
                    >
                      {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <button 
                      className="absolute bottom-0 right-0 p-2 rounded-full shadow-lg"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                    >
                      <Camera className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {profile.fullName || 'User'}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {profile.email}
                    </p>
                    <span 
                      className="inline-block mt-2 px-2 py-1 text-xs rounded-full capitalize"
                      style={{ background: 'var(--accent-primary)', color: 'white', opacity: 0.9 }}
                    >
                      {profile.role}
                    </span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      <User className="w-4 h-4 inline mr-2" />
                      Full Name
                    </label>
                    <Input
                      value={profile.fullName}
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      placeholder="Enter your email"
                      disabled
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Email cannot be changed
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      <Building className="w-4 h-4 inline mr-2" />
                      Company
                    </label>
                    <Input
                      value={profile.company}
                      onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                      placeholder="Enter your company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      <Shield className="w-4 h-4 inline mr-2" />
                      Role
                    </label>
                    <Input
                      value={profile.role}
                      disabled
                      placeholder="Your role"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Contact admin to change role
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="mt-8 pt-6 border-t flex justify-end" style={{ borderColor: 'var(--border-color)' }}>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className="p-4 cursor-pointer transition-all hover:shadow-lg rounded-lg"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                onClick={() => router.push('/settings')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <Key className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      Security Settings
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Manage password and 2FA
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className="p-4 cursor-pointer transition-all hover:shadow-lg rounded-lg"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                onClick={() => router.push('/settings')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <Shield className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      Account Settings
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Notifications, integrations & more
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

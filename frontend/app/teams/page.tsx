'use client'

import FeatureGate from '@/components/FeatureGate'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Modal, Skeleton } from '@/components/ui'
import { getAuthHeaders } from '@/lib/authHeaders'
import { useToast } from '@/contexts/ToastContext'
import {
  inviteMember,
  InviteValidationError,
  getLocalPendingInvites,
  retryLocalPendingInvite,
  type InvitedMember,
} from '@/lib/teamInvites'
import {
    Check,
    ChevronRight,
    Crown,
    Mail,
    MoreVertical,
    Plus,
    Search,
    Shield,
    Trash2,
    UserPlus,
    Users,
    X
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface TeamMember {
  id: number
  team_id: number
  user_id: string
  email: string
  name: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'pending'
  joined_at: string
}

interface Team {
  id: number
  name: string
  description: string
  owner_id: string
  members_count: number
  repositories_count: number
  created_at: string
}

const roleConfig = {
  owner: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Crown, label: 'Owner' },
  admin: { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Shield, label: 'Admin' },
  member: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Users, label: 'Member' },
  viewer: { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Users, label: 'Viewer' },
}

export default function TeamsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviteTeamId, setInviteTeamId] = useState<number | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'teams'>('teams')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const toast = useToast()

  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/teams', { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setTeams(data)
      }
    } catch (err) {
      console.error('[TEAMS] Fetch error:', err)
    }
  }, [])

  const mergeWithLocalPending = useCallback((teamId: number, backendMembers: TeamMember[]) => {
    const local = getLocalPendingInvites(teamId)
    if (local.length === 0) return backendMembers
    const seen = new Set(backendMembers.map((m) => m.email?.toLowerCase()))
    const extras = local
      .filter((m) => !seen.has(m.email.toLowerCase()))
      .map((m) => ({
        id: m.id as number,
        team_id: m.team_id,
        user_id: m.user_id,
        email: m.email,
        name: m.name,
        role: m.role as TeamMember['role'],
        status: 'pending' as const,
        joined_at: m.joined_at,
      }))
    return [...backendMembers, ...extras]
  }, [])

  const fetchTeamMembers = useCallback(async (teamId: number) => {
    let backendMembers: TeamMember[] = []
    try {
      const response = await fetch(`/api/teams?teamId=${teamId}&action=members`, { headers: getAuthHeaders() })
      if (response.ok) backendMembers = await response.json()
    } catch (err) {
      console.error('[TEAMS] Members fetch error:', err)
    }
    setTeamMembers(mergeWithLocalPending(teamId, backendMembers))

    // Opportunistically retry any local pending invites — if backend is back up,
    // they'll be persisted and removed from localStorage.
    const pending = getLocalPendingInvites(teamId)
    if (pending.length > 0) {
      const teamName = (typeof window !== 'undefined' &&
        (document.title || 'your team')) || 'your team'
      await Promise.all(
        pending.map((p) =>
          retryLocalPendingInvite(p as InvitedMember, teamName).catch(() => false),
        ),
      )
    }
  }, [mergeWithLocalPending])

  useEffect(() => {
    const init = async () => {
      await fetchTeams()
      setLoading(false)
    }
    init()
  }, [fetchTeams])

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id)
    }
  }, [selectedTeam, fetchTeamMembers])

  // All members across teams for "Members" tab
  const allMembers = teamMembers.length > 0 ? teamMembers : members

  const filteredMembers = allMembers.filter(member =>
    member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    setCreating(true)
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: newTeamName, description: newTeamDesc }),
      })
      if (response.ok) {
        const team = await response.json()
        setTeams(prev => [...prev, team])
        setShowCreateTeamModal(false)
        setNewTeamName('')
        setNewTeamDesc('')
        toast.success('Team created!', `${team.name} is ready`)
        // Auto-select the new team
        setSelectedTeam(team)
        setActiveTab('teams')
      } else {
        const err = await response.json()
        toast.error('Failed to create team', err.error)
      }
    } catch {
      toast.error('Failed to create team')
    } finally {
      setCreating(false)
    }
  }

  const handleInvite = async () => {
    const teamId = inviteTeamId || selectedTeam?.id
    if (!teamId) {
      toast.error('Please select a team first')
      return
    }
    const team = teams.find((t) => t.id === teamId)
    const teamName = team?.name || 'your team'

    setInviting(true)
    try {
      const outcome = await inviteMember({
        teamId,
        teamName,
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        existingMembers: teamMembers,
      })

      // Optimistically update the visible member list.
      setTeamMembers((prev) => [
        ...prev,
        {
          id: outcome.member.id as number,
          team_id: outcome.member.team_id,
          user_id: outcome.member.user_id,
          email: outcome.member.email,
          name: outcome.member.name,
          role: outcome.member.role as TeamMember['role'],
          status: outcome.member.status,
          joined_at: outcome.member.joined_at,
        },
      ])

      // Precise toast based on where the member landed + email status.
      if (outcome.memberPersistedOn === 'backend' && outcome.emailSent) {
        toast.success(
          'Invitation sent!',
          `${outcome.member.email} will receive an email to join ${teamName}`,
        )
      } else if (outcome.memberPersistedOn === 'backend' && !outcome.emailSent) {
        toast.warning(
          'Member added',
          `Saved, but the invite email failed: ${outcome.emailError || 'email service unavailable'}`,
        )
      } else if (outcome.memberPersistedOn === 'local' && outcome.emailSent) {
        toast.warning(
          'Added locally · email sent',
          `Backend unreachable (${outcome.backendError || 'offline'}). Will retry automatically.`,
        )
      } else {
        toast.warning(
          'Added locally',
          `Backend unreachable and email failed. Will retry automatically when backend is back.`,
        )
      }

      setShowInviteModal(false)
      setInviteEmail('')
      setInviteName('')
      fetchTeams()
      if (selectedTeam) fetchTeamMembers(selectedTeam.id)
    } catch (err) {
      if (err instanceof InviteValidationError) {
        toast.error('Check your input', err.message)
      } else {
        toast.error(
          'Failed to send invitation',
          err instanceof Error ? err.message : 'Unknown error',
        )
      }
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (member: TeamMember) => {
    if (member.role === 'owner') {
      toast.error('Cannot remove team owner')
      return
    }
    try {
      const response = await fetch(`/api/teams?teamId=${member.team_id}&memberId=${member.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        setTeamMembers(prev => prev.filter(m => m.id !== member.id))
        toast.success('Member removed')
        fetchTeams()
      }
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const handleDeleteTeam = async (teamId: number) => {
    try {
      const response = await fetch(`/api/teams?teamId=${teamId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        setTeams(prev => prev.filter(t => t.id !== teamId))
        if (selectedTeam?.id === teamId) {
          setSelectedTeam(null)
          setTeamMembers([])
        }
        toast.success('Team deleted')
      }
    } catch {
      toast.error('Failed to delete team')
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 3600000) return 'Just now'
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}d ago`
    return date.toLocaleDateString()
  }

  const openInviteForTeam = (team: Team) => {
    setInviteTeamId(team.id)
    setSelectedTeam(team)
    setShowInviteModal(true)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} alertCount={0} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
            <FeatureGate
              feature="team_management"
              title="Team management is a Premium Plus feature"
              description="Invite teammates, assign roles, and collaborate on secret remediation — all with audit trails."
              perks={[
                'Unlimited team members',
                'Role-based access (admin / developer / viewer)',
                'Email invites with auto-retry',
                'Per-member activity audit log',
              ]}
              requiredTier="premium_plus"
            >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                  <Users className="w-7 h-7 text-blue-400" />
                  Team Management
                </h1>
                <p className="text-[var(--text-muted)] mt-1">Create teams and invite members to collaborate</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCreateTeamModal(true)}
                >
                  New Team
                </Button>
                <Button 
                  variant="primary" 
                  leftIcon={<UserPlus className="w-4 h-4" />}
                  onClick={() => {
                    if (teams.length === 0) {
                      toast.warning('Create a team first', 'You need at least one team to invite members')
                      setShowCreateTeamModal(true)
                    } else {
                      setInviteTeamId(selectedTeam?.id || teams[0]?.id || null)
                      setShowInviteModal(true)
                    }
                  }}
                >
                  Invite Member
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{teams.length}</p>
                    <p className="text-xs text-[var(--text-muted)]">Teams</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{teams.reduce((a, t) => a + t.members_count, 0)}</p>
                    <p className="text-xs text-[var(--text-muted)]">Total Members</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{teamMembers.filter(m => m.status === 'active').length}</p>
                    <p className="text-xs text-[var(--text-muted)]">Active</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{teamMembers.filter(m => m.status === 'pending').length}</p>
                    <p className="text-xs text-[var(--text-muted)]">Pending Invites</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Empty state */}
            {!loading && teams.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No teams yet</h2>
                <p className="text-[var(--text-muted)] max-w-md mx-auto mb-6">
                  Create your first team to start collaborating with your colleagues on security scanning
                </p>
                <Button 
                  variant="primary" 
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCreateTeamModal(true)}
                >
                  Create Your First Team
                </Button>
              </Card>
            ) : (
              <>
                {/* Teams Grid */}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Your Teams</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(team => (
                      <div 
                        key={team.id}
                        onClick={() => {
                          setSelectedTeam(team)
                          setActiveTab('members')
                        }}
                      >
                      <Card 
                        className={`p-5 cursor-pointer transition-all hover:ring-2 hover:ring-blue-500/30 ${selectedTeam?.id === team.id ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-400" />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openInviteForTeam(team) }}
                              className="p-2 rounded-lg hover:bg-blue-500/20 text-[var(--text-muted)] hover:text-blue-400 transition-colors"
                              title="Invite member"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id) }}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                              title="Delete team"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{team.name}</h3>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{team.description || 'No description'}</p>
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border-color)]">
                          <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                            <Users className="w-4 h-4" />
                            {team.members_count} {team.members_count === 1 ? 'member' : 'members'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-blue-400">
                            <ChevronRight className="w-4 h-4" />
                            View
                          </div>
                        </div>
                      </Card>
                      </div>
                    ))}
                    <div onClick={() => setShowCreateTeamModal(true)}>
                    <Card 
                      className="p-5 border-dashed flex items-center justify-center min-h-[180px] cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors"
                    >
                      <div className="text-center">
                        <Plus className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                        <p className="text-[var(--text-muted)]">Create Team</p>
                      </div>
                    </Card>
                    </div>
                  </div>
                </div>

                {/* Selected Team Members */}
                {selectedTeam && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                          {selectedTeam.name} — Members
                        </h2>
                        <Badge variant="info" size="sm">{teamMembers.length}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative max-w-xs">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                          <input
                            type="text"
                            placeholder="Search members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                          />
                        </div>
                        <Button 
                          variant="primary" 
                          size="sm"
                          leftIcon={<UserPlus className="w-4 h-4" />}
                          onClick={() => openInviteForTeam(selectedTeam)}
                        >
                          Invite
                        </Button>
                      </div>
                    </div>

                    <Card>
                      {teamMembers.length === 0 ? (
                        <div className="p-8 text-center">
                          <Mail className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                          <p className="text-[var(--text-secondary)] font-medium">No other members yet</p>
                          <p className="text-sm text-[var(--text-muted)] mt-1">Invite your team to start collaborating</p>
                          <Button 
                            variant="primary"
                            size="sm"
                            className="mt-4"
                            leftIcon={<UserPlus className="w-4 h-4" />}
                            onClick={() => openInviteForTeam(selectedTeam)}
                          >
                            Invite First Member
                          </Button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-[var(--bg-secondary)]">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Member</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Role</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Joined</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)]">
                              {filteredMembers.map(member => {
                                const config = roleConfig[member.role] || roleConfig.member
                                const RoleIcon = config.icon
                                return (
                                  <tr key={member.id} className="hover:bg-[var(--bg-secondary)]/50">
                                    <td className="px-4 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-primary)] font-medium">
                                          {member.name ? member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : member.email[0].toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="font-medium text-[var(--text-primary)]">{member.name || 'Invited'}</p>
                                          <p className="text-sm text-[var(--text-muted)]">{member.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${config.bg} ${config.color}`}>
                                        <RoleIcon className="w-3 h-3" />
                                        {config.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4">
                                      <Badge 
                                        variant={member.status === 'active' ? 'success' : 'warning'}
                                        size="sm"
                                      >
                                        {member.status}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-[var(--text-muted)]">
                                      {formatDate(member.joined_at)}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      {member.role !== 'owner' && (
                                        <button
                                          onClick={() => handleRemoveMember(member)}
                                          className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                                          title="Remove member"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </>
            )}
            </FeatureGate>
          </div>
        </main>
      </div>

      {/* Create Team Modal */}
      <Modal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        title="Create Team"
        description="Create a new team to collaborate with colleagues"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Team Name *</label>
            <input
              type="text"
              placeholder="e.g. Engineering, Security, DevOps"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description</label>
            <input
              type="text"
              placeholder="What does this team do?"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button variant="ghost" onClick={() => setShowCreateTeamModal(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              leftIcon={<Plus className="w-4 h-4" />} 
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create Team'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Member Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Team Member"
        description={inviteTeamId ? `Invite to ${teams.find(t => t.id === inviteTeamId)?.name || 'team'}` : 'Send an invitation to join your team'}
      >
        <div className="space-y-4">
          {/* Team selector if multiple teams */}
          {teams.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Team</label>
              <select
                value={inviteTeamId || ''}
                onChange={(e) => setInviteTeamId(parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Email Address *</label>
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name (optional)</label>
            <input
              type="text"
              placeholder="John Doe"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'member', 'viewer'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setInviteRole(role)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    inviteRole === role
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <p className="font-medium text-[var(--text-primary)] capitalize">{role}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {role === 'admin' ? 'Full access' : role === 'member' ? 'Read & write' : 'Read only'}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              leftIcon={<Mail className="w-4 h-4" />} 
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
            >
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import React, { useState, useMemo } from 'react';
import {
  Bell, Check, CheckCheck, X, Clock, Calendar,
  CheckCircle2, AlertCircle, Train, Shield,
  ArrowRight, ExternalLink, RefreshCw, Trash2, Filter
} from 'lucide-react';

export default function NotificationPanel({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onRefresh,
  isLoading = false
}) {
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'REMINDERS'

  // Filtered list based on active tab
  const filteredNotifications = useMemo(() => {
    if (filterTab === 'UNREAD') {
      return notifications.filter((n) => !n.is_read);
    }
    if (filterTab === 'REMINDERS') {
      return notifications.filter((n) =>
        n.type === 'REMINDER_DAY_BEFORE' ||
        n.type === 'REMINDER_ONE_HOUR_BEFORE' ||
        n.type === 'NOTIFICATION_START_TIME'
      );
    }
    return notifications;
  }, [notifications, filterTab]);

  if (!isOpen) return null;

  // Format relative timestamp
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      const dt = new Date(dateStr);
      const now = new Date();
      const diffMs = now - dt;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return 'Recently';
    }
  };

  // Helper for type styling
  const getTypeBadge = (type) => {
    switch (type) {
      case 'BLOCK_REQUEST_APPROVED':
        return {
          label: 'Request Approved',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600'
        };
      case 'BLOCK_REQUEST_REJECTED':
        return {
          label: 'Request Rejected',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: AlertCircle,
          iconColor: 'text-rose-600'
        };
      case 'REMINDER_DAY_BEFORE':
        return {
          label: 'Day-Before Reminder',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Calendar,
          iconColor: 'text-blue-600'
        };
      case 'REMINDER_ONE_HOUR_BEFORE':
        return {
          label: '1-Hour Alert',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Clock,
          iconColor: 'text-amber-600'
        };
      case 'NOTIFICATION_START_TIME':
        return {
          label: 'Block LIVE',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: Train,
          iconColor: 'text-emerald-700'
        };
      default:
        return {
          label: 'Notification',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Bell,
          iconColor: 'text-slate-600'
        };
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl z-50 flex flex-col border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200">
        
        {/* PANEL HEADER */}
        <div className="p-4 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#1565C0]">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-[#172033] tracking-tight">
                    Notifications & Reminders
                  </h2>
                  {unreadCount > 0 && (
                    <span className="bg-[#DC2626] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Real-time block approvals and scheduled track reminders
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={onRefresh}
                title="Refresh notifications"
                className={`p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer ${
                  isLoading ? 'animate-spin text-[#1565C0]' : ''
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                title="Close panel"
                className="p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* FILTER TABS & BULK ACTIONS */}
          <div className="mt-3.5 pt-3 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1 bg-[#F1F5F9] p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setFilterTab('ALL')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterTab === 'ALL'
                    ? 'bg-white text-[#1565C0] shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilterTab('UNREAD')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterTab === 'UNREAD'
                    ? 'bg-white text-[#1565C0] shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilterTab('REMINDERS')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterTab === 'REMINDERS'
                    ? 'bg-white text-[#1565C0] shadow-2xs font-bold'
                    : 'text-[#64748B] hover:text-[#172033]'
                }`}
              >
                Reminders
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center space-x-1 text-[11px] font-semibold text-[#1565C0] hover:text-[#0D47A1] hover:bg-[#EFF6FF] px-2 py-1 rounded-md border border-transparent hover:border-[#BFDBFE] transition-all cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* NOTIFICATIONS LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC]">
          {filteredNotifications.length === 0 ? (
            /* Empty State */
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 bg-white rounded-xl border border-dashed border-[#CBD5E1]">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#172033] mb-1">
                {filterTab === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-xs text-[#64748B] max-w-xs leading-relaxed">
                {filterTab === 'UNREAD'
                  ? 'You have caught up with all block planning notifications and scheduled reminders.'
                  : 'Approved block schedules, rejection alerts, day-before, and real-time reminders will appear here.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const badge = getTypeBadge(notif.type);
              const BadgeIcon = badge.icon;
              const isUnread = !notif.is_read;

              return (
                <div
                  key={notif.id}
                  className={`relative p-3.5 rounded-xl border transition-all ${
                    isUnread
                      ? 'bg-white border-l-4 border-l-[#1565C0] border-t-[#CBD5E1] border-r-[#CBD5E1] border-b-[#CBD5E1] shadow-2xs'
                      : 'bg-white border-[#E2E8F0] opacity-90 hover:opacity-100'
                  }`}
                >
                  {/* Top Bar: Badge, Timestamp, Mark as read */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-1.5">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                        <BadgeIcon className={`w-3 h-3 ${badge.iconColor}`} />
                        <span>{badge.label}</span>
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#1565C0]" title="Unread" />
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 text-[11px] text-[#7A8494]">
                      <span>{formatTimeAgo(notif.created_at)}</span>
                      {isUnread && (
                        <button
                          onClick={() => onMarkAsRead(notif.id)}
                          title="Mark as read"
                          className="p-1 hover:bg-[#F1F5F9] rounded text-[#64748B] hover:text-[#1565C0] transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Message */}
                  <h4 className={`text-xs font-bold mb-1 ${isUnread ? 'text-[#172033]' : 'text-[#334155]'}`}>
                    {notif.title}
                  </h4>
                  <p className="text-xs text-[#5B6575] leading-relaxed mb-2.5">
                    {notif.message}
                  </p>

                  {/* Metadata Tags / Chips */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {notif.request_id && notif.request_id !== 'N/A' && (
                      <span className="bg-[#F1F5F9] text-[#475569] font-mono px-2 py-0.5 rounded border border-[#E2E8F0]">
                        Req: {notif.request_id}
                      </span>
                    )}

                    {notif.block_id && (
                      <span className="bg-[#EFF6FF] text-[#1565C0] font-mono font-semibold px-2 py-0.5 rounded border border-[#DBEAFE]">
                        Block: {notif.block_id}
                      </span>
                    )}

                    {notif.department && (
                      <span className="bg-[#F8FAFC] text-[#334155] font-medium px-2 py-0.5 rounded border border-[#E2E8F0]">
                        {notif.department}
                      </span>
                    )}

                    {notif.location && notif.location !== 'N/A' && (
                      <span className="bg-[#F8FAFC] text-[#334155] font-medium px-2 py-0.5 rounded border border-[#E2E8F0]">
                        Sec: {notif.location}
                      </span>
                    )}

                    {notif.scheduled_date && (
                      <span className="bg-[#F0FDF4] text-[#166534] font-medium px-2 py-0.5 rounded border border-[#DCFCE7]">
                        {notif.scheduled_date} ({notif.scheduled_time || 'Window'})
                      </span>
                    )}
                  </div>

                  {/* Rejection Reason Callout if Rejected */}
                  {notif.type === 'BLOCK_REQUEST_REJECTED' && notif.rejection_reason && (
                    <div className="mt-2.5 p-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[11px] text-[#991B1B]">
                      <span className="font-bold">Rejection Justification: </span>
                      {notif.rejection_reason}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* PANEL FOOTER */}
        <div className="p-3 bg-white border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
          <span>Centralized Block Planning System</span>
          <span className="font-semibold text-[#1565C0]">SCoR 2026</span>
        </div>
      </div>
    </>
  );
}

/**
 * UI Slice - Manages global UI state
 * Handles notifications, modals, theme, and other UI-level state
 */

import type { StateCreator } from 'zustand';
import type { UINotification } from '../../types';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface UISlice {
  // Notifications
  notifications: UINotification[];

  // Modals
  activeModal: string | null;
  modalData: Record<string, unknown> | null;

  // Theme
  theme: 'light' | 'dark' | 'auto';

  // Sidebar
  sidebarOpen: boolean;

  // Actions - Notifications
  addNotification: (notification: Omit<UINotification, 'id' | 'timestamp' | 'dismissed'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // Actions - Modals
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Actions - Theme
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;

  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

// ============================================================================
// SLICE IMPLEMENTATION
// ============================================================================

export const createUISlice: StateCreator<
  UISlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  // Initial state
  notifications: [],
  activeModal: null,
  modalData: null,
  theme: 'auto',
  sidebarOpen: true,

  // Add notification
  addNotification: (notification) => {
    const { notifications } = get();

    const newNotification: UINotification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      dismissed: false,
    };

    set({
      notifications: [...notifications, newNotification],
    });

    // Auto-dismiss after 5 seconds for success/info notifications
    if (notification.type === 'success' || notification.type === 'info') {
      setTimeout(() => {
        get().dismissNotification(newNotification.id);
      }, 5000);
    }
  },

  // Dismiss notification
  dismissNotification: (id) => {
    const { notifications } = get();

    set({
      notifications: notifications.map(n =>
        n.id === id ? { ...n, dismissed: true } : n
      ),
    });

    // Remove dismissed notification after animation
    setTimeout(() => {
      set({
        notifications: get().notifications.filter(n => n.id !== id),
      });
    }, 300); // 300ms for fade-out animation
  },

  // Clear all notifications
  clearNotifications: () => {
    set({ notifications: [] });
  },

  // Open modal
  openModal: (modalId, data) => {
    set({
      activeModal: modalId,
      modalData: data || null,
    });
  },

  // Close modal
  closeModal: () => {
    set({
      activeModal: null,
      modalData: null,
    });
  },

  // Set theme
  setTheme: (theme) => {
    set({ theme });

    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Auto - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  },

  // Toggle sidebar
  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  // Set sidebar open
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },
});

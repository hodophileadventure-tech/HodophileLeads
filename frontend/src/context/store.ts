import { create } from 'zustand';
import type { Lead, FollowUp, Itinerary, Payment } from '../types';

interface UIState {
  sidebarOpen: boolean;
  darkMode: boolean;
  selectedLead: Lead | null;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setSelectedLead: (lead: Lead | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  darkMode: localStorage.getItem('darkMode') === 'true',
  selectedLead: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleDarkMode: () => set((state) => {
    const newMode = !state.darkMode;
    localStorage.setItem('darkMode', String(newMode));
    return { darkMode: newMode };
  }),
  setSelectedLead: (lead) => set({ selectedLead: lead })
}));

interface DataState {
  leads: Lead[];
  followUps: FollowUp[];
  itineraries: Itinerary[];
  payments: Payment[];
  notifications: any[];
  setLeads: (leads: Lead[]) => void;
  setFollowUps: (followUps: FollowUp[]) => void;
  setItineraries: (itineraries: Itinerary[]) => void;
  setPayments: (payments: Payment[]) => void;
  setNotifications: (items: any[]) => void;
  addLead: (lead: Lead) => void;
  updateLead: (lead: Lead) => void;
}

export const useDataStore = create<DataState>((set) => ({
  leads: [],
  followUps: [],
  itineraries: [],
  payments: [],
  notifications: [],
  setLeads: (leads) => set({ leads }),
  setFollowUps: (followUps) => set({ followUps }),
  setItineraries: (itineraries) => set({ itineraries }),
  setPayments: (payments) => set({ payments }),
  setNotifications: (items) => set({ notifications: items }),
  addLead: (lead) => set((state) => ({ leads: [...state.leads, lead] })),
  updateLead: (lead) => set((state) => ({
    leads: state.leads.map((l) => l.id === lead.id ? lead : l)
  }))
}));

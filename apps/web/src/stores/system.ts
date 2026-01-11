import { create } from 'zustand'
import { Camera, DetectionPayload as DetectionEvent, Event, Rule, CustomModelConfig as CustomModel, Incident } from '@security-system/shared'
import { getMQTTService } from '../services/mqtt'
import { useAuthStore } from './auth'

interface SystemState {
  cameras: Camera[]
  events: Event[]
  detections: DetectionEvent[]
  rules: Rule[]
  customModels: CustomModel[]
  incidents: Incident[]
  systemStatus: {
    cameras: number
    online: number
    offline: number
    alerts: number
    status?: string
  }
  isConnected: boolean
  lastUpdate: Date | null
  mqttConnected: boolean
  frames: Record<string, string>
  logs: Array<{ ts: number; source: 'mqtt' | 'api'; topic?: string; message: string }>
  analyses: Array<{ ts: number; cameraId: string; type: string; severity: 'high' | 'medium' | 'low'; confidence?: number; tags: string[] }>
  
  // Actions
  setCameras: (cameras: Camera[]) => void
  setEvents: (events: Event[]) => void
  setDetections: (detections: DetectionEvent[]) => void
  setRules: (rules: Rule[]) => void
  setCustomModels: (models: CustomModel[]) => void
  setIncidents: (incidents: Incident[]) => void
  setSystemStatus: (status: SystemState['systemStatus']) => void
  setConnectionStatus: (connected: boolean) => void
  setMQTTConnected: (connected: boolean) => void
  setCameraFrame: (cameraId: string, frame: string) => void
  addLog: (entry: { ts: number; source: 'mqtt' | 'api'; topic?: string; message: string }) => void
  addAnalysis: (entry: { ts: number; cameraId: string; type: string; severity: 'high' | 'medium' | 'low'; confidence?: number; tags: string[] }) => void
  addEvent: (event: Event) => void
  addDetection: (detection: DetectionEvent) => void
  addIncident: (incident: Incident) => void
  updateCamera: (cameraId: string, updates: Partial<Camera>) => void
  updateCameraStatus: (cameraId: string, status: 'online' | 'offline') => void
  initializeMQTT: () => Promise<void>
  fetchCameras: () => Promise<void>
  fetchEvents: () => Promise<void>
  fetchSystemStatus: () => Promise<void>
  fetchIncidents: () => Promise<void>
}

export const useSystemStore = create<SystemState>((set, get) => ({
  cameras: [],
  events: [],
  detections: [],
  rules: [],
  customModels: [],
  incidents: [],
  systemStatus: {
    cameras: 0,
    online: 0,
    offline: 0,
    alerts: 0,
    status: 'unknown',
  },
  isConnected: false,
  lastUpdate: null,
  mqttConnected: false,
  frames: {},
  logs: [],
  analyses: [],

  setCameras: (cameras) => set({ cameras, lastUpdate: new Date() }),
  setEvents: (events) => set({ events, lastUpdate: new Date() }),
  setDetections: (detections) => set({ detections, lastUpdate: new Date() }),
  setRules: (rules) => set({ rules, lastUpdate: new Date() }),
  setCustomModels: (customModels) => set({ customModels, lastUpdate: new Date() }),
  setIncidents: (incidents) => set({ incidents, lastUpdate: new Date() }),
  setSystemStatus: (systemStatus) => set({ systemStatus, lastUpdate: new Date() }),
  setConnectionStatus: (isConnected) => set({ isConnected, lastUpdate: new Date() }),
  setMQTTConnected: (mqttConnected) => set({ mqttConnected, lastUpdate: new Date() }),
  setCameraFrame: (cameraId, frame) => set((state) => ({
    frames: { ...state.frames, [cameraId]: frame },
    lastUpdate: new Date(),
  })),
  addLog: (entry) => set((state) => ({ logs: [entry, ...state.logs].slice(0, 200), lastUpdate: new Date() })),
  addAnalysis: (entry) => set((state) => ({ analyses: [entry, ...state.analyses].slice(0, 200), lastUpdate: new Date() })),
  
  addEvent: (event) => set((state) => ({ 
    events: [event, ...state.events].slice(0, 1000), // Keep last 1000 events
    lastUpdate: new Date()
  })),
  
  addDetection: (detection) => set((state) => ({ 
    detections: [detection, ...state.detections].slice(0, 500), // Keep last 500 detections
    lastUpdate: new Date()
  })),
  
  addIncident: (incident) => set((state) => ({ 
    incidents: [incident, ...state.incidents].slice(0, 100), // Keep last 100 incidents
    lastUpdate: new Date()
  })),
  
  updateCamera: (cameraId, updates) => set((state) => ({
    cameras: state.cameras.map(camera => 
      camera.id === cameraId 
        ? { ...camera, ...updates }
        : camera
    ),
    lastUpdate: new Date()
  })),
  
  updateCameraStatus: (cameraId, status) => set((state) => {
    const updated = state.cameras.map((camera) =>
      camera.id === cameraId ? ({ ...(camera as any), status }) : camera
    ) as any[];
    const online = updated.filter((c) => (c as any).status === 'online').length;
    const offline = updated.filter((c) => (c as any).status === 'offline').length;
    return {
      cameras: updated as any,
      systemStatus: { ...state.systemStatus, online, offline },
      lastUpdate: new Date(),
    };
  }),

  initializeMQTT: async () => {
    try {
      const mqtt = getMQTTService();
      if (get().mqttConnected || mqtt.getConnectionStatus()) {
        return;
      }
      
      // Set up MQTT event listeners
      mqtt.on('connected', () => {
        set({ mqttConnected: true });
        get().addLog({ ts: Date.now(), source: 'mqtt', message: 'MQTT connected' });
      });

      mqtt.on('disconnected', () => {
        set({ mqttConnected: false });
        get().addLog({ ts: Date.now(), source: 'mqtt', message: 'MQTT disconnected' });
      });

      mqtt.on('event:new', (event: Event) => {
        get().addEvent(event);
        get().addLog({ ts: Date.now(), source: 'mqtt', topic: 'security/events/new', message: JSON.stringify(event) });
        const severityMap = (s: any) => (s === 'critical' ? 'high' : s === 'warn' ? 'medium' : 'low');
        const type = (event as any).detectionType || (event as any).eventType || 'event';
        const confidence = (event as any).confidence;
        const tags: string[] = [];
        if ((event as any).zones) tags.push(...((event as any).zones as string[]));
        if ((event as any).metadata?.detectionTypes) tags.push(...(event as any).metadata.detectionTypes);
        if ((event as any).cameraId) tags.push(`camera:${(event as any).cameraId}`);
        if ((event as any).tags) tags.push(...((event as any).tags as string[]));
        get().addAnalysis({ ts: Date.now(), cameraId: (event as any).cameraId || 'unknown', type, severity: severityMap((event as any).severity), confidence, tags });
      });

      mqtt.on('event:update', (event: Event) => {
        set((state) => ({
          events: state.events.map(e => e.id === event.id ? event : e)
        }));
        console.log('Event updated via MQTT:', event);
      });

      mqtt.on('incident:new', (incident: Incident) => {
        get().addIncident(incident);
        get().addLog({ ts: Date.now(), source: 'mqtt', topic: 'security/incidents/new', message: JSON.stringify(incident) });
      });

      mqtt.on('incident:update', (incident: Incident) => {
        set((state) => ({
          incidents: state.incidents.map(i => i.id === incident.id ? incident : i)
        }));
        console.log('Incident updated via MQTT:', incident);
      });

      mqtt.on('camera:status', (payload: { cameraId: string; status: 'online' | 'offline'; timestamp: number }) => {
        get().updateCameraStatus(payload.cameraId, payload.status);
        get().addLog({ ts: Date.now(), source: 'mqtt', topic: 'security/cameras/status', message: JSON.stringify(payload) });
      });

      mqtt.on('camera:frame', (payload: { cameraId: string; frame: string; timestamp: number }) => {
        get().setCameraFrame(payload.cameraId, payload.frame)
        get().addLog({ ts: Date.now(), source: 'mqtt', topic: 'security/cameras/frames', message: payload.cameraId })
      });

      mqtt.on('rules:change', () => {
        // Trigger rules refresh
        console.log('Rules changed via MQTT');
      });

      mqtt.on('models:change', () => {
        // Trigger models refresh
        console.log('Models changed via MQTT');
      });

      mqtt.on('system:status', (payload: any) => {
        console.log('System status update via MQTT:', payload);
      });

      mqtt.on('alert:notification', (payload: { title: string; message: string; severity: 'low' | 'medium' | 'high' }) => {
        // Handle browser notifications
        if (Notification.permission === 'granted') {
          new Notification(payload.title, {
            body: payload.message,
            icon: '/favicon.ico'
          });
        }
        console.log('Alert notification via MQTT:', payload);
      });

      console.log('MQTT listeners set up successfully');

      await mqtt.connect();
      console.log('MQTT connection established');
    } catch (error) {
      console.error('Failed to initialize MQTT in store:', error);
    }
  },

  fetchCameras: async () => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch('/api/cameras', {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) throw new Error('Failed to fetch cameras')
      const apiCameras: any[] = await res.json()
      const mapped: any[] = apiCameras.map((c) => ({
        ...c,
        status: c.enabled ? 'online' : 'offline',
      }))
      set({ cameras: mapped as any, lastUpdate: new Date() })
    } catch (e) {
      console.error('fetchCameras error', e)
    }
  },

  fetchEvents: async () => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch('/api/events?limit=100', {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) throw new Error('Failed to fetch events')
      const apiEvents: any[] = await res.json()
      const mapSeverity = (s: string) => (s === 'critical' ? 'high' : s === 'warn' ? 'medium' : 'low')
      const mapped: any[] = apiEvents.map((e) => ({
        id: e.id,
        type: e.event_type,
        severity: mapSeverity(e.severity),
        cameraName: e.camera_name,
        timestamp: e.ts,
        payload_json: e.payload_json,
      }))
      set({ events: mapped as any, lastUpdate: new Date() })
    } catch (e) {
      console.error('fetchEvents error', e)
    }
  },

  fetchSystemStatus: async () => {
    try {
      const res = await fetch('/health')
      const health = (await res.json()) as { status: string }
      const state = get()
      get().addLog({ ts: Date.now(), source: 'api', message: 'Fetched /health' })
      set({
        systemStatus: {
          cameras: state.cameras.length,
          online: state.cameras.filter((c: any) => c.status === 'online').length,
          offline: state.cameras.filter((c: any) => c.status === 'offline').length,
          alerts: state.events.filter((e: any) => e.severity === 'high').length,
          status: health.status,
        },
        lastUpdate: new Date(),
      })
    } catch (e) {
      console.error('fetchSystemStatus error', e)
    }
  },

  fetchIncidents: async () => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch('/api/events/incidents', {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) throw new Error('Failed to fetch incidents')
      const incidents: any[] = await res.json()
      set({ incidents: incidents as any, lastUpdate: new Date() })
      get().addLog({ ts: Date.now(), source: 'api', message: 'Fetched incidents' })
    } catch (e) {
      console.error('fetchIncidents error', e)
    }
  },
}))

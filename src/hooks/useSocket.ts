import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Strip /api/v1 (or any /api... suffix) to get the bare origin for Socket.IO
const _apiUrl: string = (import.meta as any).env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
const WS_URL = _apiUrl.replace(/\/api.*$/, '');

export type DueAppointment = {
  id: string;
  clientName: string;
  serviceName: string;
  startsAt: string;
  staffName: string;
  price: number;
};

type SocketOptions = {
  token: string | null;
  onAppointmentDue?: (appt: DueAppointment) => void;
  onAppointmentCreated?: (data: unknown) => void;
  onAppointmentUpdated?: (data: unknown) => void;
};

export function useSocket({ token, onAppointmentDue, onAppointmentCreated, onAppointmentUpdated }: SocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef({ onAppointmentDue, onAppointmentCreated, onAppointmentUpdated });

  // Keep handlers ref up to date without re-connecting
  useEffect(() => {
    handlersRef.current = { onAppointmentDue, onAppointmentCreated, onAppointmentUpdated };
  });

  useEffect(() => {
    if (!token) return;

    const socket = io(`${WS_URL}/ws`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('appointment:due', (data: DueAppointment) => {
      handlersRef.current.onAppointmentDue?.(data);
    });
    socket.on('appointment:created', (data: unknown) => {
      handlersRef.current.onAppointmentCreated?.(data);
    });
    socket.on('appointment:updated', (data: unknown) => {
      handlersRef.current.onAppointmentUpdated?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}

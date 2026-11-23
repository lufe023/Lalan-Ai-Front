import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { origenDelServidor, RUTA } from '../services/socket';

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

    /* El espacio /ws del mismo servidor de sockets que el resto de la app:
       misma raíz y misma ruta (/rt). Con la ruta por defecto (/socket.io)
       el servidor no contesta y la consola se llenaba de "WebSocket failed". */
    const socket = io(`${origenDelServidor()}/ws`, {
      path: RUTA,
      // La sesión viaja en la cookie httpOnly; `token` solo dice si hay alguien dentro
      withCredentials: true,
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

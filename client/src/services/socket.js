import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default getSocket;

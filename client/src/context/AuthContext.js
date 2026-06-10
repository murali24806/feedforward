import React, { createContext, useContext, useState, useEffect } from 'react';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('ff_token');
    const storedUser = localStorage.getItem('ff_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const loginUser = (userData, tokenValue) => {
    setUser(userData);
    setToken(tokenValue);
    localStorage.setItem('ff_token', tokenValue);
    localStorage.setItem('ff_user', JSON.stringify(userData));
  };

  const logoutUser = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    disconnectSocket();
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('ff_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logoutUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

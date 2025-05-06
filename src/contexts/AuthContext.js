import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create auth context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Set auth token for all requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  // Verify token on initial load
  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.post('/api/auth/verify', { token });
        
        if (res.data.valid) {
          // Get user profile
          const profileRes = await axios.get('/api/auth/profile');
          setCurrentUser(profileRes.data);
        } else {
          // Token invalid or expired
          setToken('');
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Authentication error:', err);
        setToken('');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, [token]);

  // Register a new user
  const register = async (username, password, publicKey) => {
    try {
      setError('');
      const res = await axios.post('/api/auth/register', {
        username,
        password,
        publicKey
      });

      setToken(res.data.token);
      setCurrentUser(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    }
  };

  // Login user
  const login = async (username, password) => {
    try {
      setError('');
      const res = await axios.post('/api/auth/login', {
        username,
        password
      });

      setToken(res.data.token);
      setCurrentUser(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  // Logout user
  const logout = () => {
    setToken('');
    setCurrentUser(null);
  };

  // Context value
  const value = {
    currentUser,
    token,
    loading,
    error,
    register,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("token", token);
      console.log("Auth token set in axios headers");
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("token");
      console.log("Auth token removed from axios headers");
    }
  }, [token]);

  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.post("/api/auth/verify", { token });

        if (res.data.valid) {
          const profileRes = await axios.get("/api/auth/profile");
          setCurrentUser(profileRes.data);
        } else {
          setToken("");
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Authentication error:", err);
        setToken("");
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, [token]);

  const register = async (username, password, publicKey) => {
    try {
      setError("");
      const res = await axios.post("/api/auth/register", {
        username,
        password,
        publicKey,
      });

      console.log("Registration successful:", res.data);

      const authToken = res.data.token;
      setToken(authToken);

      setCurrentUser({
        username: res.data.username,
      });

      return res.data;
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.response?.data?.message || "Registration failed");
      throw err;
    }
  };

  const login = async (username, password) => {
    try {
      setError("");
      const res = await axios.post("/api/auth/login", {
        username,
        password,
      });

      console.log("Login successful:", res.data);

      const authToken = res.data.token;
      setToken(authToken);

      setCurrentUser({
        username: res.data.username,
      });

      return res.data;
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.message || "Login failed");
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post("/api/auth/logout");
      }
    } catch (err) {
      console.warn("Error during logout:", err);
    } finally {
      setToken("");
      setCurrentUser(null);
    }
  };

  const value = {
    currentUser,
    token,
    loading,
    error,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

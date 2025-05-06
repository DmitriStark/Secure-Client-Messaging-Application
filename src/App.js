import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

// Components
import Header from './components/Header';
import Register from './components/Register';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';
import PrivateRoute from './components/PrivateRoute';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { CryptoProvider } from './contexts/CryptoContext';
import { MessageProvider } from './contexts/MessageContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CryptoProvider>
          <MessageProvider>
            <div className="App d-flex flex-column min-vh-100">
              <Header />
              <Container className="flex-grow-1 py-4">
                <Routes>
                  <Route path="/register" element={<Register />} />
                  <Route path="/login" element={<Login />} />
                  <Route 
                    path="/chat" 
                    element={
                      <PrivateRoute>
                        <ChatRoom />
                      </PrivateRoute>
                    } 
                  />
                  <Route path="/" element={<Navigate to="/login" />} />
                </Routes>
              </Container>
              <footer className="bg-dark text-light py-3 text-center">
                <Container>
                  <p className="mb-0">Secure Messaging Application &copy; {new Date().getFullYear()}</p>
                </Container>
              </footer>
            </div>
          </MessageProvider>
        </CryptoProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
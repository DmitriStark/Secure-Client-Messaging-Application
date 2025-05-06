import React, { useState, useContext } from 'react';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [formError, setFormError] = useState('');
  
  const { login, error: authError } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Form validation
    if (!username || !password) {
      setFormError('Username and password are required');
      return;
    }
    
    try {
      setFormError('');
      setLoggingIn(true);
      
      // Login with the server
      await login(username, password);
      
      // Login successful, navigate to chat
      navigate('/chat');
    } catch (err) {
      setFormError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };
  
  return (
    <div className="d-flex justify-content-center mt-4">
      <Card className="shadow" style={{ maxWidth: '500px', width: '100%' }}>
        <Card.Header className="bg-primary text-white text-center">
          <h2>Login</h2>
        </Card.Header>
        <Card.Body className="p-4">
          {(formError || authError) && (
            <Alert variant="danger">{formError || authError}</Alert>
          )}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loggingIn}
              />
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loggingIn}
              />
            </Form.Group>
            
            <div className="d-grid">
              <Button variant="primary" type="submit" disabled={loggingIn}>
                {loggingIn ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    <span className="ms-2">Logging in...</span>
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
        <Card.Footer className="text-center">
          Don't have an account? <Link to="/register">Register</Link>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default Login;
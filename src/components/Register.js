import React, { useState, useContext, useEffect } from "react";
import { Form, Button, Card, Alert, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "../contexts/AuthContext";
import CryptoContext from "../contexts/CryptoContext";

const Register = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [formError, setFormError] = useState("");

  const { register, error: authError } = useContext(AuthContext);
  const { keyPair, loading: cryptoLoading } = useContext(CryptoContext);

  const navigate = useNavigate();

  useEffect(() => {
    if (formError) setFormError("");
  }, [username, password, confirmPassword, formError]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password || !confirmPassword) {
      setFormError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    if (password.length < 4) {
      setFormError("Password must be at least 4 characters");
      return;
    }

    if (cryptoLoading || !keyPair) {
      setFormError("Encryption keys are not ready yet. Please wait a moment.");
      return;
    }

    try {
      setFormError("");
      setRegistering(true);

      const result = await register(username, password, keyPair.publicKey);

      console.log("Registration successful, navigating to chat...", result);

      setTimeout(() => {
        navigate("/chat");
      }, 500);
    } catch (err) {
      console.error("Registration error:", err);
      setFormError(
        err.response?.data?.message ||
          "Registration failed: " + (err.message || "Unknown error")
      );
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="d-flex justify-content-center mt-4">
      <Card className="shadow" style={{ maxWidth: "500px", width: "100%" }}>
        <Card.Header className="bg-primary text-white text-center">
          <h2>Register</h2>
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
                disabled={registering}
              />
              <Form.Text className="text-muted">
                Username must be 3-30 characters and contain only letters,
                numbers, and underscores.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={registering}
              />
              <Form.Text className="text-muted">
                Password must be at least 4 characters.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={registering}
              />
            </Form.Group>

            {cryptoLoading && (
              <Alert variant="info">
                <Spinner animation="border" size="sm" className="me-2" />
                Setting up encryption keys...
              </Alert>
            )}

            <div className="d-grid">
              <Button
                variant="primary"
                type="submit"
                disabled={registering || cryptoLoading}
              >
                {registering ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                    />
                    <span className="ms-2">Registering...</span>
                  </>
                ) : (
                  "Register"
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
        <Card.Footer className="text-center">
          Already have an account? <Link to="/login">Login</Link>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default Register;

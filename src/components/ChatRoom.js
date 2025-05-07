import React, { useState, useContext, useRef } from "react";
import {
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  ListGroup,
  Badge,
} from "react-bootstrap";
import AuthContext from "../contexts/AuthContext";
import MessageContext from "../contexts/MessageContext";
import CryptoContext from "../contexts/CryptoContext";

const ChatRoom = () => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [decrypting, setDecrypting] = useState({});

  const messagesEndRef = useRef(null);

  const { currentUser } = useContext(AuthContext);
  const {
    messages,
    loading,
    error,
    sendMessage,
    getDecryptedContent,
    tryDecryptMessage,
  } = useContext(MessageContext);
  const { keyPair, loading: cryptoLoading } = useContext(CryptoContext);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      setFormError("Message cannot be empty");
      return;
    }

    if (cryptoLoading || !keyPair) {
      setFormError("Encryption keys are not ready yet. Please wait a moment.");
      return;
    }

    try {
      setSending(true);
      setFormError("");

      await sendMessage(message);

      setMessage("");
    } catch (err) {
      setFormError("Failed to send message");
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleDecrypt = async (messageId) => {
    setDecrypting((prev) => ({ ...prev, [messageId]: true }));

    try {
      const success = await tryDecryptMessage(messageId);
      if (!success) {
        setFormError(
          `Could not decrypt message ${messageId}. Key not available.`
        );
      }
    } catch (err) {
      console.error("Decryption error:", err);
      setFormError(`Error decrypting message: ${err.message}`);
    } finally {
      setDecrypting((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  return (
    <div className="chat-container">
      <Card className="shadow h-100">
        <Card.Header className="bg-primary text-white">
          <h3 className="mb-0">Secure Chat Room</h3>
          <small>End-to-end encrypted messaging</small>
        </Card.Header>

        <div
          className="chat-messages overflow-auto p-3"
          style={{ height: "60vh" }}
        >
          {loading ? (
            <div className="d-flex justify-content-center align-items-center h-100">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted mt-5">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <ListGroup variant="flush">
              {messages.map((msg) => {
                const decryptedContent = getDecryptedContent(msg._id);
                const isSender = msg.sender === currentUser?.username;
                const isDecrypting = decrypting[msg._id];

                return (
                  <ListGroup.Item
                    key={msg._id}
                    className={`border-0 rounded p-3 mb-2 ${
                      isSender
                        ? "bg-primary text-white align-self-end"
                        : "bg-light"
                    }`}
                    style={{
                      maxWidth: "75%",
                      marginLeft: isSender ? "auto" : "0",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <strong>{msg.sender}</strong>
                      <small>{formatTimestamp(msg.timestamp)}</small>
                    </div>

                    {decryptedContent ? (
                      <>
                        <p className="mb-0">{decryptedContent}</p>
                        <small className="text-success">
                          <i className="bi bi-lock"></i> End-to-end encrypted
                        </small>
                      </>
                    ) : (
                      <>
                        <p className="mb-0 text-muted">
                          <Badge
                            bg={isSender ? "light" : "warning"}
                            className="me-2"
                            text={isSender ? "dark" : "dark"}
                          >
                            <i className="bi bi-lock"></i> Encrypted
                          </Badge>
                          {isSender
                            ? "Message encrypted. Key available."
                            : "Encrypted message. Decryption needed."}
                        </p>

                        {!isSender && (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="mt-2"
                            onClick={() => handleDecrypt(msg._id)}
                            disabled={isDecrypting}
                          >
                            {isDecrypting ? (
                              <>
                                <Spinner
                                  animation="border"
                                  size="sm"
                                  className="me-1"
                                />
                                Decrypting...
                              </>
                            ) : (
                              <>Decrypt Message</>
                            )}
                          </Button>
                        )}
                      </>
                    )}

                    {/* Message ID for debugging */}
                    <div className="mt-1">
                      <small className="text-muted">
                        ID: {msg._id?.substring(0, 8)}...
                      </small>
                    </div>
                  </ListGroup.Item>
                );
              })}
              <div ref={messagesEndRef} />
            </ListGroup>
          )}
        </div>

        <Card.Footer className="bg-white">
          {(formError || error) && (
            <Alert variant="danger" className="mb-3">
              {formError || error}
            </Alert>
          )}

          <Form onSubmit={handleSendMessage}>
            <div className="d-flex">
              <Form.Control
                type="text"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending || loading || cryptoLoading}
              />
              <Button
                variant="primary"
                type="submit"
                className="ms-2"
                disabled={sending || loading || cryptoLoading}
              >
                {sending ? <Spinner animation="border" size="sm" /> : "Send"}
              </Button>
            </div>
          </Form>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default ChatRoom;

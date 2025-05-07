import React, { useState, useContext, useEffect, useRef } from "react";
import {
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  ListGroup,
  Badge,
  OverlayTrigger,
  Tooltip,
  Modal,
  Tab,
  Tabs,
} from "react-bootstrap";
import AuthContext from "../contexts/AuthContext";
import MessageContext from "../contexts/MessageContext";
import CryptoContext from "../contexts/CryptoContext";

const ChatRoom = () => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [decrypting, setDecrypting] = useState({});
  const [showKeyManagement, setShowKeyManagement] = useState(false);
  const [showMessageKeyImport, setShowMessageKeyImport] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [importedKey, setImportedKey] = useState("");
  const [keyToExport, setKeyToExport] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedKeyVersion, setSelectedKeyVersion] = useState("");
  const [importedSharedKey, setImportedSharedKey] = useState("");

  const messagesEndRef = useRef(null);
  const keyExportRef = useRef(null);
  const importKeyRef = useRef(null);

  const { currentUser } = useContext(AuthContext);
  const {
    messages,
    decryptedMessages,
    loading,
    error,
    sendMessage,
    getDecryptedContent,
    tryDecryptMessage,
    clearAllErrors,
    exportMessageKey,
    importMessageKey,
  } = useContext(MessageContext);
  const {
    keyPair,
    loading: cryptoLoading,
    generateNewKeyPair,
    clearAllKeys,
    getUserKeyVersions,
    exportKeyForSharing,
    importSharedKey,
    backupAllKeys,
    restoreKeysFromBackup,
  } = useContext(CryptoContext);

  // Get key versions for the current user
  const keyVersions = currentUser
    ? getUserKeyVersions(currentUser?.username)
    : [];

  // Calculate message stats
  const totalMessages = messages.length;
  const decryptedCount = Object.keys(decryptedMessages).length;
  const undecryptableCount = totalMessages - decryptedCount;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [messages]);

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      clearAllErrors();
    };
  }, [clearAllErrors]);

  // Format timestamp
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

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).format(date);
  };

  // Handle sending message
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

      // Clear message input after sending
      setMessage("");
    } catch (err) {
      setFormError("Failed to send message");
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  // Handle message decryption
  const handleDecrypt = async (messageId) => {
    setDecrypting((prev) => ({ ...prev, [messageId]: true }));

    try {
      const success = await tryDecryptMessage(messageId);
      if (!success) {
        setFormError(`Could not decrypt message. No compatible key found.`);
      }
    } catch (err) {
      console.error("Decryption error:", err);
      setFormError(`Error decrypting message: ${err.message}`);
    } finally {
      setDecrypting((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  // Generate new key pair
  const handleGenerateNewKey = async () => {
    try {
      await generateNewKeyPair(currentUser.username);
      setFormError("");
      alert(
        "New encryption keys generated successfully. New messages will use these keys."
      );
    } catch (err) {
      console.error("Error generating new keys:", err);
      setFormError("Failed to generate new keys");
    }
  };

  // Clear all keys (for debugging)
  const handleClearAllKeys = () => {
    if (
      window.confirm(
        "WARNING: This will delete all encryption keys. You will not be able to decrypt any messages. Are you sure?"
      )
    ) {
      clearAllKeys();
      setFormError("");
      alert(
        "All keys have been cleared. You will need to log out and back in to generate new keys."
      );
    }
  };

  // Export a specific key for sharing
  const handleExportKey = (versionId) => {
    try {
      const exportedKey = exportKeyForSharing(versionId);
      setKeyToExport(exportedKey);
      setSelectedKeyVersion(versionId);
      setShowShareModal(true);

      // Select the text for easy copying when modal opens
      setTimeout(() => {
        if (keyExportRef.current) {
          keyExportRef.current.select();
        }
      }, 100);
    } catch (err) {
      setFormError(`Error exporting key: ${err.message}`);
    }
  };

  // Import a shared key
  const handleImportSharedKey = async () => {
    if (!importedSharedKey) {
      setFormError("Please paste a key to import");
      return;
    }

    try {
      const importedId = await importSharedKey(importedSharedKey);
      alert(`Key imported successfully! Version ID: ${importedId}`);
      setImportedSharedKey("");
      setShowShareModal(false);
    } catch (err) {
      setFormError(`Error importing key: ${err.message}`);
    }
  };

  // Backup all keys
  const handleBackupKeys = async () => {
    try {
      await backupAllKeys();
      alert(
        "Keys backed up successfully! A file has been downloaded to your device."
      );
    } catch (err) {
      setFormError(`Error backing up keys: ${err.message}`);
    }
  };

  // Restore keys from backup
  const handleRestoreBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const contents = event.target.result;
          const success = await restoreKeysFromBackup(contents);

          if (success) {
            alert("Keys restored successfully! Please refresh the page.");
            window.location.reload();
          }
        } catch (err) {
          setFormError(`Error restoring backup: ${err.message}`);
        }
      };

      reader.readAsText(file);
    } catch (err) {
      setFormError(`Error reading backup file: ${err.message}`);
    }
  };

  // Export message key for sharing
  const handleExportMessageKey = (messageId) => {
    try {
      const exportedKey = exportMessageKey(messageId);
      setSelectedMessageId(messageId);
      setKeyToExport(exportedKey);
      setShowMessageKeyImport(true);

      // Select the text for easy copying when modal opens
      setTimeout(() => {
        if (keyExportRef.current) {
          keyExportRef.current.select();
        }
      }, 100);
    } catch (err) {
      setFormError(`Error exporting message key: ${err.message}`);
    }
  };

  // Import a message key
  const handleImportMessageKey = async () => {
    if (!importedKey) {
      setFormError("Please paste a key to import");
      return;
    }

    try {
      const success = await importMessageKey(importedKey, selectedMessageId);

      if (success) {
        alert(
          "Message key imported successfully! The message has been decrypted."
        );
        setImportedKey("");
        setShowMessageKeyImport(false);
      } else {
        setFormError("The provided key could not decrypt this message.");
      }
    } catch (err) {
      setFormError(`Error importing message key: ${err.message}`);
    }
  };

  // Show import message key modal
  const openImportMessageKey = (messageId) => {
    setSelectedMessageId(messageId);
    setImportedKey("");
    setShowMessageKeyImport(true);

    // Focus on input when modal opens
    setTimeout(() => {
      if (importKeyRef.current) {
        importKeyRef.current.focus();
      }
    }, 100);
  };

  // Render encryption status badge with tooltip
  const renderEncryptionStatus = (isDecrypted, isSender, messageId) => {
    if (isDecrypted) {
      return (
        <div className="d-flex align-items-center">
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>This message is decrypted and readable</Tooltip>}
          >
            <Badge bg="success" className="me-2">
              <i className="bi bi-unlock"></i> Decrypted
            </Badge>
          </OverlayTrigger>

          {isSender && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>Share the key for this message</Tooltip>}
            >
              <Button
                size="sm"
                variant="outline-primary"
                className="ms-2 p-1"
                onClick={() => handleExportMessageKey(messageId)}
              >
                <i className="bi bi-key-fill"></i> Share Key
              </Button>
            </OverlayTrigger>
          )}
        </div>
      );
    } else if (isSender) {
      return (
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip>You sent this encrypted message</Tooltip>}
        >
          <Badge bg="primary" className="me-2">
            <i className="bi bi-lock"></i> Encrypted (Sent by you)
          </Badge>
        </OverlayTrigger>
      );
    } else {
      return (
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip>This message was encrypted with a different key</Tooltip>
          }
        >
          <Badge bg="warning" text="dark" className="me-2">
            <i className="bi bi-lock"></i> Encrypted (Try decrypt)
          </Badge>
        </OverlayTrigger>
      );
    }
  };

  return (
    <div className="chat-container">
      <Card className="shadow h-100">
        <Card.Header className="bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h3 className="mb-0">Secure Chat Room</h3>
              <small>End-to-end encrypted messaging</small>
            </div>
            <div className="d-flex align-items-center">
              <OverlayTrigger
                placement="left"
                overlay={<Tooltip>Message status statistics</Tooltip>}
              >
                <div className="text-end me-3">
                  <small className="d-block">
                    Total messages: {totalMessages}
                  </small>
                  <small className="d-block">Decrypted: {decryptedCount}</small>
                  {undecryptableCount > 0 && (
                    <small className="d-block">
                      Encrypted: {undecryptableCount}
                    </small>
                  )}
                </div>
              </OverlayTrigger>

              <Button
                variant="outline-light"
                size="sm"
                onClick={() => setShowKeyManagement(true)}
              >
                <i className="bi bi-key-fill me-1"></i> Keys & Sharing
              </Button>
            </div>
          </div>
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

                    <div className="mb-2">
                      {renderEncryptionStatus(
                        !!decryptedContent,
                        isSender,
                        msg._id
                      )}
                    </div>

                    {decryptedContent ? (
                      <p className="mb-0">{decryptedContent}</p>
                    ) : (
                      <div>
                        <p className="mb-0 text-muted fst-italic">
                          {isSender
                            ? "This message is encrypted. Only recipients with the correct key can read it."
                            : "This encrypted message was sent to you, but you don't have the correct key to decrypt it."}
                        </p>

                        {!isSender && (
                          <div className="mt-2 d-flex">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => handleDecrypt(msg._id)}
                              disabled={isDecrypting}
                              className="me-2"
                            >
                              {isDecrypting ? (
                                <>
                                  <Spinner
                                    animation="border"
                                    size="sm"
                                    className="me-1"
                                  />
                                  Trying all keys...
                                </>
                              ) : (
                                <>Try to decrypt</>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openImportMessageKey(msg._id)}
                            >
                              <i className="bi bi-key"></i> Import key
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

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
            <Alert
              variant="danger"
              className="mb-3"
              dismissible
              onClose={() => setFormError("")}
            >
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

      {/* Key Management Modal */}
      <Modal
        show={showKeyManagement}
        onHide={() => setShowKeyManagement(false)}
        backdrop="static"
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Encryption Key Management</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs defaultActiveKey="keys" className="mb-3">
            <Tab eventKey="keys" title="Your Keys">
              <Alert variant="info">
                <Alert.Heading>How Encryption Keys Work</Alert.Heading>
                <p>
                  Your messages are encrypted with strong end-to-end encryption.
                  Each key can only decrypt messages that were encrypted for
                  that specific key. When you generate a new key, the old key is
                  preserved to decrypt previous messages.
                </p>
              </Alert>

              <h5>Your Current Encryption Keys</h5>
              {keyVersions.length > 0 ? (
                <ListGroup>
                  {keyVersions.map((version) => (
                    <ListGroup.Item key={version.versionId}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>Key ID:</strong>{" "}
                          {version.versionId.substring(0, 10)}...
                          <br />
                          <small>
                            Created: {formatDate(version.createdAt)}
                          </small>
                          {version.isImported && (
                            <Badge bg="info" className="ms-2">
                              Imported
                            </Badge>
                          )}
                        </div>
                        <div>
                          {version.versionId === keyPair?.versionId && (
                            <Badge bg="success" className="me-2">
                              Current
                            </Badge>
                          )}
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleExportKey(version.versionId)}
                          >
                            <i className="bi bi-share"></i> Share
                          </Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <Alert variant="warning">No encryption keys found.</Alert>
              )}

              <div className="d-flex justify-content-between mt-4">
                <Button variant="primary" onClick={handleGenerateNewKey}>
                  <i className="bi bi-plus-circle me-2"></i>
                  Generate New Key
                </Button>

                <Button variant="danger" onClick={handleClearAllKeys}>
                  <i className="bi bi-trash me-2"></i>
                  Clear All Keys
                </Button>
              </div>
            </Tab>

            <Tab eventKey="import" title="Import Keys">
              <Alert variant="info">
                <Alert.Heading>Import Shared Keys</Alert.Heading>
                <p>
                  You can import keys shared by other users to decrypt their
                  messages. Paste the shared key below and click "Import Key".
                </p>
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label>Paste Shared Key</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  placeholder="Paste the shared key here..."
                  value={importedSharedKey}
                  onChange={(e) => setImportedSharedKey(e.target.value)}
                />
              </Form.Group>

              <Button variant="primary" onClick={handleImportSharedKey}>
                <i className="bi bi-key me-2"></i>
                Import Key
              </Button>
            </Tab>

            <Tab eventKey="backup" title="Backup & Restore">
              <Alert variant="info">
                <Alert.Heading>Backup and Restore Your Keys</Alert.Heading>
                <p>
                  It's important to backup your encryption keys regularly. If
                  you lose your keys, you won't be able to decrypt your
                  messages. You can restore your keys from a backup if you need
                  to use them on another device.
                </p>
              </Alert>

              <div className="d-grid gap-3">
                <Button variant="primary" onClick={handleBackupKeys}>
                  <i className="bi bi-download me-2"></i>
                  Backup All Keys
                </Button>

                <Form.Group>
                  <Form.Label>Restore from Backup</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".txt"
                    onChange={handleRestoreBackup}
                  />
                </Form.Group>
              </div>
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowKeyManagement(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Key Export/Share Modal */}
      <Modal
        show={showShareModal}
        onHide={() => setShowShareModal(false)}
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Share Encryption Key</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <Alert.Heading>Important Security Warning</Alert.Heading>
            <p>
              This key allows others to decrypt messages encrypted with this
              key. Only share it with trusted individuals through a secure
              channel. Anyone with this key can read your encrypted messages.
            </p>
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>Key to Share (Copy this text)</Form.Label>
            <Form.Control
              ref={keyExportRef}
              as="textarea"
              rows={6}
              value={keyToExport}
              readOnly
              onClick={(e) => e.target.select()}
            />
          </Form.Group>

          <p className="text-muted small">
            Key ID: {selectedKeyVersion.substring(0, 15)}...
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => {
              if (keyExportRef.current) {
                keyExportRef.current.select();
                document.execCommand("copy");
                alert("Key copied to clipboard!");
              }
            }}
          >
            <i className="bi bi-clipboard me-2"></i>
            Copy to Clipboard
          </Button>
          <Button variant="secondary" onClick={() => setShowShareModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Message Key Import Modal */}
      <Modal
        show={showMessageKeyImport}
        onHide={() => setShowMessageKeyImport(false)}
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {keyToExport ? "Share Message Key" : "Import Message Key"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {keyToExport ? (
            <>
              <Alert variant="info">
                <Alert.Heading>Share This Key</Alert.Heading>
                <p>
                  This key can decrypt only this specific message. Share it with
                  the person who needs to read this message.
                </p>
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label>Message Key (Copy this text)</Form.Label>
                <Form.Control
                  ref={keyExportRef}
                  as="textarea"
                  rows={6}
                  value={keyToExport}
                  readOnly
                  onClick={(e) => e.target.select()}
                />
              </Form.Group>

              <p className="text-muted small">
                Message ID: {selectedMessageId.substring(0, 15)}...
              </p>
            </>
          ) : (
            <>
              <Alert variant="info">
                <Alert.Heading>Import Message Key</Alert.Heading>
                <p>
                  Paste a message key shared with you to decrypt this specific
                  message.
                </p>
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label>Paste Message Key</Form.Label>
                <Form.Control
                  ref={importKeyRef}
                  as="textarea"
                  rows={6}
                  placeholder="Paste the message key here..."
                  value={importedKey}
                  onChange={(e) => setImportedKey(e.target.value)}
                />
              </Form.Group>

              <p className="text-muted small">
                Message ID: {selectedMessageId.substring(0, 15)}...
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {keyToExport ? (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  if (keyExportRef.current) {
                    keyExportRef.current.select();
                    document.execCommand("copy");
                    alert("Key copied to clipboard!");
                  }
                }}
              >
                <i className="bi bi-clipboard me-2"></i>
                Copy to Clipboard
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setKeyToExport("");
                  setShowMessageKeyImport(false);
                }}
              >
                Close
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={handleImportMessageKey}>
                <i className="bi bi-key me-2"></i>
                Import Key
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowMessageKeyImport(false)}
              >
                Close
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ChatRoom;

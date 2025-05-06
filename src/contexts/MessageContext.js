import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import axios from "axios";
import AuthContext from "./AuthContext";
import CryptoContext from "./CryptoContext";

// Create message context
export const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const { currentUser, token } = useContext(AuthContext);
  const {
    keyPair,
    serverPublicKey,
    generateAESKey,
    encryptWithAES,
    decryptWithAES,
    encryptWithRSA,
    decryptWithRSA,
    importAESKey,
  } = useContext(CryptoContext);

  const [messages, setMessages] = useState([]);
  const [decryptedMessages, setDecryptedMessages] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cache for users' public keys
  const [userPublicKeys, setUserPublicKeys] = useState({});

  // Long polling for new messages
  const startPolling = useCallback(async () => {
    if (!currentUser || !token || !keyPair) return;

    try {
      const response = await axios.get("/api/messages/poll");

      // Check if we received a message
      if (response.data.type === "message") {
        const newMessage = response.data.data;

        // Add the new message to the state
        setMessages((prevMessages) => [newMessage, ...prevMessages]);

        // Try to decrypt the message if it's for us
        if (
          newMessage.recipientKeys &&
          newMessage.recipientKeys[currentUser.username]
        ) {
          try {
            // Decrypt the symmetric key
            const encryptedSymKey =
              newMessage.recipientKeys[currentUser.username];
            const symmetricKey = await decryptWithRSA(
              keyPair.privateKey,
              encryptedSymKey
            );

            // Use the symmetric key to decrypt the message
            await decryptMessageContent(newMessage, symmetricKey);
          } catch (error) {
            console.error("Failed to decrypt incoming message:", error);
          }
        }
      }

      // Restart polling
      startPolling();
    } catch (err) {
      console.error("Polling error:", err);

      // Wait a bit before restarting polling on error
      setTimeout(() => {
        startPolling();
      }, 5000);
    }
  }, [currentUser, token, keyPair, decryptWithRSA]);

  // Start polling when user is authenticated
  useEffect(() => {
    if (currentUser && token && keyPair) {
      startPolling();
    }

    return () => {
      // Cleanup logic if needed
    };
  }, [currentUser, token, keyPair, startPolling]);

  // Fetch users' public keys
  const fetchUserPublicKeys = async () => {
    if (!currentUser || !token) return;

    try {
      const response = await axios.get("/api/keys/users");
      const keysMap = {};

      response.data.users.forEach((user) => {
        keysMap[user.username] = user.publicKey;
      });

      setUserPublicKeys(keysMap);
      return keysMap;
    } catch (err) {
      console.error("Error fetching user public keys:", err);
      setError("Failed to fetch user public keys");
      return {};
    }
  };

  // Fetch message history
  const fetchMessages = async () => {
    if (!currentUser || !token) return;

    try {
      setLoading(true);
      setError("");

      // Make sure we have public keys
      const publicKeys = Object.keys(userPublicKeys).length
        ? userPublicKeys
        : await fetchUserPublicKeys();

      const response = await axios.get("/api/messages/history");
      setMessages(response.data.messages);

      // Try to decrypt messages
      for (const message of response.data.messages) {
        if (
          message.recipientKeys &&
          message.recipientKeys[currentUser.username]
        ) {
          try {
            // Decrypt the symmetric key
            const encryptedSymKey = message.recipientKeys[currentUser.username];
            const symmetricKey = await decryptWithRSA(
              keyPair.privateKey,
              encryptedSymKey
            );

            // Use the symmetric key to decrypt the message
            await decryptMessageContent(message, symmetricKey);
          } catch (error) {
            console.error(`Failed to decrypt message ${message._id}:`, error);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to fetch messages");
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages when user logs in
  useEffect(() => {
    if (currentUser && token && keyPair) {
      fetchUserPublicKeys().then(() => fetchMessages());
    } else {
      setMessages([]);
      setDecryptedMessages({});
    }
  }, [currentUser, token, keyPair]);

  // Decrypt message content
  const decryptMessageContent = async (message, keyHex) => {
    try {
      // Import the AES key
      const key = await importAESKey(keyHex);

      // Decrypt the message
      const decryptedContent = await decryptWithAES(
        key,
        message.encryptedContent,
        message.iv
      );

      // Store the decrypted content
      setDecryptedMessages((prev) => ({
        ...prev,
        [message._id]: decryptedContent,
      }));

      return decryptedContent;
    } catch (err) {
      console.error("Error decrypting message:", err);
      return null;
    }
  };

  // Send a new message
 // Modified sendMessage function for MessageContext.js

const sendMessage = async (content) => {
  if (!currentUser || !token || !keyPair || !serverPublicKey) {
    setError("Not authenticated or missing encryption keys");
    return;
  }

  try {
    setLoading(true);
    setError("");

    // Make sure we have public keys for all users
    const publicKeys = Object.keys(userPublicKeys).length
      ? userPublicKeys
      : await fetchUserPublicKeys();

    // Generate a symmetric key for this message
    const { key, keyHex } = await generateAESKey();

    // Encrypt the message content with AES
    const { encryptedContent, iv } = await encryptWithAES(key, content);

    // Encrypt the symmetric key with each recipient's public key
    const recipientKeys = {};

    for (const [username, publicKey] of Object.entries(publicKeys)) {
      recipientKeys[username] = await encryptWithRSA(publicKey, keyHex);
    }

    // Send the encrypted message to the server
    const response = await axios.post("/api/messages/send", {
      encryptedContent,
      iv,
      recipientKeys,
    });

    // Create a new message object with the response data
    const newMessage = {
      _id: response.data.messageId,
      sender: currentUser.username,
      timestamp: new Date().toISOString(),
      encryptedContent,
      iv,
      recipientKeys,
    };

    // Update the messages array with the new message
    setMessages((prevMessages) => [newMessage, ...prevMessages]);

    // Store the decrypted content for our own message
    setDecryptedMessages((prev) => ({
      ...prev,
      [response.data.messageId]: content,
    }));

    // No need to start polling here, as we've already added the message
    // startPolling();

    // Success!
    return response.data;
  } catch (err) {
    console.error("Error sending message:", err);
    setError("Failed to send message");
    throw err;
  } finally {
    setLoading(false);
  }
};
  // Get decrypted message content
  const getDecryptedContent = (messageId) => {
    return decryptedMessages[messageId] || null;
  };

  // Try to decrypt a specific message from the UI
  const tryDecryptMessage = async (messageId) => {
    const message = messages.find((msg) => msg._id === messageId);

    if (
      !message ||
      !message.recipientKeys ||
      !message.recipientKeys[currentUser.username]
    ) {
      return false;
    }

    try {
      // Decrypt the symmetric key
      const encryptedSymKey = message.recipientKeys[currentUser.username];
      const symmetricKey = await decryptWithRSA(
        keyPair.privateKey,
        encryptedSymKey
      );

      // Use the symmetric key to decrypt the message
      const decrypted = await decryptMessageContent(message, symmetricKey);
      return !!decrypted;
    } catch (error) {
      console.error(`Failed to decrypt message ${messageId}:`, error);
      return false;
    }
  };

  // Context value
  const value = {
    messages,
    decryptedMessages,
    loading,
    error,
    fetchMessages,
    sendMessage,
    decryptMessageContent,
    getDecryptedContent,
    tryDecryptMessage,
    fetchUserPublicKeys,
  };

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
};

export default MessageContext;
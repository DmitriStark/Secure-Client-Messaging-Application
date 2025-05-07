import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import axios from "axios";
import AuthContext from "./AuthContext";
import CryptoContext from "./CryptoContext";

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
  const [isPolling, setIsPolling] = useState(false);

  const [userPublicKeys, setUserPublicKeys] = useState({});

  const isMounted = useRef(true);

  const initialDataFetched = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const decryptMessageContent = useCallback(
    async (message, keyHex) => {
      try {
        const key = await importAESKey(keyHex);

        const decryptedContent = await decryptWithAES(
          key,
          message.encryptedContent,
          message.iv
        );

        setDecryptedMessages((prev) => ({
          ...prev,
          [message._id]: decryptedContent,
        }));

        return decryptedContent;
      } catch (err) {
        console.error("Error decrypting message:", err);
        return null;
      }
    },
    [importAESKey, decryptWithAES]
  );

  const fetchUserPublicKeys = useCallback(async () => {
    if (!currentUser || !token) {
      console.log("Cannot fetch public keys: not authenticated");
      return {};
    }

    try {
      console.log(
        "Fetching user public keys with token:",
        token.substring(0, 15) + "..."
      );

      const response = await axios.get("/api/keys/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
  }, [currentUser, token, setError]);

  const fetchMessages = useCallback(async () => {
    if (!currentUser || !token) {
      console.log("Cannot fetch messages: not authenticated");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let publicKeys = userPublicKeys;
      if (Object.keys(publicKeys).length === 0) {
        publicKeys = await fetchUserPublicKeys();
      }

      const response = await axios.get("/api/messages/history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setMessages(response.data.messages || []);

      if (response.data.messages && response.data.messages.length > 0) {
        for (const message of response.data.messages) {
          if (
            message.recipientKeys &&
            message.recipientKeys[currentUser.username]
          ) {
            try {
              const encryptedSymKey =
                message.recipientKeys[currentUser.username];
              const symmetricKey = await decryptWithRSA(
                keyPair.privateKey,
                encryptedSymKey
              );

              await decryptMessageContent(message, symmetricKey);
            } catch (error) {
              console.error(`Failed to decrypt message ${message._id}:`, error);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to fetch messages");
    } finally {
      setLoading(false);
    }
  }, [
    currentUser,
    token,
    userPublicKeys,
    keyPair,
    decryptWithRSA,
    decryptMessageContent,
    fetchUserPublicKeys,
  ]);

  const startPolling = useCallback(async () => {
    if (!currentUser || !token || !keyPair || isPolling || !isMounted.current)
      return;

    try {
      setIsPolling(true);

      const response = await axios.get("/api/messages/poll", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (isMounted.current) {
        setIsPolling(false);
      } else {
        return;
      }

      if (response.data.type === "message") {
        const newMessage = response.data.data;

        setMessages((prevMessages) => [newMessage, ...prevMessages]);

        if (
          newMessage.recipientKeys &&
          newMessage.recipientKeys[currentUser.username]
        ) {
          try {
            const encryptedSymKey =
              newMessage.recipientKeys[currentUser.username];
            const symmetricKey = await decryptWithRSA(
              keyPair.privateKey,
              encryptedSymKey
            );

            await decryptMessageContent(newMessage, symmetricKey);
          } catch (error) {
            console.error("Failed to decrypt incoming message:", error);
          }
        }
      }

      setTimeout(() => {
        if (isMounted.current) {
          startPolling();
        }
      }, 500);
    } catch (err) {
      console.error("Polling error:", err);

      if (isMounted.current) {
        setIsPolling(false);

        setTimeout(() => {
          if (isMounted.current && currentUser && token) {
            startPolling();
          }
        }, 5000);
      }
    }
  }, [
    currentUser,
    token,
    keyPair,
    isPolling,
    decryptWithRSA,
    decryptMessageContent,
  ]);

  useEffect(() => {
    setIsPolling(false);

    if (currentUser && token && keyPair && !isPolling) {
      console.log("Starting message polling...");
      startPolling();
    }

    return () => {
      setIsPolling(false);
    };
  }, [currentUser, token, keyPair, startPolling, isPolling]);

  useEffect(() => {
    if (currentUser && token && keyPair && !initialDataFetched.current) {
      console.log("Authenticated, fetching initial data...");
      initialDataFetched.current = true;
      setTimeout(() => {
        fetchUserPublicKeys().then(() => fetchMessages());
      }, 500);
    } else if (!currentUser || !token || !keyPair) {
      initialDataFetched.current = false;
      setMessages([]);
      setDecryptedMessages({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, token, keyPair]); //had to do here eslint disable rules because other wise infinity message load

  const sendMessage = useCallback(
    async (content) => {
      if (!currentUser || !token || !keyPair || !serverPublicKey) {
        setError("Not authenticated or missing encryption keys");
        return;
      }

      try {
        setLoading(true);
        setError("");

        let publicKeys = userPublicKeys;
        if (Object.keys(publicKeys).length === 0) {
          publicKeys = await fetchUserPublicKeys();
        }

        const { key, keyHex } = await generateAESKey();

        const { encryptedContent, iv } = await encryptWithAES(key, content);

        const recipientKeys = {};

        for (const [username, publicKey] of Object.entries(publicKeys)) {
          recipientKeys[username] = await encryptWithRSA(publicKey, keyHex);
        }

        const response = await axios.post(
          "/api/messages/send",
          {
            encryptedContent,
            iv,
            recipientKeys,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const newMessage = {
          _id: response.data.messageId,
          sender: currentUser.username,
          timestamp: new Date().toISOString(),
          encryptedContent,
          iv,
          recipientKeys,
        };

        setMessages((prevMessages) => [newMessage, ...prevMessages]);

        setDecryptedMessages((prev) => ({
          ...prev,
          [response.data.messageId]: content,
        }));

        return response.data;
      } catch (err) {
        console.error("Error sending message:", err);
        setError("Failed to send message");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      currentUser,
      token,
      keyPair,
      serverPublicKey,
      userPublicKeys,
      fetchUserPublicKeys,
      generateAESKey,
      encryptWithAES,
      encryptWithRSA,
    ]
  );

  const tryDecryptMessage = useCallback(
    async (messageId) => {
      const message = messages.find((msg) => msg._id === messageId);

      if (
        !message ||
        !message.recipientKeys ||
        !message.recipientKeys[currentUser.username]
      ) {
        return false;
      }

      try {
        const encryptedSymKey = message.recipientKeys[currentUser.username];
        const symmetricKey = await decryptWithRSA(
          keyPair.privateKey,
          encryptedSymKey
        );

        const decrypted = await decryptMessageContent(message, symmetricKey);
        return !!decrypted;
      } catch (error) {
        console.error(`Failed to decrypt message ${messageId}:`, error);
        return false;
      }
    },
    [messages, currentUser, keyPair, decryptWithRSA, decryptMessageContent]
  );

  const getDecryptedContent = useCallback(
    (messageId) => {
      return decryptedMessages[messageId] || null;
    },
    [decryptedMessages]
  );

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

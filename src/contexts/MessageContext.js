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
    keyVersions,
    serverPublicKey,
    generateAESKey,
    encryptWithAES,
    decryptWithAES,
    encryptWithRSA,
    decryptWithRSA,
    importAESKey,
    tryDecryptWithAllKeys,
  } = useContext(CryptoContext);

  const [messages, setMessages] = useState([]);
  const [decryptedMessages, setDecryptedMessages] = useState({});
  const [messageKeys, setMessageKeys] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [userPublicKeys, setUserPublicKeys] = useState({});
  const [allUsers, setAllUsers] = useState([]);

  const isMounted = useRef(true);
  const initialDataFetched = useRef(false);
  const pollingTimeoutRef = useRef(null);
  const pollingStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const username = currentUser.username;

    const loadUserDecryptedData = () => {
      try {
        const storedDecryptedMessages = localStorage.getItem(
          `decryptedMessages_${username}`
        );
        if (storedDecryptedMessages) {
          setDecryptedMessages(JSON.parse(storedDecryptedMessages));
          console.log(`Loaded decrypted messages for user ${username}`);
        }

        const storedMessageKeys = localStorage.getItem(
          `messageKeys_${username}`
        );
        if (storedMessageKeys) {
          setMessageKeys(JSON.parse(storedMessageKeys));
          console.log(`Loaded message keys for user ${username}`);
        }
      } catch (err) {
        console.error(
          `Error loading stored decrypted data for user ${username}:`,
          err
        );
      }
    };

    loadUserDecryptedData();
  }, [currentUser]);

  const saveUserDecryptedData = useCallback(
    (decrypted, keys) => {
      if (!currentUser) return;

      const username = currentUser.username;

      if (decrypted) {
        localStorage.setItem(
          `decryptedMessages_${username}`,
          JSON.stringify(decrypted)
        );
      }

      if (keys) {
        localStorage.setItem(`messageKeys_${username}`, JSON.stringify(keys));
      }
    },
    [currentUser]
  );

  const decryptMessageContent = useCallback(
    async (message, keyHex) => {
      try {
        if (keyHex) {
          const key = await importAESKey(keyHex);
          const decryptedContent = await decryptWithAES(
            key,
            message.encryptedContent,
            message.iv
          );

          setDecryptedMessages((prev) => {
            const updated = {
              ...prev,
              [message._id]: decryptedContent,
            };

            if (currentUser) {
              saveUserDecryptedData(updated, null);
            }

            return updated;
          });

          if (keyHex) {
            setMessageKeys((prev) => {
              const updated = {
                ...prev,
                [message._id]: keyHex,
              };

              if (currentUser) {
                saveUserDecryptedData(null, updated);
              }

              return updated;
            });
          }

          return decryptedContent;
        }

        if (decryptedMessages[message._id]) {
          return decryptedMessages[message._id];
        }

        return null;
      } catch (err) {
        console.error(`Error decrypting message ${message._id}:`, err);
        return null;
      }
    },
    [
      importAESKey,
      decryptWithAES,
      decryptedMessages,
      currentUser,
      saveUserDecryptedData,
    ]
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
      const users = [];

      response.data.users.forEach((user) => {
        keysMap[user.username] = user.publicKey;
        users.push(user.username);
      });

      setUserPublicKeys(keysMap);
      setAllUsers(users);
      return keysMap;
    } catch (err) {
      console.error("Error fetching user public keys:", err);
      setError("Failed to fetch user public keys");
      return {};
    }
  }, [currentUser, token]);

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

      const response = await axios.get("/api/messages/all-messages", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const allMessages = response.data.messages || [];
      console.log(`Received ${allMessages.length} messages from server`);
      setMessages(allMessages);

      if (allMessages.length > 0) {
        for (const message of allMessages) {
          if (decryptedMessages[message._id]) {
            console.log(`Message ${message._id} already decrypted, skipping`);
            continue;
          }

          if (
            message.recipientKeys &&
            message.recipientKeys[currentUser.username]
          ) {
            try {
              const encryptedSymKey =
                message.recipientKeys[currentUser.username];

              try {
                const symmetricKey = await decryptWithRSA(
                  keyPair.privateKey,
                  encryptedSymKey
                );

                await decryptMessageContent(message, symmetricKey);
              } catch (error) {
                if (Object.keys(keyVersions).length > 0) {
                  console.log(
                    `Trying to decrypt message ${message._id} with all available keys...`
                  );
                  const symmetricKey = await tryDecryptWithAllKeys(
                    encryptedSymKey,
                    keyVersions
                  );

                  if (symmetricKey) {
                    await decryptMessageContent(message, symmetricKey);
                  }
                }
              }
            } catch (error) {
              console.error(`Could not decrypt message ${message._id}:`, error);
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
    keyVersions,
    decryptWithRSA,
    decryptMessageContent,
    fetchUserPublicKeys,
    tryDecryptWithAllKeys,
    decryptedMessages,
  ]);

  const startPolling = useCallback(async () => {
    if (!currentUser || !token || !keyPair || !isMounted.current) {
      return;
    }

    if (isPolling) {
      return;
    }

    try {
      setIsPolling(true);

      const response = await axios.get("/api/messages/poll", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!isMounted.current) {
        setIsPolling(false);
        return;
      }

      setIsPolling(false);

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

            try {
              const symmetricKey = await decryptWithRSA(
                keyPair.privateKey,
                encryptedSymKey
              );

              await decryptMessageContent(newMessage, symmetricKey);
            } catch (error) {
              if (Object.keys(keyVersions).length > 0) {
                const symmetricKey = await tryDecryptWithAllKeys(
                  encryptedSymKey,
                  keyVersions
                );

                if (symmetricKey) {
                  await decryptMessageContent(newMessage, symmetricKey);
                }
              }
            }
          } catch (error) {
            console.error("Failed to process incoming message:", error);
          }
        }
      }

      pollingTimeoutRef.current = setTimeout(() => {
        if (isMounted.current) {
          startPolling();
        }
      }, 500);
    } catch (err) {
      console.error("Polling error:", err);
      setIsPolling(false);

      pollingTimeoutRef.current = setTimeout(() => {
        if (isMounted.current && currentUser && token) {
          startPolling();
        }
      }, 5000);
    }
  }, [
    currentUser,
    token,
    keyPair,
    keyVersions,
    isPolling,
    decryptWithRSA,
    decryptMessageContent,
    tryDecryptWithAllKeys,
  ]);

  useEffect(() => {
    if (currentUser && token && keyPair && !pollingStartedRef.current) {
      console.log("Starting message polling...");
      pollingStartedRef.current = true;
      startPolling();
    }

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [currentUser, token, keyPair, startPolling]);

  useEffect(() => {
    if (currentUser) {
      pollingStartedRef.current = false;
      initialDataFetched.current = false;
      setDecryptedMessages({});
      setMessageKeys({});
    }
    //TODO MAKE WORK WITHOUT WARNING
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.username]); // had disable here due no time

  useEffect(() => {
    if (currentUser && token && keyPair && !initialDataFetched.current) {
      console.log("Authenticated, fetching initial data...");
      initialDataFetched.current = true;

      const fetchData = async () => {
        await fetchUserPublicKeys();
        await fetchMessages();
      };

      setTimeout(() => {
        fetchData();
      }, 500);
    } else if (!currentUser || !token || !keyPair) {
      initialDataFetched.current = false;
      setMessages([]);
    }
    //TODO MAKE WORK WITHOUT WARNING
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, token, keyPair, fetchUserPublicKeys]); // had disable here due no time

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

        setDecryptedMessages((prev) => {
          const updated = {
            ...prev,
            [response.data.messageId]: content,
          };

          if (currentUser) {
            saveUserDecryptedData(updated, null);
          }

          return updated;
        });

        setMessageKeys((prev) => {
          const updated = {
            ...prev,
            [response.data.messageId]: keyHex,
          };

          if (currentUser) {
            saveUserDecryptedData(null, updated);
          }

          return updated;
        });

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
      saveUserDecryptedData,
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

        try {
          const symmetricKey = await decryptWithRSA(
            keyPair.privateKey,
            encryptedSymKey
          );

          const decrypted = await decryptMessageContent(message, symmetricKey);
          return !!decrypted;
        } catch (error) {
          console.log("Failed with current key, trying all available keys...");

          if (Object.keys(keyVersions).length > 0) {
            const symmetricKey = await tryDecryptWithAllKeys(
              encryptedSymKey,
              keyVersions
            );

            if (symmetricKey) {
              const decrypted = await decryptMessageContent(
                message,
                symmetricKey
              );
              return !!decrypted;
            } else {
              setError(`Cannot decrypt message. No compatible key found.`);
              return false;
            }
          } else {
            setError("No alternative keys available to decrypt message.");
            return false;
          }
        }
      } catch (error) {
        console.error(`Error processing message ${messageId}:`, error);
        return false;
      }
    },
    [
      messages,
      currentUser,
      keyPair,
      keyVersions,
      decryptWithRSA,
      decryptMessageContent,
      tryDecryptWithAllKeys,
    ]
  );

  const getDecryptedContent = useCallback(
    (messageId) => {
      return decryptedMessages[messageId] || null;
    },
    [decryptedMessages]
  );

  const getMessageKey = useCallback(
    (messageId) => {
      return messageKeys[messageId] || null;
    },
    [messageKeys]
  );

  const clearAllErrors = useCallback(() => {
    setError("");
  }, []);

  const exportMessageKey = useCallback(
    (messageId) => {
      const key = messageKeys[messageId];
      if (!key) {
        throw new Error("Message key not found");
      }

      const exportData = {
        messageId,
        key,
        exportedAt: new Date().toISOString(),
      };

      return btoa(JSON.stringify(exportData));
    },
    [messageKeys]
  );

  const importMessageKey = useCallback(
    async (encodedKey, messageId) => {
      try {
        const keyData = JSON.parse(atob(encodedKey));

        if (!keyData.key) {
          throw new Error("Invalid key data");
        }

        const targetMessageId = messageId || keyData.messageId;

        if (!targetMessageId) {
          throw new Error("No message ID provided");
        }

        const message = messages.find((msg) => msg._id === targetMessageId);
        if (!message) {
          throw new Error("Message not found");
        }

        const success = await decryptMessageContent(message, keyData.key);

        if (success) {
          setMessageKeys((prev) => {
            const updated = {
              ...prev,
              [targetMessageId]: keyData.key,
            };

            if (currentUser) {
              saveUserDecryptedData(null, updated);
            }

            return updated;
          });
          return true;
        }

        return false;
      } catch (err) {
        console.error("Error importing message key:", err);
        throw new Error("Failed to import message key: " + err.message);
      }
    },
    [messages, decryptMessageContent, currentUser, saveUserDecryptedData]
  );

  const clearDecryptedMessages = useCallback(() => {
    if (!currentUser) return;

    const username = currentUser.username;
    localStorage.removeItem(`decryptedMessages_${username}`);
    localStorage.removeItem(`messageKeys_${username}`);
    setDecryptedMessages({});
    setMessageKeys({});
  }, [currentUser]);

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
    clearAllErrors,
    allUsers,
    getMessageKey,
    exportMessageKey,
    importMessageKey,
    clearDecryptedMessages,
  };

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
};

export default MessageContext;

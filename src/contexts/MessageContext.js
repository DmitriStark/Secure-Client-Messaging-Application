import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import AuthContext from './AuthContext';
import CryptoContext from './CryptoContext';

// Create message context
export const MessageContext = createContext();

export const MessageProvider = ({ children }) => {
  const { currentUser, token } = useContext(AuthContext);
  const { keyPair, serverPublicKey, generateAESKey, encryptWithAES, decryptWithAES, encryptWithRSA, decryptWithRSA, importAESKey } = useContext(CryptoContext);
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Long polling for new messages
  const startPolling = useCallback(async () => {
    if (!currentUser || !token || !keyPair) return;
    
    try {
      const response = await axios.get('/api/messages/poll');
      
      // Check if we received a message
      if (response.data.type === 'message') {
        const newMessage = response.data.data;
        
        // Add the new message to the state
        setMessages(prevMessages => [newMessage, ...prevMessages]);
      }
      
      // Restart polling
      startPolling();
    } catch (err) {
      console.error('Polling error:', err);
      
      // Wait a bit before restarting polling on error
      setTimeout(() => {
        startPolling();
      }, 5000);
    }
  }, [currentUser, token, keyPair]);
  
  // Start polling when user is authenticated
  useEffect(() => {
    if (currentUser && token && keyPair) {
      startPolling();
    }
    
    return () => {
      // Cleanup logic if needed
    };
  }, [currentUser, token, keyPair, startPolling]);
  
  // Fetch message history
  const fetchMessages = async () => {
    if (!currentUser || !token) return;
    
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get('/api/messages/history');
      setMessages(response.data.messages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch messages when user logs in
  useEffect(() => {
    if (currentUser && token) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [currentUser, token]);
  
  // Send a new message
  const sendMessage = async (content) => {
    if (!currentUser || !token || !keyPair || !serverPublicKey) {
      setError('Not authenticated or missing encryption keys');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Generate a symmetric key for this message
      const { key, keyHex } = await generateAESKey();
      
      // Encrypt the message content with AES
      const { encryptedContent, iv } = await encryptWithAES(key, content);
      
      // Encrypt the symmetric key with the server's public key
      const encryptedKey = await encryptWithRSA(serverPublicKey, keyHex);
      
      // Send the encrypted message to the server
      const response = await axios.post('/api/messages/send', {
        encryptedContent,
        iv,
        recipientKey: encryptedKey
      });
      
      // Success!
      return response.data;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  // Decrypt a message
  const decryptMessage = async (encryptedMessage) => {
    try {
      return {
        ...encryptedMessage,
        content: `Encrypted message from ${encryptedMessage.sender}`
      };
    } catch (err) {
      console.error('Error decrypting message:', err);
      return {
        ...encryptedMessage,
        content: 'Failed to decrypt message'
      };
    }
  };
  
  // Context value
  const value = {
    messages,
    loading,
    error,
    fetchMessages,
    sendMessage,
    decryptMessage
  };
  
  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};

export default MessageContext;
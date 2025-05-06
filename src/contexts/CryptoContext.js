import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from './AuthContext';

// Create crypto context
export const CryptoContext = createContext();

export const CryptoProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const [keyPair, setKeyPair] = useState(null);
  const [serverPublicKey, setServerPublicKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Generate RSA key pair on load
  useEffect(() => {
    const generateKeyPair = async () => {
      try {
        // Check if we have keys in local storage
        const storedKeyPair = localStorage.getItem('keyPair');
        
        if (storedKeyPair) {
          setKeyPair(JSON.parse(storedKeyPair));
        } else {
          // Generate new key pair using SubtleCrypto
          const keyPair = await window.crypto.subtle.generateKey(
            {
              name: 'RSA-OAEP',
              modulusLength: 4096,
              publicExponent: new Uint8Array([1, 0, 1]),
              hash: 'SHA-256'
            },
            true,
            ['encrypt', 'decrypt']
          );
          
          // Export keys to store them
          const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
          const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
          
          const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
          const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKey)));
          
          const exportedKeyPair = {
            publicKey: publicKeyBase64,
            privateKey: privateKeyBase64,
            publicKeyObject: keyPair.publicKey,
            privateKeyObject: keyPair.privateKey
          };
          
          // Store in state and localStorage
          setKeyPair(exportedKeyPair);
          localStorage.setItem('keyPair', JSON.stringify(exportedKeyPair));
        }
      } catch (err) {
        console.error('Error generating key pair:', err);
        setError('Failed to generate encryption keys');
      }
    };
    
    generateKeyPair();
  }, []);

  // Fetch server public key
  useEffect(() => {
    const fetchServerPublicKey = async () => {
      try {
        const res = await axios.get('/api/keys/server-public');
        setServerPublicKey(res.data.publicKey);
      } catch (err) {
        console.error('Error fetching server public key:', err);
        setError('Failed to fetch server public key');
      } finally {
        setLoading(false);
      }
    };
    
    fetchServerPublicKey();
  }, []);

  // Import a PEM key to CryptoKey object
  const importRSAKey = async (pem, isPrivate = false) => {
    try {
      // Remove PEM header and footer and decode base64
      const pemContents = pem
        .replace(/-----BEGIN (PUBLIC|PRIVATE) KEY-----/, '')
        .replace(/-----END (PUBLIC|PRIVATE) KEY-----/, '')
        .replace(/\s/g, '');
      
      const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
      
      return await window.crypto.subtle.importKey(
        isPrivate ? 'pkcs8' : 'spki',
        binaryDer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        false,
        isPrivate ? ['decrypt'] : ['encrypt']
      );
    } catch (err) {
      console.error('Error importing RSA key:', err);
      throw new Error('Failed to import RSA key');
    }
  };

  // Encrypt data with RSA
  const encryptWithRSA = async (publicKeyPem, data) => {
    try {
      const publicKey = await importRSAKey(publicKeyPem);
      
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        publicKey,
        dataBuffer
      );
      
      return btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    } catch (err) {
      console.error('Error encrypting with RSA:', err);
      throw new Error('Failed to encrypt data');
    }
  };

  // Decrypt data with RSA
  const decryptWithRSA = async (privateKeyPem, encryptedData) => {
    try {
      const privateKey = await importRSAKey(privateKeyPem, true);
      
      const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        privateKey,
        encryptedBuffer
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      console.error('Error decrypting with RSA:', err);
      throw new Error('Failed to decrypt data');
    }
  };

  // Generate AES key
  const generateAESKey = async () => {
    try {
      const key = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      const exportedKey = await window.crypto.subtle.exportKey('raw', key);
      const keyHex = Array.from(new Uint8Array(exportedKey))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return { key, keyHex };
    } catch (err) {
      console.error('Error generating AES key:', err);
      throw new Error('Failed to generate AES key');
    }
  };

  // Encrypt message with AES
  const encryptWithAES = async (key, plaintext) => {
    try {
      // Generate random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encode plaintext
      const encoder = new TextEncoder();
      const plaintextBuffer = encoder.encode(plaintext);
      
      // Encrypt
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        key,
        plaintextBuffer
      );
      
      // Convert to hex
      const encryptedHex = Array.from(new Uint8Array(encryptedBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const ivHex = Array.from(iv)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return {
        encryptedContent: encryptedHex,
        iv: ivHex
      };
    } catch (err) {
      console.error('Error encrypting with AES:', err);
      throw new Error('Failed to encrypt message');
    }
  };

  // Decrypt message with AES
  const decryptWithAES = async (key, encryptedContent, iv) => {
    try {
      // Convert hex to buffer
      const encryptedBuffer = new Uint8Array(
        encryptedContent.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );
      
      const ivBuffer = new Uint8Array(
        iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );
      
      // Decrypt
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
          tagLength: 128
        },
        key,
        encryptedBuffer
      );
      
      // Decode plaintext
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      console.error('Error decrypting with AES:', err);
      throw new Error('Failed to decrypt message');
    }
  };

  // Import AES key from hex
  const importAESKey = async (keyHex) => {
    try {
      const keyBuffer = new Uint8Array(
        keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );
      
      return await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (err) {
      console.error('Error importing AES key:', err);
      throw new Error('Failed to import AES key');
    }
  };

  // Context value
  const value = {
    keyPair,
    serverPublicKey,
    loading,
    error,
    encryptWithRSA,
    decryptWithRSA,
    generateAESKey,
    encryptWithAES,
    decryptWithAES,
    importAESKey
  };

  return (
    <CryptoContext.Provider value={value}>
      {children}
    </CryptoContext.Provider>
  );
};

export default CryptoContext;